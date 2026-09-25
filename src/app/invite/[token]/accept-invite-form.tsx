"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/invites";
import { Button } from "@/components/ui";

export function AcceptInviteForm({
  token,
  userName,
}: {
  token: string;
  userName: string;
}) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" className="w-full" loading={pending}>
        Unirme al proyecto
      </Button>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Vas a entrar como {userName}.
      </p>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
