import { LocationForm } from "../location-form";
import { createLocation } from "../actions";

export default function NewLocationPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Neuer Standort
        </h1>
      </header>
      <LocationForm action={createLocation} submitLabel="Anlegen" />
    </div>
  );
}
