import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { MovieCard } from "@/components/movie-card";
import { listComingSoon, listLibrary } from "@/lib/library.functions";

const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => listLibrary(),
});

const comingSoonQuery = queryOptions({
  queryKey: ["coming-soon"],
  queryFn: () => listComingSoon(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(libraryQuery),
      context.queryClient.ensureQueryData(comingSoonQuery),
    ]);
  },
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
  const { data: lib } = useSuspenseQuery(libraryQuery);
  const { data: soon } = useSuspenseQuery(comingSoonQuery);
  const movies = lib.movies;
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
            {featured.backdropUrl && (
              <img
                src={featured.backdropUrl}
                alt=""
                className="h-full w-full object-cover opacity-40"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
              Featured
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {featured.title}
            </h1>
            {featured.overview && (
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                {featured.overview}
              </p>
            )}
            <div className="mt-6 flex items-center gap-3">
              <Link
                to="/movies/$movieId"
                params={{ movieId: featured.id }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Watch now
              </Link>
              <span className="text-xs text-muted-foreground">
                {[
                  featured.year,
                  featured.runtimeMin ? `${featured.runtimeMin} min` : null,
                  featured.genres.join(", ") || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Search + grid */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Your library</h2>
          {movies.length > 0 && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles or genres…"
              className="w-64 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          )}
        </div>

        {movies.length === 0 ? (
          <EmptyLibrary configured={lib.configured} error={lib.error} />
        ) : filtered.length === 0 ? (
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

      {/* Coming soon from Jellyseerr */}
      {soon.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Coming soon</h2>
            <Link
              to="/discover"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Request more →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {soon.items.map((it) => (
              <div
                key={it.key}
                className="group relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/50"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                  {it.posterUrl ? (
                    <img
                      src={it.posterUrl}
                      alt={it.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                      {it.title}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[10px] uppercase tracking-wider text-primary">
                      {it.status === 3
                        ? "Processing"
                        : it.status === 4
                          ? "Partial"
                          : "Approved"}
                    </p>
                  </div>
                </div>
                <p className="truncate px-2 py-1.5 text-xs text-foreground">
                  {it.title}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyLibrary({
  configured,
  error,
}: {
  configured: boolean;
  error?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
      {error ? (
        <>
          <p className="font-medium text-foreground">Library scan failed</p>
          <p className="mt-2">{error}</p>
        </>
      ) : configured ? (
        <>
          <p className="font-medium text-foreground">Your library is empty</p>
          <p className="mt-2">
            Run <code className="rounded bg-muted px-1">prep-movie.sh</code> on
            a movie in your <code className="rounded bg-muted px-1">MEDIA_ROOT</code>
            to generate the HLS chunks and it'll appear here.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-foreground">Not configured yet</p>
          <p className="mt-2">
            Set <code className="rounded bg-muted px-1">MEDIA_ROOT</code> (and
            optionally <code className="rounded bg-muted px-1">TMDB_API_KEY</code>){" "}
            in your container env to point RhineTV at your media folder.
          </p>
          <p className="mt-4">
            <Link to="/discover" className="text-primary hover:underline">
              Browse and request movies via Jellyseerr →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
