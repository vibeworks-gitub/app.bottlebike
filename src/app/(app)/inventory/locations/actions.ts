"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export type LocationState = { error?: string };

const TYPES = ["warehouse", "bike"] as const;

export async function createLocation(
  _prev: LocationState,
  formData: FormData,
): Promise<LocationState> {
  const name = str(formData.get("name"));
  const type = String(formData.get("type") ?? "");
  if (!name) return { error: "Name ist erforderlich." };
  if (!TYPES.includes(type as (typeof TYPES)[number]))
    return { error: "Typ ist ungültig." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const { error } = await supabase.from("bb_locations").insert({
    owner_id: user.id,
    name,
    type,
    notes: str(formData.get("notes")),
    restock_source_location_id: str(formData.get("restock_source_location_id")),
  });
  if (error) return { error: error.message };
  revalidatePath("/inventory/locations");
  revalidatePath("/inventory");
  redirect("/inventory/locations");
}

export async function updateLocation(
  id: string,
  _prev: LocationState,
  formData: FormData,
): Promise<LocationState> {
  const name = str(formData.get("name"));
  const type = String(formData.get("type") ?? "");
  if (!name) return { error: "Name ist erforderlich." };
  if (!TYPES.includes(type as (typeof TYPES)[number]))
    return { error: "Typ ist ungültig." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_locations")
    .update({
      name,
      type,
      notes: str(formData.get("notes")),
      active: formData.get("active") === "on",
      restock_source_location_id: str(formData.get("restock_source_location_id")),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory/locations");
  revalidatePath("/inventory");
  redirect("/inventory/locations");
}

export async function deleteLocation(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bb_locations").delete().eq("id", id);
  revalidatePath("/inventory/locations");
  revalidatePath("/inventory");
}
