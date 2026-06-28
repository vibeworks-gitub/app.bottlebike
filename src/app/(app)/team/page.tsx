import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") redirect("/dashboard");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,role,default_location_id,default_cash_register_id,r2o_user_id,active",
    )
    .eq("owner_id", user.ownerId)
    .order("full_name");

  const { data: locations } = await supabase
    .from("bb_locations")
    .select("id,name")
    .order("name");
  const { data: registers } = await supabase
    .from("bb_cash_registers")
    .select("id,name")
    .order("name");

  const admin = createAdminClient();
  const ids = (members ?? []).map((m) => m.id);
  const signInMap = new Map<string, string | null>();
  if (ids.length) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of data?.users ?? []) {
      if (ids.includes(u.id)) signInMap.set(u.id, u.last_sign_in_at ?? null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle>Mitarbeiter einladen</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm
            locations={locations ?? []}
            registers={registers ?? []}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aktive Mitarbeiter</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Bike</th>
                <th>Letzter Login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2">{m.full_name}</td>
                  <td>{m.email}</td>
                  <td>
                    <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                      {m.role}
                    </Badge>
                  </td>
                  <td>
                    {locations?.find((l) => l.id === m.default_location_id)?.name ?? "—"}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {signInMap.get(m.id)?.slice(0, 16).replace("T", " ") ?? "—"}
                  </td>
                  <td>
                    <Link
                      href={`/team/${m.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Bearbeiten
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
