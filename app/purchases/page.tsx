"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Package, ArrowDown } from "lucide-react";
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
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  product_id: z.string({
    required_error: "Please select a product.",
  }),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.string().min(1, "Price is required"),
  purchase_date: z.date({
    required_error: "A date is required.",
  }),
});

function PurchasesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-[250px] mb-2" />
        <Skeleton className="h-4 w-[350px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-[400px]" />
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

export default function PurchasesPage() {
  const { toast } = useToast();
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: "",
      price: "",
    },
  });

  // Fetch products for the dropdown
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

  // Fetch recent purchases
  const { data: recentPurchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(
          `
          *,
          product:products (
            name
          )
        `
        )
        .order("purchase_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const recordPurchase = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // First record the purchase
      const { error: purchaseError } = await supabase.from("purchases").insert({
        product_id: parseInt(values.product_id),
        quantity: parseInt(values.quantity),
        price: parseFloat(values.price),
        purchase_date: values.purchase_date.toISOString().split("T")[0],
      });

      if (purchaseError) throw purchaseError;

      // Then update the product quantity
      const { error: updateError } = await supabase.rpc(
        "update_product_quantity",
        {
          p_id: parseInt(values.product_id),
          qty: parseInt(values.quantity),
        }
      );

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Purchase Recorded",
        description: "The purchase has been successfully recorded.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record purchase. Please try again.",
        variant: "destructive",
      });
      console.error("Error recording purchase:", error);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordPurchase.mutate(values);
  }

  if (productsLoading || purchasesLoading) {
    return <PurchasesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Record Purchase</h1>
        <p className="text-muted-foreground">
          Record new purchases and view recent transactions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Purchase</CardTitle>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
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

                <FormField
                  control={form.control}
                  name="purchase_date"
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={recordPurchase.isPending}
                >
                  {recordPurchase.isPending
                    ? "Recording..."
                    : "Record Purchase"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-primary">
            Recent Purchases
          </h2>
          {recentPurchases?.map((purchase) => (
            <Card key={purchase.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Badge className="bg-blue-500">
                  <Package className="h-4 w-4 mr-1" />
                  Purchase
                </Badge>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{purchase.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(purchase.purchase_date), "PPP")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{purchase.quantity} units</Badge>
                      <p className="text-sm font-medium mt-1">
                        ${purchase.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
