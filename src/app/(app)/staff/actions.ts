"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function int(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export type StaffCostState = { error?: string };

function payload(formData: FormData) {
  const display_name = str(formData.get("display_name"));
  if (!display_name) return { error: "Name ist erforderlich." } as const;
  const start_date = str(formData.get("start_date"));
  if (!start_date)
    return { error: "Eintrittsdatum ist erforderlich." } as const;
  const monthly_salary = num(formData.get("monthly_salary"));
  const hourly_rate = num(formData.get("hourly_rate"));
  if (monthly_salary == null && hourly_rate == null)
    return {
      error: "Bitte Monatslohn ODER Stundensatz eintragen.",
    } as const;

  return {
    ok: true as const,
    data: {
      display_name,
      r2o_user_id: int(formData.get("r2o_user_id")),
      role: str(formData.get("role")),
      monthly_salary,
      hourly_rate,
      hours_per_week: num(formData.get("hours_per_week")),
      employer_cost_factor:
        num(formData.get("employer_cost_factor")) ?? 1.3,
      start_date,
      end_date: str(formData.get("end_date")),
      notes: str(formData.get("notes")),
    },
  };
}

export async function createStaffCost(
  _prev: StaffCostState,
  formData: FormData,
): Promise<StaffCostState> {
  const p = payload(formData);
  if ("error" in p) return p;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };
  const { error } = await supabase
    .from("bb_staff_costs")
    .insert({ ...p.data, owner_id: user.id });
  if (error) return { error: error.message };
  revalidatePath("/staff");
  redirect("/staff");
}

export async function updateStaffCost(
  id: string,
  _prev: StaffCostState,
  formData: FormData,
): Promise<StaffCostState> {
  const p = payload(formData);
  if ("error" in p) return p;
  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_staff_costs")
    .update({ ...p.data, active: formData.get("active") === "on" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/staff");
  redirect("/staff");
}

export async function deleteStaffCost(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bb_staff_costs").delete().eq("id", id);
  revalidatePath("/staff");
}
