import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

import basicSsl from '@vitejs/plugin-basic-ssl';

// Read version from package.json for build-time injection
import packageJson from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine if building for Electron
  const isElectron = process.env.BUILD_TARGET === 'electron';
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      !isElectron && basicSsl(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    // Conditional base path: relative for Electron, absolute for web
    base: isElectron ? "./" : "/",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    esbuild: {
      // Strip all console.* calls and debugger statements from production builds.
      // Dev builds keep them via the if (import.meta.env.DEV) guards in code.
      drop: mode === 'production' ? ['debugger', 'console'] : [],
    },
    // Inject app version at build time
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  };
});
