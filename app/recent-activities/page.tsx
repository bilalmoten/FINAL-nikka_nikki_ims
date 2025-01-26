"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, ArrowUp } from "lucide-react";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";

interface Sale {
  id: number;
  sale_date: string;
  price: number;
  quantity: number;
  final_amount?: number;
  payment_received?: number;
  total_amount?: number;
}

type Activity = Sale;

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

function getActivityDate(activity: Activity): string {
  return activity.sale_date;
}

export default function RecentActivities() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { salesData, salesLoading } = useDashboardQuery();

  const { data: sales } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data?.map((sale: Sale) => ({
        ...sale,
        final_amount: sale.final_amount || 0,
        payment_received: sale.payment_received || 0,
        total_amount: sale.total_amount || 0,
      }));
    },
  });

  if (salesLoading) {
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
    sales: salesData?.filter((s: Sale) => s.sale_date === today) || [],
  };

  // Calculate totals
  const totals = {
    sales: todayActivities.sales.reduce(
      (sum: number, s: Sale) => sum + s.price,
      0
    ),
  };

  // Update the spread array with type casting
  const allActivities = [...(salesData || [])] as Activity[];

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
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Activities</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {allActivities
              .sort((a: Activity, b: Activity) => {
                const dateA = new Date(getActivityDate(a));
                const dateB = new Date(getActivityDate(b));
                return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 10)
              .map((activity: Activity, index: number) => {
                return (
                  <Card key={index}>
                    <CardContent className="flex items-center gap-4 py-4">
                      {isSale(activity) && (
                        <Badge className="bg-green-500">
                          <ArrowUp className="h-4 w-4 mr-1" />
                          Sale
                        </Badge>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {isSale(activity) && `Sold for $${activity.price}`}
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
          {salesData?.slice(0, 10).map((sale: Sale, index: number) => (
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
      </Tabs>
    </div>
  );
}
