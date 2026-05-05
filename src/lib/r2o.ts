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

// ready2order caps pagination hard at 100 per page on most list endpoints.
const R2O_MAX_PAGE = 100;

// Walks pages of a list endpoint and concatenates all rows.
export async function r2oFetchAll<T>(
  accountToken: string,
  basePath: string,
  pageSize = R2O_MAX_PAGE,
): Promise<T[]> {
  const effectiveLimit = Math.min(pageSize, R2O_MAX_PAGE);
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const sep = basePath.includes("?") ? "&" : "?";
    const batch = await r2oFetch<T[]>(
      accountToken,
      `${basePath}${sep}limit=${effectiveLimit}&page=${page}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    // continue while the API filled the page; partial page = last page
    if (batch.length < effectiveLimit) break;
    page += 1;
    if (page > 1000) break; // safety: max 100k rows
  }
  return out;
}

// Some endpoints (e.g. /v1/document/invoice) return { items: [...], count }
export async function r2oFetchAllWrapped<T>(
  accountToken: string,
  basePath: string,
  itemsKey: string,
  pageSize = R2O_MAX_PAGE,
): Promise<T[]> {
  const effectiveLimit = Math.min(pageSize, R2O_MAX_PAGE);
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const sep = basePath.includes("?") ? "&" : "?";
    const res = await r2oFetch<Record<string, unknown>>(
      accountToken,
      `${basePath}${sep}limit=${effectiveLimit}&offset=${offset}`,
    );
    const batch = (res[itemsKey] as T[] | undefined) ?? [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < effectiveLimit) break;
    offset += batch.length;
    if (offset > 100_000) break;
  }
  return out;
}
