// Temporary in-memory library seed for Phase 1.
// In production this comes from Postgres populated by the admin/scanner.
// The hlsUrl points at the master.m3u8 produced by prep-movie.sh on TrueNAS.

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtimeMin: number;
  overview: string;
  genres: string[];
  posterUrl: string;
  backdropUrl: string;
  hlsUrl: string;
  addedAt: string;
};

// Big Buck Bunny HLS test stream — replace with your own after running prep-movie.sh.
const DEMO_HLS =
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export const MOVIES: Movie[] = [
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    year: 2008,
    runtimeMin: 10,
    overview:
      "A large, gentle rabbit deals with three tiny bullies in this open-source animated short — used here as a demo HLS stream until you point the library at your own TrueNAS media.",
    genres: ["Animation", "Comedy", "Short"],
    posterUrl:
      "https://image.tmdb.org/t/p/w500/gCqnQaq2Y0MseGuU2Kk3ypfMTG4.jpg",
    backdropUrl:
      "https://image.tmdb.org/t/p/original/gCqnQaq2Y0MseGuU2Kk3ypfMTG4.jpg",
    hlsUrl: DEMO_HLS,
    addedAt: "2026-07-14T09:00:00Z",
  },
  {
    id: "sintel",
    title: "Sintel",
    year: 2010,
    runtimeMin: 15,
    overview:
      "A lonely young woman befriends a baby dragon in this open-movie short from the Blender Foundation. Placeholder entry showing how your library grid will look.",
    genres: ["Animation", "Fantasy", "Short"],
    posterUrl:
      "https://image.tmdb.org/t/p/w500/9Q4wZ4t3sIvZ8DAFvUqRj7ROI0z.jpg",
    backdropUrl:
      "https://image.tmdb.org/t/p/original/9Q4wZ4t3sIvZ8DAFvUqRj7ROI0z.jpg",
    hlsUrl: DEMO_HLS,
    addedAt: "2026-07-12T09:00:00Z",
  },
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    year: 2012,
    runtimeMin: 12,
    overview:
      "A live-action sci-fi short about a group of warriors and scientists gathered at the Amsterdam Dam Square to stop a robotic invasion.",
    genres: ["Sci-Fi", "Short"],
    posterUrl:
      "https://image.tmdb.org/t/p/w500/aSHzMhMdKvXk1TTP4tvKb4rZW4Y.jpg",
    backdropUrl:
      "https://image.tmdb.org/t/p/original/aSHzMhMdKvXk1TTP4tvKb4rZW4Y.jpg",
    hlsUrl: DEMO_HLS,
    addedAt: "2026-07-10T09:00:00Z",
  },
  {
    id: "elephants-dream",
    title: "Elephants Dream",
    year: 2006,
    runtimeMin: 11,
    overview:
      "Two strange characters explore a capricious and seemingly infinite machine. The world's first open movie, and another placeholder for your library.",
    genres: ["Animation", "Short"],
    posterUrl:
      "https://image.tmdb.org/t/p/w500/6bNbLzZ8Fj9Y9k5NNbYyR3TgLDR.jpg",
    backdropUrl:
      "https://image.tmdb.org/t/p/original/6bNbLzZ8Fj9Y9k5NNbYyR3TgLDR.jpg",
    hlsUrl: DEMO_HLS,
    addedAt: "2026-07-05T09:00:00Z",
  },
];

export function getMovie(id: string): Movie | undefined {
  return MOVIES.find((m) => m.id === id);
}

export function allMovies(): Movie[] {
  return [...MOVIES].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}
