"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { isUuid } from "@/lib/utils";
import { cleanText, dbFail, fail, ok } from "./helpers";

export async function createList(input: {
  id: string;
  projectId: string;
  name: string;
}): Promise<ActionResult> {
  const name = cleanText(input.name, 100);
  if (!isUuid(input.id) || !isUuid(input.projectId)) {
    return fail("Datos inválidos.");
  }
  if (!name) return fail("La lista necesita un nombre.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("lists")
    .insert({ id: input.id, project_id: input.projectId, name });

  if (error) return dbFail(error, "No se pudo crear la lista.");
  refresh();
  return ok(null);
}

export async function renameList(
  listId: string,
  rawName: string,
): Promise<ActionResult> {
  const name = cleanText(rawName, 100);
  if (!isUuid(listId)) return fail("Lista inválida.");
  if (!name) return fail("La lista necesita un nombre.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("lists")
    .update({ name })
    .eq("id", listId)
    .select("id")
    .single();

  if (error) return dbFail(error, "No se pudo renombrar la lista.");
  refresh();
  return ok(null);
}

export async function moveList(
  listId: string,
  direction: -1 | 1,
): Promise<ActionResult> {
  if (!isUuid(listId) || (direction !== -1 && direction !== 1)) {
    return fail("Datos inválidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_list", {
    p_list_id: listId,
    p_direction: direction,
  });

  if (error) return dbFail(error, "No se pudo mover la lista.");
  refresh();
  return ok(null);
}

export async function deleteList(listId: string): Promise<ActionResult> {
  if (!isUuid(listId)) return fail("Lista inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("lists").delete().eq("id", listId);

  if (error) return dbFail(error, "No se pudo eliminar la lista.");
  refresh();
  return ok(null);
}
