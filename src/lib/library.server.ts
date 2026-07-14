// Filesystem-backed library scanner.
//
// Scans MEDIA_ROOT for movie folders. A "movie folder" is any directory
// (up to 2 levels deep) that contains a `master.m3u8` — produced by
// prep-movie.sh on TrueNAS. Metadata comes from either:
//   1. A `metadata.json` file inside the folder (fast path — written by prep-movie.sh)
//   2. A live TMDB lookup keyed on folder name "Title (Year)" (needs TMDB_API_KEY)
//   3. Otherwise: filename-derived title, no artwork.
//
// The scan result is cached in-process for LIBRARY_CACHE_MS to keep the
// homepage fast; call invalidateLibraryCache() after admin actions.

import { promises as fs } from "node:fs";
import path from "node:path";

export type LibraryMovie = {
  id: string; // slugified folder path, stable
  folder: string; // relative path under MEDIA_ROOT
  title: string;
  year: number | null;
  runtimeMin: number | null;
  overview: string;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  hlsUrl: string;
  tmdbId: number | null;
  addedAt: string; // ISO
};

type Metadata = Partial<{
  title: string;
  year: number;
  runtimeMin: number;
  overview: string;
  genres: string[];
  posterPath: string; // TMDB path e.g. /abc.jpg
  backdropPath: string;
  posterUrl: string; // absolute override
  backdropUrl: string;
  tmdbId: number;
}>;

const CACHE_MS = Number(process.env.LIBRARY_CACHE_MS ?? 30_000);
const TMDB_IMG = "https://image.tmdb.org/t/p";

let cache: { at: number; movies: LibraryMovie[] } | null = null;

export function invalidateLibraryCache() {
  cache = null;
}

export async function scanLibrary(): Promise<LibraryMovie[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.movies;

  const root = process.env.MEDIA_ROOT;
  const publicBase = (
    process.env.PUBLIC_MEDIA_BASE_URL ?? "/media"
  ).replace(/\/$/, "");

  if (!root) {
    cache = { at: Date.now(), movies: [] };
    return [];
  }

  let entries: string[] = [];
  try {
    entries = await walkForMasters(root, 2);
  } catch {
    cache = { at: Date.now(), movies: [] };
    return [];
  }

  const movies: LibraryMovie[] = [];
  for (const masterPath of entries) {
    const folderAbs = path.dirname(masterPath);
    const folderRel = path.relative(root, folderAbs).split(path.sep).join("/");
    const id = slugify(folderRel);
    const st = await fs.stat(masterPath).catch(() => null);
    const addedAt = st ? st.mtime.toISOString() : new Date(0).toISOString();

    const meta = await readMetadata(folderAbs);
    const parsed = parseFolderName(path.basename(folderAbs));

    // TMDB lookup fills in gaps only when metadata.json is missing bits.
    let tmdb: Metadata = {};
    if (!meta && parsed.title) {
      tmdb = await tmdbLookup(parsed.title, parsed.year);
    }

    const merged: Metadata = { ...tmdb, ...meta };

    movies.push({
      id,
      folder: folderRel,
      title: merged.title ?? parsed.title ?? folderRel,
      year: merged.year ?? parsed.year ?? null,
      runtimeMin: merged.runtimeMin ?? null,
      overview: merged.overview ?? "",
      genres: merged.genres ?? [],
      posterUrl:
        merged.posterUrl ??
        (merged.posterPath ? `${TMDB_IMG}/w500${merged.posterPath}` : null),
      backdropUrl:
        merged.backdropUrl ??
        (merged.backdropPath
          ? `${TMDB_IMG}/original${merged.backdropPath}`
          : null),
      hlsUrl: `${publicBase}/${folderRel}/master.m3u8`,
      tmdbId: merged.tmdbId ?? null,
      addedAt,
    });
  }

  movies.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  cache = { at: Date.now(), movies };
  return movies;
}

async function walkForMasters(dir: string, depth: number): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === "master.m3u8") {
      out.push(p);
    } else if (e.isDirectory() && depth > 0) {
      // If this dir directly contains master.m3u8, record and don't recurse.
      const hasMaster = await fileExists(path.join(p, "master.m3u8"));
      if (hasMaster) {
        out.push(path.join(p, "master.m3u8"));
      } else {
        out.push(...(await walkForMasters(p, depth - 1)));
      }
    }
  }
  return out;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readMetadata(folder: string): Promise<Metadata | null> {
  try {
    const raw = await fs.readFile(path.join(folder, "metadata.json"), "utf8");
    return JSON.parse(raw) as Metadata;
  } catch {
    return null;
  }
}

function parseFolderName(name: string): { title: string; year: number | null } {
  // "Sintel (2010)" | "Sintel.2010" | "Sintel"
  const m = name.match(/^(.*?)[.\s_-]*\(?(\d{4})\)?\s*$/);
  if (m) {
    return {
      title: m[1].replace(/[._]+/g, " ").trim() || name,
      year: Number(m[2]),
    };
  }
  return { title: name.replace(/[._]+/g, " ").trim(), year: null };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

// -------- TMDB (best-effort, cached per (title,year)) --------

const tmdbCache = new Map<string, Metadata>();

async function tmdbLookup(
  title: string,
  year: number | null,
): Promise<Metadata> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return {};
  const cacheKey = `${title}::${year ?? ""}`;
  const hit = tmdbCache.get(cacheKey);
  if (hit) return hit;

  const qs = new URLSearchParams({
    api_key: key,
    query: title,
    include_adult: "false",
  });
  if (year) qs.set("year", String(year));

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?${qs.toString()}`,
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      results: Array<{
        id: number;
        title: string;
        overview: string;
        poster_path: string | null;
        backdrop_path: string | null;
        release_date: string;
        genre_ids: number[];
      }>;
    };
    const first = data.results?.[0];
    if (!first) return {};

    // Fetch details for runtime + genre names in parallel.
    const detailRes = await fetch(
      `https://api.themoviedb.org/3/movie/${first.id}?api_key=${key}`,
    );
    let runtimeMin: number | undefined;
    let genres: string[] | undefined;
    if (detailRes.ok) {
      const d = (await detailRes.json()) as {
        runtime?: number;
        genres?: Array<{ name: string }>;
      };
      runtimeMin = d.runtime;
      genres = d.genres?.map((g) => g.name);
    }

    const out: Metadata = {
      tmdbId: first.id,
      title: first.title,
      year: first.release_date
        ? Number(first.release_date.slice(0, 4))
        : undefined,
      overview: first.overview,
      posterPath: first.poster_path ?? undefined,
      backdropPath: first.backdrop_path ?? undefined,
      runtimeMin,
      genres,
    };
    tmdbCache.set(cacheKey, out);
    return out;
  } catch {
    return {};
  }
}
