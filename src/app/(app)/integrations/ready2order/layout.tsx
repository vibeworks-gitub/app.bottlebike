import { R2oTabs } from "./r2o-tabs";

export default function ReadyToOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Integrationen</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          ready2order
        </h1>
      </header>
      <R2oTabs />
      <div>{children}</div>
    </div>
  );
}
