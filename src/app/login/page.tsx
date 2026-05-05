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
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo size={140} />
        <LoginForm next={next} />
      </div>
    </main>
  );
}
