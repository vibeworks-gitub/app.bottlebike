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

function buildPayload(formData: FormData) {
  return {
    sku: String(formData.get("sku") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    description: str(formData.get("description")),
    cost_price: num(formData.get("cost_price")) ?? 0,
    selling_price: num(formData.get("selling_price")) ?? 0,
    vat_rate: num(formData.get("vat_rate")) ?? 19,
    image_url: str(formData.get("image_url")),
    stock: Math.round(num(formData.get("stock")) ?? 0),
    weight_kg: num(formData.get("weight_kg")),
    width_cm: num(formData.get("width_cm")),
    height_cm: num(formData.get("height_cm")),
    depth_cm: num(formData.get("depth_cm")),
    active: formData.get("active") === "on",
  };
}

export type ProductFormState = { error?: string };

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const payload = buildPayload(formData);
  if (!payload.sku || !payload.name) {
    return { error: "SKU und Name sind erforderlich." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const payload = buildPayload(formData);
  if (!payload.sku || !payload.name) {
    return { error: "SKU und Name sind erforderlich." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").update(payload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect("/products");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/products");
}
