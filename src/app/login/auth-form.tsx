"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { signIn, signUp } from "@/app/actions/auth";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function AuthForm({
  next,
  initialMode,
}: {
  next: string;
  initialMode: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "rounded-md py-1.5 text-sm font-medium transition",
              mode === value
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {value === "signin" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>
      {mode === "signin" ? <SignInForm next={next} /> : <SignUpForm next={next} />}
    </div>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
        />
      </div>
      <div>
        <Label htmlFor="signin-password">Contraseña</Label>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" className="w-full" loading={pending}>
        Ingresar
      </Button>
    </form>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.message) {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <MailCheck className="size-10 text-emerald-600" />
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="signup-name">Tu nombre</Label>
        <Input
          id="signup-name"
          name="name"
          autoComplete="name"
          maxLength={60}
          required
          defaultValue={state?.name}
          placeholder="Cómo te van a ver tus compañeros"
        />
      </div>
      <div>
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
        />
      </div>
      <div>
        <Label htmlFor="signup-password">Contraseña</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" className="w-full" loading={pending}>
        Crear cuenta
      </Button>
    </form>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
    >
      {children}
    </p>
  );
}
