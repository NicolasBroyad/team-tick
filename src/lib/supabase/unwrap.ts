import type { PostgrestError } from "@supabase/supabase-js";

// Devuelve los datos de una consulta o lanza el error (lo captura error.tsx).
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
