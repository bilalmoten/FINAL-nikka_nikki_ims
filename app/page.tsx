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
  MapPin,
  ChevronDown,
} from "lucide-react";
import { Charts } from "@/components/Charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { formatGiftSetQuantity } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CardDescription } from "@/components/ui/card";

interface Product {
  id: number;
  name: string;
  quantity: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  total_sales: number;
  total_payments: number;
  current_balance: number;
}

export default function Dashboard() {
  const {
    products,
    salesData,
    locations,
    stockByLocation,
    productsLoading,
    salesLoading,
    locationsLoading,
  } = useDashboardQuery();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Add query for customers with outstanding balances
  const { data: customersWithBalance } = useQuery({
    queryKey: ["customers_with_balance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .gt("current_balance", 0)
        .order("current_balance", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Add query for total receivables
  const { data: totalReceivables } = useQuery({
    queryKey: ["total_receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("current_balance")
        .gt("current_balance", 0);
      if (error) throw error;
      return data.reduce(
        (sum: number, customer: { current_balance: number }) =>
          sum + customer.current_balance,
        0
      );
    },
  });

  if (productsLoading || salesLoading || locationsLoading) {
    return <DashboardSkeleton />;
  }

  const inventory = {
    giftSet: products?.find((p) => p.name === "Gift Set")?.quantity || 0,
    readyProducts: {
      soap: products?.find((p) => p.name === "Soap (Ready)")?.quantity || 0,
      powder: products?.find((p) => p.name === "Powder")?.quantity || 0,
      lotion: products?.find((p) => p.name === "Lotion (Ready)")?.quantity || 0,
      shampoo:
        products?.find((p) => p.name === "Shampoo (Ready)")?.quantity || 0,
    },
    unfinishedProducts: {
      soap: {
        wrapped:
          products?.find((p) => p.name === "Soap (Wrapped)")?.quantity || 0,
        emptyBoxes:
          products?.find((p) => p.name === "Soap Boxes")?.quantity || 0,
      },
      lotion: {
        filledUnlabeled:
          products?.find((p) => p.name === "Lotion (Unlabeled)")?.quantity || 0,
      },
      shampoo: {
        filledUnlabeled:
          products?.find((p) => p.name === "Shampoo (Unlabeled)")?.quantity ||
          0,
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

  // Calculate today's sales with null check
  const todaySales = salesData?.filter((s) => s.sale_date === today) || [];
  const totalSales = todaySales.reduce((sum, s) => sum + (s.price || 0), 0);

  // Prepare data for charts with null checks
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const salesChartData = last7Days.map((date) => ({
    date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    sales:
      salesData
        ?.filter((s) => s.sale_date === date)
        .reduce((sum, s) => sum + (s.price || 0), 0) || 0,
  }));

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            Nikka Nikki Dashboard
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-pink-500 to-rose-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gift Sets</CardTitle>
              <Gift className="h-4 w-4 text-pink-200" />
            </CardHeader>
            <CardContent>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-2xl font-bold cursor-help">
                    {formatGiftSetQuantity(readyGiftSets, "Gift Set").display}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {formatGiftSetQuantity(readyGiftSets, "Gift Set").tooltip}
                  </p>
                </TooltipContent>
              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-2xl font-bold cursor-help">
                    {
                      formatGiftSetQuantity(potentialGiftSets, "Gift Set")
                        .display
                    }
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {
                      formatGiftSetQuantity(potentialGiftSets, "Gift Set")
                        .tooltip
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="text-xs text-purple-200">Can be assembled</p>
              <Progress
                className="mt-2"
                value={(potentialGiftSets / 1000) * 100}
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Sales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
              <p className="text-xs text-green-200">
                {todaySales.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Receivables
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalReceivables?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                From {customersWithBalance?.length || 0} customers
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Stock by Location */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-primary">
                Stock by Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {locations?.map((location) => {
                  const locationProducts = stockByLocation?.[location.id] || [];
                  const giftSets = locationProducts.filter(
                    (p: Product) => p.name === "Gift Set"
                  );
                  const otherProducts = locationProducts.filter(
                    (p: Product) => p.name !== "Gift Set"
                  );
                  const totalItems = locationProducts.reduce(
                    (sum: number, p: Product) => sum + p.quantity,
                    0
                  );

                  return (
                    <Card key={location.id}>
                      <CardHeader className="py-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {location.name}
                          </CardTitle>
                          <span className="text-sm text-muted-foreground">
                            {totalItems} total items
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Gift Sets */}
                          {giftSets.map((product: Product) => {
                            const quantity = formatGiftSetQuantity(
                              product.quantity,
                              product.name
                            );
                            return (
                              <div
                                key={product.id}
                                className="flex items-center space-x-2 bg-secondary/10 p-3 rounded-lg"
                              >
                                <Gift className="h-5 w-5 text-secondary" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {product.name}
                                  </p>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-xl font-bold text-primary cursor-help">
                                        {quantity.display}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{quantity.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            );
                          })}

                          {/* Other Products - Collapsible */}
                          {otherProducts.length > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-between"
                                >
                                  Other Products
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                  {otherProducts.map((product: Product) => (
                                    <div
                                      key={product.id}
                                      className="flex items-center space-x-2 bg-secondary/10 p-3 rounded-lg"
                                    >
                                      <ShoppingBag className="h-5 w-5 text-secondary" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          {product.name}
                                        </p>
                                        <p className="text-xl font-bold text-primary">
                                          {product.quantity}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

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
                        <p className="text-xl font-bold text-primary">
                          {count}
                        </p>
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

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="receivables">Receivables</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Existing cards */}

              {/* Add Receivables Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Receivables
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${totalReceivables?.toFixed(2) || "0.00"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From {customersWithBalance?.length || 0} customers
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Existing content */}
          </TabsContent>

          {/* Existing tabs content */}

          {/* Add Receivables Tab */}
          <TabsContent value="receivables" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Outstanding Balances</CardTitle>
                  <CardDescription>
                    Customers with pending payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {customersWithBalance?.map((customer) => (
                      <div key={customer.id} className="flex items-center">
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {customer.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {customer.phone}
                          </p>
                        </div>
                        <div className="ml-auto font-medium">
                          ${customer.current_balance.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    {(!customersWithBalance ||
                      customersWithBalance.length === 0) && (
                      <div className="text-center text-muted-foreground">
                        No outstanding balances
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Receivables Summary</CardTitle>
                  <CardDescription>
                    Overview of customer payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div className="flex items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Total Outstanding
                        </p>
                      </div>
                      <div className="ml-auto font-medium">
                        ${totalReceivables?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Customers with Balance
                        </p>
                      </div>
                      <div className="ml-auto font-medium">
                        {customersWithBalance?.length || 0}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Average Balance
                        </p>
                      </div>
                      <div className="ml-auto font-medium">
                        $
                        {customersWithBalance?.length
                          ? (
                              totalReceivables! / customersWithBalance.length
                            ).toFixed(2)
                          : "0.00"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

// Add loading state component
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-[200px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array(3)
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
    </div>
  );
}
