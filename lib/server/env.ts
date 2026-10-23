import "server-only"

// The only module that reads process.env. Everything server-side gets its
// configuration from here, so secrets never reach client code by accident and
// there's one place to see what the app needs.

const read = (name: string) => {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export const env = {
  /** Nebius Token Factory, OpenAI-compatible. Get a key at https://tokenfactory.nebius.com */
  nebius: {
    apiKey: read("NEBIUS_API_KEY"),
    baseUrl: read("NEBIUS_BASE_URL") ?? "https://api.tokenfactory.nebius.com/v1/",
    /** Any NVIDIA Nemotron id from GET {baseUrl}/models that supports tool calling. */
    model: read("NEBIUS_MODEL") ?? "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  },
  /** Tavily web search (optional): live news, FIA documents, team briefings. */
  tavilyApiKey: read("TAVILY_API_KEY"),
} as const

export const searchAvailable = () => Boolean(env.tavilyApiKey)
