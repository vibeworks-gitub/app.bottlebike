import { createClient } from "@/lib/supabase/server";
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
import { syncProducts } from "../sync-actions";
import { SyncButton } from "../sync-button";

type R2oProductRow = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  product_barcode: string | null;
  product_price: number | null;
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
  product_active: boolean | null;
  product_sold_out: boolean | null;
  product_stock_enabled: boolean | null;
  product_stock_value: number | null;
  product_stock_reorder_level: number | null;
  product_updated_at: string | null;
  synced_at: string;
};

export default async function R2oProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("r2o_products")
    .select(
      "product_id, product_name, product_itemnumber, product_barcode, product_price, product_price_includes_vat, product_vat, product_active, product_sold_out, product_stock_enabled, product_stock_value, product_stock_reorder_level, product_updated_at, synced_at",
    )
    .order("product_name", { ascending: true })
    .returns<R2oProductRow[]>();

  const lastSync = products?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Produkte</h2>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Zuletzt synchronisiert:{" "}
              {new Date(lastSync).toLocaleString("de-DE")}
            </p>
          )}
        </div>
        <SyncButton action={syncProducts} />
      </div>

      {!products?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Noch keine Daten. Klick auf{" "}
          <span className="font-medium">„Jetzt synchronisieren"</span>, um deine
          Produkte aus ready2order zu laden.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  SKU / Barcode
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Preis
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  MwSt
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Lager
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Nachbestellen ab
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.product_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.product_id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.product_name ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {[p.product_itemnumber, p.product_barcode]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(p.product_price ?? 0)}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {p.product_price_includes_vat ? "brutto" : "netto"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.product_vat != null ? `${p.product_vat}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.product_stock_enabled
                      ? (p.product_stock_value ?? 0)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.product_stock_enabled
                      ? (p.product_stock_reorder_level ?? 0)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.product_active ? (
                        <Badge variant="secondary">aktiv</Badge>
                      ) : (
                        <Badge variant="outline">inaktiv</Badge>
                      )}
                      {p.product_sold_out && (
                        <Badge variant="outline">ausverkauft</Badge>
                      )}
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
