import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nikka Nikki IMS",
  description: "Inventory Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen bg-gray-100">
            <nav className="w-64 bg-white shadow-md p-6">
              <h1 className="text-2xl font-bold mb-6">Nikka Nikki</h1>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/inventory"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Detailed Inventory
                  </Link>
                </li>
                <li>
                  <Link
                    href="/recent-activities"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Recent Activities
                  </Link>
                </li>
                <li>
                  <Link
                    href="/purchases"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Record Purchase
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sales"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Record Sale
                  </Link>
                </li>
                <li>
                  <Link
                    href="/production"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Record Production
                  </Link>
                </li>
                <li>
                  <Link
                    href="/wastage"
                    className="block py-2 px-4 rounded hover:bg-gray-200"
                  >
                    Record Wastage
                  </Link>
                </li>
              </ul>
            </nav>
            <main className="flex-1 p-8 overflow-auto">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
