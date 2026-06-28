"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/role";

const InviteSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  defaultLocationId: z.string().uuid().nullable(),
  defaultCashRegisterId: z.string().uuid().nullable(),
  r2oUserId: z.number().int().nullable().optional(),
});

export async function inviteTeamMember(input: z.infer<typeof InviteSchema>) {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Eingabe" };

  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.displayName,
        role: "crew",
        owner_id: user.ownerId,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/set-password`,
    },
  );
  if (error || !data.user)
    return { ok: false as const, error: error?.message ?? "Einladung fehlgeschlagen" };

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      default_location_id: parsed.data.defaultLocationId,
      default_cash_register_id: parsed.data.defaultCashRegisterId,
      r2o_user_id: parsed.data.r2oUserId ?? null,
    })
    .eq("id", data.user.id);

  revalidatePath("/team");
  return { ok: true as const };
}

export async function setTeamMemberActive(id: string, active: boolean) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/team");
  return { ok: true as const };
}

export async function updateTeamMemberDefaults(
  id: string,
  patch: {
    default_location_id?: string | null;
    default_cash_register_id?: string | null;
    r2o_user_id?: number | null;
    display_name?: string;
  },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.default_location_id !== undefined)
    update.default_location_id = patch.default_location_id;
  if (patch.default_cash_register_id !== undefined)
    update.default_cash_register_id = patch.default_cash_register_id;
  if (patch.r2o_user_id !== undefined) update.r2o_user_id = patch.r2o_user_id;
  if (patch.display_name !== undefined) update.full_name = patch.display_name;
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", id)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/team");
  return { ok: true as const };
}
