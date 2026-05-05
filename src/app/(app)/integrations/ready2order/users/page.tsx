import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { syncR2oUsers } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

type UserRow = Record<string, unknown> & {
  r2o_user_id: number;
  user_first_name: string | null;
  user_last_name: string | null;
  user_username: string | null;
  user_last_action_at: string | null;
  user_last_login_at: string | null;
  user_trainings_mode: boolean | null;
  right_id: number | null;
  synced_at: string;
};

export default async function R2oUsersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_users")
    .select(
      "r2o_user_id, user_first_name, user_last_name, user_username, user_last_action_at, user_last_login_at, user_trainings_mode, right_id, synced_at",
    )
    .order("user_last_name", { ascending: true })
    .returns<UserRow[]>();

  const lastSync = data?.[0]?.synced_at;

  const columns: SimpleColumn<UserRow>[] = [
    { key: "r2o_user_id", label: "ID", width: "100px" },
    {
      key: "user_username",
      label: "Name",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {[r.user_first_name, r.user_last_name].filter(Boolean).join(" ") ||
              "—"}
          </span>
          {r.user_username && (
            <span className="text-xs text-muted-foreground">
              @{r.user_username}
            </span>
          )}
        </div>
      ),
    },
    { key: "right_id", label: "Rechte-ID", align: "right" },
    {
      key: "user_last_login_at",
      label: "Zuletzt eingeloggt",
      render: (r) =>
        r.user_last_login_at
          ? new Date(r.user_last_login_at).toLocaleString("de-DE")
          : "—",
    },
    {
      key: "user_trainings_mode",
      label: "Status",
      render: (r) =>
        r.user_trainings_mode ? (
          <Badge variant="outline">Training</Badge>
        ) : (
          <Badge variant="secondary">aktiv</Badge>
        ),
    },
  ];

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
        <SimpleTable
          rows={data}
          columns={columns}
          searchKeys={[
            "r2o_user_id",
            "user_first_name",
            "user_last_name",
            "user_username",
          ]}
        />
      )}
    </div>
  );
}
