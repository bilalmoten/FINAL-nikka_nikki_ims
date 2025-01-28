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
  Pencil,
  Copy,
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
import { findPriceRule } from "@/lib/product-presets";

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
  created_at?: string;
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
const formSchema = z
  .object({
    customer_id: z.string({
      required_error: "Please select a customer.",
    }),
    buyer_name: z.string().min(1, "Buyer name is required"),
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
  })
  .refine(
    (data) => {
      // If credit_sale is true, payment_received must be 0 or empty
      if (data.credit_sale) {
        return (
          !data.payment_received || parseFloat(data.payment_received) === 0
        );
      }
      return true;
    },
    {
      message: "Credit sales cannot have payment received",
      path: ["payment_received"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

interface UpdateSaleParams {
  id: number;
  data: FormValues;
}

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
  const [isOpen, setIsOpen] = useState(true);
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

  // Add handlePriceCalculation function
  const handlePriceCalculation = (price: string, quantity: string) => {
    if (!price || !quantity) return;

    const numericPrice = parseFloat(price);
    const numericQuantity = parseInt(quantity);

    if (isNaN(numericPrice) || isNaN(numericQuantity)) return;

    // Calculate totals
    const total = numericPrice * numericQuantity;
    setTotalAmount(total);
    setFinalAmount(total);

    // Update form calculations
    form.trigger("items");
  };

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
        .order("sale_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const recordSale = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        let customerId = values.customer_id;

        // If no customer is selected but we have a buyer name
        if (!customerId && values.buyer_name) {
          // First check if a customer with this name already exists
          const existingCustomer = customers?.find(
            (c) =>
              c.name.toLowerCase().trim() ===
              values.buyer_name.toLowerCase().trim()
          );

          if (existingCustomer) {
            // Use existing customer
            customerId = existingCustomer.id.toString();
          } else {
            // Create new customer only if no match found
            const { data: newCustomer, error: customerError } = await supabase
              .from("customers")
              .insert({
                name: values.buyer_name.trim(),
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
        sale_id: id, // Use the exact parameter name from SQL function
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
    // Find customer's current balance
    const customer = customers?.find((c) => c.id === saleData.customer_id);

    // If this is a reprint (i.e., sale already exists in customer's balance)
    // we need to subtract this sale's amount from the current balance to show the correct previous balance
    const isReprint =
      saleData.created_at &&
      new Date(saleData.created_at).getTime() < Date.now() - 1000; // More than 1 second old
    const previousBalance = customer?.current_balance
      ? isReprint
        ? customer.current_balance -
          (saleData.credit_sale ? saleData.final_amount : 0)
        : customer.current_balance
      : 0;

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
                <td style="padding: 8px; text-align: right;">${previousBalance.toFixed(
                  2
                )}</td>
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
                  previousBalance + saleData.final_amount
                ).toFixed(2)}</td>
              </tr>
              `
                  : `
              <tr>
                <td style="padding: 8px;">Cash Balance Rs.:</td>
                <td style="padding: 8px; text-align: right;">${previousBalance.toFixed(
                  2
                )}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">Total Receivable Rs.:</td>
                <td style="padding: 8px; text-align: right;">${previousBalance.toFixed(
                  2
                )}</td>
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
    mutationFn: async ({ id, data }: UpdateSaleParams) => {
      // First update the sale
      const { error: saleError } = await supabase
        .from("sales")
        .update({
          customer_id: data.customer_id ? parseInt(data.customer_id) : null,
          buyer_name: data.buyer_name,
          contact_no: data.contact_no,
          sale_date: data.sale_date.toISOString(),
          notes: data.notes,
          bill_discount_percentage: data.bill_discount_percentage
            ? parseFloat(data.bill_discount_percentage)
            : null,
          bill_discount_amount: data.bill_discount_amount
            ? parseFloat(data.bill_discount_amount)
            : null,
          credit_sale: data.credit_sale,
          payment_received: data.payment_received
            ? parseFloat(data.payment_received)
            : 0,
        })
        .eq("id", id);

      if (saleError) throw saleError;

      // Then update each sale item
      for (const item of data.items) {
        const { error: itemError } = await supabase
          .from("sale_items")
          .update({
            product_id: parseInt(item.product_id),
            location_id: parseInt(item.location_id),
            quantity: parseInt(item.quantity),
            price_per_unit: parseFloat(item.price_per_unit),
            trade_scheme: item.trade_scheme,
            discount_percentage: item.discount_percentage
              ? parseFloat(item.discount_percentage)
              : null,
            discount_amount: item.discount_amount
              ? parseFloat(item.discount_amount)
              : null,
          })
          .eq("sale_id", id)
          .eq("product_id", parseInt(item.product_id));

        if (itemError) throw itemError;
      }

      // Fetch and return the updated sale
      const { data: updatedSale, error: fetchError } = await supabase
        .from("sales")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      return updatedSale;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["locationProducts"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({
        title: "Sale updated successfully",
        description: `Invoice number: ${data.invoice_number}`,
      });
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

  // Add validation for credit sale payment
  const handleSubmit = async (formValues: FormValues) => {
    // Validate buyer name
    if (!formValues.buyer_name?.trim()) {
      toast({
        title: "Error",
        description: "Buyer name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate credit sale payment
    if (
      formValues.credit_sale &&
      parseFloat(formValues.payment_received || "0") > 0
    ) {
      toast({
        title: "Error",
        description: "Credit sales cannot have payment received",
        variant: "destructive",
      });
      return;
    }

    // If it's a credit sale, ensure payment_received is 0
    if (formValues.credit_sale) {
      formValues.payment_received = "0";
    }

    if (editingSaleId) {
      updateSale.mutate({
        id: editingSaleId,
        data: formValues,
      });
    } else {
      recordSale.mutate(formValues);
    }
  };

  if (isLoading || productsLoading || locationsLoading) {
    return <SalesSkeleton />;
  }

  return (
    <div className="container mx-auto py-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
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

              {/* Add Excel Paste Area */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium">
                      Quick Excel Paste
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(!isOpen)}
                      className="h-8"
                    >
                      {isOpen ? "Hide" : "Show"}
                    </Button>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent>
                    <div className="space-y-4">
                      <FormItem>
                        <FormLabel>Paste Excel Data</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full min-h-[100px] p-2 border rounded-md font-mono text-sm"
                            placeholder="Paste your Excel data here..."
                            onChange={(e) => {
                              const data = e.target.value;
                              try {
                                // Split into rows and clean empty rows
                                const rows = data
                                  .trim()
                                  .split("\n")
                                  .map((row) =>
                                    row.split("\t").map((cell) => cell.trim())
                                  )
                                  .filter((row) =>
                                    row.some((cell) => cell !== "")
                                  );

                                if (rows.length === 0) return;

                                // Parse first row (header row)
                                const firstRow = rows[0];
                                const serialNo = firstRow[0] || ""; // S.No for notes
                                const date = firstRow[1] || "";
                                const buyerName = firstRow[2] || "";

                                // Initialize items array for all products
                                const saleItems: Array<{
                                  product_id: string;
                                  location_id: string;
                                  quantity: string;
                                  price_per_unit: string;
                                  trade_scheme: string;
                                  discount_percentage: string;
                                  discount_amount: string;
                                }> = [];

                                // Process all rows for products (including first row and subsequent rows)
                                for (let i = 0; i < rows.length - 1; i++) {
                                  // -1 to exclude the last total row
                                  const row = rows[i];
                                  const productName = row[3] || ""; // Product name is in column 4
                                  const quantity = row[4] || ""; // Quantity is in column 5
                                  const price = row[5] || ""; // Price is in column 6

                                  // Only add if we have a product
                                  if (
                                    productName &&
                                    quantity &&
                                    price &&
                                    !productName.toLowerCase().includes("total")
                                  ) {
                                    // Find product ID based on name
                                    let matchedProduct = null;
                                    if (productName) {
                                      console.log(
                                        "Trying to match product:",
                                        productName
                                      );
                                      console.log(
                                        "Available products:",
                                        products?.map((p) => ({
                                          id: p.id,
                                          name: p.name,
                                        }))
                                      );

                                      // Special handling for Gift Set
                                      if (
                                        productName
                                          .toLowerCase()
                                          .includes("gift set")
                                      ) {
                                        matchedProduct = products?.find((p) =>
                                          p.name
                                            .toLowerCase()
                                            .includes("gift set")
                                        );

                                        // Apply product presets if found
                                        if (matchedProduct) {
                                          const priceRule = findPriceRule(
                                            "Nikka Nikki Gift Set 4 Pcs",
                                            parseFloat(price)
                                          );

                                          if (priceRule) {
                                            saleItems.push({
                                              product_id:
                                                matchedProduct.id.toString(),
                                              location_id: "1", // Default location
                                              quantity: quantity,
                                              price_per_unit:
                                                priceRule.basePrice.toString(),
                                              trade_scheme:
                                                priceRule.tradeScheme,
                                              discount_percentage:
                                                priceRule.discountPercentage.toString(),
                                              discount_amount: "",
                                            });
                                            continue;
                                          }
                                        }
                                      } else {
                                        // Try exact match first
                                        matchedProduct = products?.find(
                                          (p) => p.name === productName
                                        );
                                        console.log(
                                          "Exact match attempt:",
                                          matchedProduct
                                        );

                                        // If no exact match, try case-insensitive match
                                        if (!matchedProduct) {
                                          matchedProduct = products?.find(
                                            (p) =>
                                              p.name.toLowerCase() ===
                                              productName.toLowerCase()
                                          );
                                          console.log(
                                            "Case-insensitive match attempt:",
                                            matchedProduct
                                          );
                                        }

                                        // If still no match, try includes
                                        if (!matchedProduct) {
                                          matchedProduct = products?.find(
                                            (p) =>
                                              p.name
                                                .toLowerCase()
                                                .includes(
                                                  productName.toLowerCase()
                                                ) ||
                                              productName
                                                .toLowerCase()
                                                .includes(p.name.toLowerCase())
                                          );
                                          console.log(
                                            "Includes match attempt:",
                                            matchedProduct
                                          );
                                        }
                                      }

                                      if (matchedProduct) {
                                        console.log(
                                          "Found matching product:",
                                          matchedProduct
                                        );
                                        const saleItem = {
                                          product_id:
                                            matchedProduct.id.toString(),
                                          location_id: "1", // Default location
                                          quantity: quantity,
                                          price_per_unit: price,
                                          trade_scheme: "",
                                          discount_percentage: "",
                                          discount_amount: "",
                                        };

                                        saleItems.push(saleItem);
                                        console.log(
                                          "Added sale item:",
                                          saleItem
                                        );
                                      } else {
                                        console.warn(
                                          `No match found for product: "${productName}"`
                                        );
                                      }
                                    }
                                  }
                                }

                                // Process last row for bill details
                                const lastRow = rows[rows.length - 1];
                                const billDiscountAmount = lastRow[7] || "0"; // Column 8
                                const paymentReceived = lastRow[8] || "0"; // Column 9
                                const isCredit =
                                  parseFloat(paymentReceived) === 0;

                                // Update form with all gathered data
                                if (buyerName) {
                                  form.setValue("buyer_name", buyerName);
                                }

                                if (date) {
                                  try {
                                    const parsedDate = new Date(date);
                                    if (!isNaN(parsedDate.getTime())) {
                                      form.setValue("sale_date", parsedDate);
                                    }
                                  } catch (error) {
                                    console.error("Date parsing error:", error);
                                  }
                                }

                                // Set items only if we have valid items
                                if (saleItems.length > 0) {
                                  console.log("Setting form items:", saleItems);

                                  // First clear existing items
                                  form.setValue("items", []);

                                  // Then set new items one by one
                                  saleItems.forEach((item, index) => {
                                    // Set the entire item first
                                    form.setValue(`items.${index}`, item);

                                    // Then explicitly set product_id and location_id
                                    form.setValue(
                                      `items.${index}.product_id`,
                                      item.product_id
                                    );
                                    form.setValue(
                                      `items.${index}.location_id`,
                                      item.location_id
                                    );

                                    console.log(`Set item ${index}:`, {
                                      formValue: form.getValues(
                                        `items.${index}`
                                      ),
                                      productId: form.getValues(
                                        `items.${index}.product_id`
                                      ),
                                    });
                                  });
                                }

                                // Set bill details
                                if (billDiscountAmount) {
                                  form.setValue(
                                    "bill_discount_amount",
                                    billDiscountAmount
                                  );
                                }

                                if (paymentReceived) {
                                  form.setValue(
                                    "payment_received",
                                    paymentReceived
                                  );
                                }

                                form.setValue("credit_sale", isCredit);

                                if (serialNo) {
                                  form.setValue("notes", `S.No: ${serialNo}`);
                                }

                                // Clear textarea
                                // e.target.value = "";

                                // Show success message
                                toast({
                                  title: "Data parsed successfully",
                                  description: `${saleItems.length} items added for ${buyerName}`,
                                });

                                // Trigger calculations for all items
                                saleItems.forEach((item) => {
                                  handlePriceCalculation(
                                    item.price_per_unit,
                                    item.quantity
                                  );
                                });
                              } catch (error) {
                                console.error("Parsing error:", error);
                                toast({
                                  variant: "destructive",
                                  title: "Error parsing data",
                                  description:
                                    "Please ensure you've copied all columns from Excel correctly",
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Paste your Excel data including all rows and columns
                          (S.No, Date, Buyer, Products, Quantities, Prices, and
                          Totals)
                        </FormDescription>
                      </FormItem>
                    </div>
                  </CardContent>
                )}
              </Card>

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
                            ? new Date(
                                field.value.getTime() -
                                  field.value.getTimezoneOffset() * 60000
                              )
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) => {
                          const inputDate = e.target.value
                            ? new Date(e.target.value)
                            : new Date();
                          // Adjust for timezone
                          const adjustedDate = new Date(
                            inputDate.getTime() +
                              inputDate.getTimezoneOffset() * 60000
                          );
                          field.onChange(adjustedDate);
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
                            defaultMonth={field.value || new Date()}
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
            <Card key={sale.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header Section */}
                <div className="p-4 bg-secondary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="bg-green-500/10 text-green-600 hover:bg-green-500/20"
                      >
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                        Sale #{sale.invoice_number}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.sale_date), "PPP")}
                      </p>
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
                        <span className="sr-only">Edit</span>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSaleToForm(sale, false)}
                      >
                        <span className="sr-only">Copy</span>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printReceipt(sale)}
                      >
                        <span className="sr-only">Print</span>
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

                  <div className="mt-3">
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-lg">{sale.buyer_name}</p>
                      {sale.contact_no && (
                        <p className="text-sm text-muted-foreground">
                          • {sale.contact_no}
                        </p>
                      )}
                    </div>
                    {sale.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Note: {sale.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items Section */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full flex justify-between items-center px-4 py-3 hover:bg-secondary/10"
                    >
                      <div className="flex items-center gap-2">
                        <span>View Items</span>
                        <Badge variant="outline" className="ml-2">
                          {sale.items?.length} items
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <div className="space-y-2 divide-y divide-border">
                        {sale.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-start pt-3 first:pt-0"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">
                                {item.product?.name}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>
                                  {item.quantity} × $
                                  {item.price_per_unit?.toFixed(2)}
                                </span>
                                {(item.discount_percentage ||
                                  item.discount_amount) && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {item.discount_percentage &&
                                      `${item.discount_percentage}% `}
                                    {item.discount_amount &&
                                      `$${item.discount_amount} `}
                                    off
                                  </Badge>
                                )}
                              </div>
                              {item.trade_scheme && (
                                <Badge variant="outline" className="text-xs">
                                  Trade Scheme: {item.trade_scheme}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium">
                              ${item.final_price.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Summary Section */}
                      {(sale.bill_discount_percentage ||
                        sale.bill_discount_amount) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Subtotal
                              </span>
                              <span>${sale.total_amount.toFixed(2)}</span>
                            </div>
                            {sale.bill_discount_amount && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Bill Discount
                                </span>
                                <span className="text-red-500">
                                  -${sale.bill_discount_amount.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {sale.bill_discount_percentage && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Bill Discount ({sale.bill_discount_percentage}
                                  %)
                                </span>
                                <span className="text-red-500">
                                  -$
                                  {(
                                    (sale.bill_discount_percentage / 100) *
                                    (sale.total_amount -
                                      (sale.bill_discount_amount || 0))
                                  ).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Footer Section */}
                <div className="px-4 py-3 bg-secondary/5 border-t flex justify-between items-center">
                  <span className="font-medium">Total Amount</span>
                  <span className="text-lg font-semibold">
                    ${sale.final_amount.toFixed(2)}
                  </span>
                </div>
              </CardContent>
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
