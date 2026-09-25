import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui";

export function AppHeader({
  user,
}: {
  user: { id: string; displayName: string; email: string };
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-500">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{user.displayName}</p>
            <p className="text-xs leading-tight text-zinc-500">{user.email}</p>
          </div>
          <Avatar id={user.id} name={user.displayName} size="sm" />
          <form action={signOut}>
            <button
              type="submit"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
