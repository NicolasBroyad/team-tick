import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <SearchX className="size-12 text-zinc-300 dark:text-zinc-600" />
      <h1 className="mt-4 text-lg font-semibold">No encontramos este proyecto</h1>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Puede que se haya eliminado o que no seas integrante. Si te lo
        compartieron, pedí un link de invitación.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Volver a mis proyectos
      </Link>
    </div>
  );
}
