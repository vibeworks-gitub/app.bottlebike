"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export type RegisterState = { error?: string };

export async function createRegister(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Name ist erforderlich." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const { error } = await supabase.from("bb_cash_registers").insert({
    owner_id: user.id,
    name,
    r2o_cash_register_id: str(formData.get("r2o_cash_register_id")),
    notes: str(formData.get("notes")),
  });
  if (error) return { error: error.message };
  revalidatePath("/inventory/cash-registers");
  revalidatePath("/inventory");
  redirect("/inventory/cash-registers");
}

export async function updateRegister(
  id: string,
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Name ist erforderlich." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_cash_registers")
    .update({
      name,
      r2o_cash_register_id: str(formData.get("r2o_cash_register_id")),
      notes: str(formData.get("notes")),
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory/cash-registers");
  revalidatePath("/inventory");
  redirect("/inventory/cash-registers");
}

export async function deleteRegister(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bb_cash_registers").delete().eq("id", id);
  revalidatePath("/inventory/cash-registers");
  revalidatePath("/inventory");
}

export type AssignState = { error?: string; ok?: boolean };

function parseTs(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

// Pruefe ob fuer dieselbe Kassa bereits eine Zuweisung diesen Zeitraum schneidet.
async function findOverlap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cashRegisterId: string,
  validFrom: string,
  validTo: string | null,
  excludeId: string | null,
): Promise<{ id: string; location_id: string; valid_from: string; valid_to: string | null } | null> {
  let query = supabase
    .from("bb_register_assignments")
    .select("id, location_id, valid_from, valid_to")
    .eq("cash_register_id", cashRegisterId);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  for (const a of data ?? []) {
    const aFrom = a.valid_from;
    const aTo = a.valid_to;
    // Overlap: [aFrom, aTo) vs [validFrom, validTo)  (To = null heisst infinity)
    const noOverlap =
      (validTo !== null && aFrom >= validTo) ||
      (aTo !== null && validFrom >= aTo);
    if (!noOverlap) return a;
  }
  return null;
}

export async function addAssignment(
  registerId: string,
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const locationId = str(formData.get("location_id"));
  if (!locationId) return { error: "Bitte einen Standort wählen." };
  const validFrom = parseTs(formData.get("valid_from")) ?? new Date().toISOString();
  const validTo = parseTs(formData.get("valid_to"));
  if (validTo && validTo <= validFrom) {
    return { error: "„Gültig bis“ muss nach „Gültig ab“ liegen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const overlap = await findOverlap(supabase, registerId, validFrom, validTo, null);
  if (overlap) {
    return {
      error: `Zeitraum überschneidet sich mit bestehender Zuweisung (${new Date(overlap.valid_from).toLocaleString("de-DE")} – ${overlap.valid_to ? new Date(overlap.valid_to).toLocaleString("de-DE") : "offen"}).`,
    };
  }

  const { error } = await supabase.from("bb_register_assignments").insert({
    owner_id: user.id,
    cash_register_id: registerId,
    location_id: locationId,
    valid_from: validFrom,
    valid_to: validTo,
    notes: str(formData.get("notes")),
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory/cash-registers");
  revalidatePath(`/inventory/cash-registers/${registerId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function updateAssignment(
  assignmentId: string,
  registerId: string,
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const locationId = str(formData.get("location_id"));
  if (!locationId) return { error: "Bitte einen Standort wählen." };
  const validFrom = parseTs(formData.get("valid_from"));
  const validTo = parseTs(formData.get("valid_to"));
  if (!validFrom) return { error: "Gültig ab fehlt." };
  if (validTo && validTo <= validFrom) {
    return { error: "„Gültig bis“ muss nach „Gültig ab“ liegen." };
  }

  const supabase = await createClient();
  const overlap = await findOverlap(supabase, registerId, validFrom, validTo, assignmentId);
  if (overlap) {
    return {
      error: `Zeitraum überschneidet sich mit bestehender Zuweisung (${new Date(overlap.valid_from).toLocaleString("de-DE")} – ${overlap.valid_to ? new Date(overlap.valid_to).toLocaleString("de-DE") : "offen"}).`,
    };
  }

  const { error } = await supabase
    .from("bb_register_assignments")
    .update({
      location_id: locationId,
      valid_from: validFrom,
      valid_to: validTo,
      notes: str(formData.get("notes")),
    })
    .eq("id", assignmentId);
  if (error) return { error: error.message };

  revalidatePath("/inventory/cash-registers");
  revalidatePath(`/inventory/cash-registers/${registerId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function endAssignment(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const registerId = String(formData.get("register_id") ?? "");
  if (!assignmentId) return;
  const supabase = await createClient();
  await supabase
    .from("bb_register_assignments")
    .update({ valid_to: new Date().toISOString() })
    .eq("id", assignmentId)
    .is("valid_to", null);
  revalidatePath("/inventory/cash-registers");
  if (registerId) revalidatePath(`/inventory/cash-registers/${registerId}`);
  revalidatePath("/inventory");
}

export async function deleteAssignment(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const registerId = String(formData.get("register_id") ?? "");
  if (!assignmentId) return;
  const supabase = await createClient();
  await supabase.from("bb_register_assignments").delete().eq("id", assignmentId);
  revalidatePath("/inventory/cash-registers");
  if (registerId) revalidatePath(`/inventory/cash-registers/${registerId}`);
  revalidatePath("/inventory");
}
