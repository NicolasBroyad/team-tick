import { twMerge } from "tailwind-merge";

// Une clases y resuelve conflictos de Tailwind (la última gana).
export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Fecha local de hoy en formato YYYY-MM-DD (igual que las columnas `date`).
export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function formatDueDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  const sameYear = year === new Date().getFullYear();
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(value);
}

export function dueStatus(date: string | null, done: boolean) {
  if (!date || done) return "none" as const;
  const today = todayISO();
  if (date < today) return "overdue" as const;
  if (date === today) return "today" as const;
  return "upcoming" as const;
}

export function formatRelativeDays(isoDate: string) {
  const diff = new Date(isoDate).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  return new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" }).format(
    days,
    "day",
  );
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Evita open redirects: solo rutas internas.
export function safeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

// UUID v4 generado en el cliente: permite que la UI optimista y la fila real
// compartan el mismo id. crypto.randomUUID solo existe en contextos seguros
// (https/localhost), así que hay un fallback para probar desde la red local.
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
