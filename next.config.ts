import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The local voice model runs on native onnxruntime; keep it out of the bundle.
  serverExternalPackages: ["kokoro-js", "@huggingface/transformers", "onnxruntime-node", "phonemizer"],
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
}

export default nextConfig
