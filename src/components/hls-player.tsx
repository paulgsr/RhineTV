import Hls from "hls.js";
import { useEffect, useRef } from "react";
import { getProgress, setProgress } from "@/lib/progress";

type Props = {
  src: string;
  movieId: string;
  poster?: string;
  autoPlay?: boolean;
};

/**
 * HLS player using hls.js.
 * - On Safari, falls back to native HLS via the <video> element.
 * - Resumes from stored progress and writes progress every ~10s.
 */
export function HlsPlayer({ src, movieId, poster, autoPlay = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    const saved = getProgress(movieId);

    const attachStartTime = () => {
      if (saved && saved.positionSec > 5 && saved.durationSec > 0) {
        // Resume slightly before last position for context.
        video.currentTime = Math.max(0, saved.positionSec - 3);
      }
    };

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        attachStartTime();
        if (autoPlay) void video.play().catch(() => undefined);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        attachStartTime();
        if (autoPlay) void video.play().catch(() => undefined);
      });
    }

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaveRef.current < 10_000) return;
      lastSaveRef.current = now;
      if (video.duration && !Number.isNaN(video.duration)) {
        setProgress(movieId, {
          positionSec: video.currentTime,
          durationSec: video.duration,
          updatedAt: now,
        });
      }
    };

    const onPause = () => {
      if (video.duration) {
        setProgress(movieId, {
          positionSec: video.currentTime,
          durationSec: video.duration,
          updatedAt: Date.now(),
        });
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      if (hls) hls.destroy();
    };
  }, [src, movieId, autoPlay]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      controls
      playsInline
      className="h-full w-full bg-black"
    />
  );
}
