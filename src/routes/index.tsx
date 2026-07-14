import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { MovieCard } from "@/components/movie-card";
import { allMovies } from "@/data/library";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RhineTV — Your Library" },
      {
        name: "description",
        content:
          "Self-hosted movie streaming with pre-segmented HLS chunks. Your library, your NAS, your rules.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const movies = allMovies();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return movies;
    return movies.filter(
      (m) =>
        m.title.toLowerCase().includes(t) ||
        m.genres.some((g) => g.toLowerCase().includes(t)),
    );
  }, [movies, q]);

  const featured = movies[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      {featured && (
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <img
              src={featured.backdropUrl}
              alt=""
              className="h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
              Featured
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {featured.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {featured.overview}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href={`/movies/${featured.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Watch now
              </a>
              <span className="text-xs text-muted-foreground">
                {featured.year} · {featured.runtimeMin} min ·{" "}
                {featured.genres.join(", ")}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Search + grid */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Your library</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles or genres…"
            className="w-64 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No movies match “{q}”.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
