import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import type { Member } from "@/lib/types";
import { isUuid } from "@/lib/utils";
import { ProjectBoard } from "./project-board";
import { ProjectHeader } from "./project-header";

const getProject = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  return data;
});

export async function generateMetadata(
  props: PageProps<"/projects/[projectId]">,
): Promise<Metadata> {
  const { projectId } = await props.params;
  const project = isUuid(projectId) ? await getProject(projectId) : null;
  return { title: project?.name ?? "Proyecto" };
}

export default async function ProjectPage(
  props: PageProps<"/projects/[projectId]">,
) {
  const { projectId } = await props.params;
  if (!isUuid(projectId)) notFound();

  const user = await requireUser();
  const project = await getProject(projectId);
  // RLS: si no sos miembro, el proyecto directamente no aparece.
  if (!project) notFound();

  const supabase = await createClient();
  const [lists, tasks, members, invites] = await Promise.all([
    supabase
      .from("lists")
      .select("*")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at")
      .then(unwrap),
    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at")
      .then(unwrap),
    supabase
      .from("project_members")
      .select("user_id, role, joined_at, profile:profiles(id, display_name, email)")
      .eq("project_id", projectId)
      .order("joined_at")
      .then((result): Member[] => unwrap(result)),
    supabase
      .from("project_invites")
      .select("*")
      .eq("project_id", projectId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .then(unwrap),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader
        project={project}
        members={members}
        invites={invites}
        currentUserId={user.id}
      />
      <ProjectBoard
        projectId={projectId}
        lists={lists}
        tasks={tasks}
        members={members}
        currentUserId={user.id}
      />
    </div>
  );
}
