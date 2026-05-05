import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import type { Profile } from "@/lib/types/database";

const NAV: Array<{ href: string; label: string; badge?: string }> = [
  { href: "/dashboard", label: "Übersicht" },
  { href: "/products", label: "Produkte" },
  { href: "/quotes", label: "Kalkulationen", badge: "bald" },
];

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

  const initials =
    (profile?.full_name ?? user.email ?? "?")
      .split(/[ .@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <Logo variant="mark" size={32} />
          <span
            className="font-heading text-[17px] font-extrabold tracking-tight"
            style={{ color: "var(--brand)", letterSpacing: "-0.04em" }}
          >
            bottle bike
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-3 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-md px-3 py-2 font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold leading-tight">
                {profile?.full_name ?? user.email}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            {profile?.role === "admin" && (
              <Badge variant="secondary" className="text-[10px]">
                Admin
              </Badge>
            )}
          </div>
          <form action="/auth/logout" method="post" className="mt-2">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full"
            >
              Abmelden
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex flex-1 flex-col p-8 lg:p-10">{children}</main>
    </div>
  );
}
