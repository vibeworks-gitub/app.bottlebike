"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/integrations/ready2order", label: "Übersicht" },
  { href: "/integrations/ready2order/invoices", label: "Belege" },
  { href: "/integrations/ready2order/products", label: "Produkte" },
  { href: "/integrations/ready2order/productgroups", label: "Warengruppen" },
  { href: "/integrations/ready2order/customers", label: "Kunden" },
  { href: "/integrations/ready2order/discounts", label: "Rabatte" },
  { href: "/integrations/ready2order/payment-methods", label: "Zahlungsarten" },
  { href: "/integrations/ready2order/tables", label: "Tische" },
  { href: "/integrations/ready2order/table-areas", label: "Bereiche" },
  { href: "/integrations/ready2order/users", label: "Mitarbeiter" },
];

export function R2oTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex flex-wrap gap-x-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
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
