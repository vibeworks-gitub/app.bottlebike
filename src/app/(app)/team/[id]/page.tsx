import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "./member-form";

export const dynamic = "force-dynamic";

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") redirect("/dashboard");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.ownerId)
    .single();
  if (!member) redirect("/team");

  const { data: locations } = await supabase
    .from("bb_locations")
    .select("id,name")
    .order("name");
  const { data: registers } = await supabase
    .from("bb_cash_registers")
    .select("id,name")
    .order("name");
  const { data: r2oUsersRaw } = await supabase
    .from("r2o_users")
    .select("r2o_user_id,user_first_name,user_last_name,user_username")
    .eq("owner_id", user.ownerId);

  const r2oUsers = (r2oUsersRaw ?? []).map((u) => {
    const fullName = [u.user_first_name, u.user_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      user_id: u.r2o_user_id,
      user_displayName: fullName || u.user_username || null,
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{member.full_name}</h1>
      <MemberForm
        member={member}
        locations={locations ?? []}
        registers={registers ?? []}
        r2oUsers={r2oUsers}
      />
    </div>
  );
}
