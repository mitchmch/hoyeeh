
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
  },

  searchTv: async (query: string) => {
    if (!query) return null;
    try {
      const res = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const show = data.results[0];
        return {
          title: show.name, // TV shows use 'name' instead of 'title'
          description: show.overview,
          thumbnailUrl: show.poster_path ? `${TMDB_IMAGE_BASE}${show.poster_path}` : null,
          backdropUrl: show.backdrop_path ? `${TMDB_IMAGE_BASE}${show.backdrop_path}` : null,
          rating: show.vote_average,
          releaseDate: show.first_air_date
        };
      }
      return null;
    } catch (error) {
      console.error("TMDB TV Search Error", error);
      return null;
    }
  },

  getDetailedInfo: async (title: string, type: 'movie' | 'series') => {
    if (!title) return null;
    try {
      // 1. Search to get ID
      const searchEndpoint = type === 'series' ? 'search/tv' : 'search/movie';
      const searchRes = await fetch(`${TMDB_BASE_URL}/${searchEndpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
      const searchData = await searchRes.json();
      
      if (!searchData.results || searchData.results.length === 0) return null;
      
      const item = searchData.results[0];
      const id = item.id;

      // 2. Fetch Details with Credits
      const detailsEndpoint = type === 'series' ? `tv/${id}` : `movie/${id}`;
      const detailsRes = await fetch(`${TMDB_BASE_URL}/${detailsEndpoint}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
      const details = await detailsRes.json();

      const credits = details.credits || {};
      const cast = (credits.cast || []).slice(0, 5).map((c: any) => c.name);
      
      let director = [];
      if (type === 'movie') {
         director = (credits.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => c.name);
      } else {
         director = (details.created_by || []).map((c: any) => c.name);
      }

      return {
        rating: details.vote_average,
        genres: (details.genres || []).map((g: any) => g.name),
        releaseDate: details.release_date || details.first_air_date,
        cast: cast,
        director: director,
        tagline: details.tagline
      };

    } catch (error) {
      console.error("TMDB Details Error", error);
      return null;
    }
  }
};
