
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "16104174-8080-405a-a2b4-8cda9731ffff.lovableproject.com"
    ]
  },
  plugins: [
    react(),
    /* mode === 'development' &&
    componentTagger(), */
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
