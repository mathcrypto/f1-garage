import { Exa } from "exa-js"

export const searchAvailable = () => Boolean(process.env.EXA_API_KEY)

export async function searchWeb(query: string) {
  const exa = new Exa(process.env.EXA_API_KEY)
  const { results } = await exa.search(query, {
    type: "auto",
    numResults: 5,
    contents: { highlights: true },
  })
  return results.map((r) => ({
    title: r.title ?? r.url,
    url: r.url,
    publishedDate: r.publishedDate,
    highlights: r.highlights,
  }))
}
