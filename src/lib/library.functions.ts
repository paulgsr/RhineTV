// TanStack server functions exposing the filesystem-backed library.
// Helpers live in ./library.server so the split transform can't strip them.

import { createServerFn } from "@tanstack/react-start";
import { scanLibrary, type LibraryMovie } from "./library.server";
import { getJellyseerrConfig, jsListRequests } from "./jellyseerr.server";

export type LibraryResponse = {
  ok: boolean;
  configured: boolean; // MEDIA_ROOT set?
  movies: LibraryMovie[];
  error?: string;
};

export const listLibrary = createServerFn({ method: "GET" }).handler(
  async (): Promise<LibraryResponse> => {
    const configured = Boolean(process.env.MEDIA_ROOT);
    try {
      const movies = await scanLibrary();
      return { ok: true, configured, movies };
    } catch (e) {
      return {
        ok: false,
        configured,
        movies: [],
        error: e instanceof Error ? e.message : "Failed to scan library",
      };
    }
  },
);

export const getLibraryMovie = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }): Promise<LibraryMovie | null> => {
    const movies = await scanLibrary();
    return movies.find((m) => m.id === data.id) ?? null;
  });

export type ComingSoonItem = {
  key: string;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  status: number; // Jellyseerr media status
  mediaType: "movie" | "tv";
  updatedAt: string;
};

export type ComingSoonResponse = {
  ok: boolean;
  configured: boolean;
  items: ComingSoonItem[];
  error?: string;
};

// Approved / processing Jellyseerr requests that aren't yet available in the
// library — surfaced on the homepage so users see what's on the way.
export const listComingSoon = createServerFn({ method: "GET" }).handler(
  async (): Promise<ComingSoonResponse> => {
    const cfg = getJellyseerrConfig();
    if (!cfg) return { ok: false, configured: false, items: [] };
    try {
      const [approved, processing] = await Promise.all([
        jsListRequests(cfg, { filter: "approved", take: 20, sort: "modified" }),
        jsListRequests(cfg, {
          filter: "processing",
          take: 20,
          sort: "modified",
        }),
      ]);
      const merged = [...approved.results, ...processing.results];
      const seen = new Set<number>();
      const items: ComingSoonItem[] = [];
      for (const r of merged) {
        // Skip anything already fully available in the library.
        if (r.media.status === 5) continue;
        if (seen.has(r.media.tmdbId)) continue;
        seen.add(r.media.tmdbId);
        items.push({
          key: `${r.media.mediaType}-${r.media.tmdbId}`,
          tmdbId: r.media.tmdbId,
          title: r.media.title ?? "Untitled",
          posterUrl: r.media.posterPath
            ? `https://image.tmdb.org/t/p/w342${r.media.posterPath}`
            : null,
          backdropUrl: r.media.backdropPath
            ? `https://image.tmdb.org/t/p/w780${r.media.backdropPath}`
            : null,
          status: r.media.status,
          mediaType: r.media.mediaType,
          updatedAt: r.updatedAt,
        });
      }
      return { ok: true, configured: true, items: items.slice(0, 12) };
    } catch (e) {
      return {
        ok: false,
        configured: true,
        items: [],
        error: e instanceof Error ? e.message : "Failed to fetch coming soon",
      };
    }
  },
);
