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

export type FixedCostState = { error?: string };

function payload(formData: FormData) {
  const amount = num(formData.get("amount"));
  if (amount == null) return { error: "Betrag ist erforderlich." } as const;
  const name = str(formData.get("name"));
  if (!name) return { error: "Name ist erforderlich." } as const;
  const frequency = String(formData.get("frequency") ?? "monthly");
  if (!["daily", "weekly", "monthly", "yearly"].includes(frequency))
    return { error: "Ungültige Frequenz." } as const;
  const start_date = str(formData.get("start_date"));
  if (!start_date)
    return { error: "Gültig ab ist erforderlich." } as const;

  return {
    ok: true as const,
    data: {
      name,
      amount,
      frequency,
      start_date,
      description: str(formData.get("description")),
      category: str(formData.get("category")),
      end_date: str(formData.get("end_date")),
      notes: str(formData.get("notes")),
    },
  };
}

export async function createFixedCost(
  _prev: FixedCostState,
  formData: FormData,
): Promise<FixedCostState> {
  const p = payload(formData);
  if ("error" in p) return p;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const { error } = await supabase
    .from("bb_fixed_costs")
    .insert({ ...p.data, owner_id: user.id });
  if (error) return { error: error.message };
  revalidatePath("/fixed-costs");
  redirect("/fixed-costs");
}

export async function updateFixedCost(
  id: string,
  _prev: FixedCostState,
  formData: FormData,
): Promise<FixedCostState> {
  const p = payload(formData);
  if ("error" in p) return p;

  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_fixed_costs")
    .update({ ...p.data, active: formData.get("active") === "on" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/fixed-costs");
  redirect("/fixed-costs");
}

export async function deleteFixedCost(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bb_fixed_costs").delete().eq("id", id);
  revalidatePath("/fixed-costs");
}
