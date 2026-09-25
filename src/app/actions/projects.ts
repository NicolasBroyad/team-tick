"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { isUuid } from "@/lib/utils";
import { cleanText, dbFail, fail, ok, optionalText } from "./helpers";

export type ProjectFormState = { error?: string } | undefined;

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const name = cleanText(formData.get("name"), 100);
  const description = optionalText(formData.get("description"), 500);
  if (!name) return { error: "El proyecto necesita un nombre." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, owner_id: claims.claims.sub })
    .select("id")
    .single();

  if (error) return { error: dbFail(error, "No se pudo crear el proyecto.").error };

  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  projectId: string,
  input: { name: string; description: string },
): Promise<ActionResult> {
  if (!isUuid(projectId)) return fail("Proyecto inválido.");
  const name = cleanText(input.name, 100);
  const description = optionalText(input.description, 500);
  if (!name) return fail("El proyecto necesita un nombre.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name, description })
    .eq("id", projectId)
    .select("id")
    .single();

  if (error) return dbFail(error, "No se pudo guardar el proyecto.");
  refresh();
  return ok(null);
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  if (!isUuid(projectId)) return fail("Proyecto inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id");

  if (error) return dbFail(error, "No se pudo eliminar el proyecto.");
  if (!data.length) return fail("Solo el dueño puede eliminar el proyecto.");

  redirect("/");
}

export async function leaveProject(projectId: string): Promise<ActionResult> {
  if (!isUuid(projectId)) return fail("Proyecto inválido.");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .select("user_id");

  if (error) return dbFail(error, "No se pudo salir del proyecto.");
  if (!data.length) {
    return fail("El dueño no puede salir del proyecto. Podés eliminarlo.");
  }

  redirect("/");
}

export async function removeMember(
  projectId: string,
  userId: string,
): Promise<ActionResult> {
  if (!isUuid(projectId) || !isUuid(userId)) return fail("Datos inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .select("user_id");

  if (error) return dbFail(error, "No se pudo quitar al integrante.");
  if (!data.length) {
    return fail("Solo el dueño del proyecto puede quitar integrantes.");
  }

  refresh();
  return ok(null);
}
