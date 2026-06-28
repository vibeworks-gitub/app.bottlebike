// src/lib/auth/role.ts
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  authUserId: string;
  ownerId: string;
  role: "owner" | "crew";
  displayName: string;
  email: string;
  defaultLocationId: string | null;
  defaultCashRegisterId: string | null;
  r2oUserId: number | null;
  active: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,role,owner_id,default_location_id,default_cash_register_id,r2o_user_id,active",
    )
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    authUserId: profile.id,
    ownerId: profile.owner_id,
    role: (profile.role === "crew" ? "crew" : "owner") as "owner" | "crew",
    displayName: profile.full_name ?? profile.email ?? "",
    email: profile.email ?? "",
    defaultLocationId: profile.default_location_id,
    defaultCashRegisterId: profile.default_cash_register_id,
    r2oUserId: profile.r2o_user_id,
    active: profile.active ?? true,
  };
}
