import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";
import { fixedCostDaily, fixedCostMonthly, frequencyLabel } from "@/lib/cost-math";
import type { FixedCost } from "@/lib/types/database";
import { deleteFixedCost } from "./actions";

export default async function FixedCostsPage() {
  const supabase = await createClient();
  const { data: costs } = await supabase
    .from("bb_fixed_costs")
    .select("*")
    .order("name", { ascending: true })
    .returns<FixedCost[]>();

  const empty = !costs || costs.length === 0;

  const totals = (costs ?? [])
    .filter((c) => c.active)
    .reduce(
      (a, c) => {
        a.daily += fixedCostDaily(c);
        a.monthly += fixedCostMonthly(c);
        return a;
      },
      { daily: 0, monthly: 0 },
    );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Kalkulationsbasis
          </p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Fixkosten
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Wiederkehrende Kosten — Lizenzen, Miete, Strom, Versicherungen etc.
            Werden in der Tagesabrechnung anteilig abgezogen.
          </p>
        </div>
        <Link href="/fixed-costs/new" className={buttonVariants()}>
          + Neue Fixkosten
        </Link>
      </header>

      {!empty && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Pro Monat"
            value={formatEUR(totals.monthly)}
            accent
          />
          <Stat label="Pro Tag" value={formatEUR(totals.daily)} />
          <Stat label="Aktive Posten" value={String(costs!.filter((c) => c.active).length)} />
        </section>
      )}

      {empty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
            }}
          >
            +
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Noch keine Fixkosten
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Trage Miete, Strom, Lizenzen etc. ein. Werden für Break-Even
              und Tagesabrechnung gebraucht.
            </p>
          </div>
          <Link href="/fixed-costs/new" className={buttonVariants()}>
            + Erste Fixkosten anlegen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Bezeichnung
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Kategorie
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Betrag
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Frequenz
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  ≈ pro Tag
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  ≈ pro Monat
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/fixed-costs/${c.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {c.name}
                    </Link>
                    {c.description && (
                      <p className="text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatEUR(c.amount)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {frequencyLabel(c.frequency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(fixedCostDaily(c))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(fixedCostMonthly(c))}
                  </TableCell>
                  <TableCell>
                    {c.active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/fixed-costs/${c.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteFixedCost}>
                        <input type="hidden" name="id" value={c.id} />
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-border bg-card px-3 py-2"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-heading text-xl font-extrabold tabular-nums tracking-tight"
        style={accent ? { color: "var(--brand)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
