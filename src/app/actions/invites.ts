"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Invite } from "@/lib/types";
import { isUuid } from "@/lib/utils";
import { dbFail, fail, ok } from "./helpers";

export async function createInvite(
  projectId: string,
): Promise<ActionResult<Invite>> {
  if (!isUuid(projectId)) return fail("Proyecto inválido.");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const { data, error } = await supabase
    .from("project_invites")
    .insert({ project_id: projectId, created_by: claims.claims.sub })
    .select("*")
    .single();

  if (error) return dbFail(error, "No se pudo crear el link de invitación.");
  refresh();
  return ok(data);
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  if (!isUuid(inviteId)) return fail("Invitación inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .select("id")
    .single();

  if (error) return dbFail(error, "No se pudo revocar el link.");
  refresh();
  return ok(null);
}

export type AcceptInviteState = { error?: string } | undefined;

export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data: projectId, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });

  if (error) {
    console.error("accept_invite", error);
    if (error.code === "28000") redirect(`/login?next=/invite/${token}`);
    return {
      error:
        error.code === "P0001" || error.code === "P0002"
          ? error.message
          : "No pudimos sumarte al proyecto. Probá de nuevo.",
    };
  }

  redirect(`/projects/${projectId}`);
}
