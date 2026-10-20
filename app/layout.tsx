import type { Metadata, Viewport } from "next"
import "@fontsource/titillium-web/400.css"
import "@fontsource/titillium-web/600.css"
import "@fontsource/titillium-web/700.css"
import "@fontsource/titillium-web/900.css"
import "@fontsource-variable/inter"
import "./globals.css"

export const metadata: Metadata = {
  title: "F1 Garage",
  description: "Explore every 2026 Formula 1 car in 3D, take it apart part by part, and ask an AI race engineer about upgrades and FIA regulations.",
}

export const viewport: Viewport = { themeColor: "#08090c" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
