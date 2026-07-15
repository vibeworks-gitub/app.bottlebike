"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteTeamMember } from "./actions";

export function InviteForm({
  locations,
  registers,
}: {
  locations: { id: string; name: string }[];
  registers: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [locId, setLocId] = useState("");
  const [regId, setRegId] = useState("");

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await inviteTeamMember({
            email,
            displayName: name,
            defaultLocationId: locId || null,
            defaultCashRegisterId: regId || null,
          });
          if (res.ok) {
            toast.success("Einladung verschickt");
            setEmail("");
            setName("");
          } else toast.error(res.error);
        });
      }}
    >
      <Input
        placeholder="E-Mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        className="rounded border p-2 text-sm"
        value={locId}
        onChange={(e) => setLocId(e.target.value)}
      >
        <option value="">Default-Bike wählen…</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        className="rounded border p-2 text-sm"
        value={regId}
        onChange={(e) => setRegId(e.target.value)}
      >
        <option value="">Default-Kasse wählen…</option>
        {registers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending} className="sm:col-span-2">
        {pending ? "Schicke Einladung…" : "Einladen"}
      </Button>
    </form>
  );
}
