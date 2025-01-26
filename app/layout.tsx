import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { Toaster } from "@/components/ui/toaster";
import { CartonCalculator } from "@/components/carton-calculator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nikka Nikki IMS",
  description: "Inventory Management System",
};

const sidebarNavItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: "dashboard",
  },
  {
    title: "Sales",
    href: "/sales",
    icon: "sales",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: "users",
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: "inventory",
  },
  {
    title: "Production",
    href: "/production",
    icon: "production",
  },
  {
    title: "Transfers",
    href: "/transfers",
    icon: "transfer",
  },
  {
    title: "Purchases",
    href: "/purchases",
    icon: "purchase",
  },
  {
    title: "Wastage",
    href: "/wastage",
    icon: "wastage",
  },
  {
    title: "Activities",
    href: "/recent-activities",
    icon: "activity",
  },
];

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
            <nav className="w-64 bg-white shadow-md p-6 flex flex-col">
              <h1 className="text-2xl font-bold mb-6">Nikka Nikki</h1>
              <ul className="space-y-2 mb-6">
                {sidebarNavItems.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      className="block py-2 px-4 rounded hover:bg-gray-200"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <CartonCalculator />
              </div>
            </nav>
            <main className="flex-1 p-8 overflow-auto">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
