"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <CircleAlert className="size-12 text-red-400" />
      <h1 className="mt-4 text-lg font-semibold">Algo salió mal</h1>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        No pudimos cargar los datos. Revisá tu conexión y probá de nuevo.
      </p>
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
