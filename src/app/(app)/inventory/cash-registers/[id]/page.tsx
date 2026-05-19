import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  CashRegister,
  Location,
  RegisterAssignment,
} from "@/lib/types/database";
import { RegisterForm } from "../register-form";
import { AddAssignmentForm, EditAssignmentRow } from "../assign-form";
import { deleteAssignment, endAssignment, updateRegister } from "../actions";

export default async function EditRegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: reg }, { data: bikes }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("bb_cash_registers")
        .select("*")
        .eq("id", id)
        .maybeSingle<CashRegister>(),
      supabase
        .from("bb_locations")
        .select("*")
        .eq("type", "bike")
        .eq("active", true)
        .order("name", { ascending: true })
        .returns<Location[]>(),
      supabase
        .from("bb_register_assignments")
        .select("*")
        .eq("cash_register_id", id)
        .order("valid_from", { ascending: false })
        .returns<RegisterAssignment[]>(),
    ]);

  if (!reg) notFound();

  const action = updateRegister.bind(null, reg.id);
  const now = Date.now();
  const statusOf = (a: RegisterAssignment): "current" | "future" | "past" => {
    const from = new Date(a.valid_from).getTime();
    const to = a.valid_to ? new Date(a.valid_to).getTime() : null;
    if (from > now) return "future";
    if (to !== null && to <= now) return "past";
    return "current";
  };
  const hasCurrent = (assignments ?? []).some((a) => statusOf(a) === "current");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          {reg.name}
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Zuweisungen</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lege je Zeitraum eine Zuweisung an. Lücken sind erlaubt — Verkäufe
            in nicht abgedeckten Zeiträumen werden nicht automatisch gebucht.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasCurrent && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Diese Kassa hat aktuell keine aktive Zuweisung — Verkäufe werden
              nicht automatisch abgebucht.
            </p>
          )}

          <AddAssignmentForm registerId={reg.id} bikes={bikes ?? []} />

          {(assignments ?? []).length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="hidden grid-cols-[1.5fr_1fr_1fr_auto] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Verkaufsstelle</span>
                <span>Gültig ab</span>
                <span>Gültig bis</span>
                <span />
              </div>
              {(assignments ?? []).map((a) => {
                const status = statusOf(a);
                return (
                  <div key={a.id} className="border-b border-border last:border-b-0">
                    <div className="flex items-center justify-between gap-2 px-3 pt-2">
                      <Badge
                        variant={
                          status === "current"
                            ? "secondary"
                            : status === "future"
                              ? "outline"
                              : "outline"
                        }
                        style={
                          status === "current"
                            ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" }
                            : undefined
                        }
                      >
                        {status === "current"
                          ? "aktiv"
                          : status === "future"
                            ? "zukünftig"
                            : "abgeschlossen"}
                      </Badge>
                      <div className="flex gap-1">
                        {status === "current" && a.valid_to === null && (
                          <form action={endAssignment}>
                            <input type="hidden" name="assignment_id" value={a.id} />
                            <input type="hidden" name="register_id" value={reg.id} />
                            <button
                              type="submit"
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              Jetzt beenden
                            </button>
                          </form>
                        )}
                        <form action={deleteAssignment}>
                          <input type="hidden" name="assignment_id" value={a.id} />
                          <input type="hidden" name="register_id" value={reg.id} />
                          <button
                            type="submit"
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                            style={{ color: "var(--destructive)" }}
                          >
                            Löschen
                          </button>
                        </form>
                      </div>
                    </div>
                    <EditAssignmentRow
                      assignment={a}
                      registerId={reg.id}
                      bikes={bikes ?? []}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RegisterForm action={action} initial={reg} submitLabel="Speichern" />
    </div>
  );
}
