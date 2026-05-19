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
import { formatEUR } from "@/lib/format";
import type { Location, Purchase, Supplier } from "@/lib/types/database";
import { deletePurchase } from "./actions";

const fmtDate = new Intl.DateTimeFormat("de-DE", { dateStyle: "short" });

export default async function PurchasesPage() {
  const supabase = await createClient();
  const [{ data: purchases }, { data: suppliers }, { data: locations }] =
    await Promise.all([
      supabase
        .from("bb_purchases")
        .select("*")
        .order("invoice_date", { ascending: false, nullsFirst: false })
        .order("received_at", { ascending: false })
        .limit(100)
        .returns<Purchase[]>(),
      supabase.from("bb_suppliers").select("id, name").returns<Pick<Supplier, "id" | "name">[]>(),
      supabase.from("bb_locations").select("id, name").returns<Pick<Location, "id" | "name">[]>(),
    ]);

  const supById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const locById = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const empty = !purchases || purchases.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Wareneingang
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Erfasste Lieferantenrechnungen. Jede Position bucht direkt ins
            Ziel-Lager.
          </p>
        </div>
        <Link href="/inventory/purchases/new" className={buttonVariants()}>
          + Neuer Wareneingang
        </Link>
      </header>

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
              Noch kein Wareneingang
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Erfasse die erste Lieferantenrechnung.
            </p>
          </div>
          <Link href="/inventory/purchases/new" className={buttonVariants()}>
            + Ersten Wareneingang erfassen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Datum
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Rechnung
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Lieferant
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Ziel
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                  Netto
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                  Brutto
                </TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    {p.invoice_date
                      ? fmtDate.format(new Date(p.invoice_date))
                      : fmtDate.format(new Date(p.received_at))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.invoice_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.supplier_id ? supById.get(p.supplier_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {locById.get(p.destination_location_id) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatEUR(p.total_net)}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatEUR(p.total_gross)}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={deletePurchase}>
                      <input type="hidden" name="id" value={p.id} />
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
