"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/integrations/ready2order", label: "Übersicht" },
  { href: "/integrations/ready2order/products", label: "Produkte" },
  { href: "/integrations/ready2order/productgroups", label: "Warengruppen" },
];

export function R2oTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {active && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5"
                style={{ backgroundColor: "var(--brand)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
