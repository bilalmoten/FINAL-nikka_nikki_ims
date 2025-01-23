"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteButton } from "@/components/ui/delete-button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import React from "react";

interface Product {
  id: number;
  name: string;
  quantity: number;
}

interface Location {
  id: number;
  name: string;
  address?: string;
}

interface Transfer {
  id: number;
  product_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: number;
  transfer_date: string;
  notes?: string;
  product: Product;
  from_location: Location;
  to_location: Location;
}

const formSchema = z
  .object({
    product_id: z.string({
      required_error: "Please select a product.",
    }),
    from_location_id: z.string({
      required_error: "Please select source location.",
    }),
    to_location_id: z.string({
      required_error: "Please select destination location.",
    }),
    quantity: z
      .string()
      .min(1, "Quantity is required")
      .refine((val) => !isNaN(parseInt(val)) && parseInt(val) > 0, {
        message: "Quantity must be a positive number",
      }),
    transfer_date: z.date({
      required_error: "A date is required.",
    }),
    notes: z.string().optional(),
  })
  .refine((data) => data.from_location_id !== data.to_location_id, {
    message: "Source and destination locations must be different",
    path: ["to_location_id"],
  });

function TransferSkeleton() {
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

export default function TransfersPage() {
  const { toast } = useToast();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: "",
      from_location_id: "1",
      to_location_id: "",
      quantity: "",
      transfer_date: new Date(),
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
      return data as Product[];
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
      return data as Location[];
    },
  });

  // Add pagination state
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  // Fetch transfers with pagination
  const { data: transfersData, isLoading: transfersLoading } = useQuery({
    queryKey: ["transfers", page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("transfers")
        .select(
          `
          *,
          product:products(*),
          from_location:locations!from_location_id(*),
          to_location:locations!to_location_id(*)
        `,
          { count: "exact" }
        )
        .order("transfer_date", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;
      return { transfers: data, totalCount: count } as {
        transfers: Transfer[];
        totalCount: number;
      };
    },
  });

  const recordTransfer = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const selectedProduct = products?.find(
        (p) => p.id === parseInt(values.product_id)
      );

      if (!selectedProduct) {
        throw new Error("Selected product not found");
      }

      const quantity = parseInt(values.quantity);
      if (quantity > selectedProduct.quantity) {
        throw new Error(
          `Not enough stock. Available: ${selectedProduct.quantity}`
        );
      }

      // Record the transfer using the function
      const { error: transferError } = await supabase.rpc("record_transfer", {
        p_product_id: parseInt(values.product_id),
        p_from_location_id: parseInt(values.from_location_id),
        p_to_location_id: parseInt(values.to_location_id),
        p_quantity: quantity,
        p_transfer_date: values.transfer_date.toISOString().split("T")[0],
        p_notes: values.notes,
      });

      if (transferError) throw transferError;
    },
    onSuccess: () => {
      toast({
        title: "Transfer Recorded",
        description: "The transfer has been successfully recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to record transfer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.rpc("reverse_transfer", {
        transfer_id: id,
      });
      if (error) {
        console.error("Transfer deletion error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Transfer Reversed",
        description: "The transfer record has been successfully reversed.",
      });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to reverse transfer. Please try again.",
        variant: "destructive",
      });
      console.error("Transfer deletion error:", error);
    },
  });

  // Add reset handler
  const handleReset = () => {
    form.reset({
      product_id: "",
      from_location_id: "",
      to_location_id: "",
      quantity: "",
      transfer_date: new Date(),
      notes: "",
    });
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordTransfer.mutate(values);
  }

  if (productsLoading || locationsLoading || transfersLoading) {
    return <TransferSkeleton />;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Transfer Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Record Transfer</CardTitle>
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
                                {product.name} ({product.quantity} in stock)
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
                    name="from_location_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Location</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select source location" />
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
                    name="to_location_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To Location</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select destination location" />
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
                    name="transfer_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Transfer Date</FormLabel>
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
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() ||
                                  date < new Date("1900-01-01")
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
                      disabled={recordTransfer.isPending}
                    >
                      {recordTransfer.isPending
                        ? "Recording..."
                        : "Record Transfer"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                    >
                      Reset Form
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transfers */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Transfers</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of{" "}
                  {transfersData?.totalCount
                    ? Math.ceil(transfersData.totalCount / pageSize)
                    : 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) =>
                      transfersData?.totalCount
                        ? Math.min(
                            Math.ceil(transfersData.totalCount / pageSize),
                            p + 1
                          )
                        : p
                    )
                  }
                  disabled={
                    !transfersData?.totalCount ||
                    page === Math.ceil(transfersData.totalCount / pageSize)
                  }
                >
                  Next
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transfersData?.transfers?.map((transfer) => (
                  <Card key={transfer.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">
                            {transfer.product.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(transfer.transfer_date), "PPP")}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="text-right">
                            <p className="font-medium">
                              {transfer.quantity} units
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transfer.from_location.name} →{" "}
                              {transfer.to_location.name}
                            </p>
                          </div>
                          <DeleteButton
                            onDelete={async () => {
                              try {
                                await deleteTransfer.mutateAsync(transfer.id);
                                return Promise.resolve();
                              } catch (error) {
                                return Promise.reject(error);
                              }
                            }}
                            loading={deleteTransfer.isPending}
                            title="Reverse Transfer"
                            description="This will reverse the transfer and restore the product quantities at both locations. This action cannot be undone."
                          />
                        </div>
                      </div>
                      {transfer.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Note: {transfer.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
