"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type PurchaseState = { error?: string };

export async function createPurchase(
  _prev: PurchaseState,
  formData: FormData,
): Promise<PurchaseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const destination = str(formData.get("destination_location_id"));
  if (!destination) return { error: "Ziel-Lager fehlt." };

  // Items aus FormData ziehen — Felder heissen items[i][...]
  type ItemDraft = {
    r2o_product_id: number;
    quantity: number;
    unit_cost_net: number | null;
    expiry_date: string | null;
    notes: string | null;
  };
  const items: ItemDraft[] = [];
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = key.match(/^items\[(\d+)\]\[/);
    if (m) indices.add(Number(m[1]));
  }
  for (const i of [...indices].sort((a, b) => a - b)) {
    const pid = num(formData.get(`items[${i}][r2o_product_id]`));
    const qty = num(formData.get(`items[${i}][quantity]`));
    if (!pid || !qty || qty <= 0) continue;
    items.push({
      r2o_product_id: Math.trunc(pid),
      quantity: qty,
      unit_cost_net: num(formData.get(`items[${i}][unit_cost_net]`)),
      expiry_date: str(formData.get(`items[${i}][expiry_date]`)),
      notes: str(formData.get(`items[${i}][notes]`)),
    });
  }
  if (items.length === 0)
    return { error: "Mindestens eine Position mit Menge > 0 angeben." };

  const totalNet = items.reduce(
    (acc, it) => acc + (it.unit_cost_net ?? 0) * it.quantity,
    0,
  );

  const { data: purchase, error: pErr } = await supabase
    .from("bb_purchases")
    .insert({
      owner_id: user.id,
      supplier_id: str(formData.get("supplier_id")),
      invoice_number: str(formData.get("invoice_number")),
      invoice_date: str(formData.get("invoice_date")),
      destination_location_id: destination,
      total_net: totalNet || null,
      total_gross: num(formData.get("total_gross")),
      notes: str(formData.get("notes")),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (pErr || !purchase) return { error: pErr?.message ?? "Fehler beim Anlegen." };

  const itemRows = items.map((it, idx) => ({
    owner_id: user.id,
    purchase_id: purchase.id,
    r2o_product_id: it.r2o_product_id,
    quantity: it.quantity,
    unit_cost_net: it.unit_cost_net,
    expiry_date: it.expiry_date,
    notes: it.notes,
    sort_order: idx,
  }));
  const { error: iErr } = await supabase.from("bb_purchase_items").insert(itemRows);
  if (iErr) {
    // Rollback: Purchase loeschen damit kein Waisen-Datensatz bleibt
    await supabase.from("bb_purchases").delete().eq("id", purchase.id);
    return { error: iErr.message };
  }

  revalidatePath("/inventory/purchases");
  revalidatePath("/inventory");
  redirect("/inventory/purchases");
}

export async function deletePurchase(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  // Stock-Movements zu diesem Wareneingang umkehren waere sauber, aber ON DELETE
  // CASCADE auf items haengt nicht an movements. Vorerst nur Items+Purchase loeschen,
  // existierende sale/transfer-Bewegungen anderer Quellen bleiben unberuehrt.
  // TODO: Reversal-Movement bei Loeschung erzeugen.
  await supabase.from("bb_purchases").delete().eq("id", id);
  revalidatePath("/inventory/purchases");
  revalidatePath("/inventory");
}
