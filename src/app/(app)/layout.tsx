import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/lib/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/40 p-4">
        <Link href="/dashboard" className="mb-6 text-lg font-semibold">
          Bottlebike
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/dashboard"
            className="rounded px-2 py-1.5 hover:bg-muted"
          >
            Übersicht
          </Link>
          <Link
            href="/products"
            className="rounded px-2 py-1.5 hover:bg-muted"
          >
            Produkte
          </Link>
          <Link
            href="/quotes"
            className="rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
          >
            Kalkulationen
            <span className="ml-1 text-xs">(bald)</span>
          </Link>
        </nav>
        <Separator className="my-4" />
        <div className="mt-auto flex flex-col gap-2 text-sm">
          <div className="flex flex-col gap-1">
            <span className="truncate font-medium">
              {profile?.full_name ?? user.email}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
            {profile?.role === "admin" && (
              <Badge variant="secondary" className="w-fit">
                Admin
              </Badge>
            )}
          </div>
          <form action="/auth/logout" method="post">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full"
            >
              Logout
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex flex-1 flex-col p-8">{children}</main>
    </div>
  );
}
