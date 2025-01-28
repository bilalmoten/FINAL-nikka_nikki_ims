"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, ArrowUp, Printer } from "lucide-react";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";

interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  location_id: number;
  quantity: number;
  price_per_unit: number;
  trade_scheme?: string;
  discount_percentage?: number;
  discount_amount?: number;
  total_price: number;
  final_price: number;
  product: {
    id: number;
    name: string;
    quantity: number;
  };
  location: {
    id: number;
    name: string;
    address?: string;
  };
}

interface Sale {
  id: number;
  invoice_number: string;
  customer_id?: number;
  buyer_name: string;
  contact_no?: string;
  sale_date: string;
  bill_discount_percentage?: number;
  bill_discount_amount?: number;
  total_amount: number;
  final_amount: number;
  payment_received: number;
  notes?: string;
  items: SaleItem[];
  price: number;
  quantity: number;
  credit_sale: boolean;
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

  // Add function to fetch complete sale data
  const fetchCompleteSaleData = async (saleId: number) => {
    const { data, error } = await supabase
      .from("sales")
      .select(
        `
        *,
        items:sale_items(
          *,
          product:products(*),
          location:locations(*)
        )
      `
      )
      .eq("id", saleId)
      .single();

    if (error) throw error;
    return data;
  };

  // Add function to print receipt
  const printReceipt = async (saleId: number) => {
    try {
      const saleData = await fetchCompleteSaleData(saleId);
      const receiptContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
          <div>
            <h1 style="color: #EA6AA9; font-size: 32px; margin: 0;">NIKKA NIKKI</h1>
            <h2 style="color: #59B0E5; font-size: 24px; margin: 5px 0;">NISA COSMETICS</h2>
            <p style="color: #666; margin: 5px 0;">Plot 10, Sector 16, Korangi Industrial Area</p>
            <p style="color: #666; margin: 5px 0;">Karachi, Pakistan</p>
            <p style="color: #666; margin: 5px 0;">Contact: 0333 3066055</p>
            <p style="color: #666; margin: 5px 0;">Email: nikkanikki.pk@gmail.com</p>
          </div>
          <div style="text-align: right;">
            <h2 style="font-size: 24px; margin: 0; color: #333;">INVOICE</h2>
            <p style="color: #666; margin: 5px 0;">Invoice #: ${
              saleData.invoice_number
            }</p>
            <p style="color: #666; margin: 5px 0;">Date: ${format(
              new Date(saleData.sale_date),
              "PPP"
            )}</p>
          </div>
        </div>

        <!-- Customer Info -->
        <div style="margin-bottom: 30px;">
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Bill To:</h3>
            <p style="margin: 0; color: #666;">${saleData.buyer_name}</p>
            ${
              saleData.contact_no
                ? `<p style="margin: 5px 0; color: #666;">Contact: ${saleData.contact_no}</p>`
                : ""
            }
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #EA6AA9; color: white;">
              <th style="padding: 12px; text-align: center; width: 8%;">Qty</th>
              <th style="padding: 12px; text-align: left; width: 25%;">Description</th>
              <th style="padding: 12px; text-align: right; width: 10%;">Retail Rate</th>
              <th style="padding: 12px; text-align: center; width: 8%;">T.S</th>
              <th style="padding: 12px; text-align: right; width: 10%;">T.S/Pc</th>
              <th style="padding: 12px; text-align: right; width: 8%;">Disc %</th>
              <th style="padding: 12px; text-align: right; width: 10%;">Disc/Pc</th>
              <th style="padding: 12px; text-align: right; width: 10%;">Net Rate</th>
              <th style="padding: 12px; text-align: right; width: 11%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${saleData.items
              .map((item: SaleItem) => {
                const productName = item.product.name
                  .toLowerCase()
                  .includes("gift set")
                  ? `${item.product.name} (4 Pcs)`
                  : item.product.name;

                // Calculate trade scheme discount per piece
                const tradeSchemeDiscountPerPiece = item.trade_scheme
                  ? (calculateTradeSchemeDiscount(
                      item.quantity,
                      item.trade_scheme
                    ) *
                      item.price_per_unit) /
                    item.quantity
                  : 0;

                // Calculate price after trade scheme per piece
                const priceAfterTradeSchemePerPiece =
                  item.price_per_unit - tradeSchemeDiscountPerPiece;

                // Calculate percentage discount per piece
                const percentageDiscountPerPiece = item.discount_percentage
                  ? priceAfterTradeSchemePerPiece *
                    (item.discount_percentage / 100)
                  : 0;

                // Calculate final rate per unit
                const netRateAfterDiscount = item.final_price / item.quantity;

                // Format quantity display
                const qtyDisplay = item.product.name
                  .toLowerCase()
                  .includes("gift set")
                  ? `${item.quantity} Pcs`
                  : `${item.quantity} Pcs`;

                return `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px; text-align: center;">${qtyDisplay}</td>
                  <td style="padding: 12px; text-align: left;">${productName}</td>
                  <td style="padding: 12px; text-align: right;">${item.price_per_unit.toFixed(
                    2
                  )}</td>
                  <td style="padding: 12px; text-align: center;">${
                    item.trade_scheme || "-"
                  }</td>
                  <td style="padding: 12px; text-align: right;">${tradeSchemeDiscountPerPiece.toFixed(
                    2
                  )}</td>
                  <td style="padding: 12px; text-align: right;">${
                    item.discount_percentage?.toFixed(1) || "-"
                  }</td>
                  <td style="padding: 12px; text-align: right;">${percentageDiscountPerPiece.toFixed(
                    2
                  )}</td>
                  <td style="padding: 12px; text-align: right;">${netRateAfterDiscount.toFixed(
                    2
                  )}</td>
                  <td style="padding: 12px; text-align: right;">${item.final_price.toFixed(
                    2
                  )}</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; margin: 20px 0;">
          <div style="flex: 1;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Previous Balance</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background-color: #f5f5f5;">
                <td style="padding: 8px;">Previous Total Rs.:</td>
                <td style="padding: 8px; text-align: right;">24,667.00</td>
              </tr>
              ${
                saleData.credit_sale
                  ? `
                <tr>
                  <td style="padding: 8px;">Current Bill Rs.:</td>
                  <td style="padding: 8px; text-align: right;">${saleData.final_amount.toFixed(
                    2
                  )}</td>
                </tr>
                <tr>
                  <td style="padding: 8px;">Total Balance Rs.:</td>
                  <td style="padding: 8px; text-align: right;">${(
                    24667.0 + saleData.final_amount
                  ).toFixed(2)}</td>
                </tr>
                `
                  : `
                <tr>
                  <td style="padding: 8px;">Cash Balance Rs.:</td>
                  <td style="padding: 8px; text-align: right;">0.00</td>
                </tr>
                <tr>
                  <td style="padding: 8px;">Total Receivable Rs.:</td>
                  <td style="padding: 8px; text-align: right;">24,667.00</td>
                </tr>
                `
              }
            </table>
          </div>
          <div style="flex: 1; margin-left: 40px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Current Bill</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px;">Sub Total:</td>
                <td style="padding: 8px; text-align: right;">${saleData.total_amount.toFixed(
                  2
                )}</td>
              </tr>
              ${(() => {
                // Calculate total discount (item-level + bill-level)
                let totalDiscount =
                  saleData.total_amount - saleData.final_amount;

                // Show bill discount percentage if it exists
                const billDiscountSection = saleData.bill_discount_percentage
                  ? `
                  <tr>
                    <td style="padding: 8px;">Bill Discount:</td>
                    <td style="padding: 8px; text-align: right;">${saleData.bill_discount_percentage}%</td>
                  </tr>
                `
                  : "";

                return `
                  ${billDiscountSection}
                  <tr style="border-top: 1px solid #eee;">
                    <td style="padding: 8px;">Total Discount:</td>
                    <td style="padding: 8px; text-align: right; color: #EA6AA9;">-${totalDiscount.toFixed(
                      2
                    )}</td>
                  </tr>
                  <tr style="font-weight: bold;">
                    <td style="padding: 8px;">Net Amount:</td>
                    <td style="padding: 8px; text-align: right;">${saleData.final_amount.toFixed(
                      2
                    )}</td>
                  </tr>
                `;
              })()}
            </table>
          </div>
        </div>

        ${
          saleData.notes
            ? `
          <div style="margin: 20px 0; padding-top: 20px; border-top: 1px solid #eee;">
            <strong>Notes:</strong> ${saleData.notes}
          </div>
        `
            : ""
        }

        <div style="margin-top: 40px; text-align: center; color: #666;">
          <p style="margin: 5px 0;">Thank you for your business!</p>
        </div>
      </div>
    `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Nikka Nikki Invoice - ${saleData.buyer_name} - ${saleData.invoice_number}</title>
            </head>
            <body>
              ${receiptContent}
              <script>
                window.onload = function() {
                  window.print();
                  document.title = "Nikka Nikki Invoice - ${saleData.buyer_name} - ${saleData.invoice_number}";
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error("Error printing receipt:", error);
    }
  };

  // Helper function to calculate trade scheme discount
  function calculateTradeSchemeDiscount(
    quantity: number,
    scheme: string
  ): number {
    if (!scheme) return 0;

    const [buy, free] = scheme.split("+").map((num) => parseInt(num.trim()));
    if (isNaN(buy) || isNaN(free) || buy <= 0 || free <= 0) return 0;

    // Calculate proportional free items
    const freeItems = (free * quantity) / (buy + free);
    return freeItems;
  }

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => printReceipt(sale.id)}
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
