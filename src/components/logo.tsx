import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
        <rect width="32" height="32" rx="8" fill="#059669" />
        <circle cx="12" cy="12.5" r="6.5" fill="#a7f3d0" />
        <circle cx="19.5" cy="19" r="8" fill="#fff" stroke="#059669" strokeWidth="2.5" />
        <path
          d="M15.6 19.2l2.8 2.8 5-5.4"
          fill="none"
          stroke="#059669"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg tracking-tight">
        Team<span className="text-emerald-700 dark:text-emerald-400">Tick</span>
      </span>
    </span>
  );
}
