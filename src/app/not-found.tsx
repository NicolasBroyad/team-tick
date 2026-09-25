import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Logo />
      <h1 className="mt-8 text-lg font-semibold">Página no encontrada</h1>
      <Link
        href="/"
        className="mt-4 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
