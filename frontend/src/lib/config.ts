export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5050").replace(/\/$/, "");

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

export const BOROUGHS_GEOJSON_URL =
  import.meta.env.VITE_BOROUGHS_GEOJSON_URL || "/boroughs.geojson";
