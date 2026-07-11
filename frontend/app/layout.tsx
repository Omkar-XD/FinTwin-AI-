import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { QueryProvider } from '@/components/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'FinTwin AI - Premium Financial Intelligence',
  description: 'AI-native financial intelligence platform for sophisticated wealth management',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: [{ color: '#0a0a0a' }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground">
        <QueryProvider>{children}</QueryProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
