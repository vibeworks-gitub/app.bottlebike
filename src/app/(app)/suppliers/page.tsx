import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Supplier } from "@/lib/types/database";
import { deleteSupplier } from "./actions";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("bb_suppliers")
    .select("*")
    .order("name", { ascending: true })
    .returns<Supplier[]>();

  const empty = !suppliers || suppliers.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Stammdaten
          </p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Lieferanten
          </h1>
        </div>
        <Link href="/suppliers/new" className={buttonVariants()}>
          + Neuer Lieferant
        </Link>
      </header>

      {empty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
            }}
          >
            +
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Noch keine Lieferanten
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege deine wichtigsten Lieferanten an, dann kannst du sie pro
              Produkt zuordnen.
            </p>
          </div>
          <Link href="/suppliers/new" className={buttonVariants()}>
            + Ersten Lieferanten anlegen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Ansprechpartner
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  E-Mail
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Telefon
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {s.name}
                    </Link>
                    {s.address && (
                      <p className="text-xs text-muted-foreground">
                        {s.address}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.contact_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{s.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{s.phone ?? "—"}</TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/suppliers/${s.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteSupplier}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                          style={{ color: "var(--destructive)" }}
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
