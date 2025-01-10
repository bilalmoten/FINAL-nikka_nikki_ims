"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Factory } from "lucide-react";
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

const PRODUCTION_PROCESSES = {
  SOAP_BOXING: "soap_boxing",
  SHAMPOO_LABELING: "shampoo_labeling",
  LOTION_LABELING: "lotion_labeling",
  GIFT_SET_ASSEMBLY: "gift_set_assembly",
} as const;

const formSchema = z.object({
  process: z.enum(
    [
      PRODUCTION_PROCESSES.SOAP_BOXING,
      PRODUCTION_PROCESSES.SHAMPOO_LABELING,
      PRODUCTION_PROCESSES.LOTION_LABELING,
      PRODUCTION_PROCESSES.GIFT_SET_ASSEMBLY,
    ],
    {
      required_error: "Please select a production process.",
    }
  ),
  quantity: z.string().min(1, "Quantity is required"),
  production_date: z.date({
    required_error: "A date is required.",
  }),
});

function ProductionSkeleton() {
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

export default function ProductionPage() {
  const { toast } = useToast();
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      process: undefined,
      quantity: "",
      production_date: undefined,
    },
  });

  // Fetch products for inventory check
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

  // Fetch recent production records
  const { data: recentProduction, isLoading: productionLoading } = useQuery({
    queryKey: ["production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production")
        .select("*")
        .order("production_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const recordProduction = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        console.log("Starting production process with values:", values);
        if (!products) {
          throw new Error("Products data is not available");
        }

        const quantity = parseInt(values.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("Invalid quantity. Please enter a positive number.");
        }

        const productUpdates: { id: number; quantity: number }[] = [];

        // Log available products
        console.log("Available products:", products);

        // Determine which products to update based on the process
        switch (values.process) {
          case PRODUCTION_PROCESSES.SOAP_BOXING: {
            const wrappedSoap = products?.find(
              (p) => p.name === "Soap (Wrapped)"
            );
            const emptyBoxes = products?.find((p) => p.name === "Soap Boxes");
            const readySoap = products?.find((p) => p.name === "Soap (Ready)");

            console.log("Soap Boxing Process - Found Products:", {
              wrappedSoap,
              emptyBoxes,
              readySoap,
            });

            if (!wrappedSoap || !emptyBoxes || !readySoap) {
              throw new Error(
                `Required products not found. Missing: ${[
                  !wrappedSoap && "Wrapped Soap",
                  !emptyBoxes && "Soap Boxes",
                  !readySoap && "Ready Soap",
                ]
                  .filter(Boolean)
                  .join(", ")}`
              );
            }

            if (
              wrappedSoap.quantity < quantity ||
              emptyBoxes.quantity < quantity
            ) {
              throw new Error(
                `Insufficient materials. Required: ${quantity}, Available: Wrapped Soap: ${wrappedSoap.quantity}, Empty Boxes: ${emptyBoxes.quantity}`
              );
            }

            productUpdates.push(
              { id: wrappedSoap.id, quantity: -quantity },
              { id: emptyBoxes.id, quantity: -quantity },
              { id: readySoap.id, quantity: quantity }
            );
            break;
          }

          case PRODUCTION_PROCESSES.SHAMPOO_LABELING: {
            const unlabeledShampoo = products?.find(
              (p) => p.name === "Shampoo (Unlabeled)"
            );
            const readyShampoo = products?.find(
              (p) => p.name === "Shampoo (Ready)"
            );

            console.log("Shampoo Labeling Process - Found Products:", {
              unlabeledShampoo,
              readyShampoo,
            });

            if (!unlabeledShampoo || !readyShampoo) {
              throw new Error(
                `Required products not found. Missing: ${[
                  !unlabeledShampoo && "Unlabeled Shampoo",
                  !readyShampoo && "Ready Shampoo",
                ]
                  .filter(Boolean)
                  .join(", ")}`
              );
            }

            if (unlabeledShampoo.quantity < quantity) {
              throw new Error(
                `Insufficient materials. Required: ${quantity}, Available Unlabeled Shampoo: ${unlabeledShampoo.quantity}`
              );
            }

            productUpdates.push(
              { id: unlabeledShampoo.id, quantity: -quantity },
              { id: readyShampoo.id, quantity: quantity }
            );
            break;
          }

          case PRODUCTION_PROCESSES.LOTION_LABELING: {
            const unlabeledLotion = products?.find(
              (p) => p.name === "Lotion (Unlabeled)"
            );
            const readyLotion = products?.find(
              (p) => p.name === "Lotion (Ready)"
            );

            console.log("Lotion Labeling Process - Found Products:", {
              unlabeledLotion,
              readyLotion,
            });

            if (!unlabeledLotion || !readyLotion) {
              throw new Error(
                `Required products not found. Missing: ${[
                  !unlabeledLotion && "Unlabeled Lotion",
                  !readyLotion && "Ready Lotion",
                ]
                  .filter(Boolean)
                  .join(", ")}`
              );
            }

            if (unlabeledLotion.quantity < quantity) {
              throw new Error(
                `Insufficient materials. Required: ${quantity}, Available Unlabeled Lotion: ${unlabeledLotion.quantity}`
              );
            }

            productUpdates.push(
              { id: unlabeledLotion.id, quantity: -quantity },
              { id: readyLotion.id, quantity: quantity }
            );
            break;
          }

          case PRODUCTION_PROCESSES.GIFT_SET_ASSEMBLY: {
            const readySoap = products?.find((p) => p.name === "Soap (Ready)");
            const readyShampoo = products?.find(
              (p) => p.name === "Shampoo (Ready)"
            );
            const readyLotion = products?.find(
              (p) => p.name === "Lotion (Ready)"
            );
            const powder = products?.find((p) => p.name === "Powder");
            const giftBox = products?.find(
              (p) => p.name === "Gift Box Outer Cardboard"
            );
            const thermacol = products?.find(
              (p) => p.name === "Empty Thermacol"
            );
            const giftSet = products?.find((p) => p.name === "Gift Set");

            console.log("Gift Set Assembly Process - Found Products:", {
              readySoap,
              readyShampoo,
              readyLotion,
              powder,
              giftBox,
              thermacol,
              giftSet,
            });

            if (
              !readySoap ||
              !readyShampoo ||
              !readyLotion ||
              !powder ||
              !giftBox ||
              !thermacol ||
              !giftSet
            ) {
              throw new Error(
                `Required products not found. Missing: ${[
                  !readySoap && "Ready Soap",
                  !readyShampoo && "Ready Shampoo",
                  !readyLotion && "Ready Lotion",
                  !powder && "Powder",
                  !giftBox && "Gift Box",
                  !thermacol && "Thermacol",
                  !giftSet && "Gift Set",
                ]
                  .filter(Boolean)
                  .join(", ")}`
              );
            }

            if (
              readySoap.quantity < quantity ||
              readyShampoo.quantity < quantity ||
              readyLotion.quantity < quantity ||
              powder.quantity < quantity ||
              giftBox.quantity < quantity ||
              thermacol.quantity < quantity
            ) {
              throw new Error(
                `Insufficient materials. Required: ${quantity}, Available: ` +
                  `Ready Soap: ${readySoap.quantity}, ` +
                  `Ready Shampoo: ${readyShampoo.quantity}, ` +
                  `Ready Lotion: ${readyLotion.quantity}, ` +
                  `Powder: ${powder.quantity}, ` +
                  `Gift Box: ${giftBox.quantity}, ` +
                  `Thermacol: ${thermacol.quantity}`
              );
            }

            productUpdates.push(
              { id: readySoap.id, quantity: -quantity },
              { id: readyShampoo.id, quantity: -quantity },
              { id: readyLotion.id, quantity: -quantity },
              { id: powder.id, quantity: -quantity },
              { id: giftBox.id, quantity: -quantity },
              { id: thermacol.id, quantity: -quantity },
              { id: giftSet.id, quantity: quantity }
            );
            break;
          }
        }

        console.log("Product updates to be applied:", productUpdates);

        // Record the production
        const { data: productionData, error: productionError } = await supabase
          .from("production")
          .insert({
            process: values.process,
            quantity: quantity,
            production_date: values.production_date.toISOString().split("T")[0],
          })
          .select()
          .single();

        if (productionError) {
          console.error("Error recording production:", productionError);
          throw new Error(
            `Failed to record production: ${productionError.message}`
          );
        }

        if (!productionData) {
          throw new Error("Production record was not created");
        }

        console.log("Production record created successfully:", productionData);

        // Update all product quantities
        for (const update of productUpdates) {
          console.log("Applying update:", update);
          const { data: updateData, error: updateError } = await supabase.rpc(
            "update_product_quantity",
            {
              p_id: update.id,
              qty: update.quantity,
            }
          );

          if (updateError) {
            console.error("Error updating product quantity:", updateError);
            throw new Error(
              `Failed to update product quantity: ${updateError.message}`
            );
          }

          console.log("Product quantity updated successfully:", updateData);
        }

        console.log("All product quantities updated successfully");
      } catch (error) {
        console.error("Production process failed:", error);
        if (error instanceof Error) {
          throw new Error(`Production failed: ${error.message}`);
        } else if (typeof error === "object" && error !== null) {
          throw new Error(`Production failed: ${JSON.stringify(error)}`);
        } else {
          throw new Error("An unknown error occurred during production");
        }
      }
    },
    onSuccess: () => {
      console.log("Production recorded successfully");
      toast({
        title: "Production Recorded",
        description: "The production has been successfully recorded.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: unknown) => {
      console.error("Production mutation error:", error);
      let errorMessage = "Failed to record production. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        errorMessage = JSON.stringify(error);
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordProduction.mutate(values);
  }

  if (productsLoading || productionLoading) {
    return <ProductionSkeleton />;
  }

  const getProcessDescription = (process: string) => {
    switch (process) {
      case PRODUCTION_PROCESSES.SOAP_BOXING:
        return "Putting wrapped soap into boxes";
      case PRODUCTION_PROCESSES.SHAMPOO_LABELING:
        return "Labeling shampoo bottles";
      case PRODUCTION_PROCESSES.LOTION_LABELING:
        return "Labeling lotion bottles";
      case PRODUCTION_PROCESSES.GIFT_SET_ASSEMBLY:
        return "Assembling gift sets";
      default:
        return process;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Record Production</h1>
        <p className="text-muted-foreground">
          Record production processes and view production history
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Production</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="process"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Process</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a process" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(PRODUCTION_PROCESSES).map(
                            (process) => (
                              <SelectItem key={process} value={process}>
                                {getProcessDescription(process)}
                              </SelectItem>
                            )
                          )}
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
                  name="production_date"
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
                  disabled={recordProduction.isPending}
                >
                  {recordProduction.isPending
                    ? "Recording..."
                    : "Record Production"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-primary">
            Recent Production
          </h2>
          {recentProduction?.map((production) => (
            <Card key={production.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Badge className="bg-purple-500">
                  <Factory className="h-4 w-4 mr-1" />
                  Production
                </Badge>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {getProcessDescription(production.process)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(production.production_date), "PPP")}
                      </p>
                    </div>
                    <Badge variant="outline">{production.quantity} units</Badge>
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
