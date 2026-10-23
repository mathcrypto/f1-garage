import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Edge TTS uses a native WebSocket client; keep it out of the bundle.
  serverExternalPackages: ["node-edge-tts", "ws"],
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
}

export default nextConfig
