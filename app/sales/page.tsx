"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  ArrowDown,
  Printer,
  Calculator,
  ShoppingCart,
} from "lucide-react";
import { cn, formatGiftSetQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Product {
  id: number;
  name: string;
  quantity: number;
}

interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  price_per_unit: number;
  trade_scheme?: string;
  discount_percentage?: number;
  discount_amount?: number;
  total_price: number;
  final_price: number;
  product: Product;
}

interface Sale {
  id: number;
  invoice_number: string;
  buyer_name: string;
  contact_no?: string;
  sale_date: string;
  bill_discount_percentage?: number;
  bill_discount_amount?: number;
  total_amount: number;
  final_amount: number;
  notes?: string;
  items: SaleItem[];
  product?: Product;
  quantity?: number;
  price?: number;
}

interface Transfer {
  id: number;
  product_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: number;
  transfer_date: string;
  product: Product;
  from_location: Location;
  to_location: Location;
}

interface Location {
  id: number;
  name: string;
  address?: string;
}

interface StockByLocation {
  [key: number]: Product[];
}

// Schema for individual sale item
const saleItemSchema = z.object({
  product_id: z.string({
    required_error: "Please select a product.",
  }),
  quantity: z.string().min(1, "Quantity is required"),
  price_per_unit: z.string().min(1, "Price per unit is required"),
  trade_scheme: z.string().optional(),
  discount_percentage: z.string().optional(),
  discount_amount: z.string().optional(),
});

// Main form schema
const formSchema = z.object({
  buyer_name: z.string(),
  contact_no: z.string().optional(),
  sale_date: z.date(),
  location_id: z.string({
    required_error: "Please select a location.",
  }),
  notes: z.string().optional(),
  bill_discount_percentage: z.string().optional(),
  bill_discount_amount: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string(),
      quantity: z.string(),
      price_per_unit: z.string(),
      trade_scheme: z.string().optional(),
      discount_percentage: z.string().optional(),
      discount_amount: z.string().optional(),
    })
  ),
});

type FormValues = z.infer<typeof formSchema>;

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

// Helper function to calculate item final price
function calculateItemFinalPrice(
  quantity: number,
  pricePerUnit: number,
  tradeScheme?: string,
  discountPercentage?: string,
  discountAmount?: string
): { totalPrice: number; finalPrice: number } {
  // Calculate initial total
  const total = quantity * pricePerUnit;

  // Apply trade scheme discount
  const freeItems = calculateTradeSchemeDiscount(quantity, tradeScheme || "");
  const priceAfterTradeScheme = total - freeItems * pricePerUnit;

  // Apply fixed amount discount
  const discAmt = parseFloat(discountAmount || "0");
  const priceAfterAmountDiscount = Math.max(0, priceAfterTradeScheme - discAmt);

  // Apply percentage discount
  const discPerc = parseFloat(discountPercentage || "0");
  const discountFromPercentage = priceAfterAmountDiscount * (discPerc / 100);
  const finalPrice = Math.max(
    0,
    priceAfterAmountDiscount - discountFromPercentage
  );

  return { totalPrice: total, finalPrice };
}

function SalesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-[250px] mb-2" />
        <Skeleton className="h-4 w-[350px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="space-y-4">
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <Skeleton key={i} className="h-[100px]" />
            ))}
        </div>
      </div>
    </div>
  );
}

export default function SalesPage() {
  const [totalAmount, setTotalAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buyer_name: "",
      contact_no: "",
      sale_date: new Date(),
      location_id: "",
      notes: "",
      items: [
        {
          product_id: "",
          quantity: "",
          price_per_unit: "",
          trade_scheme: "",
          discount_percentage: "",
          discount_amount: "",
        },
      ],
    },
  });

  // Watch form values for calculations
  const formValues = form.watch();

  // Calculate totals when form values change
  useEffect(() => {
    let total = 0;
    let final = 0;

    // Calculate item-level totals
    formValues.items.forEach((item) => {
      if (!item.quantity || !item.price_per_unit) return;

      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.price_per_unit);
      const { totalPrice, finalPrice } = calculateItemFinalPrice(
        qty,
        price,
        item.trade_scheme || "",
        item.discount_percentage || "",
        item.discount_amount || ""
      );
      total += totalPrice;
      final += finalPrice;
    });

    // Apply bill-level discounts
    const billDiscAmt = parseFloat(formValues.bill_discount_amount ?? "0");
    const billDiscPerc = parseFloat(formValues.bill_discount_percentage ?? "0");

    // First apply fixed amount discount
    final = Math.max(0, final - billDiscAmt);

    // Then apply percentage discount
    const billDiscountFromPercentage = final * (billDiscPerc / 100);
    final = Math.max(0, final - billDiscountFromPercentage);

    setTotalAmount(total);
    setFinalAmount(final);
  }, [formValues]);

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch stock by location
  const { data: stockByLocation } = useQuery<StockByLocation>({
    queryKey: ["stockByLocation"],
    queryFn: async () => {
      const { data: transfers, error: transfersError } = await supabase.from(
        "transfers"
      ).select(`
          *,
          product:products(*),
          from_location:locations!from_location_id(*),
          to_location:locations!to_location_id(*)
        `);
      if (transfersError) throw transfersError;

      // Calculate stock per location
      const stockByLocation = locations?.reduce((acc, location) => {
        acc[location.id] =
          products?.map((product: Product) => {
            const incomingTransfers =
              transfers
                ?.filter(
                  (t: Transfer) =>
                    t.to_location_id === location.id &&
                    t.product_id === product.id
                )
                .reduce((sum: number, t: Transfer) => sum + t.quantity, 0) || 0;

            const outgoingTransfers =
              transfers
                ?.filter(
                  (t: Transfer) =>
                    t.from_location_id === location.id &&
                    t.product_id === product.id
                )
                .reduce((sum: number, t: Transfer) => sum + t.quantity, 0) || 0;

            return {
              ...product,
              quantity: incomingTransfers - outgoingTransfers,
            };
          }) || [];
        return acc;
      }, {} as StockByLocation);

      return stockByLocation;
    },
    enabled: !!locations && !!products,
  });

  // Organize products into ready and other
  const readyProducts =
    products?.filter(
      (p) => p.name.includes("Ready") || p.name === "Gift Set"
    ) || [];

  const otherProducts =
    products?.filter(
      (p) => !p.name.includes("Ready") && p.name !== "Gift Set"
    ) || [];

  // Fetch recent sales
  const { data: recentSales, isLoading } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          `
          *,
          product:products!inner(*)
        `
        )
        .order("sale_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const recordSale = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        // Start a Supabase transaction
        const { data: saleData, error: saleError } = await supabase
          .from("sales")
          .insert({
            invoice_number: `INV-${Date.now()}`,
            buyer_name: values.buyer_name,
            contact_no: values.contact_no,
            sale_date: values.sale_date.toISOString().split("T")[0],
            location_id: parseInt(values.location_id),
            bill_discount_percentage: values.bill_discount_percentage
              ? parseFloat(values.bill_discount_percentage)
              : null,
            bill_discount_amount: values.bill_discount_amount
              ? parseFloat(values.bill_discount_amount)
              : null,
            total_amount: totalAmount,
            final_amount: finalAmount,
            notes: values.notes,
          })
          .select()
          .single();

        if (saleError) {
          console.error("Sale recording error:", saleError);
          throw new Error(saleError.message);
        }

        if (!saleData) {
          throw new Error("Failed to create sale record");
        }

        // Record each item
        for (const item of values.items) {
          const product = products?.find(
            (p) => p.id === parseInt(item.product_id)
          );
          if (!product) {
            throw new Error(`Product not found: ${item.product_id}`);
          }

          const requestedQty = parseInt(item.quantity);
          const locationStock = stockByLocation?.[
            parseInt(values.location_id)
          ]?.find((p: Product) => p.id === parseInt(item.product_id));

          if (!locationStock || requestedQty > locationStock.quantity) {
            throw new Error(
              `Insufficient stock for ${
                product.name
              } at selected location. Only ${
                locationStock?.quantity || 0
              } units available.`
            );
          }

          const { totalPrice, finalPrice } = calculateItemFinalPrice(
            requestedQty,
            parseFloat(item.price_per_unit),
            item.trade_scheme,
            item.discount_percentage,
            item.discount_amount
          );

          // Record the sale item
          const { error: itemError } = await supabase
            .from("sale_items")
            .insert({
              sale_id: saleData.id,
              product_id: parseInt(item.product_id),
              quantity: requestedQty,
              price_per_unit: parseFloat(item.price_per_unit),
              trade_scheme: item.trade_scheme || null,
              discount_percentage: item.discount_percentage
                ? parseFloat(item.discount_percentage)
                : null,
              discount_amount: item.discount_amount
                ? parseFloat(item.discount_amount)
                : null,
              total_price: totalPrice,
              final_price: finalPrice,
            });

          if (itemError) {
            console.error("Sale item recording error:", itemError);
            throw new Error(itemError.message);
          }

          // Update product quantity at the specific location
          const { error: updateError } = await supabase.rpc(
            "update_location_quantity",
            {
              p_product_id: parseInt(item.product_id),
              p_location_id: parseInt(values.location_id),
              p_quantity: -requestedQty,
            }
          );

          if (updateError) {
            console.error("Product quantity update error:", updateError);
            throw new Error(updateError.message);
          }
        }

        // Fetch the complete sale with items for receipt
        const { data: completeSale, error: fetchError } = await supabase
          .from("sales")
          .select(
            `
            *,
            items:sale_items(
              *,
              product:products(*)
            )
          `
          )
          .eq("id", saleData.id)
          .single();

        if (fetchError) {
          console.error("Error fetching complete sale:", fetchError);
          throw new Error(fetchError.message);
        }

        return completeSale;
      } catch (error) {
        console.error("Transaction error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({
        title: "Sale Recorded",
        description: `Invoice #${data.invoice_number} has been created.`,
      });
      printReceipt(data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSale = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("reverse_sale", {
        sale_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Sale Reversed",
        description: "The sale record has been successfully reversed.",
      });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to reverse sale. Please try again.",
        variant: "destructive",
      });
      console.error("Sale deletion error:", error);
    },
  });

  function printReceipt(saleData: Sale) {
    const receiptContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
          <div>
            <h1 style="color: #2E7D32; font-size: 32px; margin: 0;">NIKKA NIKKI</h1>
            <p style="color: #666; margin: 5px 0;">Natural Handmade Products</p>
            <p style="color: #666; margin: 5px 0;">Lahore, Pakistan</p>
            <p style="color: #666; margin: 5px 0;">+92 300 1234567</p>
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
            <tr style="background-color: #2E7D32; color: white;">
              <th style="padding: 12px; text-align: left;">#</th>
              <th style="padding: 12px; text-align: left;">Item & Description</th>
              <th style="padding: 12px; text-align: right;">Qty</th>
              <th style="padding: 12px; text-align: right;">Rate</th>
              <th style="padding: 12px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${saleData.items
              .map(
                (item, index) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${index + 1}</td>
                <td style="padding: 12px;">${item.product.name}</td>
                <td style="padding: 12px; text-align: right;">${
                  item.quantity
                }</td>
                <td style="padding: 12px; text-align: right;">$${item.price_per_unit.toFixed(
                  2
                )}</td>
                <td style="padding: 12px; text-align: right;">$${item.total_price.toFixed(
                  2
                )}</td>
              </tr>
              ${
                item.trade_scheme
                  ? `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;"></td>
                <td style="padding: 12px; color: #666;" colspan="4">
                  Trade Scheme (${item.trade_scheme}): -$${(
                      calculateTradeSchemeDiscount(
                        item.quantity,
                        item.trade_scheme
                      ) * item.price_per_unit
                    ).toFixed(2)}
                </td>
              </tr>
              `
                  : ""
              }
              ${
                item.discount_amount
                  ? `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;"></td>
                <td style="padding: 12px; color: #666;" colspan="4">
                  Discount Amount: -$${item.discount_amount.toFixed(2)}
                </td>
              </tr>
              `
                  : ""
              }
              ${
                item.discount_percentage
                  ? `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;"></td>
                <td style="padding: 12px; color: #666;" colspan="4">
                  Discount (${item.discount_percentage}%): -$${(
                      item.total_price -
                      item.final_price -
                      (item.discount_amount || 0)
                    ).toFixed(2)}
                </td>
              </tr>
              `
                  : ""
              }
            `
              )
              .join("")}
          </tbody>
        </table>

        <!-- Summary -->
        <div style="margin-left: auto; width: 300px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
            <span>Subtotal:</span>
            <span>$${saleData.total_amount.toFixed(2)}</span>
          </div>
          ${
            saleData.bill_discount_amount
              ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
            <span>Bill Discount Amount:</span>
            <span>-$${saleData.bill_discount_amount.toFixed(2)}</span>
          </div>
          `
              : ""
          }
          ${
            saleData.bill_discount_percentage
              ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
            <span>Bill Discount (${saleData.bill_discount_percentage}%):</span>
            <span>-$${(
              (parseFloat(formValues.bill_discount_percentage ?? "0") / 100) *
              (totalAmount - parseFloat(formValues.bill_discount_amount ?? "0"))
            ).toFixed(2)}</span>
          </div>
          `
              : ""
          }
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #2E7D32; margin-top: 8px;">
            <span style="font-weight: bold; color: #333;">Total Due:</span>
            <span style="font-weight: bold; color: #2E7D32;">$${saleData.final_amount.toFixed(
              2
            )}</span>
          </div>
        </div>

        <!-- Notes -->
        ${
          saleData.notes
            ? `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
          <h4 style="color: #333; margin: 0 0 10px 0;">Notes:</h4>
          <p style="color: #666; margin: 0;">${saleData.notes}</p>
        </div>
        `
            : ""
        }

        <!-- Footer -->
        <div style="margin-top: 40px; text-align: center; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="margin: 0;">Thank you for your business!</p>
          <p style="margin: 5px 0;">For any queries, please contact us at info@nikkanikki.com</p>
        </div>
      </div>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice #${saleData.invoice_number}</title>
          </head>
          <body>
            ${receiptContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  // Add reset handler
  const handleReset = () => {
    form.reset({
      buyer_name: "",
      contact_no: "",
      sale_date: new Date(),
      location_id: "",
      notes: "",
      bill_discount_percentage: "",
      bill_discount_amount: "",
      items: [
        {
          product_id: "",
          quantity: "",
          price_per_unit: "",
          trade_scheme: "",
          discount_percentage: "",
          discount_amount: "",
        },
      ],
    });
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordSale.mutate(values);
  }

  if (isLoading || productsLoading || locationsLoading) {
    return <SalesSkeleton />;
  }

  return (
    <div className="container mx-auto py-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((location) => (
                          <SelectItem
                            key={location.id}
                            value={location.id.toString()}
                          >
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="buyer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter buyer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sale_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Sale Date</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={
                          field.value
                            ? field.value.toISOString().split("T")[0]
                            : ""
                        }
                        onChange={(e) => {
                          const date = e.target.value
                            ? new Date(e.target.value)
                            : new Date();
                          field.onChange(date);
                        }}
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[280px]",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {formValues.items.map((_, index) => (
                    <div key={index} className="space-y-4 mb-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">
                          Item {index + 1}
                        </h4>
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const currentItems = form.getValues("items");
                              form.setValue(
                                "items",
                                currentItems.filter((_, i) => i !== index)
                              );
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name={`items.${index}.product_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products?.map((product) => (
                                  <SelectItem
                                    key={product.id}
                                    value={product.id.toString()}
                                  >
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {field.value && (
                              <div className="mt-2 grid grid-cols-4 gap-2">
                                {locations?.map((location) => {
                                  const stock = stockByLocation?.[
                                    location.id
                                  ]?.find(
                                    (p) => p.id === parseInt(field.value)
                                  );
                                  return (
                                    <div
                                      key={location.id}
                                      className={cn(
                                        "flex flex-col items-center p-2 rounded-lg border text-sm",
                                        location.id.toString() ===
                                          form.getValues("location_id")
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-background"
                                      )}
                                    >
                                      <span className="font-medium">
                                        {location.name}
                                      </span>
                                      <span>{stock?.quantity || 0}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Enter quantity"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.price_per_unit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price per Unit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Enter price"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 mr-1" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-1" />
                          )}
                          Discounts
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 mt-4">
                          <FormField
                            control={form.control}
                            name={`items.${index}.trade_scheme`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    placeholder="Trade Scheme (e.g., 12+2)"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Enter in format: buy+free (e.g., 12+2)
                                </FormDescription>
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`items.${index}.discount_percentage`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="Discount %"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`items.${index}.discount_amount`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="Discount $"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const currentItems = form.getValues("items");
                      form.setValue("items", [
                        ...currentItems,
                        {
                          product_id: "",
                          quantity: "",
                          price_per_unit: "",
                          trade_scheme: "",
                          discount_percentage: "",
                          discount_amount: "",
                        },
                      ]);
                    }}
                  >
                    Add Item
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bill Discounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bill_discount_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bill Discount %</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Discount %"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bill_discount_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bill Discount $</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Discount $"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${totalAmount.toFixed(2)}</span>
                    </div>
                    {formValues.bill_discount_amount &&
                      parseFloat(formValues.bill_discount_amount) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Bill Discount Amount:</span>
                          <span>
                            -$
                            {parseFloat(
                              formValues.bill_discount_amount
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    {formValues.bill_discount_percentage &&
                      parseFloat(formValues.bill_discount_percentage) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            Bill Discount ({formValues.bill_discount_percentage}
                            %):
                          </span>
                          <span>
                            -$
                            {(
                              (parseFloat(
                                formValues.bill_discount_percentage ?? "0"
                              ) /
                                100) *
                              (totalAmount -
                                parseFloat(
                                  formValues.bill_discount_amount ?? "0"
                                ))
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Total:</span>
                      <span>${finalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Input placeholder="Add any notes here" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={recordSale.isPending}
            >
              {recordSale.isPending ? "Recording..." : "Record Sale"}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset Form
            </Button>
          </div>
        </form>
      </Form>

      {/* Recent Sales with Receipts */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Recent Sales</h2>
        <div className="space-y-4">
          {recentSales?.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Badge className="bg-green-500">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Sale
                  </Badge>
                  <div>
                    <p className="font-medium">
                      Invoice #{sale.invoice_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(sale.sale_date), "PPP")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sale.buyer_name}
                      {sale.contact_no && ` • ${sale.contact_no}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">
                      ${sale.final_amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sale.items.length} items
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => printReceipt(sale)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <DeleteButton
                      onDelete={() => deleteSale.mutate(sale.id)}
                      loading={deleteSale.isPending}
                      title="Reverse Sale"
                      description="This will reverse the sale and restore the product quantities. This action cannot be undone."
                    />
                  </div>
                </div>
              </CardContent>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex justify-between items-center p-4 hover:bg-secondary/10"
                  >
                    View Items
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <div className="space-y-2">
                      {sale.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center py-2 border-t first:border-t-0"
                        >
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} × $
                              {item.price_per_unit.toFixed(2)}
                            </p>
                            {item.trade_scheme && (
                              <p className="text-sm text-muted-foreground">
                                Trade Scheme: {item.trade_scheme}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              ${item.final_price.toFixed(2)}
                            </p>
                            {(item.discount_percentage ||
                              item.discount_amount) && (
                              <p className="text-sm text-muted-foreground">
                                {item.discount_percentage &&
                                  `${item.discount_percentage}% `}
                                {item.discount_amount &&
                                  `$${item.discount_amount} `}
                                off
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(sale.bill_discount_percentage ||
                      sale.bill_discount_amount) && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Subtotal:</span>
                          <span>${sale.total_amount.toFixed(2)}</span>
                        </div>
                        {sale.bill_discount_amount && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Bill Discount:</span>
                            <span>
                              -${sale.bill_discount_amount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {sale.bill_discount_percentage && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>
                              Bill Discount ({sale.bill_discount_percentage}%):
                            </span>
                            <span>
                              -$
                              {(
                                (sale.bill_discount_percentage / 100) *
                                (sale.total_amount -
                                  (sale.bill_discount_amount || 0))
                              ).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium mt-2">
                          <span>Total:</span>
                          <span>${sale.final_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {sale.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Note: {sale.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
