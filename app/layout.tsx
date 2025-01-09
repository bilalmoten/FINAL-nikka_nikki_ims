import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Toaster } from "@/components/ui/toaster"
import LoadingIndicator from '@/components/LoadingIndicator'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Nikka Nikki Inventory Management',
  description: 'Manage your Nikka Nikki gift set inventory with ease',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-100">
          <nav className="w-64 bg-white shadow-md p-6">
            <h1 className="text-2xl font-bold mb-6">Nikka Nikki</h1>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="block py-2 px-4 rounded hover:bg-gray-200">Dashboard</Link>
              </li>
              <li>
                <Link href="/inventory" className="block py-2 px-4 rounded hover:bg-gray-200">Detailed Inventory</Link>
              </li>
              <li>
                <Link href="/recent-activities" className="block py-2 px-4 rounded hover:bg-gray-200">Recent Activities</Link>
              </li>
              <li>
                <Link href="/purchases" className="block py-2 px-4 rounded hover:bg-gray-200">Record Purchase</Link>
              </li>
              <li>
                <Link href="/sales" className="block py-2 px-4 rounded hover:bg-gray-200">Record Sale</Link>
              </li>
              <li>
                <Link href="/production" className="block py-2 px-4 rounded hover:bg-gray-200">Record Production</Link>
              </li>
              <li>
                <Link href="/wastage" className="block py-2 px-4 rounded hover:bg-gray-200">Record Wastage</Link>
              </li>
            </ul>
          </nav>
          <main className="flex-1 p-8 overflow-auto">
            <LoadingIndicator />
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}

