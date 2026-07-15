"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/role";

const CountItem = z.object({
  productId: z.number().int(),
  countedQty: z.number(),
  expectedQty: z.number().nullable(),
  notes: z.string().nullable().optional(),
});

const TransferItem = z.object({
  productId: z.number().int(),
  qty: z.number().positive(),
});

async function requireCrew() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt");
  if (user.role !== "crew") throw new Error("Nur Crew-Modus");
  return user;
}

async function requireOpenShiftId() {
  const user = await requireCrew();
  const supabase = await createClient();
  const { data } = await supabase
    .from("bb_shifts")
    .select("id,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();
  return { user, shift: data, supabase };
}

export async function openShift(input: { startCashEur: number }) {
  const user = await requireCrew();
  if (!user.defaultLocationId)
    return { ok: false as const, error: "Kein Default-Lager hinterlegt" };
  if (!user.defaultCashRegisterId)
    return { ok: false as const, error: "Keine Default-Kasse hinterlegt" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bb_shifts")
    .insert({
      owner_id: user.ownerId,
      location_id: user.defaultLocationId,
      cash_register_id: user.defaultCashRegisterId,
      r2o_user_id: user.r2oUserId,
      started_at: new Date().toISOString(),
      start_cash_eur: input.startCashEur,
      status: "open",
      created_by: user.authUserId,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crew");
  return { ok: true as const, shiftId: data.id };
}

export async function confirmStartCounts(
  shiftId: string,
  items: z.infer<typeof CountItem>[],
) {
  const user = await requireCrew();
  const parsed = z.array(CountItem).safeParse(items);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Daten" };
  const supabase = await createClient();
  const rows = parsed.data.map((i) => ({
    shift_id: shiftId,
    owner_id: user.ownerId,
    r2o_product_id: i.productId,
    count_type: "start" as const,
    counted_qty: i.countedQty,
    expected_qty: i.expectedQty,
    notes: i.notes ?? null,
    counted_at: new Date().toISOString(),
    counted_by: user.authUserId,
  }));
  const { error } = await supabase
    .from("bb_shift_counts")
    .upsert(rows, { onConflict: "shift_id,r2o_product_id,count_type" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function recordRestockTransfers(
  items: z.infer<typeof TransferItem>[],
) {
  const user = await requireCrew();
  const parsed = z.array(TransferItem).safeParse(items);
  if (!parsed.success || parsed.data.length === 0)
    return { ok: false as const, error: "Keine Umbuchungen angegeben" };
  if (!user.defaultLocationId)
    return { ok: false as const, error: "Kein Default-Lager hinterlegt" };

  const supabase = await createClient();
  const { data: aperobike } = await supabase
    .from("bb_locations")
    .select("id,restock_source_location_id")
    .eq("id", user.defaultLocationId)
    .single();
  if (!aperobike?.restock_source_location_id)
    return {
      ok: false as const,
      error: "Kein Nachschub-Lager für dieses Bike hinterlegt",
    };

  const now = new Date().toISOString();
  const rows = parsed.data.map((i) => ({
    owner_id: user.ownerId,
    r2o_product_id: i.productId,
    from_location_id: aperobike.restock_source_location_id,
    to_location_id: aperobike.id,
    quantity: i.qty,
    type: "transfer" as const,
    occurred_at: now,
    created_by: user.authUserId,
    notes: "Nachschub Schicht-Start",
  }));
  const { error } = await supabase.from("bb_stock_movements").insert(rows);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function confirmEndCounts(
  shiftId: string,
  items: z.infer<typeof CountItem>[],
) {
  const user = await requireCrew();
  const parsed = z.array(CountItem).safeParse(items);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Daten" };
  const supabase = await createClient();
  const rows = parsed.data.map((i) => ({
    shift_id: shiftId,
    owner_id: user.ownerId,
    r2o_product_id: i.productId,
    count_type: "end" as const,
    counted_qty: i.countedQty,
    expected_qty: i.expectedQty,
    notes: i.notes ?? null,
    counted_at: new Date().toISOString(),
    counted_by: user.authUserId,
  }));
  const { error } = await supabase
    .from("bb_shift_counts")
    .upsert(rows, { onConflict: "shift_id,r2o_product_id,count_type" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function closeShift(input: { endCashEur: number }) {
  const { shift, supabase } = await requireOpenShiftId();
  if (!shift) return { ok: false as const, error: "Keine offene Schicht" };
  const { error } = await supabase
    .from("bb_shifts")
    .update({
      ended_at: new Date().toISOString(),
      end_cash_eur: input.endCashEur,
      status: "closed",
    })
    .eq("id", shift.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crew");
  return { ok: true as const };
}
