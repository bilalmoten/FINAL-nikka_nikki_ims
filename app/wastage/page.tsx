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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Product {
  id: number;
  name: string;
  quantity: number;
}

const formSchema = z.object({
  product_id: z.string({
    required_error: "Please select a product.",
  }),
  quantity: z.string()
    .min(1, "Quantity is required")
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) > 0, {
      message: "Quantity must be a positive number",
    }),
  wastage_date: z.date({
    required_error: "A date is required.",
  }),
  reason: z.string().min(1, "Please provide a reason for wastage"),
});

export default function WastageForm() {
  const { toast } = useToast();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const queryClient = useQueryClient();

  // Fetch products for the dropdown
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: "",
      quantity: "",
      wastage_date: new Date(),
      reason: "",
    },
  });

  const recordWastage = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const selectedProduct = products?.find(
        (p: Product) => p.id === parseInt(values.product_id)
      );

      if (!selectedProduct) {
        throw new Error("Selected product not found");
      }

      const quantity = parseInt(values.quantity);
      if (quantity > selectedProduct.quantity) {
        throw new Error(`Not enough stock. Available: ${selectedProduct.quantity}`);
      }

      // First record the wastage
      const { error: wastageError } = await supabase.from("wastage").insert({
        product_id: parseInt(values.product_id),
        quantity: quantity,
        wastage_date: values.wastage_date.toISOString().split("T")[0],
        reason: values.reason,
      });

      if (wastageError) throw wastageError;

      // Then update the product quantity
      const { error: updateError } = await supabase.rpc(
        "update_product_quantity",
        {
          p_id: parseInt(values.product_id),
          qty: -quantity,
        }
      );

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Wastage Recorded",
        description: "The wastage has been successfully recorded.",
      });
      form.reset({
        product_id: "",
        quantity: "",
        wastage_date: new Date(),
        reason: "",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record wastage. Please try again.",
        variant: "destructive",
      });
      console.error("Error recording wastage:", error);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordWastage.mutate(values);
  }

  if (productsLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Record Wastage</h3>
        <p className="text-sm text-muted-foreground">
          Record any damaged or wasted products.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    {products?.map((product: Product) => (
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
            name="wastage_date"
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
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter reason for wastage" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={recordWastage.isPending}>
            {recordWastage.isPending ? "Recording..." : "Record Wastage"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
