"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, ArrowDown, Printer, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
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

const formSchema = z.object({
  product_id: z.string({
    required_error: "Please select a product.",
  }),
  buyer_name: z.string().min(1, "Buyer name is required"),
  contact_no: z.string().optional(),
  quantity: z.string().min(1, "Quantity is required"),
  price_per_unit: z.string().min(1, "Price per unit is required"),
  discount_percentage: z.string().optional(),
  discount_amount: z.string().optional(),
  sale_date: z.date({
    required_error: "A date is required.",
  }),
  notes: z.string().optional(),
});

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

// Add type definitions
interface Product {
  id: number;
  name: string;
  quantity: number;
}

interface Sale {
  id: number;
  product_id: number;
  buyer_name: string;
  contact_no?: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  discount_percentage?: number;
  discount_amount?: number;
  final_price: number;
  sale_date: string;
  notes?: string;
  product: Product;
}

export default function SalesPage() {
  const { toast } = useToast();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const queryClient = useQueryClient();
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [selectedProductQty, setSelectedProductQty] = useState<number | null>(
    null
  );
  const [pricePerPieceAfterDiscount, setPricePerPieceAfterDiscount] =
    useState<number>(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buyer_name: "",
      contact_no: "",
      quantity: "",
      price_per_unit: "",
      discount_percentage: "",
      discount_amount: "",
      notes: "",
    },
  });

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

  // Organize products into ready and other
  const readyProducts =
    products?.filter(
      (p) => p.name.includes("Ready") || p.name === "Gift Set"
    ) || [];

  const otherProducts =
    products?.filter(
      (p) => !p.name.includes("Ready") && p.name !== "Gift Set"
    ) || [];

  // Watch form values for price calculation
  const quantity = form.watch("quantity");
  const pricePerUnit = form.watch("price_per_unit");
  const discountPercentage = form.watch("discount_percentage");
  const discountAmount = form.watch("discount_amount");
  const selectedProductId = form.watch("product_id");

  // Watch product selection
  useEffect(() => {
    if (selectedProductId) {
      const product = products?.find(
        (p) => p.id === parseInt(selectedProductId)
      );
      setSelectedProductQty(product?.quantity || null);
    } else {
      setSelectedProductQty(null);
    }
  }, [selectedProductId, products]);

  // Calculate total and final price
  useEffect(() => {
    const qty = parseFloat(quantity || "0");
    const price = parseFloat(pricePerUnit || "0");
    const discPerc = parseFloat(discountPercentage || "0");
    const discAmt = parseFloat(discountAmount || "0");

    // Calculate initial total
    const total = qty * price;
    setTotalPrice(total);

    // Apply fixed amount discount first
    const priceAfterAmountDiscount = Math.max(0, total - discAmt);

    // Then apply percentage discount
    const discountFromPercentage = priceAfterAmountDiscount * (discPerc / 100);
    const finalPriceAfterDiscount =
      priceAfterAmountDiscount - discountFromPercentage;
    setFinalPrice(Math.max(0, finalPriceAfterDiscount));

    // Calculate price per piece after all discounts
    if (qty > 0) {
      setPricePerPieceAfterDiscount(finalPriceAfterDiscount / qty);
    } else {
      setPricePerPieceAfterDiscount(0);
    }
  }, [quantity, pricePerUnit, discountPercentage, discountAmount]);

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
        // Validate product quantity
        const product = products?.find(
          (p) => p.id === parseInt(values.product_id)
        );
        if (!product) {
          throw new Error("Selected product not found");
        }

        const requestedQty = parseInt(values.quantity);
        if (requestedQty > product.quantity) {
          throw new Error(
            `Insufficient stock. Only ${product.quantity} units available.`
          );
        }

        // Record the sale
        const { data: saleData, error: saleError } = await supabase
          .from("sales")
          .insert({
            product_id: parseInt(values.product_id),
            buyer_name: values.buyer_name,
            contact_no: values.contact_no,
            quantity: requestedQty,
            price: parseFloat(values.price_per_unit),
            price_per_unit: parseFloat(values.price_per_unit),
            total_price: totalPrice,
            discount_percentage: values.discount_percentage
              ? parseFloat(values.discount_percentage)
              : null,
            discount_amount: values.discount_amount
              ? parseFloat(values.discount_amount)
              : null,
            final_price: finalPrice,
            sale_date: values.sale_date.toISOString().split("T")[0],
            notes: values.notes,
          })
          .select(
            `
            *,
            product:products!inner(*)
          `
          )
          .single();

        if (saleError) {
          console.error("Sale recording error:", saleError);
          throw new Error(saleError.message);
        }

        if (!saleData) {
          throw new Error("Failed to create sale record");
        }

        // Update product quantity
        const { error: updateError } = await supabase.rpc(
          "update_product_quantity",
          {
            p_id: parseInt(values.product_id),
            qty: -requestedQty,
          }
        );

        if (updateError) {
          console.error("Product quantity update error:", updateError);
          throw new Error(updateError.message);
        }

        return saleData;
      } catch (error) {
        console.error("Sale recording failed:", error);
        if (error instanceof Error) {
          throw new Error(`Sale failed: ${error.message}`);
        }
        throw new Error(
          "An unexpected error occurred while recording the sale"
        );
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Sale Recorded",
        description: "The sale has been successfully recorded.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      // Print receipt
      printReceipt(data);
    },
    onError: (error) => {
      console.error("Sale mutation error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to record sale. Please try again.",
        variant: "destructive",
      });
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
            <p style="color: #666; margin: 5px 0;">Invoice #: INV-${saleData.id.toString().padStart(6, "0")}</p>
            <p style="color: #666; margin: 5px 0;">Date: ${format(new Date(saleData.sale_date), "PPP")}</p>
          </div>
        </div>

        <!-- Customer Info -->
        <div style="margin-bottom: 30px;">
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Bill To:</h3>
            <p style="margin: 0; color: #666;">${saleData.buyer_name}</p>
            ${saleData.contact_no ? `<p style="margin: 5px 0; color: #666;">Contact: ${saleData.contact_no}</p>` : ""}
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
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px;">1</td>
              <td style="padding: 12px;">${saleData.product.name}</td>
              <td style="padding: 12px; text-align: right;">${saleData.quantity}</td>
              <td style="padding: 12px; text-align: right;">$${saleData.price_per_unit.toFixed(2)}</td>
              <td style="padding: 12px; text-align: right;">$${saleData.total_price.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Summary -->
        <div style="margin-left: auto; width: 300px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
            <span>Subtotal:</span>
            <span>$${saleData.total_price.toFixed(2)}</span>
          </div>
          ${
            saleData.discount_amount
              ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
            <span>Discount Amount:</span>
            <span>-$${saleData.discount_amount.toFixed(2)}</span>
          </div>
          `
              : ""
          }
          ${
            saleData.discount_percentage
              ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
            <span>Discount (${saleData.discount_percentage}%):</span>
            <span>-$${(saleData.total_price - saleData.final_price - (saleData.discount_amount || 0)).toFixed(2)}</span>
          </div>
          `
              : ""
          }
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #2E7D32; margin-top: 8px;">
            <span style="font-weight: bold; color: #333;">Total Due:</span>
            <span style="font-weight: bold; color: #2E7D32;">$${saleData.final_price.toFixed(2)}</span>
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
            <title>Invoice #INV-${saleData.id.toString().padStart(6, "0")}</title>
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

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordSale.mutate(values);
  }

  if (isLoading || productsLoading) {
    return <SalesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Record Sale</h1>
        <p className="text-muted-foreground">
          Record new sales and view recent transactions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Sale</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="product_id"
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
                          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                            Ready Products
                          </div>
                          {readyProducts.map((product) => (
                            <SelectItem
                              key={product.id}
                              value={product.id.toString()}
                            >
                              {product.name}
                            </SelectItem>
                          ))}

                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center w-full px-2 py-1.5 text-sm border-t">
                              <ChevronRight className="h-4 w-4 mr-1" />
                              Show All Products
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                                Other Products
                              </div>
                              {otherProducts.map((product) => (
                                <SelectItem
                                  key={product.id}
                                  value={product.id.toString()}
                                >
                                  {product.name}
                                </SelectItem>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        </SelectContent>
                      </Select>
                      {selectedProductQty !== null && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Available Quantity: {selectedProductQty}
                        </p>
                      )}
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
                      <FormLabel>Contact Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter contact number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
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
                    name="price_per_unit"
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

                <Card className="bg-secondary/10">
                  <CardContent className="pt-4">
                    <div className="text-sm font-medium mb-2">
                      Price Calculation
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="discount_percentage"
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
                          name="discount_amount"
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
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Final Price:</span>
                        <div className="text-right">
                          <div>${finalPrice.toFixed(2)}</div>
                          {pricePerPieceAfterDiscount > 0 && (
                            <div className="text-sm text-muted-foreground">
                              @${pricePerPieceAfterDiscount.toFixed(2)} per
                              piece
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <FormField
                  control={form.control}
                  name="sale_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("2023-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Add any notes about the sale"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={recordSale.isPending}
                >
                  {recordSale.isPending ? "Recording..." : "Record Sale"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-primary">Recent Sales</h2>
          {recentSales?.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Badge className="bg-green-500">
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Sale
                </Badge>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {sale.product?.name || "Unknown Product"}
                      </p>
                      <p className="text-sm">{sale.buyer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.sale_date), "PPP")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{sale.quantity} units</Badge>
                      <p className="text-sm font-medium mt-1">
                        ${sale.final_price.toFixed(2)}
                      </p>
                      {(sale.discount_percentage || sale.discount_amount) && (
                        <p className="text-xs text-muted-foreground">
                          Discounted from ${sale.total_price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => printReceipt(sale)}
                  title="Print Receipt"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
