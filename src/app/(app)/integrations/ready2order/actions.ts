"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requestGrantAccess } from "@/lib/r2o";

function callbackBaseUrl(): string {
  const env = process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  // fallback: derive from request headers
  return "";
}

async function deriveCallbackUri(): Promise<string> {
  const base = callbackBaseUrl();
  if (base) return `${base}/api/integrations/ready2order/callback`;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Cannot determine callback host");
  return `${proto}://${host}/api/integrations/ready2order/callback`;
}

export async function startConnect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const callbackUri = await deriveCallbackUri();
  const { grantAccessUri } = await requestGrantAccess(callbackUri);
  redirect(grantAccessUri);
}

export async function disconnect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  await supabase
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "ready2order");

  revalidatePath("/integrations/ready2order");
}

export async function updateAutoSync(formData: FormData): Promise<void> {
  const minutesRaw = formData.get("minutes");
  const minutes =
    minutesRaw == null || minutesRaw === "0" || minutesRaw === ""
      ? null
      : Number(minutesRaw);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  await supabase
    .from("integrations")
    .update({ auto_sync_minutes: minutes })
    .eq("user_id", user.id)
    .eq("provider", "ready2order");

  revalidatePath("/integrations/ready2order");
}
