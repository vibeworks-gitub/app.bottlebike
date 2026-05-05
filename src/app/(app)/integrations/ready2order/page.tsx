import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Integration } from "@/lib/types/database";
import { startConnect, disconnect } from "./actions";

export default async function ReadyToOrderHome({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string }>;
}) {
  const { connected, error, detail } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", user!.id)
    .eq("provider", "ready2order")
    .maybeSingle<Integration>();

  const [{ count: productCount }, { count: groupCount }] = await Promise.all([
    supabase
      .from("r2o_products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user!.id),
    supabase
      .from("r2o_productgroups")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user!.id),
  ]);

  const companyId = (integration?.metadata as { company_id?: number })
    ?.company_id;

  return (
    <div className="flex flex-col gap-6">
      {connected && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          ✓ Verbunden mit ready2order.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Verbindung fehlgeschlagen: {error}
          {detail ? ` — ${detail}` : ""}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status
            {integration ? (
              <Badge variant="secondary">verbunden</Badge>
            ) : (
              <Badge variant="outline">nicht verbunden</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {integration ? (
              <>
                Account-Token gespeichert seit{" "}
                {new Date(integration.created_at).toLocaleString("de-DE")}.
                {companyId && (
                  <>
                    {" "}Company-ID: <code className="font-mono">{companyId}</code>.
                  </>
                )}
              </>
            ) : (
              "Klick auf Verbinden — du wirst zu ready2order weitergeleitet."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integration ? (
            <form action={disconnect}>
              <Button type="submit" variant="outline">
                Trennen
              </Button>
            </form>
          ) : (
            <form action={startConnect}>
              <Button type="submit">ready2order verbinden</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {integration && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Tile
            href="/integrations/ready2order/products"
            title="Produkte"
            count={productCount ?? 0}
            description="Alle Artikel aus ready2order — inklusive Lager + Nachbestell-Schwellen."
          />
          <Tile
            href="/integrations/ready2order/productgroups"
            title="Warengruppen"
            count={groupCount ?? 0}
            description="Kategorien für die Produkte (productgroups)."
          />
        </section>
      )}
    </div>
  );
}

function Tile({
  href,
  title,
  count,
  description,
}: {
  href: string;
  title: string;
  count: number;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-lg font-semibold">{title}</span>
        <span
          className="font-heading text-2xl font-extrabold tabular-nums"
          style={{ color: "var(--brand)" }}
        >
          {count}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <span
        className="mt-2 text-sm font-medium transition group-hover:translate-x-0.5"
        style={{ color: "var(--brand)" }}
      >
        Öffnen →
      </span>
    </Link>
  );
}
