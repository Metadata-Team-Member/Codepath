// Static (no server) build of the Codepath teaching page for GitHub Pages.
// Build: npm run build:static  ->  dist-static/
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "static",
  base: "/Codepath/",
  publicDir: "../public",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [tailwindcss(), viteReact()],
  build: { outDir: "../dist-static", emptyOutDir: true },
});
