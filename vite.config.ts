import path from "path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function getProxyTargets(mode: string): { apiTarget: string; wsTarget: string } {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || "http://localhost:8000";
  const apiUrl = new URL(apiTarget);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const wsTarget = env.VITE_WS_URL || `${wsProtocol}//${apiUrl.host}`;

  return { apiTarget, wsTarget };
}

export default defineConfig(({ mode }) => {
  const { apiTarget, wsTarget } = getProxyTargets(mode);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/ws": {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
