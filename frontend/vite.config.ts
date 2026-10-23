import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function apiOrigin(apiUrl: string | undefined): string | undefined {
  try {
    return apiUrl ? new URL(apiUrl).origin : undefined;
  } catch {
    return undefined;
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const backend = apiOrigin(loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL);
  return {
    plugins: [react(), tailwindcss()],
    server: backend ? { proxy: { "/api": backend } } : undefined,
  };
});
