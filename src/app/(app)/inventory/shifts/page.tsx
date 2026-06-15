import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEUR } from "@/lib/format";
import type { Location, Shift, StaffCost } from "@/lib/types/database";

const dt = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

function staffName(
  s: Pick<StaffCost, "display_name" | "role"> | undefined,
  id: number | null,
): string {
  if (!s && id == null) return "—";
  if (!s) return `User #${id}`;
  return s.role ? `${s.display_name} · ${s.role}` : s.display_name;
}

function fmtDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default async function ShiftsPage() {
  const supabase = await createClient();
  const [{ data: shifts }, { data: locations }, { data: staff }] =
    await Promise.all([
      supabase
        .from("bb_shifts")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50)
        .returns<Shift[]>(),
      supabase
        .from("bb_locations")
        .select("id, name")
        .returns<Pick<Location, "id" | "name">[]>(),
      supabase
        .from("bb_staff_costs")
        .select("r2o_user_id, display_name, role, commission_pct")
        .returns<
          Pick<StaffCost, "r2o_user_id" | "display_name" | "role" | "commission_pct">[]
        >(),
    ]);

  const locById = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const staffById = new Map<
    number,
    Pick<StaffCost, "display_name" | "role" | "commission_pct">
  >();
  for (const s of staff ?? []) {
    if (s.r2o_user_id != null) {
      staffById.set(s.r2o_user_id, {
        display_name: s.display_name,
        role: s.role,
        commission_pct: s.commission_pct,
      });
    }
  }

  const open = (shifts ?? []).filter((s) => s.status === "open");
  const closed = (shifts ?? []).filter((s) => s.status === "closed");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Schichten
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schicht starten = Anfangsbestand-Snapshot · live verfolgen ·
            Endbestand zählen, Kasse abschließen.
          </p>
        </div>
        <Link href="/inventory/shifts/new" className={buttonVariants()}>
          + Schicht starten
        </Link>
      </header>

      {open.length > 0 && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {open.map((s) => (
            <Card
              key={s.id}
              className="border-2"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--brand) 35%, transparent)",
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{locById.get(s.location_id) ?? "—"}</span>
                  <Badge
                    style={{
                      backgroundColor: "var(--brand)",
                      color: "white",
                    }}
                  >
                    LIVE
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {staffName(
                  s.r2o_user_id != null ? staffById.get(s.r2o_user_id) : undefined,
                  s.r2o_user_id,
                )}{" "}
                  · seit {dt.format(new Date(s.started_at))} ·{" "}
                  {fmtDuration(s.started_at, null)}
                </p>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/inventory/shifts/${s.id}`}
                  className={buttonVariants()}
                >
                  Live-Dashboard öffnen →
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Letzte Schichten</h2>
        {closed.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
            Noch keine abgeschlossenen Schichten.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Bike
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Mitarbeiter
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Beginn
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Ende
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Dauer
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Wechselgeld
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    End-Cash
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      {locById.get(s.location_id) ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {staffName(
                        s.r2o_user_id != null
                          ? staffById.get(s.r2o_user_id)
                          : undefined,
                        s.r2o_user_id,
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {dt.format(new Date(s.started_at))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.ended_at ? dt.format(new Date(s.ended_at)) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fmtDuration(s.started_at, s.ended_at)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatEUR(s.start_cash_eur)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatEUR(s.end_cash_eur)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/inventory/shifts/${s.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
