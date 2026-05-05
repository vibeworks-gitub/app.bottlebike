const R2O_BASE = "https://api.ready2order.com";

function devToken(): string {
  const t = process.env.R2O_DEVELOPER_TOKEN;
  if (!t) throw new Error("R2O_DEVELOPER_TOKEN not set");
  return t;
}

export async function requestGrantAccess(callbackUri: string): Promise<{
  grantAccessToken: string;
  grantAccessUri: string;
}> {
  const res = await fetch(`${R2O_BASE}/v1/developerToken/grantAccessToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${devToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ callbackUri }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ready2order grant request failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function r2oFetch<T = unknown>(
  accountToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${R2O_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accountToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ready2order ${path} ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

// Walks pages of a list endpoint and concatenates all rows.
export async function r2oFetchAll<T>(
  accountToken: string,
  basePath: string,
  pageSize = 250,
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const sep = basePath.includes("?") ? "&" : "?";
    const batch = await r2oFetch<T[]>(
      accountToken,
      `${basePath}${sep}limit=${pageSize}&page=${page}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    page += 1;
    if (page > 200) break; // safety: max 50k rows
  }
  return out;
}
