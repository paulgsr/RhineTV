import { Link } from "@tanstack/react-router";
import type { Movie } from "@/data/library";
import { getProgress, watchedFraction } from "@/lib/progress";
import { useEffect, useState } from "react";

export function MovieCard({ movie }: { movie: Movie }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    setPct(watchedFraction(getProgress(movie.id)) * 100);
  }, [movie.id]);

  return (
    <Link
      to="/movies/$movieId"
      params={{ movieId: movie.id }}
      className="group relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/50 transition hover:ring-primary/60"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        <img
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {pct > 2 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <h3 className="truncate text-sm font-medium text-foreground">
          {movie.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {movie.year} · {movie.runtimeMin}m
        </p>
      </div>
    </Link>
  );
}
