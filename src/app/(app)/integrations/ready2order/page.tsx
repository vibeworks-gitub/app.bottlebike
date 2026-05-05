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

  const tableNames = [
    "r2o_invoices",
    "r2o_products",
    "r2o_productgroups",
    "r2o_customers",
    "r2o_discounts",
    "r2o_payment_methods",
    "r2o_tables",
    "r2o_table_areas",
    "r2o_users",
  ] as const;
  const counts: Record<string, number> = {};
  await Promise.all(
    tableNames.map(async (t) => {
      const { count } = await supabase
        .from(t)
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      counts[t] = count ?? 0;
    }),
  );

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
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            href="/integrations/ready2order/invoices"
            title="Belege"
            count={counts.r2o_invoices}
            description="Verkaufsbelege mit Brutto/Netto/MwSt + Filter nach Datum & Zahlungsart."
            highlight
          />
          <Tile
            href="/integrations/ready2order/products"
            title="Produkte"
            count={counts.r2o_products}
            description="Alle Artikel inkl. Lager + Nachbestell-Schwellen + Warengruppen-Verknüpfung."
          />
          <Tile
            href="/integrations/ready2order/productgroups"
            title="Warengruppen"
            count={counts.r2o_productgroups}
            description="Kategorien — expandierbar mit Produkten je Gruppe."
          />
          <Tile
            href="/integrations/ready2order/customers"
            title="Kunden"
            count={counts.r2o_customers}
            description="Kontakt + Adress-Stammdaten."
          />
          <Tile
            href="/integrations/ready2order/discounts"
            title="Rabatte"
            count={counts.r2o_discounts}
            description="Definierte Rabatt-Vorlagen."
          />
          <Tile
            href="/integrations/ready2order/payment-methods"
            title="Zahlungsarten"
            count={counts.r2o_payment_methods}
            description="Bar / Karte / etc."
          />
          <Tile
            href="/integrations/ready2order/tables"
            title="Tische"
            count={counts.r2o_tables}
            description="Tisch-Stammdaten mit Bereich-Verknüpfung."
          />
          <Tile
            href="/integrations/ready2order/table-areas"
            title="Tisch-Bereiche"
            count={counts.r2o_table_areas}
            description="Saal / Terrasse / Theke …"
          />
          <Tile
            href="/integrations/ready2order/users"
            title="Mitarbeiter"
            count={counts.r2o_users}
            description="POS-Benutzer mit Login-Historie."
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
  highlight,
}: {
  href: string;
  title: string;
  count: number;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-accent/30"
      style={
        highlight
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
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
