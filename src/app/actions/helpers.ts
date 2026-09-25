import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/types";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// Traduce errores de Postgres/PostgREST a mensajes para el usuario.
export function dbFail(error: PostgrestError, fallback: string) {
  console.error(fallback, error);
  switch (error.code) {
    case "23514":
      return fail("El texto está vacío o es demasiado largo.");
    case "23505":
      return fail("Ese elemento ya existe.");
    case "23503":
      return fail("El elemento relacionado ya no existe. Recargá la página.");
    case "42501":
      return fail("No tenés permiso para hacer esto.");
    case "PGRST116":
      return fail("No se encontró el elemento (puede que alguien lo haya borrado).");
    default:
      return fail(fallback);
  }
}

export function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function optionalText(value: unknown, max: number) {
  const text = cleanText(value, max);
  return text.length > 0 ? text : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function optionalDate(value: unknown) {
  return typeof value === "string" && DATE_RE.test(value) ? value : null;
}
