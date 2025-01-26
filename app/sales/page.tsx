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
  X,
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
  SelectGroup,
  SelectLabel,
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
import { Checkbox } from "@/components/ui/checkbox";

interface Product {
  id: number;
  name: string;
  quantity: number;
}

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
  product: Product;
  location: Location;
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
  product?: Product;
  quantity?: number;
  price?: number;
  credit_sale: boolean;
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

// Add customer interface
interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  total_sales: number;
  total_payments: number;
  current_balance: number;
}

// Schema for individual sale item
const saleItemSchema = z.object({
  product_id: z.string({
    required_error: "Please select a product.",
  }),
  location_id: z.string({
    required_error: "Please select location.",
  }),
  quantity: z.string().min(1, "Quantity is required"),
  price_per_unit: z.string().min(1, "Price per unit is required"),
  trade_scheme: z.string().optional(),
  discount_percentage: z.string().optional(),
  discount_amount: z.string().optional(),
});

// Main form schema
const formSchema = z.object({
  customer_id: z.string({
    required_error: "Please select a customer.",
  }),
  buyer_name: z.string(),
  contact_no: z.string().optional(),
  sale_date: z.date(),
  notes: z.string().optional(),
  bill_discount_percentage: z.string().optional(),
  bill_discount_amount: z.string().optional(),
  print_receipt: z.boolean().default(false),
  credit_sale: z.boolean().default(false),
  payment_received: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string(),
      location_id: z.string(),
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
  // Ensure we have valid numbers
  quantity = quantity || 0;
  pricePerUnit = pricePerUnit || 0;

  // Calculate initial total
  const total = quantity * pricePerUnit;

  // Apply trade scheme discount
  const freeItems = calculateTradeSchemeDiscount(quantity, tradeScheme || "");
  const priceAfterTradeScheme = total - freeItems * pricePerUnit;

  // Apply fixed amount discount
  const discAmt = parseFloat(discountAmount || "0") || 0;
  const priceAfterAmountDiscount = Math.max(0, priceAfterTradeScheme - discAmt);

  // Apply percentage discount
  const discPerc = parseFloat(discountPercentage || "0") || 0;
  const discountFromPercentage = priceAfterAmountDiscount * (discPerc / 100);
  const finalPrice = Math.max(
    0,
    priceAfterAmountDiscount - discountFromPercentage
  );

  return {
    totalPrice: total || 0,
    finalPrice: finalPrice || 0,
  };
}

// Add this helper function near the top of the file
function calculateLiveItemPrice(
  quantity: string,
  pricePerUnit: string,
  tradeScheme?: string,
  discountPercentage?: string,
  discountAmount?: string
) {
  if (!quantity || !pricePerUnit)
    return { perPiece: 0, total: 0, finalTotal: 0 };

  const qty = parseFloat(quantity);
  const price = parseFloat(pricePerUnit);
  const total = qty * price;

  // Calculate trade scheme discount
  const tradeSchemeDiscount = tradeScheme
    ? calculateTradeSchemeDiscount(qty, tradeScheme) * price
    : 0;
  const afterTradeScheme = total - tradeSchemeDiscount;

  // Apply fixed discount
  const fixedDiscount = parseFloat(discountAmount || "0");
  const afterFixedDiscount = Math.max(0, afterTradeScheme - fixedDiscount);

  // Apply percentage discount
  const percentageDiscount = parseFloat(discountPercentage || "0");
  const finalTotal = Math.max(
    0,
    afterFixedDiscount * (1 - percentageDiscount / 100)
  );

  return {
    perPiece: finalTotal / qty,
    total,
    finalTotal,
  };
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Add customer query
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      buyer_name: "",
      contact_no: "",
      sale_date: new Date(),
      notes: "",
      print_receipt: false,
      credit_sale: false,
      payment_received: "",
      items: [
        {
          product_id: "",
          location_id: "",
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

      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price_per_unit) || 0;
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
    const billDiscAmt = parseFloat(formValues.bill_discount_amount || "0") || 0;
    const billDiscPerc =
      parseFloat(formValues.bill_discount_percentage || "0") || 0;

    // First apply fixed amount discount
    final = Math.max(0, final - billDiscAmt);

    // Then apply percentage discount
    const billDiscountFromPercentage = final * (billDiscPerc / 100);
    final = Math.max(0, final - billDiscountFromPercentage);

    setTotalAmount(total || 0);
    setFinalAmount(final || 0);
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
    queryKey: ["locationProducts"],
    queryFn: async () => {
      const { data: locationProducts, error } = await supabase.from(
        "location_products"
      ).select(`
          location_id,
          product_id,
          quantity,
          products (*)
        `);
      if (error) throw error;

      // Transform into the expected format with null checks
      const stockByLocation = locations?.reduce((acc, location) => {
        acc[location.id] =
          products?.map((product) => {
            const locationProduct = locationProducts?.find(
              (lp) =>
                lp?.location_id === location.id && lp?.product_id === product.id
            );
            return {
              ...product,
              quantity: locationProduct?.quantity || 0,
            };
          }) || [];
        return acc;
      }, {} as StockByLocation);

      return stockByLocation || {};
    },
    enabled: !!locations && !!products,
  });

  // Organize products into ready and other with null checks
  const readyProducts =
    products?.filter(
      (p) => p?.name?.includes("Ready") || p?.name === "Gift Set"
    ) || [];

  const otherProducts =
    products?.filter(
      (p) => !p?.name?.includes("Ready") && p?.name !== "Gift Set"
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
          items:sale_items(
            *,
            product:products(*),
            location:locations(*)
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const recordSale = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        let customerId = values.customer_id;

        // If no customer is selected but we have a buyer name, create a new customer
        if (!customerId && values.buyer_name) {
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: values.buyer_name,
              phone: values.contact_no || null,
              total_sales: 0,
              total_payments: 0,
              current_balance: 0,
            })
            .select()
            .single();

          if (customerError) throw customerError;
          customerId = newCustomer.id.toString();
        }

        // Start a Supabase transaction
        const { data: saleData, error: saleError } = await supabase
          .from("sales")
          .insert({
            invoice_number: `INV-${Date.now()}`,
            customer_id: customerId ? parseInt(customerId) : null,
            buyer_name: values.buyer_name,
            contact_no: values.contact_no,
            sale_date: values.sale_date.toISOString().split("T")[0],
            bill_discount_percentage: values.bill_discount_percentage
              ? parseFloat(values.bill_discount_percentage)
              : null,
            bill_discount_amount: values.bill_discount_amount
              ? parseFloat(values.bill_discount_amount)
              : null,
            total_amount: totalAmount,
            final_amount: finalAmount,
            payment_received: values.payment_received
              ? parseFloat(values.payment_received)
              : 0,
            notes: values.notes,
            credit_sale: values.credit_sale,
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
            parseInt(item.location_id)
          ]?.find((p: Product) => p.id === parseInt(item.product_id));

          if (!locationStock || requestedQty > locationStock.quantity) {
            throw new Error(
              `Insufficient stock for ${product.name} at ${
                locations?.find((l) => l.id === parseInt(item.location_id))
                  ?.name
              }. Only ${locationStock?.quantity || 0} units available.`
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
              location_id: parseInt(item.location_id),
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

          // Update product quantity at the specific location using the new function
          const { error: updateError } = await supabase.rpc(
            "update_location_quantity",
            {
              p_product_id: parseInt(item.product_id),
              p_location_id: parseInt(item.location_id),
              p_quantity: -requestedQty, // Negative quantity for sales
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
              product:products(*),
              location:locations(*)
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
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["locationProducts"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Sale recorded successfully",
        description: `Invoice number: ${data.invoice_number}`,
      });
      if (formValues.print_receipt) {
        printReceipt(data);
      }
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error recording sale",
        description: error.message,
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
              .map((item) => {
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

                // Calculate percentage discount per piece (applied on price after trade scheme)
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
                  ? `${item.quantity} Ctn`
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
  }

  // Add reset handler
  const handleReset = () => {
    form.reset({
      customer_id: "",
      buyer_name: "",
      contact_no: "",
      sale_date: new Date(),
      notes: "",
      print_receipt: false,
      credit_sale: false,
      payment_received: "",
      items: [
        {
          product_id: "",
          location_id: "",
          quantity: "",
          price_per_unit: "",
          trade_scheme: "",
          discount_percentage: "",
          discount_amount: "",
        },
      ],
    });
  };

  // Add these functions near the top of the component
  const loadSaleToForm = (sale: Sale, isEdit: boolean = false) => {
    if (!sale || !sale.items) return;

    form.reset({
      customer_id: sale.customer_id?.toString() || "",
      buyer_name: sale.buyer_name,
      contact_no: sale.contact_no || "",
      sale_date: new Date(sale.sale_date),
      notes: sale.notes || "",
      print_receipt: false,
      credit_sale: sale.credit_sale,
      payment_received: sale.payment_received?.toString() || "0",
      bill_discount_percentage: sale.bill_discount_percentage?.toString() || "",
      bill_discount_amount: sale.bill_discount_amount?.toString() || "",
      items: sale.items.map((item) => ({
        product_id: item.product_id.toString(),
        location_id: item.location_id.toString(),
        quantity: item.quantity.toString(),
        price_per_unit: item.price_per_unit.toString(),
        trade_scheme: item.trade_scheme || "",
        discount_percentage: item.discount_percentage?.toString() || "",
        discount_amount: item.discount_amount?.toString() || "",
      })),
    });

    // Scroll to the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateSale = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        // First delete the old sale
        const { error: deleteError } = await supabase.rpc("reverse_sale", {
          sale_id: editingSaleId,
        });

        if (deleteError) throw deleteError;

        // Then create a new sale with the same invoice number
        const { data: saleData, error: saleError } = await supabase
          .from("sales")
          .insert({
            invoice_number: editingInvoiceNumber, // Use the original invoice number
            customer_id: parseInt(values.customer_id),
            buyer_name: values.buyer_name,
            contact_no: values.contact_no,
            sale_date: values.sale_date.toISOString().split("T")[0],
            bill_discount_percentage: values.bill_discount_percentage
              ? parseFloat(values.bill_discount_percentage)
              : null,
            bill_discount_amount: values.bill_discount_amount
              ? parseFloat(values.bill_discount_amount)
              : null,
            total_amount: totalAmount,
            final_amount: finalAmount,
            payment_received: values.payment_received
              ? parseFloat(values.payment_received)
              : 0,
            notes: values.notes,
            credit_sale: values.credit_sale,
          })
          .select()
          .single();

        if (saleError) throw saleError;

        // Record the updated items
        for (const item of values.items) {
          const { totalPrice, finalPrice } = calculateItemFinalPrice(
            parseInt(item.quantity),
            parseFloat(item.price_per_unit),
            item.trade_scheme,
            item.discount_percentage,
            item.discount_amount
          );

          const { error: itemError } = await supabase
            .from("sale_items")
            .insert({
              sale_id: saleData.id,
              product_id: parseInt(item.product_id),
              location_id: parseInt(item.location_id),
              quantity: parseInt(item.quantity),
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

          if (itemError) throw itemError;

          // Update product quantity
          const { error: updateError } = await supabase.rpc(
            "update_location_quantity",
            {
              p_product_id: parseInt(item.product_id),
              p_location_id: parseInt(item.location_id),
              p_quantity: -parseInt(item.quantity),
            }
          );

          if (updateError) throw updateError;
        }

        return saleData;
      } catch (error) {
        console.error("Update error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["locationProducts"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({
        title: "Sale updated successfully",
        description: `Invoice number: ${data.invoice_number}`,
      });
      setEditingSaleId(null);
      setEditingInvoiceNumber(null);
      if (formValues.print_receipt) {
        printReceipt(data);
      }
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error updating sale",
        description: error.message,
      });
    },
  });

  // Add state for editing
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState<
    string | null
  >(null);

  // Add customer selection handler
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers?.find((c) => c.id.toString() === customerId);
    if (customer) {
      form.setValue("customer_id", customerId);
      form.setValue("buyer_name", customer.name);
      form.setValue("contact_no", customer.phone || "");
    }
  };

  // Update the submit handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    if (editingSaleId) {
      updateSale.mutate(values);
    } else {
      recordSale.mutate(values);
    }
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
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        handleCustomerSelect(value);
                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem
                            key={customer.id}
                            value={customer.id.toString()}
                          >
                            <div className="flex justify-between items-center gap-4">
                              <span>{customer.name}</span>
                              <span className="text-muted-foreground">
                                Balance: ${customer.current_balance.toFixed(2)}
                              </span>
                            </div>
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

              <FormField
                control={form.control}
                name="payment_received"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Received</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter payment amount"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty for full credit sale
                    </FormDescription>
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
                  {form.getValues("items").map((_, index) => (
                    <div
                      key={index}
                      className="space-y-4 p-4 border rounded-lg relative"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2"
                        onClick={() => {
                          const currentItems = form.getValues("items");
                          form.setValue(
                            "items",
                            currentItems.filter((_, i) => i !== index)
                          );
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>

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
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Ready Products</SelectLabel>
                                  {readyProducts.map((product) => (
                                    <SelectItem
                                      key={product.id}
                                      value={product.id.toString()}
                                    >
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>Other Products</SelectLabel>
                                  {otherProducts.map((product) => (
                                    <SelectItem
                                      key={product.id}
                                      value={product.id.toString()}
                                    >
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Show stock availability across locations when product is selected */}
                      {form.watch(`items.${index}.product_id`) && (
                        <div className="mt-2 space-y-2">
                          <FormLabel>
                            Select Location (Click on available stock)
                          </FormLabel>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {locations?.map((location) => {
                              const locationStock =
                                stockByLocation?.[location.id] || [];
                              const stockAtLocation = Array.isArray(
                                locationStock
                              )
                                ? locationStock.find(
                                    (p) =>
                                      p?.id ===
                                      parseInt(
                                        form.watch(`items.${index}.product_id`)
                                      )
                                  )
                                : undefined;
                              const isSelected =
                                form.watch(`items.${index}.location_id`) ===
                                location.id.toString();

                              return (
                                <Button
                                  key={location.id}
                                  type="button"
                                  variant={isSelected ? "default" : "outline"}
                                  className={cn(
                                    "w-full justify-between",
                                    !stockAtLocation?.quantity && "opacity-50",
                                    isSelected && "ring-2 ring-primary"
                                  )}
                                  onClick={() => {
                                    if (stockAtLocation?.quantity) {
                                      form.setValue(
                                        `items.${index}.location_id`,
                                        location.id.toString()
                                      );
                                    }
                                  }}
                                  disabled={!stockAtLocation?.quantity}
                                >
                                  <span>{location.name}</span>
                                  <Badge
                                    variant={
                                      isSelected ? "secondary" : "outline"
                                    }
                                  >
                                    {
                                      formatGiftSetQuantity(
                                        stockAtLocation?.quantity || 0,
                                        products?.find(
                                          (p) =>
                                            p.id ===
                                            parseInt(
                                              form.watch(
                                                `items.${index}.product_id`
                                              )
                                            )
                                        )?.name || ""
                                      ).display
                                    }
                                  </Badge>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
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
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.trade_scheme`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Trade Scheme</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g. 10+1" />
                              </FormControl>
                              <FormDescription>
                                Format: buy+free (e.g. 10+1)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.discount_percentage`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount %</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.discount_amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Amount</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Live Price Calculations */}
                      {(() => {
                        const item = form.watch(`items.${index}`);
                        const { perPiece, total, finalTotal } =
                          calculateLiveItemPrice(
                            item.quantity,
                            item.price_per_unit,
                            item.trade_scheme,
                            item.discount_percentage,
                            item.discount_amount
                          );

                        if (!item.quantity || !item.price_per_unit) return null;

                        return (
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Original Total:
                              </span>
                              <span>${total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Final Total:
                              </span>
                              <span>${finalTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span>Final Rate Per Piece:</span>
                              <span>${perPiece.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}
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
                          location_id: "",
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

          <FormField
            control={form.control}
            name="print_receipt"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Print Receipt</FormLabel>
                  <FormDescription>
                    Automatically print receipt after recording sale
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="credit_sale"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Credit Sale</FormLabel>
                  <FormDescription>
                    Check if this is a credit sale
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={recordSale.isPending || updateSale.isPending}
            >
              {editingSaleId
                ? updateSale.isPending
                  ? "Updating..."
                  : "Update Sale"
                : recordSale.isPending
                ? "Recording..."
                : "Record Sale"}
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSaleId(sale.id);
                      setEditingInvoiceNumber(sale.invoice_number);
                      loadSaleToForm(sale, true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadSaleToForm(sale, false);
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
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
                      {sale.items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center py-2 border-t first:border-t-0"
                        >
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} × $
                              {item.price_per_unit?.toFixed(2)}
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

          {/* Pagination */}
          {recentSales && recentSales.length > ITEMS_PER_PAGE && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of{" "}
                  {Math.ceil(recentSales.length / ITEMS_PER_PAGE)}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={
                  currentPage >= Math.ceil(recentSales.length / ITEMS_PER_PAGE)
                }
              >
                Next
              </Button>
            </div>
          )}

          {/* Empty state */}
          {recentSales?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No sales records found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
