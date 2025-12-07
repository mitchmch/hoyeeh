
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE } from '../constants';

export const tmdb = {
  searchMovie: async (query: string) => {
    if (!query) return null;
    try {
      const res = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        return {
          title: movie.title,
          description: movie.overview,
          thumbnailUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
          backdropUrl: movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : null,
          rating: movie.vote_average,
          releaseDate: movie.release_date
        };
      }
      return null;
    } catch (error) {
      console.error("TMDB Search Error", error);
      return null;
    }
  }
};
