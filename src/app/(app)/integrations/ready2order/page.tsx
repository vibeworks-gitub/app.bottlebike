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
import { r2oFetch } from "@/lib/r2o";
import type { Integration } from "@/lib/types/database";
import { startConnect, disconnect } from "./actions";

type R2oCompany = {
  company_name?: string;
  company_email?: string;
  account_currency?: string;
};

export default async function ReadyToOrderPage({
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

  let company: R2oCompany | null = null;
  let probeError: string | null = null;
  let productCount: number | null = null;

  if (integration) {
    try {
      company = await r2oFetch<R2oCompany>(integration.account_token, "/v1/company");
    } catch (e) {
      probeError = e instanceof Error ? e.message : String(e);
    }
    try {
      const list = await r2oFetch<unknown[]>(
        integration.account_token,
        "/v1/products?limit=1",
      );
      productCount = Array.isArray(list) ? list.length : null;
    } catch {
      // ignore — already report via probeError above
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Integrationen</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          ready2order
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Verbinde deinen ready2order-Account, um Produkte zu importieren und
          später Lager + Nachbestellungen zu verwalten.
        </p>
      </header>

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
            {integration
              ? `Account-Token gespeichert seit ${new Date(integration.created_at).toLocaleString("de-DE")}.`
              : "Klick auf Verbinden, um den OAuth-Flow zu starten. Du wirst zu ready2order weitergeleitet."}
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
        <Card>
          <CardHeader>
            <CardTitle>Verbundener Account</CardTitle>
            <CardDescription>
              Erste Daten direkt aus der ready2order-API — als Verbindungstest.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {probeError ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                API-Fehler: {probeError}
              </p>
            ) : company ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Firma" value={company.company_name ?? "—"} />
                <Field label="Email" value={company.company_email ?? "—"} />
                <Field label="Währung" value={company.account_currency ?? "—"} />
                <Field
                  label="Produkte verfügbar"
                  value={productCount === null ? "?" : productCount > 0 ? "ja" : "0"}
                />
              </dl>
            ) : (
              <p>Keine Daten geladen.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
