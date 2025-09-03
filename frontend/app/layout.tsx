import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import '../src/index.css'

const inter = Inter({ subsets: ['latin'] })
const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '700'] })

export const metadata: Metadata = {
  title: 'Tellit - Solana Note App',
  description: 'A decentralized note-taking application on Solana',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
