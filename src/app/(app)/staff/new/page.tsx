import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StaffForm, type R2oUserOption } from "../staff-form";
import { createStaffCost } from "../actions";

export default async function NewStaffPage() {
  const supabase = await createClient();
  const { data: r2oUsers } = await supabase
    .from("r2o_users")
    .select("r2o_user_id, user_first_name, user_last_name, user_username")
    .order("user_last_name");

  const opts: R2oUserOption[] = (r2oUsers ?? []).map((u) => ({
    r2o_user_id: u.r2o_user_id as number,
    label:
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
      (u.user_username as string) ||
      `#${u.r2o_user_id}`,
  }));

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
          Neuer Mitarbeiter
        </h1>
      </div>
      <StaffForm
        action={createStaffCost}
        r2oUsers={opts}
        submitLabel="Anlegen"
      />
    </div>
  );
}
