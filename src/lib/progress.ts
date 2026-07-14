// Local-only progress tracking for Phase 1.
// Persists per-movie playback position in localStorage so "Resume" works while
// we iterate. In production this is replaced by a server function that writes
// to the watch_progress Postgres table for the signed-in user.

const KEY_PREFIX = "chunkflix:progress:";

export type Progress = {
  positionSec: number;
  durationSec: number;
  updatedAt: number;
};

function isBrowser() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getProgress(movieId: string): Progress | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + movieId);
    return raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    return null;
  }
}

export function setProgress(movieId: string, p: Progress) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + movieId, JSON.stringify(p));
  } catch {
    // storage quota / disabled — ignore
  }
}

export function clearProgress(movieId: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + movieId);
  } catch {
    // ignore
  }
}

export function watchedFraction(p: Progress | null): number {
  if (!p || !p.durationSec) return 0;
  return Math.min(1, Math.max(0, p.positionSec / p.durationSec));
}
