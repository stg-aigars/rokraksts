import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rokraksts',
  description: 'Uzraksti burtus ar pirkstu un nosūti apsveikumu savā rokrakstā.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf6ee',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="lv">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
