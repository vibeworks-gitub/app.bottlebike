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
import { formatEUR, formatPercent } from "@/lib/format";
import { deleteProduct } from "./actions";
import type { Product } from "@/lib/types/database";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Product[]>();

  const empty = !error && (products ?? []).length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Stammdaten
          </p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Produkte
          </h1>
        </div>
        <Link
          href="/products/new"
          className={buttonVariants()}
        >
          + Neues Produkt
        </Link>
      </header>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Fehler beim Laden: {error.message}
        </p>
      )}

      {empty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold"
            style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
          >
            +
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Noch keine Produkte
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege das erste Produkt an, um Kalkulationen zu starten.
            </p>
          </div>
          <Link href="/products/new" className={buttonVariants()}>
            + Erstes Produkt anlegen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  SKU
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  EK netto
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  VK netto
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Marge
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Bestand
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products ?? []).map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.sku}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/products/${p.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(p.cost_price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatEUR(p.selling_price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(p.margin_percent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.stock}
                  </TableCell>
                  <TableCell>
                    {p.active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <Link
                        href={`/products/${p.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteProduct}>
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
