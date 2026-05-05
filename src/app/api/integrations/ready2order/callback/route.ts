import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const accountToken = url.searchParams.get("accountToken");
  const grantAccessToken = url.searchParams.get("grantAccessToken");

  const result = new URL("/integrations/ready2order", url);

  if (status !== "approved" || !accountToken) {
    result.searchParams.set("error", status === "denied" ? "denied" : "missing_token");
    return NextResponse.redirect(result);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    result.searchParams.set("error", "not_authenticated");
    return NextResponse.redirect(result);
  }

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: user.id,
      provider: "ready2order",
      account_token: accountToken,
      metadata: { grant_access_token: grantAccessToken, connected_at: new Date().toISOString() },
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    result.searchParams.set("error", "save_failed");
    result.searchParams.set("detail", error.message);
    return NextResponse.redirect(result);
  }

  result.searchParams.set("connected", "1");
  return NextResponse.redirect(result);
}
