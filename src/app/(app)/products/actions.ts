"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export type ProductExtraState = { error?: string };

export async function saveProductExtras(
  r2oProductId: number,
  _prev: ProductExtraState,
  formData: FormData,
): Promise<ProductExtraState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const payload = {
    owner_id: user.id,
    r2o_product_id: r2oProductId,
    cost_price: num(formData.get("cost_price")),
    cost_includes_vat: formData.get("cost_includes_vat") === "on",
    supplier_id: str(formData.get("supplier_id")),
    reorder_level: num(formData.get("reorder_level")),
    target_margin_pct: num(formData.get("target_margin_pct")),
    package_unit: str(formData.get("package_unit")),
    package_qty: num(formData.get("package_qty")),
    custom_name: str(formData.get("custom_name")),
    custom_category: str(formData.get("custom_category")),
    notes: str(formData.get("notes")),
    last_purchase_date: str(formData.get("last_purchase_date")),
    last_purchase_price: num(formData.get("last_purchase_price")),
  };

  const { error } = await supabase
    .from("bb_product_extras")
    .upsert(payload, { onConflict: "owner_id,r2o_product_id" });

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${r2oProductId}`);
  redirect("/products");
}

export async function clearProductExtras(formData: FormData) {
  const id = Number(formData.get("r2o_product_id"));
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("bb_product_extras")
    .delete()
    .eq("owner_id", user.id)
    .eq("r2o_product_id", id);
  revalidatePath("/products");
}
