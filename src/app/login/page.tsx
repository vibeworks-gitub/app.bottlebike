import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="bg-mesh relative flex flex-1 items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo variant="full" size={48} />
        <LoginForm next={next} />
        <p className="text-xs text-muted-foreground">
          Produktverwaltung &amp; Kalkulation
        </p>
      </div>
    </main>
  );
}
