-- =====================================================================
-- TeamTick — esquema inicial
--
-- Proyectos (grupos de listas) compartidos entre integrantes.
-- Cada proyecto tiene listas y cada lista tiene tareas.
-- Se suman integrantes a través de links de invitación.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (char_length(description) <= 500),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);

create type public.project_role as enum ('owner', 'member');

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_id_idx on public.project_members (user_id);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  -- Lo calcula un trigger al insertar (queda al final del proyecto).
  position integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Permite que tasks referencie (list_id, project_id) y garantice
  -- que una tarea siempre pertenece al mismo proyecto que su lista.
  unique (id, project_id)
);
create index lists_project_id_idx on public.lists (project_id, position);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  list_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 500),
  notes text check (char_length(notes) <= 5000),
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  -- Lo calcula un trigger al insertar o mover (queda al final de la lista).
  position integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, project_id) references public.lists (id, project_id) on delete cascade
);
create index tasks_list_id_idx on public.tasks (list_id, position);
create index tasks_project_id_idx on public.tasks (project_id);

create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  use_count integer not null default 0
);
create index project_invites_project_id_idx on public.project_invites (project_id);

-- ---------------------------------------------------------------------
-- Funciones auxiliares para RLS (security definer para evitar recursión)
-- ---------------------------------------------------------------------

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_project_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = (select auth.uid())
  );
$$;

create or replace function public.shares_project_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Crea el perfil cuando se registra un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      ),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quien crea un proyecto queda como owner.
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Las listas nuevas van al final del proyecto.
create or replace function public.set_list_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(l.position), 0) + 1
    into new.position
    from public.lists l
   where l.project_id = new.project_id;
  return new;
end;
$$;

create trigger lists_set_position
  before insert on public.lists
  for each row execute function public.set_list_position();

-- Las tareas nuevas (o movidas a otra lista) van al final de la lista,
-- y se registra quién y cuándo las completó.
create or replace function public.prepare_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_moved boolean := false;
  v_toggled boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_moved := new.list_id is distinct from old.list_id;
    v_toggled := new.done is distinct from old.done;
  end if;

  if tg_op = 'INSERT' or v_moved then
    select coalesce(max(t.position), 0) + 1
      into new.position
      from public.tasks t
     where t.list_id = new.list_id;
  end if;

  if v_toggled then
    if new.done then
      new.done_at := now();
      new.done_by := (select auth.uid());
    else
      new.done_at := null;
      new.done_by := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_prepare
  before insert or update on public.tasks
  for each row execute function public.prepare_task();

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Mueve una lista una posición a la izquierda (-1) o derecha (1).
-- security invoker: RLS garantiza que solo miembros puedan hacerlo.
create or replace function public.move_list(p_list_id uuid, p_direction integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_ids uuid[];
  v_idx integer;
  v_swap integer;
begin
  select l.project_id into v_project_id from public.lists l where l.id = p_list_id;
  if v_project_id is null then
    raise exception 'Lista no encontrada' using errcode = 'P0002';
  end if;

  select array_agg(l.id order by l.position, l.created_at, l.id)
    into v_ids
    from public.lists l
   where l.project_id = v_project_id;

  v_idx := array_position(v_ids, p_list_id);
  v_swap := v_idx + sign(p_direction)::integer;
  if v_swap < 1 or v_swap > array_length(v_ids, 1) or v_swap = v_idx then
    return;
  end if;

  v_ids[v_idx] := v_ids[v_swap];
  v_ids[v_swap] := p_list_id;

  update public.lists l
     set position = t.ord
    from unnest(v_ids) with ordinality as t(id, ord)
   where l.id = t.id
     and l.position is distinct from t.ord::integer;
end;
$$;

-- Info pública de una invitación (para mostrarla antes de aceptar).
create or replace function public.get_invite(p_token text)
returns table (
  project_id uuid,
  project_name text,
  inviter_name text,
  member_count integer,
  is_valid boolean,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    pr.display_name,
    (select count(*)::integer from public.project_members m where m.project_id = p.id),
    (i.revoked_at is null and i.expires_at > now()),
    exists (
      select 1 from public.project_members m
      where m.project_id = p.id and m.user_id = (select auth.uid())
    )
  from public.project_invites i
  join public.projects p on p.id = i.project_id
  left join public.profiles pr on pr.id = i.created_by
  where i.token = p_token;
$$;

-- Suma al usuario actual al proyecto de la invitación.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.project_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión' using errcode = '28000';
  end if;

  select * into v_invite
    from public.project_invites i
   where i.token = p_token
   for update;

  if not found then
    raise exception 'La invitación no existe' using errcode = 'P0002';
  end if;

  if v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'La invitación expiró o fue revocada' using errcode = 'P0001';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (v_invite.project_id, v_uid, 'member')
  on conflict (project_id, user_id) do nothing;

  if found then
    update public.project_invites
       set use_count = use_count + 1
     where id = v_invite.id;
  end if;

  return v_invite.project_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos
--
-- Supabase ya no otorga permisos automáticos sobre tablas y funciones
-- nuevas, así que se declaran explícitamente (y solo lo necesario).
-- RLS (más abajo) decide además qué filas ve/modifica cada usuario.
-- ---------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.projects,
  public.project_members,
  public.lists,
  public.tasks,
  public.project_invites
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Nadie puede cambiar owner_id.
grant select, insert, delete on public.projects to authenticated;
grant update (name, description) on public.projects to authenticated;

-- Las altas se hacen solo vía trigger / accept_invite().
grant select, delete on public.project_members to authenticated;

grant select, insert, delete on public.lists to authenticated;
grant update (name, position) on public.lists to authenticated;

grant select, insert, delete on public.tasks to authenticated;
grant update (list_id, title, notes, done, assignee_id, due_date) on public.tasks to authenticated;

grant select, insert, delete on public.project_invites to authenticated;
grant update (revoked_at) on public.project_invites to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.shares_project_with(uuid) to authenticated;
grant execute on function public.move_list(uuid, integer) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.lists enable row level security;
alter table public.tasks enable row level security;
alter table public.project_invites enable row level security;

-- profiles: me veo a mí y a quienes comparten proyecto conmigo.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_project_with(id));

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projects
create policy "projects_select" on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_project_member(id));

create policy "projects_insert" on public.projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "projects_update" on public.projects
  for update to authenticated
  using (public.is_project_member(id))
  with check (public.is_project_member(id));

create policy "projects_delete" on public.projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- project_members: las altas se hacen solo vía trigger / accept_invite().
create policy "members_select" on public.project_members
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "members_delete" on public.project_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or public.is_project_owner(project_id))
  );

-- lists
create policy "lists_select" on public.lists
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "lists_insert" on public.lists
  for insert to authenticated
  with check (public.is_project_member(project_id));

create policy "lists_update" on public.lists
  for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "lists_delete" on public.lists
  for delete to authenticated
  using (public.is_project_member(project_id));

-- tasks
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (public.is_project_member(project_id));

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (public.is_project_member(project_id));

-- project_invites
create policy "invites_select" on public.project_invites
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "invites_insert" on public.project_invites
  for insert to authenticated
  with check (
    public.is_project_member(project_id)
    and created_by = (select auth.uid())
  );

create policy "invites_update" on public.project_invites
  for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "invites_delete" on public.project_invites
  for delete to authenticated
  using (public.is_project_member(project_id));

-- ---------------------------------------------------------------------
-- Realtime: los cambios se reflejan en vivo para todos los integrantes.
-- ---------------------------------------------------------------------

alter publication supabase_realtime
  add table public.projects, public.project_members, public.lists, public.tasks;

-- Perfiles para usuarios que ya existieran antes de esta migración.
insert into public.profiles (id, email, display_name)
select
  u.id,
  coalesce(u.email, ''),
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Usuario'
    ),
    60
  )
from auth.users u
on conflict (id) do nothing;
