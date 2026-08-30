import type { Listing, SortDirection, SortKey } from "../types";

type ErrorPayload = { error?: string };

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok) {
    throw new Error(payload.error || `请求失败（HTTP ${response.status}）`);
  }
  return payload;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listFiles(params: {
  path: string;
  page: number;
  pageSize: number;
  query: string;
  sort: SortKey;
  direction: SortDirection;
  refresh?: boolean;
}) {
  const query = new URLSearchParams({
    prefix: params.path,
    page: String(params.page),
    page_size: String(params.pageSize),
    query: params.query,
    sort: params.sort,
    direction: params.direction,
  });
  if (params.refresh) query.set("refresh", "1");
  return requestJson<Listing>(`/api/list?${query}`);
}
