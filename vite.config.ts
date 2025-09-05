import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOST || "localhost";
  const devPort = Number(env.VITE_DEV_PORT || 5174);
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || "localhost")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    server: {
      host: devHost,
      port: devPort,
      allowedHosts,
    },
  };
});
