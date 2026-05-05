import { createClient } from "@/lib/supabase/server";
import { syncR2oUsers } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import { UsersView, type UserRow } from "./users-view";

export default async function R2oUsersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_users")
    .select(
      "r2o_user_id, user_first_name, user_last_name, user_username, user_last_action_at, user_last_login_at, user_trainings_mode, right_id, synced_at",
    )
    .order("user_last_name", { ascending: true })
    .returns<(UserRow & { synced_at: string })[]>();

  const lastSync = data?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Mitarbeiter"
        lastSync={lastSync}
        syncAction={syncR2oUsers}
      />
      {!data?.length ? (
        <EmptyState resourceName="Mitarbeiter" />
      ) : (
        <UsersView rows={data} />
      )}
    </div>
  );
}
