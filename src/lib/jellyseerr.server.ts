// Minimal Jellyseerr API client wrapper for server-side use.
// Docs: https://api-docs.jellyseerr.dev/
//
// NOTE: These calls run in the Node/Worker server runtime. In the Lovable
// preview (Cloudflare Workers) the JELLYSEERR_URL must be reachable over the
// public internet — a LAN-only URL like http://192.168.x.x will fail with a
// fetch error until the app is deployed inside your Docker stack on TrueNAS,
// where LAN URLs work fine.

export type JellyseerrSearchResult = {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  originalTitle?: string;
  originalName?: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: {
    status?: number; // 1 unknown, 2 pending, 3 processing, 4 partially available, 5 available
  };
};

export type JellyseerrRequest = {
  id: number;
  status: number; // 1 pending, 2 approved, 3 declined
  createdAt: string;
  updatedAt: string;
  type: "movie" | "tv";
  requestedBy?: { id: number; displayName?: string; username?: string };
  media: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status: number; // see above
    title?: string;
    posterPath?: string | null;
    backdropPath?: string | null;
  };
};

export type JellyseerrConfig = { baseUrl: string; apiKey: string };

export function getJellyseerrConfig(): JellyseerrConfig | null {
  const baseUrl = process.env.JELLYSEERR_URL?.replace(/\/$/, "");
  const apiKey = process.env.JELLYSEERR_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

async function jsFetch<T>(
  cfg: JellyseerrConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": cfg.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jellyseerr ${init.method ?? "GET"} ${path} failed [${res.status}]: ${body.slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

export function jsSearch(cfg: JellyseerrConfig, query: string, page = 1) {
  const qs = new URLSearchParams({ query, page: String(page) });
  return jsFetch<{ results: JellyseerrSearchResult[]; totalResults: number }>(
    cfg,
    `/api/v1/search?${qs.toString()}`,
  );
}

export function jsCreateRequest(
  cfg: JellyseerrConfig,
  args: { mediaId: number; mediaType: "movie" | "tv" },
) {
  return jsFetch<JellyseerrRequest>(cfg, `/api/v1/request`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function jsListRequests(
  cfg: JellyseerrConfig,
  opts: {
    filter?: "all" | "approved" | "declined" | "pending" | "available" | "processing";
    take?: number;
    skip?: number;
    sort?: "added" | "modified";
  } = {},
) {
  const qs = new URLSearchParams();
  qs.set("take", String(opts.take ?? 20));
  qs.set("skip", String(opts.skip ?? 0));
  if (opts.filter) qs.set("filter", opts.filter);
  if (opts.sort) qs.set("sort", opts.sort);
  return jsFetch<{
    pageInfo: { pages: number; pageSize: number; results: number; page: number };
    results: JellyseerrRequest[];
  }>(cfg, `/api/v1/request?${qs.toString()}`);
}

export function jsApproveRequest(cfg: JellyseerrConfig, id: number) {
  return jsFetch<JellyseerrRequest>(
    cfg,
    `/api/v1/request/${id}/status/approve`,
    { method: "POST" },
  );
}

export function jsDeclineRequest(cfg: JellyseerrConfig, id: number) {
  return jsFetch<JellyseerrRequest>(
    cfg,
    `/api/v1/request/${id}/status/decline`,
    { method: "POST" },
  );
}

export function jsPosterUrl(path?: string | null) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

export function jsStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return "Unknown";
    case 2:
      return "Pending";
    case 3:
      return "Processing";
    case 4:
      return "Partially available";
    case 5:
      return "Available";
    default:
      return `Status ${status}`;
  }
}

export function jsRequestStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return "Pending";
    case 2:
      return "Approved";
    case 3:
      return "Declined";
    default:
      return `Status ${status}`;
  }
}
