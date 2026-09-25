export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Cargando proyecto">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-6 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="flex gap-4 overflow-hidden p-4 sm:p-6">
        {[5, 3, 4].map((rows, index) => (
          <div
            key={index}
            className="w-[85vw] max-w-80 shrink-0 rounded-2xl border border-zinc-200 bg-zinc-100/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-80"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: rows }, (_, row) => (
                <div
                  key={row}
                  className="h-11 animate-pulse rounded-xl bg-white dark:bg-zinc-800/80"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
