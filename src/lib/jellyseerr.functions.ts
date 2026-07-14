// TanStack server functions bridging the browser to Jellyseerr.
// The .server.ts wrapper holds the fetch logic; this file only exposes RPC
// stubs so sibling helpers aren't accidentally used by the split transform.

import { createServerFn } from "@tanstack/react-start";
import {
  getJellyseerrConfig,
  jsApproveRequest,
  jsCreateRequest,
  jsDeclineRequest,
  jsListRequests,
  jsSearch,
  type JellyseerrRequest,
  type JellyseerrSearchResult,
} from "./jellyseerr.server";

export type SearchResponse = {
  ok: boolean;
  configured: boolean;
  results: JellyseerrSearchResult[];
  error?: string;
};

export const searchJellyseerr = createServerFn({ method: "GET" })
  .inputValidator((data: { query: string }) => ({
    query: String(data.query ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<SearchResponse> => {
    const cfg = getJellyseerrConfig();
    if (!cfg) return { ok: false, configured: false, results: [] };
    if (!data.query.trim())
      return { ok: true, configured: true, results: [] };
    try {
      const res = await jsSearch(cfg, data.query.trim());
      return {
        ok: true,
        configured: true,
        results: res.results.filter((r) => r.mediaType !== "person"),
      };
    } catch (e) {
      return {
        ok: false,
        configured: true,
        results: [],
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  });

export const requestMedia = createServerFn({ method: "POST" })
  .inputValidator((data: { mediaId: number; mediaType: "movie" | "tv" }) => ({
    mediaId: Number(data.mediaId),
    mediaType: data.mediaType === "tv" ? ("tv" as const) : ("movie" as const),
  }))
  .handler(async ({ data }) => {
    const cfg = getJellyseerrConfig();
    if (!cfg) throw new Error("Jellyseerr is not configured");
    try {
      const req = await jsCreateRequest(cfg, data);
      return { ok: true as const, request: req };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Failed to create request",
      };
    }
  });

export type RequestsResponse = {
  ok: boolean;
  configured: boolean;
  results: JellyseerrRequest[];
  error?: string;
};

export const listRequests = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      filter?: "all" | "pending" | "approved" | "declined" | "available" | "processing";
      take?: number;
    }) => ({
      filter: data.filter ?? "all",
      take: Math.min(Math.max(Number(data.take ?? 30), 1), 100),
    }),
  )
  .handler(async ({ data }): Promise<RequestsResponse> => {
    const cfg = getJellyseerrConfig();
    if (!cfg) return { ok: false, configured: false, results: [] };
    try {
      const res = await jsListRequests(cfg, {
        filter: data.filter,
        take: data.take,
        sort: "modified",
      });
      return { ok: true, configured: true, results: res.results };
    } catch (e) {
      return {
        ok: false,
        configured: true,
        results: [],
        error: e instanceof Error ? e.message : "Failed to fetch requests",
      };
    }
  });

export const approveRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => ({ id: Number(data.id) }))
  .handler(async ({ data }) => {
    const cfg = getJellyseerrConfig();
    if (!cfg) throw new Error("Jellyseerr is not configured");
    return { request: await jsApproveRequest(cfg, data.id) };
  });

export const declineRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => ({ id: Number(data.id) }))
  .handler(async ({ data }) => {
    const cfg = getJellyseerrConfig();
    if (!cfg) throw new Error("Jellyseerr is not configured");
    return { request: await jsDeclineRequest(cfg, data.id) };
  });
