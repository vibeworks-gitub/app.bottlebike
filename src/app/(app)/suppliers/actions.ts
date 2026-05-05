"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export type SupplierState = { error?: string };

export async function createSupplier(
  _prev: SupplierState,
  formData: FormData,
): Promise<SupplierState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Name ist erforderlich." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const { error } = await supabase.from("bb_suppliers").insert({
    owner_id: user.id,
    name,
    contact_name: str(formData.get("contact_name")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    address: str(formData.get("address")),
    notes: str(formData.get("notes")),
  });

  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplier(
  id: string,
  _prev: SupplierState,
  formData: FormData,
): Promise<SupplierState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Name ist erforderlich." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_suppliers")
    .update({
      name,
      contact_name: str(formData.get("contact_name")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      address: str(formData.get("address")),
      notes: str(formData.get("notes")),
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bb_suppliers").delete().eq("id", id);
  revalidatePath("/suppliers");
}
