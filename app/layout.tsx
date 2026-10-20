import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "F1 Garage",
  description: "Explore your favourite Formula 1 car part by part, with an AI race engineer for upgrades and FIA regulations.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
