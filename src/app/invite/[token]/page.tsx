import type { Metadata } from "next";
import Link from "next/link";
import { CircleX, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Invitación" };

const TOKEN_RE = /^[0-9a-f]{48}$/;

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const user = await getCurrentUser();

  let invite = null;
  if (TOKEN_RE.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invite", { p_token: token });
    invite = data?.[0] ?? null;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo className="scale-125" />
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {!invite ? (
            <Problem
              title="Invitación inválida"
              text="El link no existe o está mal copiado. Pedile a quien te invitó que te pase uno nuevo."
              user={Boolean(user)}
            />
          ) : invite.already_member ? (
            <>
              <Users className="mx-auto size-10 text-emerald-600" />
              <h1 className="mt-3 text-lg font-semibold">
                Ya sos parte de “{invite.project_name}”
              </h1>
              <Link
                href={`/projects/${invite.project_id}`}
                className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                Ir al proyecto
              </Link>
            </>
          ) : !invite.is_valid ? (
            <Problem
              title="La invitación expiró"
              text="Este link ya no está activo. Pedile a quien te invitó que genere uno nuevo."
              user={Boolean(user)}
            />
          ) : (
            <>
              <Users className="mx-auto size-10 text-emerald-600" />
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                {invite.inviter_name ?? "Alguien"} te invitó a
              </p>
              <h1 className="mt-1 text-xl font-semibold">{invite.project_name}</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {invite.member_count}{" "}
                {invite.member_count === 1 ? "integrante" : "integrantes"}
              </p>
              {user ? (
                <AcceptInviteForm token={token} userName={user.displayName} />
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                >
                  Ingresá o creá una cuenta para unirte
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Problem({
  title,
  text,
  user,
}: {
  title: string;
  text: string;
  user: boolean;
}) {
  return (
    <>
      <CircleX className="mx-auto size-10 text-red-500" />
      <h1 className="mt-3 text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
      <Link
        href={user ? "/" : "/login"}
        className="mt-6 inline-flex text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        {user ? "Ir a mis proyectos" : "Ir a TeamTick"}
      </Link>
    </>
  );
}
