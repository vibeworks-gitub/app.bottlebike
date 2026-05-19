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

export type TransferState = { error?: string };

export async function createTransfer(
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const from = str(formData.get("from_location_id"));
  const to = str(formData.get("to_location_id"));
  const notes = str(formData.get("notes"));
  if (!from || !to) return { error: "Quelle und Ziel müssen gesetzt sein." };
  if (from === to) return { error: "Quelle und Ziel müssen unterschiedlich sein." };

  type Row = { r2o_product_id: number; quantity: number };
  const rows: Row[] = [];
  const indices = new Set<number>();
  for (const k of formData.keys()) {
    const m = k.match(/^items\[(\d+)\]\[/);
    if (m) indices.add(Number(m[1]));
  }
  for (const i of [...indices].sort((a, b) => a - b)) {
    const pid = num(formData.get(`items[${i}][r2o_product_id]`));
    const qty = num(formData.get(`items[${i}][quantity]`));
    if (!pid || !qty || qty <= 0) continue;
    rows.push({ r2o_product_id: Math.trunc(pid), quantity: qty });
  }
  if (rows.length === 0)
    return { error: "Mindestens eine Position mit Menge > 0 angeben." };

  const occurredAt = new Date().toISOString();
  const movements = rows.map((r) => ({
    owner_id: user.id,
    r2o_product_id: r.r2o_product_id,
    from_location_id: from,
    to_location_id: to,
    quantity: r.quantity,
    type: "transfer" as const,
    notes,
    occurred_at: occurredAt,
    created_by: user.id,
  }));
  const { error } = await supabase.from("bb_stock_movements").insert(movements);
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  redirect("/inventory");
}
