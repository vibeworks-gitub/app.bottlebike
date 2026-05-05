"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <Card className="w-full shadow-lg ring-1 ring-foreground/5">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-xl tracking-tight">
          {mode === "login" ? "Willkommen zurück" : "Account anlegen"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Melde dich mit deiner E-Mail an."
            : "Der erste Account wird automatisch Admin."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {next && <input type="hidden" name="next" value={next} />}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="du@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "signup" ? 8 : undefined}
              placeholder="••••••••"
            />
          </div>
          {state.error && (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="mt-1">
            {pending
              ? "..."
              : mode === "login"
                ? "Einloggen"
                : "Account anlegen"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "login"
              ? "Noch kein Account? Registrieren"
              : "Bereits einen Account? Einloggen"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
