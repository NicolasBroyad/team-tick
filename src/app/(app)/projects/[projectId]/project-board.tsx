"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Eraser,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createList, deleteList, moveList, renameList } from "@/app/actions/lists";
import {
  clearCompleted,
  createTask,
  deleteTask,
  setTaskDone,
  updateTask,
} from "@/app/actions/tasks";
import { useToast } from "@/components/toast";
import {
  Avatar,
  Button,
  ConfirmDialog,
  IconButton,
  Input,
  Label,
  Menu,
  Modal,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult, List, Member, Task } from "@/lib/types";
import {
  cn,
  dueStatus,
  firstName,
  formatDueDate,
  newId,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Estado optimista del tablero
// ---------------------------------------------------------------------------

type BoardState = { lists: List[]; tasks: Task[] };

type BoardAction =
  | { type: "addLists"; lists: List[] }
  | { type: "renameList"; id: string; name: string }
  | { type: "deleteList"; id: string }
  | { type: "moveList"; id: string; direction: -1 | 1 }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "deleteTask"; id: string }
  | { type: "clearCompleted"; listId: string };

// Lo que se agrega o mueve de forma optimista queda al final hasta que llega
// la posición real calculada por la base.
const LAST = Number.MAX_SAFE_INTEGER;

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "addLists":
      return { ...state, lists: [...state.lists, ...action.lists] };
    case "renameList":
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === action.id ? { ...list, name: action.name } : list,
        ),
      };
    case "deleteList":
      return {
        lists: state.lists.filter((list) => list.id !== action.id),
        tasks: state.tasks.filter((task) => task.list_id !== action.id),
      };
    case "moveList": {
      const index = state.lists.findIndex((list) => list.id === action.id);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= state.lists.length) return state;
      const lists = [...state.lists];
      [lists[index], lists[target]] = [lists[target], lists[index]];
      return { ...state, lists };
    }
    case "addTask":
      return { ...state, tasks: [...state.tasks, action.task] };
    case "updateTask":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, ...action.patch } : task,
        ),
      };
    case "deleteTask":
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id),
      };
    case "clearCompleted":
      return {
        ...state,
        tasks: state.tasks.filter(
          (task) => !(task.list_id === action.listId && task.done),
        ),
      };
  }
}

type Profile = Member["profile"];

type BoardContextValue = {
  projectId: string;
  currentUserId: string;
  lists: List[];
  members: Member[];
  profileById: Map<string, Profile>;
  run: (action: BoardAction, call: () => Promise<ActionResult>) => void;
  openTask: (taskId: string) => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard fuera de <ProjectBoard>");
  return value;
}

// ---------------------------------------------------------------------------
// Tiempo real: cuando otro integrante cambia algo, se recargan los datos.
// ---------------------------------------------------------------------------

function useRealtimeRefresh(projectId: string, knownIds: Set<string>) {
  const router = useRouter();
  const knownIdsRef = useRef(knownIds);

  useEffect(() => {
    knownIdsRef.current = knownIds;
  }, [knownIds]);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    // Los DELETE no se pueden filtrar por columna en Supabase Realtime, así
    // que se filtran acá: solo interesan filas de este proyecto.
    const onDelete = (payload: { old: Record<string, unknown> }) => {
      const { id, project_id } = payload.old;
      if (knownIdsRef.current.has(String(id)) || project_id === projectId) {
        scheduleRefresh();
      }
    };

    const byProject = `project_id=eq.${projectId}`;
    const bindings = [
      { event: "INSERT", table: "tasks", filter: byProject },
      { event: "UPDATE", table: "tasks", filter: byProject },
      { event: "DELETE", table: "tasks" },
      { event: "INSERT", table: "lists", filter: byProject },
      { event: "UPDATE", table: "lists", filter: byProject },
      { event: "DELETE", table: "lists" },
      { event: "INSERT", table: "project_members", filter: byProject },
      { event: "DELETE", table: "project_members" },
      { event: "UPDATE", table: "projects", filter: `id=eq.${projectId}` },
    ] as const;

    (async () => {
      // El token del usuario tiene que estar cargado ANTES de suscribirse: si
      // no, el canal se une como anónimo y RLS filtra todos los eventos.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      // Nombre único por montaje: supabase.channel() reutiliza un canal con el
      // mismo nombre si el anterior todavía se está cerrando.
      channel = supabase.channel(`project:${projectId}:${newId()}`);
      for (const { event, table, ...rest } of bindings) {
        channel.on(
          "postgres_changes",
          { event, schema: "public", table, ...rest },
          event === "DELETE" ? onDelete : scheduleRefresh,
        );
      }
      channel.subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Realtime no disponible:", status, error);
        }
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [projectId, router]);
}

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

function sortTasks(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
}

export function ProjectBoard({
  projectId,
  lists,
  tasks,
  members,
  currentUserId,
}: {
  projectId: string;
  lists: List[];
  tasks: Task[];
  members: Member[];
  currentUserId: string;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [state, applyOptimistic] = useOptimistic<BoardState, BoardAction>(
    { lists, tasks },
    boardReducer,
  );
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const run = useCallback(
    (action: BoardAction, call: () => Promise<ActionResult>) => {
      startTransition(async () => {
        applyOptimistic(action);
        try {
          const result = await call();
          if (!result.ok) toast(result.error);
        } catch {
          toast("Se perdió la conexión. Revisá tu internet y probá de nuevo.");
        }
      });
    },
    [applyOptimistic, toast],
  );

  const profileById = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.profile])),
    [members],
  );

  const tasksByList = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of sortTasks(state.tasks)) {
      const bucket = map.get(task.list_id);
      if (bucket) bucket.push(task);
      else map.set(task.list_id, [task]);
    }
    return map;
  }, [state.tasks]);

  const knownIds = useMemo(
    () =>
      new Set([
        ...lists.map((list) => list.id),
        ...tasks.map((task) => task.id),
      ]),
    [lists, tasks],
  );
  useRealtimeRefresh(projectId, knownIds);

  const openTask = state.tasks.find((task) => task.id === openTaskId) ?? null;

  const context: BoardContextValue = {
    projectId,
    currentUserId,
    lists: state.lists,
    members,
    profileById,
    run,
    openTask: setOpenTaskId,
  };

  return (
    <BoardContext value={context}>
      {state.lists.length === 0 ? (
        <EmptyBoard />
      ) : (
        <div className="thin-scrollbar min-h-0 flex-1 snap-x snap-mandatory scroll-px-4 overflow-x-auto overflow-y-hidden sm:snap-none">
          <div className="flex h-full w-max min-w-full items-start gap-3 p-4 sm:gap-4 sm:p-6">
            {state.lists.map((list, index) => (
              <ListColumn
                key={list.id}
                list={list}
                tasks={tasksByList.get(list.id) ?? []}
                isFirst={index === 0}
                isLast={index === state.lists.length - 1}
              />
            ))}
            <NewListColumn />
          </div>
        </div>
      )}

      <Modal
        open={openTask !== null}
        onClose={() => setOpenTaskId(null)}
        title="Editar tarea"
      >
        {openTask && (
          <TaskEditor
            key={openTask.id}
            task={openTask}
            onClose={() => setOpenTaskId(null)}
          />
        )}
      </Modal>
    </BoardContext>
  );
}

// ---------------------------------------------------------------------------
// Proyecto sin listas
// ---------------------------------------------------------------------------

const TEMPLATE = ["Por hacer", "En curso", "Hecho"];

function EmptyBoard() {
  const { projectId, currentUserId, run } = useBoard();

  function applyTemplate() {
    const now = new Date().toISOString();
    const lists = TEMPLATE.map((name, index) => ({
      id: newId(),
      project_id: projectId,
      name,
      position: LAST - TEMPLATE.length + index,
      created_by: currentUserId,
      created_at: now,
    }));
    run({ type: "addLists", lists }, async () => {
      // En orden, para que la base les asigne posiciones consecutivas.
      for (const list of lists) {
        const result = await createList({
          id: list.id,
          projectId,
          name: list.name,
        });
        if (!result.ok) return result;
      }
      return { ok: true, data: null };
    });
  }

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-12 sm:py-20">
      <div className="w-full max-w-md text-center">
        <LayoutList className="mx-auto size-12 text-zinc-300 dark:text-zinc-600" />
        <h2 className="mt-4 text-lg font-semibold">Este proyecto no tiene listas</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Creá una lista por cada etapa, parte o área del proyecto. Cada lista
          tiene sus propias tareas.
        </p>
        <div className="mx-auto mt-6 max-w-xs text-left">
          <NewListForm autoFocus onDone={() => {}} />
        </div>
        <div className="mt-6 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />o
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <Button variant="secondary" className="mt-6" onClick={applyTemplate}>
          Empezar con “{TEMPLATE.join(" · ")}”
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------

function ListColumn({
  list,
  tasks,
  isFirst,
  isLast,
}: {
  list: List;
  tasks: Task[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const { run } = useBoard();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const pending = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  function rename(name: string) {
    setRenaming(false);
    const value = name.trim();
    if (!value || value === list.name) return;
    run({ type: "renameList", id: list.id, name: value }, () =>
      renameList(list.id, value),
    );
  }

  function move(direction: -1 | 1) {
    run({ type: "moveList", id: list.id, direction }, () =>
      moveList(list.id, direction),
    );
  }

  return (
    <section
      aria-label={list.name}
      className="flex max-h-full w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl border border-zinc-200 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-80"
    >
      <header className="flex items-center gap-1 pl-3 pr-1.5 pt-2.5">
        {renaming ? (
          <RenameInput
            initialValue={list.name}
            onSubmit={rename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <h2
            className="min-w-0 flex-1 cursor-text truncate py-1 text-sm font-semibold"
            onDoubleClick={() => setRenaming(true)}
            title={list.name}
          >
            {list.name}
          </h2>
        )}
        <span className="shrink-0 rounded-full bg-zinc-200/80 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {done.length}/{tasks.length}
        </span>
        <Menu
          label={`Opciones de ${list.name}`}
          trigger={<MoreHorizontal className="size-4" />}
          items={[
            {
              label: "Renombrar",
              icon: <Pencil className="size-4" />,
              onSelect: () => setRenaming(true),
            },
            {
              label: "Mover a la izquierda",
              icon: <ArrowLeft className="size-4" />,
              onSelect: () => move(-1),
              disabled: isFirst,
            },
            {
              label: "Mover a la derecha",
              icon: <ArrowRight className="size-4" />,
              onSelect: () => move(1),
              disabled: isLast,
            },
            {
              label: "Borrar completadas",
              icon: <Eraser className="size-4" />,
              onSelect: () =>
                run({ type: "clearCompleted", listId: list.id }, () =>
                  clearCompleted(list.id),
                ),
              disabled: done.length === 0,
            },
            {
              label: "Eliminar lista",
              icon: <Trash2 className="size-4" />,
              onSelect: () => setConfirmingDelete(true),
              danger: true,
            },
          ]}
        />
      </header>

      <div className="px-3 pb-1 pt-2">
        <ProgressBar value={done.length} total={tasks.length} />
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tasks.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Sin tareas todavía
          </p>
        )}
        {pending.length === 0 && done.length > 0 && (
          <p className="flex items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" /> ¡Todo completado!
          </p>
        )}
        <ul className="space-y-2">
          {pending.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
        {done.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDone((value) => !value)}
              aria-expanded={showDone}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ChevronRight
                className={cn("size-3.5 transition-transform", showDone && "rotate-90")}
              />
              Completadas ({done.length})
            </button>
            {showDone && (
              <ul className="mt-2 space-y-2">
                {done.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 px-2 py-2 dark:border-zinc-800">
        <AddTaskForm list={list} />
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          run({ type: "deleteList", id: list.id }, () => deleteList(list.id));
        }}
        title="Eliminar lista"
        description={
          tasks.length > 0
            ? `Se va a eliminar “${list.name}” junto con sus ${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}. No se puede deshacer.`
            : `Se va a eliminar “${list.name}”. No se puede deshacer.`
        }
        confirmLabel="Eliminar"
      />
    </section>
  );
}

// Input de renombrado: Enter o salir del campo guarda, Escape cancela.
// Termina una sola vez (al desmontarse puede dispararse un blur extra).
function RenameInput({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const finished = useRef(false);

  function finish(value: string | null) {
    if (finished.current) return;
    finished.current = true;
    if (value === null) onCancel();
    else onSubmit(value);
  }

  return (
    <input
      autoFocus
      defaultValue={initialValue}
      maxLength={100}
      aria-label="Nombre de la lista"
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(event.currentTarget.value);
        if (event.key === "Escape") finish(null);
      }}
      className="h-8 min-w-0 flex-1 rounded-md border border-emerald-500 bg-white px-2 text-sm font-semibold outline-none ring-3 ring-emerald-500/20 dark:bg-zinc-900"
    />
  );
}

function NewListForm({
  autoFocus,
  onDone,
}: {
  autoFocus?: boolean;
  onDone: () => void;
}) {
  const { projectId, currentUserId, run } = useBoard();
  const [name, setName] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    const list: List = {
      id: newId(),
      project_id: projectId,
      name: value,
      position: LAST,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
    };
    run({ type: "addLists", lists: [list] }, () =>
      createList({ id: list.id, projectId, name: value }),
    );
    setName("");
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        autoFocus={autoFocus}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onDone()}
        maxLength={100}
        placeholder="Nombre de la lista"
        aria-label="Nombre de la nueva lista"
      />
      <Button type="submit" disabled={!name.trim()}>
        Crear
      </Button>
    </form>
  );
}

function NewListColumn() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-[85vw] max-w-80 shrink-0 snap-start sm:w-80">
      {open ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-100/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          <NewListForm autoFocus onDone={() => setOpen(false)} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="size-3.5" /> Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 dark:border-zinc-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
        >
          <Plus className="size-4" /> Agregar lista
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

function AddTaskForm({ list }: { list: List }) {
  const { projectId, currentUserId, run } = useBoard();
  const [title, setTitle] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: newId(),
      project_id: projectId,
      list_id: list.id,
      title: value,
      notes: null,
      done: false,
      done_at: null,
      done_by: null,
      assignee_id: null,
      due_date: null,
      position: LAST,
      created_by: currentUserId,
      created_at: now,
      updated_at: now,
    };
    run({ type: "addTask", task }, () =>
      createTask({ id: task.id, projectId, listId: list.id, title: value }),
    );
    setTitle("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 focus-within:bg-white dark:focus-within:bg-zinc-800">
        <Plus className="size-4 shrink-0 text-zinc-400" />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={500}
          placeholder="Agregar tarea"
          aria-label={`Agregar tarea a ${list.name}`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
      </label>
      {title.trim() && (
        <Button type="submit" size="sm">
          Agregar
        </Button>
      )}
    </form>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { run, profileById, openTask } = useBoard();
  const assignee = task.assignee_id ? profileById.get(task.assignee_id) : null;
  const due = dueStatus(task.due_date, task.done);

  function toggle() {
    run({ type: "updateTask", id: task.id, patch: { done: !task.done } }, () =>
      setTaskDone(task.id, !task.done),
    );
  }

  return (
    <li className="group flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-xs transition hover:border-zinc-300 dark:border-zinc-700/70 dark:bg-zinc-800/80 dark:hover:border-zinc-600">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? "Marcar como pendiente" : "Marcar como completada"}
        onClick={toggle}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          task.done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500 dark:border-zinc-600",
        )}
      >
        <Check className="size-3" strokeWidth={3.5} />
      </button>

      <button
        type="button"
        onClick={() => openTask(task.id)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={cn(
            "block break-words text-sm leading-5",
            task.done && "text-zinc-400 line-through dark:text-zinc-500",
          )}
        >
          {task.title}
        </span>
        {(task.due_date || task.notes || assignee) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                  due === "overdue" &&
                    "bg-red-50 font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300",
                  due === "today" &&
                    "bg-amber-50 font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
                  (due === "upcoming" || due === "none") &&
                    "bg-zinc-100 dark:bg-zinc-700/60",
                )}
              >
                <Calendar className="size-3" />
                {due === "today" ? "Hoy" : formatDueDate(task.due_date)}
              </span>
            )}
            {task.notes && (
              <AlignLeft className="size-3.5" aria-label="Tiene notas" />
            )}
            {assignee && (
              <span className="ml-auto inline-flex items-center gap-1">
                <Avatar id={assignee.id} name={assignee.display_name} size="xs" />
                {firstName(assignee.display_name)}
              </span>
            )}
          </span>
        )}
      </button>

      <IconButton
        label="Eliminar tarea"
        onClick={() =>
          run({ type: "deleteTask", id: task.id }, () => deleteTask(task.id))
        }
        className="-my-1 -mr-1 hidden size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-fine:inline-flex"
      >
        <Trash2 className="size-3.5" />
      </IconButton>
    </li>
  );
}

const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { run, lists, members, profileById } = useBoard();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [listId, setListId] = useState(task.list_id);

  const createdBy = task.created_by ? profileById.get(task.created_by) : null;
  const doneBy = task.done_by ? profileById.get(task.done_by) : null;

  function save(event?: React.FormEvent) {
    event?.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const input = {
      title: cleanTitle,
      notes: notes.trim(),
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      listId,
    };
    run(
      {
        type: "updateTask",
        id: task.id,
        patch: {
          title: input.title,
          notes: input.notes || null,
          assignee_id: input.assigneeId,
          due_date: input.dueDate,
          list_id: input.listId,
          ...(input.listId !== task.list_id ? { position: LAST } : {}),
        },
      },
      () => updateTask(task.id, input),
    );
    onClose();
  }

  function remove() {
    run({ type: "deleteTask", id: task.id }, () => deleteTask(task.id));
    onClose();
  }

  function saveOnCtrlEnter(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <Label htmlFor="task-title">Título</Label>
        <Textarea
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              save();
            }
          }}
          rows={2}
          maxLength={500}
          required
          className="resize-none"
        />
      </div>
      <div>
        <Label htmlFor="task-notes">Notas</Label>
        <Textarea
          id="task-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onKeyDown={saveOnCtrlEnter}
          rows={4}
          maxLength={5000}
          placeholder="Detalles, links, lo que haga falta…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="task-assignee">Responsable</Label>
          <Select
            id="task-assignee"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Sin asignar</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profile.display_name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-due">Fecha límite</Label>
          <div className="flex gap-1">
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            {dueDate && (
              <IconButton
                label="Quitar fecha"
                onClick={() => setDueDate("")}
                className="size-10"
              >
                <X className="size-4" />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      <div>
        <Label htmlFor="task-list">Lista</Label>
        <Select
          id="task-list"
          value={listId}
          onChange={(event) => setListId(event.target.value)}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {createdBy ? `Creada por ${createdBy.display_name}` : "Creada"} el{" "}
        {dateTimeFormat.format(new Date(task.created_at))}
        {task.done && task.done_at && (
          <>
            {" · "}Completada{doneBy ? ` por ${doneBy.display_name}` : ""} el{" "}
            {dateTimeFormat.format(new Date(task.done_at))}
          </>
        )}
      </p>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <Button type="button" variant="danger-ghost" onClick={remove}>
          <Trash2 className="size-4" />
          Eliminar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            Guardar
          </Button>
        </div>
      </div>
    </form>
  );
}
