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
import { useState } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types
interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  total_sales: number;
  total_payments: number;
  current_balance: number;
  created_at: string;
}

interface Payment {
  id: number;
  customer_id: number;
  sale_id?: number;
  amount: number;
  payment_date: string;
  payment_type: string;
  payment_method: string;
  reference_no?: string;
  notes?: string;
  created_at: string;
}

interface Sale {
  id: number;
  invoice_number: string;
  buyer_name: string;
  sale_date: string;
  final_amount: number;
  payment_received: number;
  credit_sale: boolean;
}

// Form Schemas
const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const paymentFormSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  payment_date: z.date(),
  payment_type: z.string(),
  payment_method: z.string(),
  reference_no: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

function CustomerSkeleton() {
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
          {Array(3)
            .fill(null)
            .map((_, i) => (
              <Skeleton key={i} className="h-[100px]" />
            ))}
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Forms
  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
    },
  });

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: "",
      payment_date: new Date(),
      payment_type: "dues_payment",
      payment_method: "cash",
      reference_no: "",
      notes: "",
    },
  });

  // Queries
  const { data: customers, isLoading: customersLoading } = useQuery({
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

  const { data: customerSales } = useQuery({
    queryKey: ["customer_sales", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("customer_id", selectedCustomer.id)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!selectedCustomer,
  });

  const { data: customerPayments } = useQuery({
    queryKey: ["customer_payments", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", selectedCustomer.id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!selectedCustomer,
  });

  // Mutations
  const createCustomer = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const { data, error } = await supabase
        .from("customers")
        .insert([values])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Customer created",
        description: "New customer has been added successfully.",
      });
      customerForm.reset();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: number;
      values: CustomerFormValues;
    }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Customer updated",
        description: "Customer details have been updated successfully.",
      });
      customerForm.reset();
      setSelectedCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const recordPayment = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      if (!selectedCustomer) throw new Error("No customer selected");
      const { data, error } = await supabase
        .from("payments")
        .insert([
          {
            ...values,
            customer_id: selectedCustomer.id,
            amount: parseFloat(values.amount),
            payment_date: values.payment_date.toISOString().split("T")[0],
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: "Payment has been recorded successfully.",
      });
      paymentForm.reset({
        amount: "",
        payment_date: new Date(),
        payment_type: "dues_payment",
        payment_method: "cash",
        reference_no: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["customer_payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Customer deleted",
        description: "Customer has been deleted successfully.",
      });
      setSelectedCustomer(null);
      customerForm.reset();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Event Handlers
  function onCustomerSubmit(values: CustomerFormValues) {
    if (selectedCustomer) {
      updateCustomer.mutate({ id: selectedCustomer.id, values });
    } else {
      createCustomer.mutate(values);
    }
  }

  function onPaymentSubmit(values: PaymentFormValues) {
    recordPayment.mutate(values);
  }

  function handleCustomerSelect(customer: Customer) {
    setSelectedCustomer(customer);
    customerForm.reset({
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
    });
  }

  function handleCustomerReset() {
    setSelectedCustomer(null);
    customerForm.reset();
  }

  if (customersLoading) {
    return <CustomerSkeleton />;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer List */}
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customers?.map((customer) => (
                <Card
                  key={customer.id}
                  className={cn(
                    "cursor-pointer hover:bg-accent transition-colors",
                    selectedCustomer?.id === customer.id && "bg-accent"
                  )}
                  onClick={() => handleCustomerSelect(customer)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <h3 className="font-medium">{customer.name}</h3>
                      {customer.phone && (
                        <p className="text-sm text-muted-foreground">
                          {customer.phone}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        Balance: ${customer.current_balance.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Sales: ${customer.total_sales.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Customer Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {selectedCustomer ? "Edit Customer" : "New Customer"}
              </CardTitle>
              {selectedCustomer && (
                <Button variant="outline" onClick={handleCustomerReset}>
                  Add New Customer
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Form {...customerForm}>
                <form
                  onSubmit={customerForm.handleSubmit(onCustomerSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={customerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter customer name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter phone number"
                            type="tel"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customerForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={
                        createCustomer.isPending || updateCustomer.isPending
                      }
                    >
                      {selectedCustomer ? "Update" : "Create"}
                    </Button>
                    {selectedCustomer && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCustomerReset}
                        >
                          Cancel
                        </Button>
                        <DeleteButton
                          onDelete={() =>
                            deleteCustomer.mutate(selectedCustomer.id)
                          }
                          loading={deleteCustomer.isPending}
                        />
                      </>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Payment Form */}
          {selectedCustomer && (
            <Card>
              <CardHeader>
                <CardTitle>Record Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...paymentForm}>
                  <form
                    onSubmit={paymentForm.handleSubmit(onPaymentSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={paymentForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Enter payment amount"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={paymentForm.control}
                        name="payment_method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Method</FormLabel>
                            <FormControl>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                                {...field}
                              >
                                <option value="cash">Cash</option>
                                <option value="bank_transfer">
                                  Bank Transfer
                                </option>
                                <option value="cheque">Cheque</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={paymentForm.control}
                        name="payment_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Type</FormLabel>
                            <FormControl>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                                {...field}
                              >
                                <option value="dues_payment">
                                  Dues Payment
                                </option>
                                <option value="advance_payment">
                                  Advance Payment
                                </option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={paymentForm.control}
                      name="reference_no"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter reference number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input placeholder="Add notes" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={recordPayment.isPending}
                    >
                      {recordPayment.isPending
                        ? "Recording Payment..."
                        : "Record Payment"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Customer Details */}
      {selectedCustomer && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Customer Details - {selectedCustomer.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transactions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="transactions">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ...(customerSales || []).map((sale) => ({
                          date: sale.sale_date,
                          type: "sale",
                          details: `Invoice #${sale.invoice_number}`,
                          amount: sale.final_amount,
                          payment: sale.payment_received,
                        })),
                        ...(customerPayments || []).map((payment) => ({
                          date: payment.payment_date,
                          type: "payment",
                          details: `${payment.payment_type} - ${
                            payment.payment_method
                          }${
                            payment.reference_no
                              ? ` (Ref: ${payment.reference_no})`
                              : ""
                          }`,
                          amount: -payment.amount, // Negative for payments
                          payment: payment.amount,
                        })),
                      ]
                        .sort((a, b) => {
                          return (
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime()
                          );
                        })
                        .map((transaction, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {format(new Date(transaction.date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.type === "sale"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{transaction.details}</TableCell>
                            <TableCell className="text-right">
                              ${Math.abs(transaction.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${transaction.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="summary">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${selectedCustomer.total_sales.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Payments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${selectedCustomer.total_payments.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Current Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${selectedCustomer.current_balance.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
