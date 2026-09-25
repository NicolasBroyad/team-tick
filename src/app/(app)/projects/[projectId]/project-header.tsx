"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  LogOut,
  Settings,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { createInvite, revokeInvite } from "@/app/actions/invites";
import {
  deleteProject,
  leaveProject,
  removeMember,
  updateProject,
} from "@/app/actions/projects";
import { useToast } from "@/components/toast";
import {
  Avatar,
  AvatarStack,
  Button,
  ConfirmDialog,
  IconButton,
  Input,
  Label,
  Modal,
  Textarea,
} from "@/components/ui";
import type { ActionResult, Invite, Member, Project } from "@/lib/types";
import { formatRelativeDays } from "@/lib/utils";

export function ProjectHeader({
  project,
  members,
  invites,
  currentUserId,
}: {
  project: Project;
  members: Member[];
  invites: Invite[];
  currentUserId: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-3.5" /> Proyectos
          </Link>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p className="line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ver integrantes"
            className="mr-1 rounded-full focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <AvatarStack
              people={members.map((m) => ({
                id: m.user_id,
                name: m.profile.display_name,
              }))}
            />
          </button>
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            <UserPlus className="size-4" />
            Invitar
          </Button>
          <IconButton
            label="Ajustes del proyecto"
            onClick={() => setSettingsOpen(true)}
            className="size-10"
          >
            <Settings className="size-5" />
          </IconButton>
        </div>
      </div>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Invitar al proyecto"
        description="Quien abra el link e inicie sesión se suma al proyecto con acceso a todas sus listas."
      >
        <ShareContent projectId={project.id} invites={invites} />
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Ajustes del proyecto"
      >
        <SettingsContent
          project={project}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setSettingsOpen(false)}
        />
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invitaciones
// ---------------------------------------------------------------------------

function ShareContent({
  projectId,
  invites,
}: {
  projectId: string;
  invites: Invite[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createInvite(projectId);
      if (!result.ok) toast(result.error);
    });
  }

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
        <Link2 className="size-8 text-zinc-400" />
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          No hay links de invitación activos.
        </p>
        <Button className="mt-4" onClick={create} loading={pending}>
          Generar link de invitación
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-3">
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Los links vencen a los 7 días.
        </p>
        <Button variant="ghost" size="sm" onClick={create} loading={pending}>
          Generar otro link
        </Button>
      </div>
    </div>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [revoking, startRevoke] = useTransition();
  // Este componente solo se monta con el modal abierto (en el cliente).
  const url = `${window.location.origin}/invite/${invite.token}`;
  const canShare = typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("No se pudo copiar. Seleccioná el link y copialo a mano.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Sumate a mi proyecto en TeamTick", url });
    } catch {
      // El usuario canceló el diálogo de compartir.
    }
  }

  function revoke() {
    startRevoke(async () => {
      const result = await revokeInvite(invite.id);
      if (!result.ok) toast(result.error);
      else toast("Link revocado.", "success");
    });
  }

  return (
    <li className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Link de invitación"
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono sm:text-xs"
        />
        <Button variant="secondary" onClick={copy} className="shrink-0">
          {copied ? (
            <Check className="size-4 text-emerald-600" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        {canShare && (
          <IconButton label="Compartir" onClick={share} className="size-10">
            <Share2 className="size-4" />
          </IconButton>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Vence {formatRelativeDays(invite.expires_at)} · usado{" "}
          {invite.use_count} {invite.use_count === 1 ? "vez" : "veces"}
        </span>
        <button
          type="button"
          onClick={revoke}
          disabled={revoking}
          className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
        >
          {revoking ? "Revocando…" : "Revocar"}
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

function SettingsContent({
  project,
  members,
  currentUserId,
  onClose,
}: {
  project: Project;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const isOwner = project.owner_id === currentUserId;
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, startSave] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"delete" | "leave" | null>(null);
  const [dangerPending, startDanger] = useTransition();

  const dirty =
    name.trim() !== project.name ||
    description.trim() !== (project.description ?? "");

  function save(event: React.FormEvent) {
    event.preventDefault();
    startSave(async () => {
      const result = await updateProject(project.id, { name, description });
      if (!result.ok) toast(result.error);
      else {
        toast("Proyecto actualizado.", "success");
        onClose();
      }
    });
  }

  function remove(member: Member) {
    setRemovingId(member.user_id);
    startSave(async () => {
      const result = await removeMember(project.id, member.user_id);
      setRemovingId(null);
      if (!result.ok) toast(result.error);
      else toast(`${member.profile.display_name} ya no es parte del proyecto.`, "success");
    });
  }

  function runDanger(call: () => Promise<ActionResult>) {
    startDanger(async () => {
      // Si sale bien, la acción redirige al inicio.
      const result = await call();
      if (result && !result.ok) {
        toast(result.error);
        setConfirming(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-3">
        <div>
          <Label htmlFor="settings-name">Nombre</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div>
          <Label htmlFor="settings-description">Descripción</Label>
          <Textarea
            id="settings-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!dirty || !name.trim()} loading={saving && !removingId}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Integrantes ({members.length})
        </h3>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar id={member.user_id} name={member.profile.display_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.profile.display_name}
                  {member.user_id === currentUserId && (
                    <span className="font-normal text-zinc-500"> (vos)</span>
                  )}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {member.profile.email}
                </p>
              </div>
              {member.role === "owner" ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  Dueño
                </span>
              ) : (
                isOwner && (
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => remove(member)}
                    loading={removingId === member.user_id}
                  >
                    Quitar
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-red-200 p-4 dark:border-red-900/60">
        {isOwner ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Eliminar proyecto</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Se borran todas las listas y tareas para todos los integrantes.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setConfirming("delete")}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Salir del proyecto</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Vas a dejar de ver sus listas. Podés volver con un link nuevo.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setConfirming("leave")}>
              <LogOut className="size-4" /> Salir
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirming === "delete"}
        onClose={() => setConfirming(null)}
        onConfirm={() => runDanger(() => deleteProject(project.id))}
        loading={dangerPending}
        title="Eliminar proyecto"
        description={`Se va a eliminar “${project.name}” con todas sus listas y tareas, para todos los integrantes. No se puede deshacer.`}
        confirmLabel="Eliminar proyecto"
      />
      <ConfirmDialog
        open={confirming === "leave"}
        onClose={() => setConfirming(null)}
        onConfirm={() => runDanger(() => leaveProject(project.id))}
        loading={dangerPending}
        title="Salir del proyecto"
        description={`Vas a dejar de tener acceso a “${project.name}”.`}
        confirmLabel="Salir"
      />
    </div>
  );
}
