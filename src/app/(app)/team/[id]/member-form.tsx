"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setTeamMemberActive,
  updateTeamMemberDefaults,
} from "../actions";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  default_location_id: string | null;
  default_cash_register_id: string | null;
  r2o_user_id: number | null;
  active: boolean;
};

export function MemberForm({
  member,
  locations,
  registers,
  r2oUsers,
}: {
  member: Member;
  locations: { id: string; name: string }[];
  registers: { id: string; name: string }[];
  r2oUsers: { user_id: number; user_displayName: string | null }[];
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(member.full_name ?? "");
  const [locId, setLocId] = useState(member.default_location_id ?? "");
  const [regId, setRegId] = useState(member.default_cash_register_id ?? "");
  const [r2oId, setR2oId] = useState(member.r2o_user_id?.toString() ?? "");
  const [active, setActive] = useState(member.active);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateTeamMemberDefaults(member.id, {
            display_name: name,
            default_location_id: locId || null,
            default_cash_register_id: regId || null,
            r2o_user_id: r2oId ? Number(r2oId) : null,
          });
          if (res.ok) toast.success("Gespeichert");
          else toast.error(res.error);
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        E-Mail
        <Input value={member.email ?? ""} disabled />
      </label>
      <label className="grid gap-1 text-sm">
        Default-Bike
        <select className="rounded border p-2" value={locId} onChange={(e) => setLocId(e.target.value)}>
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Default-Kasse
        <select className="rounded border p-2" value={regId} onChange={(e) => setRegId(e.target.value)}>
          <option value="">—</option>
          {registers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        r2o-User (für Provision)
        <select className="rounded border p-2" value={r2oId} onChange={(e) => setR2oId(e.target.value)}>
          <option value="">—</option>
          {r2oUsers.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.user_displayName ?? u.user_id}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          Speichern
        </Button>
        <Button
          type="button"
          variant={active ? "destructive" : "secondary"}
          onClick={() =>
            start(async () => {
              const res = await setTeamMemberActive(member.id, !active);
              if (res.ok) {
                setActive(!active);
                toast.success(active ? "Deaktiviert" : "Aktiviert");
              } else toast.error(res.error);
            })
          }
        >
          {active ? "Deaktivieren" : "Aktivieren"}
        </Button>
      </div>
    </form>
  );
}
