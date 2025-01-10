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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
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
      quantity: "",
    },
  });

  // Fetch recent production records
  const { data: recentProduction, isLoading } = useQuery({
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
      const { error } = await supabase.from("production").insert({
        quantity: parseInt(values.quantity),
        production_date: values.production_date.toISOString().split("T")[0],
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Production Recorded",
        description: "The production has been successfully recorded.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["production"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record production. Please try again.",
        variant: "destructive",
      });
      console.error("Error recording production:", error);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    recordProduction.mutate(values);
  }

  if (isLoading) {
    return <ProductionSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Record Production</h1>
        <p className="text-muted-foreground">
          Record new production batches and view recent production history
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
                      <p className="font-medium">{production.quantity} units</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(production.production_date), "PPP")}
                      </p>
                    </div>
                    <Badge variant="outline">Completed</Badge>
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
