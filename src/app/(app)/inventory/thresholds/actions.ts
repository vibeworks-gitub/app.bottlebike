"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ThresholdState = { error?: string; ok?: boolean };

function num(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function setThreshold(
  _prev: ThresholdState,
  formData: FormData,
): Promise<ThresholdState> {
  const locationId = String(formData.get("location_id") ?? "");
  const productId = Number(formData.get("r2o_product_id"));
  const min = num(formData.get("min_quantity"));
  if (!locationId || !Number.isFinite(productId)) {
    return { error: "Standort und Produkt sind erforderlich." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  if (min === null || min <= 0) {
    await supabase
      .from("bb_stock_thresholds")
      .delete()
      .eq("owner_id", user.id)
      .eq("location_id", locationId)
      .eq("r2o_product_id", productId);
  } else {
    const { error } = await supabase.from("bb_stock_thresholds").upsert(
      {
        owner_id: user.id,
        location_id: locationId,
        r2o_product_id: productId,
        min_quantity: min,
      },
      { onConflict: "owner_id,r2o_product_id,location_id" },
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/inventory/thresholds");
  revalidatePath("/inventory");
  return { ok: true };
}
