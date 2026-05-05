import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffForm, type R2oUserOption } from "../staff-form";
import { updateStaffCost } from "../actions";
import type { StaffCost } from "@/lib/types/database";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: staff }, { data: r2oUsers }] = await Promise.all([
    supabase
      .from("bb_staff_costs")
      .select("*")
      .eq("id", id)
      .maybeSingle<StaffCost>(),
    supabase
      .from("r2o_users")
      .select("r2o_user_id, user_first_name, user_last_name, user_username")
      .order("user_last_name"),
  ]);
  if (!staff) notFound();

  const opts: R2oUserOption[] = (r2oUsers ?? []).map((u) => ({
    r2o_user_id: u.r2o_user_id as number,
    label:
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
      (u.user_username as string) ||
      `#${u.r2o_user_id}`,
  }));

  const action = updateStaffCost.bind(null, staff.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/staff"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
          {staff.display_name}
        </h1>
      </div>
      <StaffForm
        action={action}
        initial={staff}
        r2oUsers={opts}
        submitLabel="Speichern"
      />
    </div>
  );
}
