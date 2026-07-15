import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CrewHistory() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shifts } = await supabase
    .from("bb_shifts")
    .select("id,started_at,ended_at,status,location_id")
    .eq("created_by", user.authUserId)
    .order("started_at", { ascending: false })
    .limit(30);

  const locIds = Array.from(
    new Set((shifts ?? []).map((s) => s.location_id).filter((x): x is string => x != null)),
  );
  const { data: locations } = locIds.length
    ? await supabase.from("bb_locations").select("id,name").in("id", locIds)
    : { data: [] };

  const shiftIds = (shifts ?? []).map((s) => s.id);
  const { data: openDiffs } = shiftIds.length
    ? await supabase
        .from("bb_shift_counts")
        .select("shift_id,counted_qty,expected_qty,cleared_at")
        .in("shift_id", shiftIds)
    : { data: [] };
  const diffMap = new Map<string, number>();
  for (const c of openDiffs ?? []) {
    if (
      c.cleared_at == null &&
      c.expected_qty != null &&
      Number(c.counted_qty) !== Number(c.expected_qty)
    ) {
      diffMap.set(c.shift_id, (diffMap.get(c.shift_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Meine Schichten</h1>
      {(shifts ?? []).map((s) => (
        <div key={s.id} className="rounded-md border p-3 text-sm">
          <div className="flex justify-between">
            <span>
              {new Date(s.started_at!).toLocaleString("de-AT", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{locations?.find((l) => l.id === s.location_id)?.name}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{s.status}</span>
            {(diffMap.get(s.id) ?? 0) > 0 && (
              <span style={{ color: "var(--destructive)" }}>
                {diffMap.get(s.id)} offene Differenz(en)
              </span>
            )}
          </div>
        </div>
      ))}
      {(shifts ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Schichten.</p>
      )}
    </div>
  );
}
