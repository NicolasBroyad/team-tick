"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export type AuthFormState =
  | { error?: string; message?: string; email?: string; name?: string }
  | undefined;

function authErrorMessage(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Tenés que confirmar tu email antes de entrar. Revisá tu casilla.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email. Probá ingresar.";
    case "weak_password":
      return "La contraseña es muy débil. Usá al menos 6 caracteres.";
    case "email_address_invalid":
      return "El email no es válido.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
    case "signup_disabled":
      return "El registro de nuevas cuentas está deshabilitado.";
    default:
      console.error("Auth error", error);
      return "No pudimos completar la operación. Probá de nuevo.";
  }
}

async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Completá tu email y contraseña.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error), email };

  redirect(next);
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!name || name.length > 60) {
    return { error: "Ingresá tu nombre (hasta 60 caracteres).", email, name };
  }
  if (!email) return { error: "Ingresá tu email.", email, name };
  if (password.length < 6) {
    return {
      error: "La contraseña debe tener al menos 6 caracteres.",
      email,
      name,
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: authErrorMessage(error), email, name };

  // Con "Confirm email" desactivado en Supabase ya hay sesión.
  if (data.session) redirect(next);

  // Con confirmación activada, Supabase no revela si el email ya existía:
  // en ese caso devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    return {
      error: "Ya existe una cuenta con ese email. Probá ingresar.",
      email,
      name,
    };
  }

  return {
    message: `Te enviamos un email a ${email}. Abrí el link para confirmar tu cuenta.`,
    email,
    name,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
