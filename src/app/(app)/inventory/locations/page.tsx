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
import type { Location } from "@/lib/types/database";
import { deleteLocation } from "./actions";

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("bb_locations")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true })
    .returns<Location[]>();

  const empty = !locations || locations.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Standorte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lager und Verkaufsstellen (Bikes). Bestand wird pro Standort geführt.
          </p>
        </div>
        <Link href="/inventory/locations/new" className={buttonVariants()}>
          + Neuer Standort
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
              Noch keine Standorte
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege zuerst ein Lager und mindestens eine Verkaufsstelle (Bike)
              an.
            </p>
          </div>
          <Link href="/inventory/locations/new" className={buttonVariants()}>
            + Ersten Standort anlegen
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
                  Typ
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link
                      href={`/inventory/locations/${l.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {l.name}
                    </Link>
                    {l.notes && (
                      <p className="text-xs text-muted-foreground">{l.notes}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {l.type === "warehouse" ? "Lager" : "Bike"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/inventory/locations/${l.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteLocation}>
                        <input type="hidden" name="id" value={l.id} />
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
