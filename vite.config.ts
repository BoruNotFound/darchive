import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// `base` differs between dev and prod:
//   - dev:   "/"               so `npm run dev` works at localhost:5173/
//   - build: "/darchive/"  so assets resolve under GH Pages project URL
//     (https://<user>.github.io/darchive/).
//   - process.env.CF_PAGES
//
// `resolve.alias` mirrors tsconfig.app.json's `paths` because TS path
// mappings are compile-time only and don't carry into the bundler.
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  base: process.env.CF_PAGES ? '/' : '/darchive/',
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
