import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CrewHome() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: openShift } = await supabase
    .from("bb_shifts")
    .select("id,started_at,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();

  const { data: location } = openShift?.location_id
    ? await supabase
        .from("bb_locations")
        .select("name")
        .eq("id", openShift.location_id)
        .single()
    : { data: null };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Schicht</h1>
      {openShift ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Aktive Schicht seit{" "}
              {new Date(openShift.started_at!).toLocaleTimeString("de-AT", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {location?.name ?? ""}
            </p>
            <Link
              href="/crew/shift/active"
              className={buttonVariants({ size: "lg" }) + " h-12 w-full text-base"}
            >
              Schicht öffnen
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Link
          href="/crew/shift/new"
          className={buttonVariants({ size: "lg" }) + " h-14 w-full text-base"}
        >
          Schicht starten
        </Link>
      )}
      <Link
        href="/crew/history"
        className={buttonVariants({ variant: "ghost" }) + " w-full"}
      >
        Meine Schichten
      </Link>
    </div>
  );
}
