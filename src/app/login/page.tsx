import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { safeNextPath } from "@/lib/utils";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = safeNextPath(
    typeof searchParams.next === "string" ? searchParams.next : null,
  );
  const confirmError = searchParams.error === "confirm";
  const fromInvite = next.startsWith("/invite/");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="scale-125" />
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Listas de tareas compartidas para tus proyectos.
          </p>
        </div>

        {fromInvite && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            Te invitaron a un proyecto. Ingresá o creá una cuenta para unirte.
          </p>
        )}
        {confirmError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            El link de confirmación no es válido o ya expiró. Probá ingresar o
            registrarte de nuevo.
          </p>
        )}

        <AuthForm next={next} initialMode={fromInvite ? "signup" : "signin"} />
      </div>
    </main>
  );
}
