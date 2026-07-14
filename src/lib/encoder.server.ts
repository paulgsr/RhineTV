// Auto-encoder worker.
//
// Runs INSIDE the RhineTV container (Node runtime). Watches INBOX_ROOT for
// video files, spawns ffprobe + ffmpeg to produce the HLS layout under
// MEDIA_ROOT that library.server.ts scans, and writes metadata.json (with
// optional TMDB enrichment).
//
// State is kept in-memory + persisted as sidecar marker files next to each
// source: `<file>.processed` (with the output folder name) or `<file>.failed`
// (with the error message). This means the worker is stateless across
// restarts and safe to run alongside manual `prep-movie.sh` invocations.
//
// NOTE: Requires ffmpeg + ffprobe on PATH. The runtime Dockerfile installs
// both. In the Cloudflare Workers preview, spawn is stubbed — the worker
// no-ops and reports "not available in preview".

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { invalidateLibraryCache } from "./library.server";

export type JobStatus =
  | "queued"
  | "probing"
  | "encoding"
  | "writing-master"
  | "fetching-metadata"
  | "done"
  | "failed";

export type EncodingJob = {
  id: string;
  sourcePath: string;
  sourceName: string;
  folderName: string;
  status: JobStatus;
  // 0..1 fraction of source duration currently encoded across all renditions
  progress: number;
  currentRendition: string | null;
  renditions: string[];
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  enqueuedAt: string;
};

type WorkerState = {
  jobs: Map<string, EncodingJob>;
  running: boolean;
  interval: NodeJS.Timeout | null;
  available: boolean;
  lastScanAt: number | null;
  lastScanError: string | null;
};

const VIDEO_EXT = new Set([
  ".mkv",
  ".mp4",
  ".m4v",
  ".avi",
  ".mov",
  ".webm",
  ".ts",
]);

const V_BITRATE: Record<string, string> = {
  "1080p": "5000k",
  "720p": "2800k",
  "480p": "1400k",
};
const A_BITRATE: Record<string, string> = {
  "1080p": "192k",
  "720p": "128k",
  "480p": "96k",
};
const HEIGHT: Record<string, number> = {
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
};
const BANDWIDTH: Record<string, number> = {
  "1080p": 5_500_000,
  "720p": 3_200_000,
  "480p": 1_600_000,
};
const RES: Record<string, string> = {
  "1080p": "1920x1080",
  "720p": "1280x720",
  "480p": "854x480",
};

let state: WorkerState | null = null;

function getState(): WorkerState {
  if (state) return state;
  state = {
    jobs: new Map(),
    running: false,
    interval: null,
    available: true, // set false the first time spawn fails
    lastScanAt: null,
    lastScanError: null,
  };
  return state;
}

/** Idempotently start the poll loop. Safe to call from every server fn. */
export function ensureEncoderWorker() {
  const s = getState();
  if (s.interval) return;
  const inbox = process.env.INBOX_ROOT;
  if (!inbox) return; // not configured — nothing to poll
  const intervalMs = Number(process.env.INBOX_POLL_MS ?? 30_000);
  // Kick a scan on next tick, then every interval.
  setTimeout(() => scanInboxSafe(), 500);
  s.interval = setInterval(() => scanInboxSafe(), intervalMs);
}

async function scanInboxSafe() {
  try {
    await scanInbox();
    const s = getState();
    s.lastScanAt = Date.now();
    s.lastScanError = null;
  } catch (e) {
    const s = getState();
    s.lastScanAt = Date.now();
    s.lastScanError = e instanceof Error ? e.message : String(e);
  }
}

export async function scanInbox(): Promise<void> {
  const s = getState();
  const inbox = process.env.INBOX_ROOT;
  const mediaRoot = process.env.MEDIA_ROOT;
  if (!inbox || !mediaRoot) return;

  const files = await listVideosRecursive(inbox, 2);
  for (const src of files) {
    const marker = `${src}.processed`;
    const failed = `${src}.failed`;
    if (await fileExists(marker)) continue;
    if (await fileExists(failed)) continue; // manual delete of .failed re-queues
    const id = hashPath(src);
    if (s.jobs.has(id)) continue;

    const base = path.basename(src, path.extname(src));
    s.jobs.set(id, {
      id,
      sourcePath: src,
      sourceName: path.basename(src),
      folderName: base,
      status: "queued",
      progress: 0,
      currentRendition: null,
      renditions: [],
      error: null,
      startedAt: null,
      finishedAt: null,
      enqueuedAt: new Date().toISOString(),
    });
  }

  processQueue();
}

async function processQueue() {
  const s = getState();
  if (s.running) return;
  const next = [...s.jobs.values()].find((j) => j.status === "queued");
  if (!next) return;
  s.running = true;
  try {
    await runJob(next);
  } finally {
    s.running = false;
    // Drain remaining queue.
    if ([...s.jobs.values()].some((j) => j.status === "queued")) {
      setTimeout(() => processQueue(), 100);
    }
  }
}

async function runJob(job: EncodingJob) {
  const s = getState();
  const mediaRoot = process.env.MEDIA_ROOT!;
  const requested = (process.env.RENDITIONS ?? "1080p 720p 480p")
    .split(/\s+/)
    .filter((r) => r in HEIGHT);
  const segSeconds = Number(process.env.SEG_SECONDS ?? 6);

  job.status = "probing";
  job.startedAt = new Date().toISOString();

  try {
    const probe = await ffprobe(job.sourcePath);
    if (!s.available) throw new Error("ffmpeg not available on this host");

    const renditions = requested.filter((r) => probe.height >= HEIGHT[r]);
    if (renditions.length === 0) {
      // Fall back to lowest requested rendition so tiny sources still play.
      renditions.push(requested[requested.length - 1] ?? "480p");
    }
    job.renditions = renditions;

    const outDir = path.join(mediaRoot, job.folderName);
    await fs.mkdir(outDir, { recursive: true });

    job.status = "encoding";
    const totalWork = probe.durationSec * renditions.length;
    let doneWork = 0;

    for (const r of renditions) {
      job.currentRendition = r;
      const rDir = path.join(outDir, r);
      await fs.mkdir(rDir, { recursive: true });
      await encodeRendition({
        src: job.sourcePath,
        outDir: rDir,
        height: HEIGHT[r],
        vBitrate: V_BITRATE[r],
        aBitrate: A_BITRATE[r],
        segSeconds,
        onProgressSec: (sec) => {
          const cur = Math.min(sec, probe.durationSec);
          job.progress = Math.min(
            1,
            (doneWork + cur) / Math.max(1, totalWork),
          );
        },
      });
      doneWork += probe.durationSec;
      job.progress = Math.min(1, doneWork / Math.max(1, totalWork));
    }

    job.status = "writing-master";
    await writeMaster(path.join(outDir, "master.m3u8"), renditions);

    job.status = "fetching-metadata";
    await writeMetadata(outDir, job.folderName, probe.durationSec);

    await fs.writeFile(`${job.sourcePath}.processed`, job.folderName, "utf8");
    invalidateLibraryCache();

    job.status = "done";
    job.progress = 1;
    job.currentRendition = null;
    job.finishedAt = new Date().toISOString();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    job.status = "failed";
    job.error = msg;
    job.finishedAt = new Date().toISOString();
    try {
      await fs.writeFile(`${job.sourcePath}.failed`, msg, "utf8");
    } catch {
      /* ignore */
    }
  }
}

// -------- ffmpeg / ffprobe wrappers --------

async function ffprobe(
  src: string,
): Promise<{ durationSec: number; height: number }> {
  const s = getState();
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    let proc;
    try {
      proc = spawn("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=height:format=duration",
        "-of",
        "json",
        src,
      ]);
    } catch (e) {
      s.available = false;
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => {
      s.available = false;
      reject(new Error(`ffprobe failed to spawn: ${e.message}`));
    });
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`ffprobe exited ${code}: ${err.slice(0, 300)}`));
      try {
        const j = JSON.parse(out) as {
          streams?: Array<{ height?: number }>;
          format?: { duration?: string };
        };
        const height = j.streams?.[0]?.height ?? 0;
        const durationSec = Math.round(Number(j.format?.duration ?? 0));
        resolve({ durationSec, height });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

async function encodeRendition(opts: {
  src: string;
  outDir: string;
  height: number;
  vBitrate: string;
  aBitrate: string;
  segSeconds: number;
  onProgressSec: (sec: number) => void;
}): Promise<void> {
  const args = buildFfmpegArgs(opts);

  const s = getState();
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn("ffmpeg", args);
    } catch (e) {
      s.available = false;
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    let errTail = "";
    proc.stdout.on("data", (d) => {
      // ffmpeg -progress emits "key=value" lines including out_time_ms=NNN
      const s2 = d.toString();
      const m = s2.match(/out_time_ms=(\d+)/g);
      if (m) {
        const last = m[m.length - 1];
        const us = Number(last.split("=")[1]);
        opts.onProgressSec(us / 1_000_000);
      }
    });
    proc.stderr.on("data", (d) => {
      errTail = (errTail + d.toString()).slice(-500);
    });
    proc.on("error", (e) => {
      s.available = false;
      reject(new Error(`ffmpeg failed to spawn: ${e.message}`));
    });
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`ffmpeg exited ${code}: ${errTail}`));
      resolve();
    });
  });
}

// -------- ffmpeg command builder (per-hwaccel) --------

type Hwaccel = "none" | "nvenc" | "qsv" | "vaapi";

function getHwaccel(): Hwaccel {
  const raw = (process.env.HWACCEL ?? "none").toLowerCase();
  if (raw === "nvenc" || raw === "qsv" || raw === "vaapi") return raw;
  return "none";
}

function buildFfmpegArgs(opts: {
  src: string;
  outDir: string;
  height: number;
  vBitrate: string;
  aBitrate: string;
  segSeconds: number;
}): string[] {
  const gop = String(opts.segSeconds * 2);
  const hw = getHwaccel();

  // Common tail: audio + HLS muxer.
  const tail: string[] = [
    "-c:a",
    "aac",
    "-b:a",
    opts.aBitrate,
    "-ac",
    "2",
    "-hls_time",
    String(opts.segSeconds),
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    path.join(opts.outDir, "seg%05d.ts"),
    "-f",
    "hls",
    path.join(opts.outDir, "index.m3u8"),
  ];

  const preamble = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-nostats",
    "-y",
  ];

  if (hw === "nvenc") {
    // GTX 1060 / any NVIDIA GPU: full GPU pipeline — decode on GPU, scale on
    // GPU, encode with NVENC. Requires nvidia-container-toolkit + a Debian-
    // based ffmpeg built with cuda / nvenc / scale_cuda (bookworm ships one).
    return [
      ...preamble,
      "-hwaccel",
      "cuda",
      "-hwaccel_output_format",
      "cuda",
      "-i",
      opts.src,
      // scale on the GPU to avoid a CPU round-trip
      "-vf",
      `scale_cuda=-2:${opts.height}:format=yuv420p`,
      "-c:v",
      "h264_nvenc",
      "-preset",
      "p5", // p1 fastest .. p7 slowest; p5 = balanced
      "-tune",
      "hq",
      "-rc",
      "vbr",
      "-cq",
      "23",
      "-b:v",
      opts.vBitrate,
      "-maxrate",
      opts.vBitrate,
      "-bufsize",
      opts.vBitrate,
      "-profile:v",
      "main",
      "-g",
      gop,
      "-keyint_min",
      gop,
      "-sc_threshold",
      "0",
      ...tail,
    ];
  }

  if (hw === "qsv") {
    // Intel iGPU QuickSync. Needs /dev/dri passthrough.
    return [
      ...preamble,
      "-hwaccel",
      "qsv",
      "-hwaccel_output_format",
      "qsv",
      "-i",
      opts.src,
      "-vf",
      `vpp_qsv=w=-2:h=${opts.height}`,
      "-c:v",
      "h264_qsv",
      "-preset",
      "medium",
      "-global_quality",
      "23",
      "-b:v",
      opts.vBitrate,
      "-maxrate",
      opts.vBitrate,
      "-bufsize",
      opts.vBitrate,
      "-g",
      gop,
      ...tail,
    ];
  }

  if (hw === "vaapi") {
    // AMD / Intel via VA-API. Needs /dev/dri passthrough.
    return [
      ...preamble,
      "-hwaccel",
      "vaapi",
      "-hwaccel_device",
      "/dev/dri/renderD128",
      "-hwaccel_output_format",
      "vaapi",
      "-i",
      opts.src,
      "-vf",
      `scale_vaapi=w=-2:h=${opts.height}:format=nv12`,
      "-c:v",
      "h264_vaapi",
      "-b:v",
      opts.vBitrate,
      "-maxrate",
      opts.vBitrate,
      "-bufsize",
      opts.vBitrate,
      "-g",
      gop,
      ...tail,
    ];
  }

  // CPU fallback (libx264).
  return [
    ...preamble,
    "-i",
    opts.src,
    "-vf",
    `scale=-2:${opts.height}`,
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-b:v",
    opts.vBitrate,
    "-maxrate",
    opts.vBitrate,
    "-bufsize",
    opts.vBitrate,
    "-pix_fmt",
    "yuv420p",
    "-g",
    gop,
    "-keyint_min",
    gop,
    "-sc_threshold",
    "0",
    ...tail,
  ];
}


async function writeMaster(masterPath: string, renditions: string[]) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const r of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${BANDWIDTH[r]},RESOLUTION=${RES[r]}`,
    );
    lines.push(`${r}/index.m3u8`);
  }
  await fs.writeFile(masterPath, lines.join("\n") + "\n", "utf8");
}

async function writeMetadata(
  outDir: string,
  folderName: string,
  durationSec: number,
) {
  const parsed = parseFolderName(folderName);
  const runtimeMin = Math.round(durationSec / 60);

  type Meta = Record<string, unknown>;
  const meta: Meta = {
    title: parsed.title,
    year: parsed.year,
    runtimeMin,
    overview: "",
    genres: [] as string[],
  };

  const key = process.env.TMDB_API_KEY;
  if (key && parsed.title) {
    try {
      const qs = new URLSearchParams({ api_key: key, query: parsed.title });
      if (parsed.year) qs.set("year", String(parsed.year));
      const r = await fetch(
        `https://api.themoviedb.org/3/search/movie?${qs}`,
      );
      if (r.ok) {
        const data = (await r.json()) as {
          results?: Array<{
            id: number;
            title: string;
            overview: string;
            poster_path: string | null;
            backdrop_path: string | null;
            release_date: string;
          }>;
        };
        const first = data.results?.[0];
        if (first) {
          meta.tmdbId = first.id;
          meta.title = first.title;
          if (first.release_date)
            meta.year = Number(first.release_date.slice(0, 4));
          meta.overview = first.overview;
          meta.posterPath = first.poster_path ?? undefined;
          meta.backdropPath = first.backdrop_path ?? undefined;

          const d = await fetch(
            `https://api.themoviedb.org/3/movie/${first.id}?api_key=${key}`,
          );
          if (d.ok) {
            const dj = (await d.json()) as {
              runtime?: number;
              genres?: Array<{ name: string }>;
            };
            if (dj.runtime) meta.runtimeMin = dj.runtime;
            meta.genres = dj.genres?.map((g) => g.name) ?? [];
          }
        }
      }
    } catch {
      /* TMDB best-effort */
    }
  }

  await fs.writeFile(
    path.join(outDir, "metadata.json"),
    JSON.stringify(meta, null, 2),
    "utf8",
  );
}

// -------- misc --------

async function listVideosRecursive(
  dir: string,
  depth: number,
): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0) {
      out.push(...(await listVideosRecursive(p, depth - 1)));
    } else if (e.isFile() && VIDEO_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(p);
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

function parseFolderName(name: string): {
  title: string;
  year: number | null;
} {
  const m = name.match(/^(.*?)[.\s_-]*\(?(\d{4})\)?\s*$/);
  if (m) {
    return {
      title: m[1].replace(/[._]+/g, " ").trim() || name,
      year: Number(m[2]),
    };
  }
  return { title: name.replace(/[._]+/g, " ").trim(), year: null };
}

function hashPath(p: string): string {
  // Simple stable hash — path is unique per job.
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) | 0;
  return `job-${(h >>> 0).toString(36)}`;
}

// -------- read-only accessors for server fns --------

export type EncoderStatus = {
  configured: boolean;
  available: boolean;
  lastScanAt: string | null;
  lastScanError: string | null;
  jobs: EncodingJob[];
};

export function getEncoderStatus(): EncoderStatus {
  const s = getState();
  const jobs = [...s.jobs.values()].sort(
    (a, b) => (a.enqueuedAt < b.enqueuedAt ? 1 : -1),
  );
  return {
    configured: Boolean(process.env.INBOX_ROOT && process.env.MEDIA_ROOT),
    available: s.available,
    lastScanAt: s.lastScanAt ? new Date(s.lastScanAt).toISOString() : null,
    lastScanError: s.lastScanError,
    jobs,
  };
}

export function clearFinishedJobs() {
  const s = getState();
  for (const [id, j] of s.jobs) {
    if (j.status === "done" || j.status === "failed") s.jobs.delete(id);
  }
}
