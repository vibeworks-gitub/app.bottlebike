"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/role";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateAll() {
  revalidatePath("/staff/payroll");
  revalidatePath("/staff");
  revalidatePath("/dashboard");
}

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return null;
  return user;
}

// Tages-Provision live rechnen und als Auszahlung einfrieren.
export async function payoutDay(r2oUserId: number, workDate: string) {
  if (!DATE_RE.test(workDate) || !Number.isInteger(r2oUserId))
    return { ok: false as const, error: "Ungültige Eingabe" };
  const user = await requireOwner();
  if (!user) return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();

  // Belege des Wien-Tags laden (Fenster in UTC: Wien-Tag −2h ... +24h reicht,
  // wir filtern danach exakt über den Wien-Tag).
  const dayStart = new Date(`${workDate}T00:00:00+02:00`);
  const windowFrom = new Date(dayStart.getTime() - 3 * 3600_000).toISOString();
  const windowTo = new Date(dayStart.getTime() + 27 * 3600_000).toISOString();

  const [{ data: invoices }, { data: payments }, { data: reassignments }, { data: staffRows }] =
    await Promise.all([
      supabase
        .from("r2o_invoices")
        .select(
          "invoice_id, invoice_total_net, invoice_total_tip, invoice_paid_date, user_id, payment_method_id",
        )
        .eq("owner_id", user.ownerId)
        .eq("invoice_paid", true)
        .eq("invoice_test_mode", false)
        .is("invoice_deleted_at", null)
        .gte("invoice_paid_date", windowFrom)
        .lte("invoice_paid_date", windowTo),
      supabase
        .from("r2o_payment_methods")
        .select("payment_id, payment_name")
        .eq("owner_id", user.ownerId),
      supabase
        .from("bb_commission_reassignments")
        .select("work_date, from_r2o_user_id, to_r2o_user_id")
        .eq("owner_id", user.ownerId)
        .eq("work_date", workDate),
      supabase
        .from("bb_staff_costs")
        .select("r2o_user_id, commission_pct")
        .eq("owner_id", user.ownerId),
    ]);

  const internalIds = new Set(
    (payments ?? [])
      .filter((p) =>
        (p.payment_name ?? "").toLowerCase().includes("eigenverbrauch"),
      )
      .map((p) => p.payment_id as number),
  );
  const reassign = new Map(
    (reassignments ?? []).map((r) => [
      r.from_r2o_user_id as number,
      r.to_r2o_user_id as number,
    ]),
  );
  const viennaDay = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  let revenueNet = 0;
  for (const i of invoices ?? []) {
    if (!i.invoice_paid_date) continue;
    if (viennaDay.format(new Date(i.invoice_paid_date)) !== workDate) continue;
    if (
      i.payment_method_id != null &&
      internalIds.has(i.payment_method_id as number)
    )
      continue;
    let uid = i.user_id as number | null;
    if (uid != null) uid = reassign.get(uid) ?? uid;
    if (uid !== r2oUserId) continue;
    revenueNet +=
      Number(i.invoice_total_net ?? 0) - Number(i.invoice_total_tip ?? 0);
  }

  const pct = (staffRows ?? []).find(
    (s) => s.r2o_user_id === r2oUserId,
  )?.commission_pct;
  if (pct == null)
    return {
      ok: false as const,
      error: "Kein Provisions-Satz für diesen Mitarbeiter hinterlegt",
    };
  const commission = Math.round(revenueNet * Number(pct)) / 100;

  const { error } = await supabase.from("bb_commission_payouts").insert({
    owner_id: user.ownerId,
    r2o_user_id: r2oUserId,
    work_date: workDate,
    revenue_net_snapshot: Math.round(revenueNet * 100) / 100,
    commission_pct_snapshot: Number(pct),
    commission_snapshot: commission,
    created_by: user.authUserId,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false as const, error: "Tag ist bereits ausgezahlt" };
    return { ok: false as const, error: error.message };
  }
  revalidateAll();
  return { ok: true as const, commission };
}

export async function undoPayout(payoutId: string) {
  const user = await requireOwner();
  if (!user) return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_commission_payouts")
    .delete()
    .eq("id", payoutId)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidateAll();
  return { ok: true as const };
}

// Tages-Umsätze einem anderen Mitarbeiter zuweisen.
export async function reassignDay(
  workDate: string,
  fromR2oUserId: number,
  toR2oUserId: number,
) {
  if (
    !DATE_RE.test(workDate) ||
    !Number.isInteger(fromR2oUserId) ||
    !Number.isInteger(toR2oUserId) ||
    fromR2oUserId === toR2oUserId
  )
    return { ok: false as const, error: "Ungültige Eingabe" };
  const user = await requireOwner();
  if (!user) return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();

  // Sperre: Tag darf für keinen der beiden MA bereits ausgezahlt sein.
  const { data: paid } = await supabase
    .from("bb_commission_payouts")
    .select("id")
    .eq("owner_id", user.ownerId)
    .eq("work_date", workDate)
    .in("r2o_user_id", [fromR2oUserId, toR2oUserId])
    .limit(1);
  if (paid && paid.length > 0)
    return {
      ok: false as const,
      error: "Tag ist bereits ausgezahlt — erst Auszahlung zurücknehmen",
    };

  const { error } = await supabase
    .from("bb_commission_reassignments")
    .upsert(
      {
        owner_id: user.ownerId,
        work_date: workDate,
        from_r2o_user_id: fromR2oUserId,
        to_r2o_user_id: toR2oUserId,
        created_by: user.authUserId,
      },
      { onConflict: "owner_id,work_date,from_r2o_user_id" },
    );
  if (error) return { ok: false as const, error: error.message };
  revalidateAll();
  return { ok: true as const };
}

export async function undoReassignment(id: string) {
  const user = await requireOwner();
  if (!user) return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("bb_commission_reassignments")
    .select("work_date, from_r2o_user_id, to_r2o_user_id")
    .eq("id", id)
    .eq("owner_id", user.ownerId)
    .maybeSingle();
  if (!r) return { ok: false as const, error: "Umbuchung nicht gefunden" };

  const { data: paid } = await supabase
    .from("bb_commission_payouts")
    .select("id")
    .eq("owner_id", user.ownerId)
    .eq("work_date", r.work_date)
    .in("r2o_user_id", [r.from_r2o_user_id, r.to_r2o_user_id])
    .limit(1);
  if (paid && paid.length > 0)
    return {
      ok: false as const,
      error: "Tag ist bereits ausgezahlt — erst Auszahlung zurücknehmen",
    };

  const { error } = await supabase
    .from("bb_commission_reassignments")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidateAll();
  return { ok: true as const };
}
