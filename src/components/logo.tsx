import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
        <Check className="size-4.5" strokeWidth={3} />
      </span>
      <span className="text-lg tracking-tight">
        Team<span className="text-emerald-600">Tick</span>
      </span>
    </span>
  );
}
