import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: productCount },
    { count: extrasCount },
    { count: supplierCount },
    { count: invoiceCount },
  ] = await Promise.all([
    supabase
      .from("r2o_products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user!.id),
    supabase
      .from("bb_product_extras")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user!.id)
      .not("cost_price", "is", null),
    supabase
      .from("bb_suppliers")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user!.id),
    supabase
      .from("r2o_invoices")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user!.id),
  ]);

  const greeting = user?.email?.split("@")[0] ?? "";

  return (
    <div className="flex flex-col gap-8">
      <header className="relative overflow-hidden rounded-2xl bg-mesh px-6 py-7 ring-1 ring-foreground/5">
        <p className="text-sm font-medium text-muted-foreground">
          Willkommen{greeting ? `, ${greeting}` : ""}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.04em" }}
        >
          Übersicht
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Produkte verwalten, Margen kalkulieren — alles an einem Ort.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Produkte (r2o)"
          value={productCount ?? 0}
          accent
        />
        <StatCard
          label="EK gepflegt"
          value={`${extrasCount ?? 0} / ${productCount ?? 0}`}
          hint={
            (productCount ?? 0) > 0
              ? `${Math.round(((extrasCount ?? 0) / (productCount ?? 1)) * 100)}%`
              : undefined
          }
        />
        <StatCard label="Lieferanten" value={supplierCount ?? 0} />
        <StatCard label="Belege (r2o)" value={invoiceCount ?? 0} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schnellstart</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <QuickLink href="/products" label="Produkte / EK pflegen" />
            <QuickLink href="/suppliers" label="Lieferanten verwalten" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>Kalkulationen (Angebote) folgen im nächsten Release.</p>
            <p>
              Marge wird automatisch aus Einkaufs- und Verkaufspreis
              berechnet.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card
      className="overflow-hidden transition-shadow hover:shadow-md"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          {hint && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
              {hint}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="font-heading text-3xl font-extrabold tracking-tight"
          style={accent ? { color: "var(--brand)" } : undefined}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="font-medium">{label}</span>
      <span
        className="text-muted-foreground transition group-hover:translate-x-0.5"
        style={{ color: "var(--brand)" }}
      >
        →
      </span>
    </Link>
  );
}
