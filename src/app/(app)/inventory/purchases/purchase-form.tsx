"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import type {
  Location,
  Purchase,
  PurchaseItem,
  Supplier,
} from "@/lib/types/database";
import { createPurchase, type PurchaseState } from "./actions";

type FormAction = (
  state: PurchaseState,
  formData: FormData,
) => Promise<PurchaseState> | PurchaseState;

export type ProductOption = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  default_quantity?: number | null;
  default_unit_cost_net?: number | null;
  package_unit?: string | null;
  default_supplier_id?: string | null;
  product_vat?: number | null;
  product_price?: number | null;
  product_price_includes_vat?: boolean | null;
  deposit_product_id?: number | null;
  shelf_life_days?: number | null;
};

type Row = {
  uid: string;
  product_id: string;
  packages: string;
  singles: string;
  unit_cost_net: string;
  expiry_date: string;
  notes: string;
  // welche Felder wurden manuell vom User getippt (nicht auto-gefuellt)?
  dirty: { packages?: boolean; singles?: boolean; unit_cost_net?: boolean; expiry_date?: boolean; notes?: boolean };
  // Wenn diese Zeile automatisch als Pfand-Zusatz angelegt wurde:
  auto_deposit_for?: string; // uid der Hauptzeile
  auto_deposit_product_id?: number; // welches Produkt wurde dabei auto-gesetzt
};

function newRow(): Row {
  return {
    uid: Math.random().toString(36).slice(2),
    product_id: "",
    packages: "",
    singles: "",
    unit_cost_net: "",
    expiry_date: "",
    notes: "",
    dirty: {},
  };
}

function parseDec(s: string): number {
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
}

export function PurchaseForm({
  warehouses,
  suppliers,
  products,
  initial,
  action,
  mode = "create",
}: {
  warehouses: Location[];
  suppliers: Supplier[];
  products: ProductOption[];
  initial?: { purchase: Purchase; items: PurchaseItem[] };
  action?: FormAction;
  mode?: "create" | "edit";
}) {
  const productByIdInit = new Map<number, ProductOption>();
  for (const p of products) productByIdInit.set(p.product_id, p);

  function rowsFromInitial(): Row[] {
    if (!initial || initial.items.length === 0) return [newRow()];
    return initial.items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => {
        const opt = productByIdInit.get(it.r2o_product_id);
        const pkgSize = opt?.default_quantity ?? 0;
        const qty = Number(it.quantity);
        let packages = "";
        let singles = String(qty).replace(".", ",");
        if (pkgSize > 0 && qty > 0 && qty % pkgSize === 0) {
          packages = String(qty / pkgSize);
          singles = "";
        }
        return {
          uid: Math.random().toString(36).slice(2),
          product_id: String(it.r2o_product_id),
          packages,
          singles,
          unit_cost_net:
            it.unit_cost_net != null
              ? String(it.unit_cost_net).replace(".", ",")
              : "",
          expiry_date: it.expiry_date ?? "",
          notes: it.notes ?? "",
          dirty: {
            packages: !!packages,
            singles: !!singles,
            unit_cost_net: it.unit_cost_net != null,
            expiry_date: !!it.expiry_date,
            notes: !!it.notes,
          },
        };
      });
  }

  const [state, formAction, pending] = useActionState<PurchaseState, FormData>(
    action ?? createPurchase,
    {},
  );
  const [rows, setRows] = useState<Row[]>(rowsFromInitial());
  const [supplierId, setSupplierId] = useState<string>(
    initial?.purchase.supplier_id ?? "",
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initial?.purchase.invoice_date ?? "",
  );

  function addDays(baseIso: string, days: number): string {
    const d = baseIso ? new Date(baseIso) : new Date();
    if (!Number.isFinite(d.getTime())) return "";
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const productById = new Map<number, ProductOption>();
  for (const p of products) productById.set(p.product_id, p);

  function update(uid: string, field: keyof Row, value: string) {
    setRows((rs) => {
      let next = rs.map((r) => {
        if (r.uid !== uid) return r;
        const updated = { ...r, [field]: value };
        if (
          field === "packages" ||
          field === "singles" ||
          field === "unit_cost_net" ||
          field === "expiry_date" ||
          field === "notes"
        ) {
          updated.dirty = { ...r.dirty, [field]: true };
        }
        return updated;
      });

      // Wenn sich die Stk-Menge der Hauptzeile aendert (packages/singles),
      // die zugeordnete Auto-Pfand-Zeile mitnachfuehren — solange diese vom
      // User nicht selber editiert wurde.
      if (field === "packages" || field === "singles") {
        const mainRow = next.find((r) => r.uid === uid);
        if (mainRow) {
          const mainOpt = mainRow.product_id
            ? productById.get(Number(mainRow.product_id))
            : undefined;
          const newTotal = rowTotal(mainRow, mainOpt);
          next = next.map((r) => {
            if (
              r.auto_deposit_for === uid &&
              Number(r.product_id) === r.auto_deposit_product_id &&
              !r.dirty.packages &&
              !r.dirty.singles
            ) {
              return {
                ...r,
                packages: "",
                singles: newTotal > 0 ? String(newTotal) : "",
              };
            }
            return r;
          });
        }
      }
      return next;
    });
  }

  function defaultsForProduct(opt: ProductOption | undefined): {
    packages: string;
    singles: string;
    unit_cost_net: string;
    expiry_date: string;
  } {
    if (!opt)
      return { packages: "", singles: "", unit_cost_net: "", expiry_date: "" };
    const packages =
      opt.default_quantity != null && opt.default_quantity > 0 ? "1" : "";
    const singles = packages === "" ? "1" : "";
    const unit_cost_net =
      opt.default_unit_cost_net != null
        ? opt.default_unit_cost_net
            .toFixed(4)
            .replace(/\.?0+$/, "")
            .replace(".", ",")
        : "";
    const expiry_date =
      opt.shelf_life_days != null && opt.shelf_life_days > 0
        ? addDays(invoiceDate, opt.shelf_life_days)
        : "";
    return { packages, singles, unit_cost_net, expiry_date };
  }

  function rowTotal(r: Row, opt: ProductOption | undefined): number {
    const pkgSize = opt?.default_quantity ?? 0;
    return parseDec(r.packages) * (pkgSize || 0) + parseDec(r.singles);
  }

  // Wenn Produkt gewaehlt: ein Gebinde vorschlagen + EK netto vorbelegen
  // (nur wenn Felder noch leer sind). Lieferant uebernehmen falls Kopf noch leer.
  // Wenn Produkt einen Pfand-Artikel hinterlegt hat -> automatisch Zusatz-Position
  // mit gleicher Stueck-Menge anhaengen (nur einmal pro Auswahl).
  function handleProductChange(uid: string, value: string) {
    const opt = productById.get(Number(value));
    const depositOpt =
      opt?.deposit_product_id != null
        ? productById.get(opt.deposit_product_id)
        : undefined;

    setRows((rs) => {
      // 1) Hauptzeile aktualisieren — Auto-Fill ueberschreibt nicht-dirty Werte
      let updated = rs.map((r) => {
        if (r.uid !== uid) return r;
        const next: Row = { ...r, product_id: value };
        if (opt) {
          const d = defaultsForProduct(opt);
          if (!r.dirty.packages && !r.dirty.singles) {
            next.packages = d.packages;
            next.singles = d.singles;
          }
          if (!r.dirty.unit_cost_net) {
            next.unit_cost_net = d.unit_cost_net;
          }
          if (!r.dirty.expiry_date) {
            next.expiry_date = d.expiry_date;
          }
        } else {
          if (!r.dirty.packages) next.packages = "";
          if (!r.dirty.singles) next.singles = "";
          if (!r.dirty.unit_cost_net) next.unit_cost_net = "";
          if (!r.dirty.expiry_date) next.expiry_date = "";
        }
        return next;
      });

      const mainRow = updated.find((r) => r.uid === uid);
      const totalQty = mainRow ? rowTotal(mainRow, opt) : 0;

      // 2) Bestehende Auto-Pfand-Zeile fuer diese Hauptzeile finden
      const existingIdx = updated.findIndex((r) => r.auto_deposit_for === uid);
      const existing = existingIdx >= 0 ? updated[existingIdx] : null;
      // User hat die Zeile manuell angepasst (Produkt oder Felder)?
      const isUntouched =
        existing != null &&
        Number(existing.product_id) === existing.auto_deposit_product_id &&
        !existing.dirty.packages &&
        !existing.dirty.singles &&
        !existing.dirty.unit_cost_net &&
        !existing.dirty.expiry_date &&
        !existing.dirty.notes;

      if (!depositOpt) {
        // Neues Produkt hat keinen Pfand -> alte Auto-Pfand-Zeile entfernen (falls untouched)
        if (existing && isUntouched) {
          updated = updated.filter((_, i) => i !== existingIdx);
        }
        return updated;
      }

      // Neues Produkt hat Pfand. Existierende Auto-Zeile updaten oder neu anlegen.
      const d = defaultsForProduct(depositOpt);
      const depositSingles = totalQty > 0 ? String(totalQty) : d.singles;

      if (existing && isUntouched) {
        // Auto-Zeile auf das neue Pfand-Produkt umstellen
        updated = updated.map((r, i) =>
          i === existingIdx
            ? {
                ...r,
                product_id: String(depositOpt.product_id),
                auto_deposit_product_id: depositOpt.product_id,
                packages: "",
                singles: depositSingles,
                unit_cost_net: d.unit_cost_net,
                expiry_date: d.expiry_date,
                notes: `Pfand zu ${opt?.product_name ?? ""}`.trim(),
              }
            : r,
        );
        return updated;
      }

      // Wenn der User selber (manuell, nicht auto) das Pfand-Produkt schon in
      // der Liste hat -> nicht zusaetzlich auto-anlegen (vermeidet Doppelungen
      // wenn jemand die Pfand-Zeile von Hand ergaenzt hat). Auto-Pfand-Zeilen
      // anderer Hauptzeilen sind aber ok — jede Hauptzeile bekommt ihre eigene.
      const userAddedDeposit = updated.some(
        (r) =>
          Number(r.product_id) === depositOpt.product_id &&
          !r.auto_deposit_for,
      );
      if (userAddedDeposit) return updated;

      const depositRow: Row = {
        uid: Math.random().toString(36).slice(2),
        product_id: String(depositOpt.product_id),
        packages: "",
        singles: depositSingles,
        unit_cost_net: d.unit_cost_net,
        expiry_date: d.expiry_date,
        notes: `Pfand zu ${opt?.product_name ?? ""}`.trim(),
        dirty: {},
        auto_deposit_for: uid,
        auto_deposit_product_id: depositOpt.product_id,
      };
      return [...updated, depositRow];
    });

    if (opt?.default_supplier_id && !supplierId) {
      setSupplierId(opt.default_supplier_id);
    }
  }

  // Gesamtsummen pro Steuersatz aggregieren
  const vatBuckets = new Map<number, { net: number; vat: number }>();
  let totalNet = 0;
  let totalVat = 0;
  for (const r of rows) {
    const opt = r.product_id ? productById.get(Number(r.product_id)) : undefined;
    const pkgSize = opt?.default_quantity ?? 0;
    const qty = parseDec(r.packages) * (pkgSize || 0) + parseDec(r.singles);
    const unitNet = parseDec(r.unit_cost_net);
    if (qty <= 0 || unitNet <= 0) continue;
    const lineNet = qty * unitNet;
    const rate = Number(opt?.product_vat ?? 0);
    const lineVat = lineNet * (rate / 100);
    totalNet += lineNet;
    totalVat += lineVat;
    const b = vatBuckets.get(rate) ?? { net: 0, vat: 0 };
    b.net += lineNet;
    b.vat += lineVat;
    vatBuckets.set(rate, b);
  }
  const totalGross = totalNet + totalVat;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Lieferantenrechnung</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier_id">Lieferant</Label>
            <select
              id="supplier_id"
              name="supplier_id"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">— wählen —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destination_location_id">Ziel-Lager *</Label>
            <select
              id="destination_location_id"
              name="destination_location_id"
              required
              defaultValue={
                initial?.purchase.destination_location_id ?? warehouses[0]?.id ?? ""
              }
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {warehouses.length === 0 && (
                <option value="">— keins vorhanden —</option>
              )}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice_number">Rechnungsnummer</Label>
            <Input
              id="invoice_number"
              name="invoice_number"
              defaultValue={initial?.purchase.invoice_number ?? ""}
              placeholder="z.B. 2026-1234"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice_date">Rechnungsdatum</Label>
            <Input
              id="invoice_date"
              name="invoice_date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={initial?.purchase.notes ?? ""}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {products.length === 0 && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Keine Produkte gefunden — synchronisiere zuerst ready2order.
            </p>
          )}
          <div className="hidden grid-cols-[1.8fr_0.6fr_0.6fr_0.7fr_0.9fr_0.9fr_1fr_1fr_2rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Produkt</span>
            <span className="text-right">Gebinde</span>
            <span className="text-right">Einzeln</span>
            <span className="text-right">Σ Stk</span>
            <span className="text-right">EK netto/Stk</span>
            <span className="text-right">Summe netto</span>
            <span>MHD</span>
            <span>Notiz</span>
            <span />
          </div>
          {rows.map((r, idx) => {
            const opt = r.product_id ? productById.get(Number(r.product_id)) : undefined;
            const pkgSize =
              opt?.default_quantity && opt.default_quantity > 0
                ? Number(opt.default_quantity)
                : 0;
            const pkgUnit = opt?.package_unit ?? null;
            const total =
              parseDec(r.packages) * (pkgSize || 0) + parseDec(r.singles);
            return (
              <div
                key={r.uid}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[1.8fr_0.6fr_0.6fr_0.7fr_0.9fr_0.9fr_1fr_1fr_2rem] md:bg-transparent md:p-0 md:border-0"
              >
                <div className="flex flex-col gap-0.5">
                  <select
                    name={`items[${idx}][r2o_product_id]`}
                    value={r.product_id}
                    onChange={(e) => handleProductChange(r.uid, e.target.value)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                  >
                    <option value="">— Produkt wählen —</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.product_name ?? `#${p.product_id}`}
                        {p.product_itemnumber ? ` (${p.product_itemnumber})` : ""}
                      </option>
                    ))}
                  </select>
                  {pkgSize > 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      1 {pkgUnit ?? "Gebinde"} = {pkgSize} Stk
                    </span>
                  )}
                  {pkgSize === 0 && pkgUnit && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      Einheit: {pkgUnit}
                    </span>
                  )}
                </div>
                <Input
                  value={r.packages}
                  onChange={(e) => update(r.uid, "packages", e.target.value)}
                  inputMode="decimal"
                  placeholder={pkgSize > 0 ? "0" : "—"}
                  disabled={pkgSize === 0}
                  className="text-right"
                />
                <Input
                  value={r.singles}
                  onChange={(e) => update(r.uid, "singles", e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="text-right"
                />
                <div className="flex h-9 items-center justify-end rounded-md border border-dashed border-border px-3 text-sm font-medium tabular-nums">
                  {total > 0 ? fmtQty(total) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <input
                  type="hidden"
                  name={`items[${idx}][quantity]`}
                  value={total > 0 ? String(total) : ""}
                />
                <Input
                  name={`items[${idx}][unit_cost_net]`}
                  value={r.unit_cost_net}
                  onChange={(e) => update(r.uid, "unit_cost_net", e.target.value)}
                  inputMode="decimal"
                  placeholder={
                    opt?.default_unit_cost_net != null
                      ? opt.default_unit_cost_net.toFixed(2).replace(".", ",")
                      : "optional"
                  }
                  className="text-right"
                />
                <div className="flex h-9 items-center justify-end rounded-md border border-dashed border-border px-3 text-sm font-semibold tabular-nums">
                  {total > 0 && parseDec(r.unit_cost_net) > 0 ? (
                    formatEUR(total * parseDec(r.unit_cost_net))
                  ) : (
                    <span className="font-normal text-muted-foreground">—</span>
                  )}
                </div>
                <Input
                  name={`items[${idx}][expiry_date]`}
                  value={r.expiry_date}
                  onChange={(e) => update(r.uid, "expiry_date", e.target.value)}
                  type="date"
                />
                <Input
                  name={`items[${idx}][notes]`}
                  value={r.notes}
                  onChange={(e) => update(r.uid, "notes", e.target.value)}
                  placeholder="optional"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) =>
                      rs.length === 1 ? [newRow()] : rs.filter((x) => x.uid !== r.uid),
                    )
                  }
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  style={{ color: "var(--destructive)" }}
                  aria-label="Position entfernen"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setRows((rs) => [...rs, newRow()])}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                + Position
              </button>
              <p className="text-[10px] text-muted-foreground">
                Σ Stk = Gebinde × Gebinde-Größe + Einzeln · Summe netto = Σ Stk × EK netto
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-muted-foreground">Netto</span>
                <span className="min-w-24 text-right font-medium">
                  {formatEUR(totalNet)}
                </span>
              </div>
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Gesamt brutto
                </span>
                <span
                  className="min-w-24 text-right font-heading text-lg font-extrabold"
                  style={{ color: "var(--brand)" }}
                >
                  {formatEUR(totalGross)}
                </span>
              </div>
              {vatBuckets.size > 0 && (
                <div className="mt-1 border-t border-border pt-1">
                  {[...vatBuckets.entries()]
                    .sort(([a], [b]) => a - b)
                    .map(([rate, v]) => (
                      <div
                        key={rate}
                        className="flex items-center gap-6 text-xs tabular-nums text-muted-foreground"
                      >
                        <span>davon MwSt {rate}%</span>
                        <span className="min-w-24 text-right">
                          {formatEUR(v.vat)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <input type="hidden" name="total_gross" value={totalGross || ""} />
        </CardContent>
      </Card>

      {state.error && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          name="status"
          value="booked"
          disabled={pending}
        >
          {pending
            ? "Speichern…"
            : mode === "edit"
              ? "Buchen"
              : "Wareneingang buchen"}
        </Button>
        <Button
          type="submit"
          name="status"
          value="draft"
          variant="outline"
          disabled={pending}
        >
          {mode === "edit" ? "Entwurf speichern" : "Als Entwurf speichern"}
        </Button>
        <Link
          href="/inventory/purchases"
          className={buttonVariants({ variant: "ghost" })}
        >
          Abbrechen
        </Link>
        <span className="text-xs text-muted-foreground">
          Entwürfe erscheinen in der Liste, buchen aber noch nicht ins Lager.
        </span>
      </div>
    </form>
  );
}
