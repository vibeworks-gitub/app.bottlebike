const R2O_BASE = "https://api.ready2order.com";

// API allows 60 req/min per IP. Stay safely under and respect 429 hints.
const R2O_MAX_PER_MINUTE = 50;

class RateLimiter {
  private timestamps: number[] = [];
  constructor(private readonly maxPerMinute: number) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
      if (this.timestamps.length < this.maxPerMinute) {
        this.timestamps.push(now);
        return;
      }
      const wait = this.timestamps[0] + 60_000 - now + 50;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const limiter = new RateLimiter(R2O_MAX_PER_MINUTE);

async function rateLimitedFetch(
  input: string,
  init: RequestInit,
): Promise<Response> {
  await limiter.acquire();
  let res = await fetch(input, init);
  if (res.status === 429) {
    let waitSec = 65;
    try {
      const body = await res.clone().json();
      const minutes = body?.details?.rateLimitMinutes;
      if (typeof minutes === "number" && minutes > 0) {
        waitSec = minutes * 60 + 5;
      }
    } catch {
      // ignore parse errors
    }
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    await limiter.acquire();
    res = await fetch(input, init);
  }
  return res;
}

function devToken(): string {
  const t = process.env.R2O_DEVELOPER_TOKEN;
  if (!t) throw new Error("R2O_DEVELOPER_TOKEN not set");
  return t;
}

export async function requestGrantAccess(callbackUri: string): Promise<{
  grantAccessToken: string;
  grantAccessUri: string;
}> {
  const res = await rateLimitedFetch(
    `${R2O_BASE}/v1/developerToken/grantAccessToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${devToken()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ callbackUri }),
    },
  );
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
  const res = await rateLimitedFetch(`${R2O_BASE}${path}`, {
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
