import { RegisterForm } from "../register-form";
import { createRegister } from "../actions";

export default function NewRegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Neue Kassa
        </h1>
      </header>
      <RegisterForm action={createRegister} submitLabel="Anlegen" />
    </div>
  );
}
