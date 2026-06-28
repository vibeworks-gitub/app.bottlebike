import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export default async function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "crew") redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <span className="text-sm font-medium">Hallo {user.displayName}</span>
        <form action="/auth/logout" method="post">
          <button type="submit" className="text-xs text-muted-foreground underline">
            Abmelden
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
