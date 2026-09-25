import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, ListChecks } from "lucide-react";
import { AvatarStack, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { NewProjectButton } from "./new-project-button";

export const metadata: Metadata = { title: "Proyectos" };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // RLS devuelve solo lo de los proyectos de los que el usuario es miembro.
  const [projectRows, lists, tasks, members] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, owner_id, updated_at")
      .order("updated_at", { ascending: false })
      .then(unwrap),
    supabase.from("lists").select("id, project_id").then(unwrap),
    supabase.from("tasks").select("project_id, done").then(unwrap),
    supabase
      .from("project_members")
      .select("project_id, user_id, joined_at, profiles(display_name)")
      .order("joined_at")
      .then(unwrap),
  ]);

  const projects = projectRows.map((project) => {
    const projectTasks = tasks.filter((t) => t.project_id === project.id);
    return {
      ...project,
      listCount: lists.filter((l) => l.project_id === project.id).length,
      taskCount: projectTasks.length,
      doneCount: projectTasks.filter((t) => t.done).length,
      members: members
        .filter((m) => m.project_id === project.id)
        .map((m) => ({ id: m.user_id, name: m.profiles.display_name })),
    };
  });

  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Hola, {firstName}
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {projects.length === 0
              ? "Creá tu primer proyecto para empezar."
              : "Estos son tus proyectos."}
          </p>
        </div>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <FolderKanban className="size-12 text-zinc-300 dark:text-zinc-600" />
          <h2 className="mt-4 text-lg font-semibold">Todavía no hay proyectos</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Un proyecto agrupa listas (etapas, partes, áreas…) que podés
            compartir con tu equipo mediante un link.
          </p>
          <div className="mt-6">
            <NewProjectButton />
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    {project.name}
                  </h2>
                  {project.owner_id === user.id && (
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Dueño
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {project.description}
                  </p>
                )}
                <div className="mt-auto pt-5">
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="size-3.5" />
                      {project.listCount}{" "}
                      {project.listCount === 1 ? "lista" : "listas"}
                    </span>
                    <span>
                      {project.doneCount}/{project.taskCount} tareas
                    </span>
                  </div>
                  <ProgressBar value={project.doneCount} total={project.taskCount} />
                  <div className="mt-4">
                    <AvatarStack people={project.members} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
