"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { isUuid } from "@/lib/utils";
import {
  cleanText,
  dbFail,
  fail,
  ok,
  optionalDate,
  optionalText,
} from "./helpers";

export async function createTask(input: {
  id: string;
  projectId: string;
  listId: string;
  title: string;
}): Promise<ActionResult> {
  const title = cleanText(input.title, 500);
  if (![input.id, input.projectId, input.listId].every(isUuid)) {
    return fail("Datos inválidos.");
  }
  if (!title) return fail("La tarea necesita un título.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    id: input.id,
    project_id: input.projectId,
    list_id: input.listId,
    title,
  });

  if (error) return dbFail(error, "No se pudo crear la tarea.");
  refresh();
  return ok(null);
}

export async function setTaskDone(
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  if (!isUuid(taskId) || typeof done !== "boolean") {
    return fail("Datos inválidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ done })
    .eq("id", taskId)
    .select("id")
    .single();

  if (error) return dbFail(error, "No se pudo actualizar la tarea.");
  refresh();
  return ok(null);
}

export async function updateTask(
  taskId: string,
  input: {
    title: string;
    notes: string;
    assigneeId: string | null;
    dueDate: string | null;
    listId: string;
  },
): Promise<ActionResult> {
  const title = cleanText(input.title, 500);
  if (!isUuid(taskId) || !isUuid(input.listId)) return fail("Datos inválidos.");
  if (input.assigneeId !== null && !isUuid(input.assigneeId)) {
    return fail("Integrante inválido.");
  }
  if (!title) return fail("La tarea necesita un título.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      notes: optionalText(input.notes, 5000),
      assignee_id: input.assigneeId,
      due_date: optionalDate(input.dueDate),
      list_id: input.listId,
    })
    .eq("id", taskId)
    .select("id")
    .single();

  if (error) return dbFail(error, "No se pudo guardar la tarea.");
  refresh();
  return ok(null);
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!isUuid(taskId)) return fail("Tarea inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) return dbFail(error, "No se pudo eliminar la tarea.");
  refresh();
  return ok(null);
}

export async function clearCompleted(listId: string): Promise<ActionResult> {
  if (!isUuid(listId)) return fail("Lista inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("list_id", listId)
    .eq("done", true);

  if (error) return dbFail(error, "No se pudieron borrar las completadas.");
  refresh();
  return ok(null);
}
