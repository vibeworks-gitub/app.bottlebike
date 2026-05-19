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
import type { CashRegisterStatus } from "@/lib/types/database";
import { deleteRegister } from "./actions";

export default async function CashRegistersPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("bb_cash_registers_status")
    .select("*")
    .order("name", { ascending: true })
    .returns<CashRegisterStatus[]>();

  const empty = !rows || rows.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Kassen
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kassageräte und ihre aktuelle Zuweisung an eine Verkaufsstelle.
            Verkäufe einer Kassa werden automatisch der zum Beleg-Zeitpunkt
            zugewiesenen Verkaufsstelle abgebucht.
          </p>
        </div>
        <Link href="/inventory/cash-registers/new" className={buttonVariants()}>
          + Neue Kassa
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
              Noch keine Kassen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege jedes Kassagerät an und ordne es einer Verkaufsstelle zu.
            </p>
          </div>
          <Link href="/inventory/cash-registers/new" className={buttonVariants()}>
            + Erste Kassa anlegen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  r2o-ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Aktuell zugewiesen
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/inventory/cash-registers/${r.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.r2o_cash_register_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.current_location_name ? (
                      <span>
                        {r.current_location_name}{" "}
                        <Badge variant="outline" className="ml-1">
                          {r.current_location_type === "warehouse"
                            ? "Lager"
                            : "Bike"}
                        </Badge>
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        style={{ color: "var(--destructive)" }}
                      >
                        nicht zugewiesen
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/inventory/cash-registers/${r.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteRegister}>
                        <input type="hidden" name="id" value={r.id} />
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
