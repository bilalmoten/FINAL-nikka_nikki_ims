"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Gift,
  Package,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Charts } from "@/components/Charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";

export default function Dashboard() {
  const { products, salesData, productsLoading, salesLoading } = useDashboardQuery();

  if (productsLoading || salesLoading) {
    return <DashboardSkeleton />;
  }

  const inventory = {
    giftSet: products?.find((p) => p.name === "Gift Set")?.quantity || 0,
    readyProducts: {
      soap: products?.find((p) => p.name === "Soap (Ready)")?.quantity || 0,
      powder: products?.find((p) => p.name === "Powder")?.quantity || 0,
      lotion: products?.find((p) => p.name === "Lotion (Ready)")?.quantity || 0,
      shampoo: products?.find((p) => p.name === "Shampoo (Ready)")?.quantity || 0,
    },
    unfinishedProducts: {
      soap: {
        wrapped: products?.find((p) => p.name === "Soap (Wrapped)")?.quantity || 0,
        emptyBoxes: products?.find((p) => p.name === "Soap Boxes")?.quantity || 0,
      },
      lotion: {
        filledUnlabeled: products?.find((p) => p.name === "Lotion (Unlabeled)")?.quantity || 0,
      },
      shampoo: {
        filledUnlabeled: products?.find((p) => p.name === "Shampoo (Unlabeled)")?.quantity || 0,
      },
    },
  };

  const readyGiftSets = inventory.giftSet;
  const potentialGiftSets = Math.min(
    inventory.readyProducts.soap,
    inventory.readyProducts.powder,
    inventory.readyProducts.lotion,
    inventory.readyProducts.shampoo,
    products?.find((p) => p.name === "Gift Box Outer Cardboard")?.quantity || 0,
    products?.find((p) => p.name === "Empty Thermacol")?.quantity || 0
  );

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Calculate today's sales
  const todaySales = salesData?.filter((s) => s.sale_date === today) || [];
  const totalSales = todaySales.reduce((sum, s) => sum + s.price, 0);

  // Prepare data for charts
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const salesChartData = last7Days.map((date) => ({
    date,
    sales: salesData?.filter((s) => s.sale_date === date).reduce((sum, s) => sum + s.price, 0) || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">
          Nikka Nikki Dashboard
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-pink-500 to-rose-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gift Sets</CardTitle>
            <Gift className="h-4 w-4 text-pink-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readyGiftSets}</div>
            <p className="text-xs text-pink-200">Ready to sell</p>
            <Progress className="mt-2" value={(readyGiftSets / 1000) * 100} />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Potential Gift Sets
            </CardTitle>
            <Package className="h-4 w-4 text-purple-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{potentialGiftSets}</div>
            <p className="text-xs text-purple-200">Can be assembled</p>
            <Progress className="mt-2" value={(potentialGiftSets / 1000) * 100} />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
            <p className="text-xs text-green-200">{todaySales.length} transactions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">
              Ready Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(inventory.readyProducts).map(
                ([product, count]) => (
                  <div
                    key={product}
                    className="flex items-center space-x-2 bg-secondary/10 p-3 rounded-lg"
                  >
                    <ShoppingBag className="h-5 w-5 text-secondary" />
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {product}
                      </p>
                      <p className="text-xl font-bold text-primary">{count}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">
              Unfinished Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {Object.entries(inventory.unfinishedProducts).map(
                ([product, details]) => (
                  <li
                    key={product}
                    className="flex justify-between items-center bg-secondary/10 p-2 rounded"
                  >
                    <span className="capitalize text-sm">{product}</span>
                    <span className="font-bold text-primary">
                      {Object.values(details)[0]}
                    </span>
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {last7Days.map((date) => {
                const salesForDay = salesData?.filter((s) => s.sale_date === date) || [];
                const totalSales = salesForDay.reduce((sum, s) => sum + s.price, 0);

                return (
                  <div key={date} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {new Date(date).toLocaleDateString("en-US", {
                          weekday: "long",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Sales: ${totalSales.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(inventory.readyProducts).map(
                ([product, count]) => {
                  const lowStock = count < 100;
                  return lowStock ? (
                    <Alert
                      key={product}
                      variant={lowStock ? "destructive" : "default"}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Low Stock Warning</AlertTitle>
                      <AlertDescription>
                        {product} is running low ({count} units remaining)
                      </AlertDescription>
                    </Alert>
                  ) : null;
                }
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Charts salesChartData={salesChartData} />
    </div>
  );
}

// Add loading state component
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-[200px]" />
        <Skeleton className="h-9 w-[120px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array(4)
          .fill(null)
          .map((_, i) => (
            <Card key={i} className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-rose-500/20" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full mt-2" />
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Array(4)
                .fill(null)
                .map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-2 bg-secondary/10 p-3 rounded-lg"
                  >
                    <Skeleton className="h-5 w-5" />
                    <div>
                      <Skeleton className="h-4 w-20 mb-1" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array(3)
                .fill(null)
                .map((_, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-secondary/10 p-2 rounded"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array(7)
                .fill(null)
                .map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array(3)
                .fill(null)
                .map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
