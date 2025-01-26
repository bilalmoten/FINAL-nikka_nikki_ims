"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Package,
  AlertTriangle,
  ArrowUpDown,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  History,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Interfaces
interface Product {
  id: number;
  name: string;
  stage: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
  min_stock?: number;
}

interface Location {
  id: number;
  name: string;
}

interface LocationProduct {
  location_id: number;
  product_id: number;
  quantity: number;
  location: Location;
}

interface ProductMovement {
  id: number;
  product_id: number;
  quantity_change: number;
  movement_type: "sale" | "production" | "purchase" | "transfer" | "wastage";
  created_at: string;
  location_id: number;
  location: Location;
  notes?: string;
}

interface Transfer {
  id: number;
  product_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: number;
  transfer_date: string;
  notes?: string;
  from_location: Location;
  to_location: Location;
}

// Add interfaces for the query responses
interface SaleItemWithDetails {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  price_per_unit: number;
  location_id: number;
  location: Location;
  sale: {
    created_at: string;
    sale_date: string;
    invoice_number: string;
  };
}

interface ProductionRecord {
  id: number;
  process: string;
  quantity: number;
  production_date: string;
  created_at: string;
}

interface TransferRecord {
  id: number;
  product_id: number;
  quantity: number;
  from_location_id: number;
  to_location_id: number;
  transfer_date: string;
  notes?: string;
  created_at: string;
  from_location: Location;
  to_location: Location;
}

interface WastageRecord {
  id: number;
  product_id: number;
  quantity: number;
  wastage_date: string;
  reason?: string;
  created_at: string;
}

// Add purchase interface
interface PurchaseRecord {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  purchase_date: string;
  created_at: string;
  product_name: string;
}

// Form Schema
const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  category: z.string().optional(),
  min_stock: z.string().optional(),
});

// Movement type colors
const movementTypeColors: Record<
  ProductMovement["movement_type"],
  { bg: string; text: string }
> = {
  sale: { bg: "bg-red-500", text: "text-white" },
  production: { bg: "bg-green-500", text: "text-white" },
  purchase: { bg: "bg-blue-500", text: "text-white" },
  transfer: { bg: "bg-yellow-500", text: "text-black" },
  wastage: { bg: "bg-gray-500", text: "text-white" },
};

// Add production process definitions
const productionProcesses = {
  soap_boxing: {
    inputs: ["Soap (Wrapped)", "Soap Boxes"],
    output: "Soap (Ready)",
  },
  shampoo_labeling: {
    inputs: ["Shampoo (Unlabeled)", "Shampoo Labels"],
    output: "Shampoo (Ready)",
  },
  lotion_labeling: {
    inputs: ["Lotion (Unlabeled)", "Lotion Labels"],
    output: "Lotion (Ready)",
  },
  gift_set_assembly: {
    inputs: [
      "Soap (Ready)",
      "Shampoo (Ready)",
      "Lotion (Ready)",
      "Powder",
      "Gift Box Outer Cardboard",
      "Empty Thermacol",
    ],
    output: "Gift Set",
  },
};

function InventorySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-[250px] mb-2" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array(4)
          .fill(null)
          .map((_, i) => (
            <Skeleton key={i} className="h-[125px]" />
          ))}
      </div>
      <Skeleton className="h-[500px]" />
    </div>
  );
}

export default function InventoryPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<
    "ledger" | "transfers" | "location"
  >("ledger");
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const { toast } = useToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const queryClient = useQueryClient();

  // Product form
  const productForm = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      category: "",
      min_stock: "",
    },
  });

  // Queries
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name")
        .returns<Product[]>();
      if (error) throw error;
      return data;
    },
  });

  const { data: locationProducts } = useQuery<LocationProduct[]>({
    queryKey: ["locationProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_products")
        .select(
          `
          location_id,
          product_id,
          quantity,
          location:locations(id, name)
        `
        )
        .returns<LocationProduct[]>();
      if (error) throw error;
      return data;
    },
  });

  const { data: productMovements } = useQuery<ProductMovement[]>({
    queryKey: ["productMovements", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];

      const [
        salesData,
        productionData,
        transfersData,
        wastageData,
        purchaseData,
      ] = await Promise.all([
        // Sales query remains the same
        supabase
          .from("sale_items")
          .select(
            `
            id,
            sale_id,
            product_id,
            quantity,
            price_per_unit,
            location_id,
            location:locations(id, name),
            sale:sales(created_at, sale_date, invoice_number)
          `
          )
          .eq("product_id", selectedProduct.id)
          .returns<SaleItemWithDetails[]>(),

        // Production query modified
        supabase
          .from("production")
          .select(
            `
            id,
            process,
            quantity,
            production_date,
            created_at
          `
          )
          .returns<ProductionRecord[]>(),

        // Transfers
        supabase
          .from("transfers")
          .select(
            `
            id,
            product_id,
            quantity,
            from_location_id,
            to_location_id,
            transfer_date,
            notes,
            created_at,
            from_location:locations!from_location_id(id, name),
            to_location:locations!to_location_id(id, name)
          `
          )
          .eq("product_id", selectedProduct.id)
          .returns<TransferRecord[]>(),

        // Wastage
        supabase
          .from("wastage")
          .select(
            `
            id,
            product_id,
            quantity,
            wastage_date,
            reason,
            created_at
          `
          )
          .eq("product_id", selectedProduct.id)
          .returns<WastageRecord[]>(),

        // Purchases
        supabase
          .from("purchases")
          .select(
            `
            id,
            product_id,
            quantity,
            price,
            purchase_date,
            product_name,
            created_at
          `
          )
          .eq("product_id", selectedProduct.id)
          .returns<PurchaseRecord[]>(),
      ]);

      if (
        salesData.error ||
        productionData.error ||
        transfersData.error ||
        wastageData.error ||
        purchaseData.error
      ) {
        throw new Error("Error fetching movement data");
      }

      // Transform and combine the data
      const allMovements: ProductMovement[] = [
        // Sales movements
        ...salesData.data.map(
          (sale): ProductMovement => ({
            id: sale.id,
            product_id: sale.product_id,
            quantity_change: -sale.quantity,
            movement_type: "sale",
            created_at: sale.sale.created_at,
            location_id: sale.location_id || 0,
            location: sale.location || { id: 0, name: "General" },
            notes: `Invoice: ${sale.sale.invoice_number}, Price: ₹${sale.price_per_unit} per unit`,
          })
        ),

        // Production movements updated
        ...productionData.data.flatMap((prod): ProductMovement[] => {
          const process =
            productionProcesses[
              prod.process as keyof typeof productionProcesses
            ];
          if (!process) return [];

          const movements: ProductMovement[] = [];

          // If this product is the output of the process
          if (process.output === selectedProduct.name) {
            movements.push({
              id: parseInt(String(prod.id)) * 2,
              product_id: selectedProduct.id,
              quantity_change: prod.quantity,
              movement_type: "production",
              created_at: prod.created_at,
              location_id: 0,
              location: { id: 0, name: "General" },
              notes: `Production: ${prod.process}, Date: ${format(
                new Date(prod.production_date),
                "PP"
              )}`,
            });
          }

          // If this product is one of the inputs of the process
          if (process.inputs.includes(selectedProduct.name)) {
            movements.push({
              id: parseInt(String(prod.id)) * 2 + 1,
              product_id: selectedProduct.id,
              quantity_change: -prod.quantity,
              movement_type: "production",
              created_at: prod.created_at,
              location_id: 0,
              location: { id: 0, name: "General" },
              notes: `Used in ${prod.process}, Date: ${format(
                new Date(prod.production_date),
                "PP"
              )}`,
            });
          }

          return movements;
        }),

        // Purchase movements
        ...purchaseData.data.map(
          (purchase): ProductMovement => ({
            id: purchase.id,
            product_id: purchase.product_id,
            quantity_change: purchase.quantity,
            movement_type: "purchase",
            created_at: purchase.created_at,
            location_id: 0,
            location: { id: 0, name: "General" },
            notes: `Purchase at ₹${purchase.price} per unit, Date: ${format(
              new Date(purchase.purchase_date),
              "PP"
            )}`,
          })
        ),

        // Wastage movements
        ...wastageData.data.map(
          (waste): ProductMovement => ({
            id: waste.id,
            product_id: waste.product_id,
            quantity_change: -waste.quantity,
            movement_type: "wastage",
            created_at: waste.created_at,
            location_id: 0,
            location: { id: 0, name: "General" },
            notes: `${
              waste.reason ? `Reason: ${waste.reason}, ` : ""
            }Date: ${format(new Date(waste.wastage_date), "PP")}`,
          })
        ),

        // Transfer movements
        ...transfersData.data.flatMap((transfer): ProductMovement[] => [
          {
            id: transfer.id * 2,
            product_id: transfer.product_id,
            quantity_change: -transfer.quantity,
            movement_type: "transfer",
            created_at: transfer.created_at,
            location_id: transfer.from_location_id,
            location: transfer.from_location,
            notes: `Transfer to ${transfer.to_location.name}${
              transfer.notes ? `: ${transfer.notes}` : ""
            }, Date: ${format(new Date(transfer.transfer_date), "PP")}`,
          },
          {
            id: transfer.id * 2 + 1,
            product_id: transfer.product_id,
            quantity_change: transfer.quantity,
            movement_type: "transfer",
            created_at: transfer.created_at,
            location_id: transfer.to_location_id,
            location: transfer.to_location,
            notes: `Transfer from ${transfer.from_location.name}${
              transfer.notes ? `: ${transfer.notes}` : ""
            }, Date: ${format(new Date(transfer.transfer_date), "PP")}`,
          },
        ]),
      ];

      // Sort by created_at in descending order
      return allMovements.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!selectedProduct,
  });

  // Mutations
  const addProduct = useMutation({
    mutationFn: async (values: z.infer<typeof productFormSchema>) => {
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: values.name,
          quantity: 0,
          category: values.category || null,
          min_stock: values.min_stock ? parseInt(values.min_stock) : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      productForm.reset();
      toast({
        title: "Product added",
        description: "The product has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Update product filtering logic
  const readyProducts = products?.filter((p) => p.stage === "ready");

  const rawProducts = products?.filter(
    (p) => p.stage === "raw" || p.stage === "intermediate"
  );

  // Get location products for a specific product
  const getLocationProductsForProduct = (productId: number) => {
    return locationProducts?.filter((lp) => lp.product_id === productId) || [];
  };

  // Event handlers
  const onProductSubmit = (values: z.infer<typeof productFormSchema>) => {
    addProduct.mutate(values);
  };

  const toggleRow = (productId: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
    setSelectedProduct(
      selectedProduct?.id === productId
        ? null
        : products?.find((p) => p.id === productId) || null
    );
  };

  // Add open state for the sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  if (productsLoading) {
    return <InventorySkeleton />;
  }

  const InventoryTable = ({ data }: { data: Product[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30px]"></TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Total Quantity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((product) => (
          <>
            <TableRow
              key={product.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => {
                toggleRow(product.id);
              }}
            >
              <TableCell>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expandedRows[product.id] && "rotate-180"
                  )}
                />
              </TableCell>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.quantity}</TableCell>
              <TableCell>
                {product.quantity < (product.min_stock || 100) ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Low Stock
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Package className="h-3 w-3" />
                    In Stock
                  </Badge>
                )}
              </TableCell>
            </TableRow>
            {expandedRows[product.id] && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Card className="bg-muted/50">
                    <CardHeader className="py-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">
                          Location Breakdown
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setSelectedLocation(null);
                            setActiveTab("location");
                            setSheetOpen(true);
                          }}
                        >
                          <History className="h-4 w-4 mr-2" />
                          View History
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="py-3">
                      <div className="grid grid-cols-2 gap-3">
                        {locationProducts
                          ?.filter((lp) => lp.product_id === product.id)
                          .map((lp) => (
                            <div
                              key={lp.location_id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(product);
                                setSelectedLocation(lp.location_id);
                                setActiveTab("location");
                                setSheetOpen(true);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {lp.location.name}
                                </span>
                              </div>
                              <Badge variant="secondary">
                                {lp.quantity} units
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">
          Inventory Management
        </h1>
        <p className="text-muted-foreground">
          Track and manage your product inventory
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Ready Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readyProducts?.reduce((sum, p) => sum + p.quantity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {readyProducts?.length} different products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Raw Materials
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rawProducts?.reduce((sum, p) => sum + p.quantity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {rawProducts?.length} different materials
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Items
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                products?.filter((p) => p.quantity < (p.min_stock || 100))
                  .length
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Items below minimum stock level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Locations
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locationProducts
                ? new Set(locationProducts.map((lp) => lp.location_id)).size
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active storage locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="ready" className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="ready">Ready Products</TabsTrigger>
            <TabsTrigger value="raw">Raw Materials</TabsTrigger>
          </TabsList>
          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add New Product</SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <Form {...productForm}>
                  <form
                    onSubmit={productForm.handleSubmit(onProductSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={productForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter product name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={productForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter product category"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={productForm.control}
                      name="min_stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Stock Level</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Enter minimum stock level"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      Add Product
                    </Button>
                  </form>
                </Form>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <TabsContent value="ready">
          <Card>
            <CardContent className="p-6">
              <InventoryTable data={readyProducts || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardContent className="p-6">
              <InventoryTable data={rawProducts || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Details Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl">
          {selectedProduct && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedProduct.name}
                  {activeTab === "location" && selectedLocation && (
                    <span className="text-muted-foreground">
                      {" @ "}
                      {
                        locationProducts?.find(
                          (lp) => lp.location_id === selectedLocation
                        )?.location.name
                      }
                    </span>
                  )}
                </SheetTitle>
              </SheetHeader>
              <Tabs
                value={activeTab}
                className="mt-4"
                onValueChange={(value) => {
                  if (value === "ledger" || value === "location") {
                    setActiveTab(value as "ledger" | "location");
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ledger">Item Ledger</TabsTrigger>
                  <TabsTrigger value="location">Location Ledger</TabsTrigger>
                </TabsList>
                <TabsContent value="ledger" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">
                        Total Stock Movements
                      </h3>
                      <Badge variant="outline">
                        Current Stock: {selectedProduct.quantity}
                      </Badge>
                    </div>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {productMovements
                        ?.filter(
                          (m) =>
                            // Only show movements that affect total stock
                            m.movement_type !== "transfer"
                        )
                        .map((movement) => (
                          <div
                            key={movement.id}
                            className="flex items-center justify-between bg-background p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "gap-1",
                                  movementTypeColors[movement.movement_type].bg,
                                  movementTypeColors[movement.movement_type]
                                    .text
                                )}
                              >
                                {movement.quantity_change > 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {movement.movement_type}
                              </Badge>
                              <div>
                                {movement.notes && (
                                  <p className="text-xs text-muted-foreground">
                                    {movement.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {movement.quantity_change > 0 ? "+" : ""}
                                {movement.quantity_change} units
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(movement.created_at), "PPp")}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="location" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">
                        Location Movement History
                      </h3>
                      <Badge variant="outline">
                        Current Stock:{" "}
                        {selectedLocation
                          ? locationProducts?.find(
                              (lp) =>
                                lp.product_id === selectedProduct.id &&
                                lp.location_id === selectedLocation
                            )?.quantity || 0
                          : "Select a location"}
                      </Badge>
                    </div>
                    {/* Location selector */}
                    <div className="grid grid-cols-2 gap-2">
                      {locationProducts
                        ?.filter((lp) => lp.product_id === selectedProduct.id)
                        .map((lp) => (
                          <Button
                            key={lp.location_id}
                            variant={
                              selectedLocation === lp.location_id
                                ? "default"
                                : "outline"
                            }
                            className="w-full"
                            onClick={() => setSelectedLocation(lp.location_id)}
                          >
                            {lp.location.name}
                          </Button>
                        ))}
                    </div>
                    {selectedLocation ? (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {productMovements
                          ?.filter((m) => {
                            if (m.movement_type === "transfer") {
                              // For transfers, show if this location is either source or destination
                              return m.location_id === selectedLocation;
                            } else {
                              // For other movements, show only if they happened at this location
                              return m.location_id === selectedLocation;
                            }
                          })
                          .map((movement) => (
                            <div
                              key={movement.id}
                              className="flex items-center justify-between bg-background p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "gap-1",
                                    movementTypeColors[movement.movement_type]
                                      .bg,
                                    movementTypeColors[movement.movement_type]
                                      .text
                                  )}
                                >
                                  {movement.quantity_change > 0 ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )}
                                  {movement.movement_type}
                                </Badge>
                                <div>
                                  {movement.notes && (
                                    <p className="text-xs text-muted-foreground">
                                      {movement.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  {movement.quantity_change > 0 ? "+" : ""}
                                  {movement.quantity_change} units
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(movement.created_at), "PPp")}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        Select a location to view its movement history
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
