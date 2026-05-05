"use client";

import { Badge } from "@/components/ui/badge";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

export type UserRow = Record<string, unknown> & {
  r2o_user_id: number;
  user_first_name: string | null;
  user_last_name: string | null;
  user_username: string | null;
  user_last_action_at: string | null;
  user_last_login_at: string | null;
  user_trainings_mode: boolean | null;
  right_id: number | null;
};

export function UsersView({ rows }: { rows: UserRow[] }) {
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
    <SimpleTable
      rows={rows}
      columns={columns}
      searchKeys={[
        "r2o_user_id",
        "user_first_name",
        "user_last_name",
        "user_username",
      ]}
    />
  );
}
