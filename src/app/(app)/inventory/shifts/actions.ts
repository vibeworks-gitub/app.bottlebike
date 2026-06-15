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

export type ShiftState = { error?: string };

export async function startShift(
  _prev: ShiftState,
  formData: FormData,
): Promise<ShiftState> {
  const supabase = await createClient();
  const locationId = str(formData.get("location_id"));
  if (!locationId) return { error: "Bike auswählen." };

  const r2oUserRaw = num(formData.get("r2o_user_id"));
  const r2oUserId = r2oUserRaw != null ? Math.trunc(r2oUserRaw) : null;
  const cashRegisterId = str(formData.get("cash_register_id"));
  const startCash = num(formData.get("start_cash"));
  const notes = str(formData.get("notes"));

  const { data, error } = await supabase.rpc("bb_start_shift", {
    p_location_id: locationId,
    p_r2o_user_id: r2oUserId,
    p_cash_register_id: cashRegisterId,
    p_start_cash: startCash ?? 0,
    p_notes: notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory/shifts");
  revalidatePath("/inventory");
  redirect(`/inventory/shifts/${data as string}`);
}

export async function endShift(
  shiftId: string,
  _prev: ShiftState,
  formData: FormData,
): Promise<ShiftState> {
  const supabase = await createClient();

  // Endzaehlungen sammeln
  type Count = { r2o_product_id: number; counted_qty: number };
  const counts: Count[] = [];
  for (const k of formData.keys()) {
    const m = k.match(/^count\[(\d+)\]$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const qty = num(formData.get(k));
    if (Number.isFinite(pid) && qty != null && qty >= 0) {
      counts.push({ r2o_product_id: pid, counted_qty: qty });
    }
  }

  if (counts.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht eingeloggt." };
    // Existing end-counts loeschen + neu einfuegen (idempotent bei Re-Submit)
    await supabase
      .from("bb_shift_counts")
      .delete()
      .eq("shift_id", shiftId)
      .eq("count_type", "end");
    const { error: iErr } = await supabase.from("bb_shift_counts").insert(
      counts.map((c) => ({
        owner_id: user.id,
        shift_id: shiftId,
        r2o_product_id: c.r2o_product_id,
        count_type: "end" as const,
        counted_qty: c.counted_qty,
        counted_by: user.id,
      })),
    );
    if (iErr) return { error: iErr.message };
  }

  const endCash = num(formData.get("end_cash"));
  const notes = str(formData.get("end_notes"));

  const { error } = await supabase.rpc("bb_end_shift", {
    p_shift_id: shiftId,
    p_end_cash: endCash,
    p_notes: notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory/shifts");
  revalidatePath(`/inventory/shifts/${shiftId}`);
  revalidatePath("/inventory");
  redirect(`/inventory/shifts/${shiftId}`);
}

export async function deleteShift(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bb_shifts").delete().eq("id", id);
  revalidatePath("/inventory/shifts");
}
