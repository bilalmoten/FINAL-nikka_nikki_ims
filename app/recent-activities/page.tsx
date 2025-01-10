"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  ShoppingCart,
  Factory,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Settings,
} from "lucide-react";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import { format } from "date-fns";

interface Sale {
  id: number;
  sale_date: string;
  price: number;
  quantity: number;
}

interface Purchase {
  id: number;
  purchase_date: string;
  price: number;
  quantity: number;
}

interface Production {
  id: number;
  production_date: string;
  quantity: number;
}

interface Wastage {
  id: number;
  wastage_date: string;
  quantity: number;
  reason: string;
}

type Activity = Sale | Purchase | Production | Wastage;

function ActivitySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-[250px] mb-2" />
        <Skeleton className="h-4 w-[350px]" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-[300px]" />

        <div className="grid gap-4 md:grid-cols-2">
          {Array(4)
            .fill(null)
            .map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-[200px]" />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function isSale(activity: Activity): activity is Sale {
  return "sale_date" in activity;
}

function isPurchase(activity: Activity): activity is Purchase {
  return "purchase_date" in activity;
}

function isProduction(activity: Activity): activity is Production {
  return "production_date" in activity;
}

function isWastage(activity: Activity): activity is Wastage {
  return "wastage_date" in activity;
}

function getActivityDate(activity: Activity): string {
  if (isSale(activity)) return activity.sale_date;
  if (isPurchase(activity)) return activity.purchase_date;
  if (isProduction(activity)) return activity.production_date;
  return activity.wastage_date;
}

export default function RecentActivities() {
  const { salesData, purchasesData, productionData, wastageData, isLoading } =
    useDashboardQuery();

  if (isLoading) {
    return <ActivitySkeleton />;
  }

  // Helper function to format date
  const formatDate = (date: string) => {
    return format(new Date(date), "PPP");
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Filter activities for today
  const todayActivities = {
    sales: salesData?.filter((s) => s.sale_date === today) || [],
    purchases: purchasesData?.filter((p) => p.purchase_date === today) || [],
    production:
      productionData?.filter((p) => p.production_date === today) || [],
    wastage: wastageData?.filter((w) => w.wastage_date === today) || [],
  };

  // Calculate totals
  const totals = {
    sales: todayActivities.sales.reduce((sum, s) => sum + s.price, 0),
    purchases: todayActivities.purchases.reduce((sum, p) => sum + p.price, 0),
    production: todayActivities.production.reduce(
      (sum, p) => sum + p.quantity,
      0
    ),
    wastage: todayActivities.wastage.reduce((sum, w) => sum + w.quantity, 0),
  };

  // Update the spread array with type casting
  const allActivities = [
    ...((salesData as Sale[]) || []),
    ...((purchasesData as Purchase[]) || []),
    ...((productionData as Production[]) || []),
    ...((wastageData as Wastage[]) || []),
  ] as Activity[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Recent Activities</h1>
        <p className="text-muted-foreground">
          Track all recent activities across your business
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.sales.toFixed(2)}</div>
            <p className="text-xs text-green-200">
              {todayActivities.sales.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Purchases
            </CardTitle>
            <Package className="h-4 w-4 text-blue-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totals.purchases.toFixed(2)}
            </div>
            <p className="text-xs text-blue-200">
              {todayActivities.purchases.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Production
            </CardTitle>
            <Factory className="h-4 w-4 text-purple-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.production}</div>
            <p className="text-xs text-purple-200">
              {todayActivities.production.length} batches
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-red-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Wastage
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-200" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.wastage}</div>
            <p className="text-xs text-yellow-200">
              {todayActivities.wastage.length} records
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Activities</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {allActivities
              .sort((a, b) => {
                const dateA = new Date(getActivityDate(a));
                const dateB = new Date(getActivityDate(b));
                return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 10)
              .map((activity, index) => {
                return (
                  <Card key={index}>
                    <CardContent className="flex items-center gap-4 py-4">
                      {isSale(activity) && (
                        <Badge className="bg-green-500">
                          <ArrowUp className="h-4 w-4 mr-1" />
                          Sale
                        </Badge>
                      )}
                      {isPurchase(activity) && (
                        <Badge className="bg-blue-500">
                          <ArrowDown className="h-4 w-4 mr-1" />
                          Purchase
                        </Badge>
                      )}
                      {isProduction(activity) && (
                        <Badge className="bg-purple-500">
                          <Settings className="h-4 w-4 mr-1" />
                          Production
                        </Badge>
                      )}
                      {isWastage(activity) && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Wastage
                        </Badge>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {isProduction(activity)
                            ? `Produced ${activity.quantity} units`
                            : isSale(activity)
                              ? `Sold for $${activity.price}`
                              : isPurchase(activity)
                                ? `Purchased for $${activity.price}`
                                : `Wasted ${activity.quantity} units`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(getActivityDate(activity))}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          {salesData?.slice(0, 10).map((sale, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-4 py-4">
                <Badge className="bg-green-500">
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Sale
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sold for ${sale.price}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(sale.sale_date)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          {purchasesData?.slice(0, 10).map((purchase, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-4 py-4">
                <Badge className="bg-blue-500">
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Purchase
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Purchased for ${purchase.price}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(purchase.purchase_date)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          {productionData?.slice(0, 10).map((production, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-4 py-4">
                <Badge className="bg-purple-500">
                  <Settings className="h-4 w-4 mr-1" />
                  Production
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Produced {production.quantity} units
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(production.production_date)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
