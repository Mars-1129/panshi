import { defineConfig } from "vite"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { runtimePlugin } from "./server/vite-plugin"

export default defineConfig({
  plugins: [react(), runtimePlugin()],
  server: { port: 4173, host: "127.0.0.1", fs: { allow: [resolve(__dirname, "../..")] } },
})
