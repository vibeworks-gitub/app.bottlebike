import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEUR, formatPercent } from "@/lib/format";
import { deleteProduct } from "./actions";
import type { Product } from "@/lib/types/database";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Product[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produkte</h1>
        <Link href="/products/new" className={buttonVariants()}>
          Neues Produkt
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600">Fehler beim Laden: {error.message}</p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">EK netto</TableHead>
              <TableHead className="text-right">VK netto</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-right">Bestand</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).length === 0 && !error && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground"
                >
                  Noch keine Produkte. Lege das erste an.
                </TableCell>
              </TableRow>
            )}
            {(products ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell>
                  <Link href={`/products/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {formatEUR(p.cost_price)}
                </TableCell>
                <TableCell className="text-right">
                  {formatEUR(p.selling_price)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(p.margin_percent)}
                </TableCell>
                <TableCell className="text-right">{p.stock}</TableCell>
                <TableCell>
                  {p.active ? (
                    <Badge variant="secondary">aktiv</Badge>
                  ) : (
                    <Badge variant="outline">inaktiv</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/products/${p.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Bearbeiten
                    </Link>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Löschen
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
