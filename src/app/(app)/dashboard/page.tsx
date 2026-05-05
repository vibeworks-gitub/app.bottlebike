import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ count: productCount }, { count: activeCount }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Übersicht</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produkte gesamt
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {productCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktive Produkte
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {activeCount ?? 0}
          </CardContent>
        </Card>
      </div>
      <div>
        <Link href="/products" className="text-sm underline">
          Zur Produktliste →
        </Link>
      </div>
    </div>
  );
}
