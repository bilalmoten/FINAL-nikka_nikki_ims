"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, AlertTriangle, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function InventorySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-[250px] mb-2" />
        <Skeleton className="h-4 w-[350px]" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-[200px]" />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Skeleton className="h-[125px]" />
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="p-4">
            <Skeleton className="h-8 w-[200px] mb-4" />
            <div className="space-y-3">
              {Array(5)
                .fill(null)
                .map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-6 w-[100px]" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { products, productsLoading } = useDashboardQuery();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  if (productsLoading) {
    return <InventorySkeleton />;
  }

  const readyProducts = products?.filter(
    (p) =>
      p.name.includes("Ready") ||
      p.name === "Gift Set" ||
      (!p.name.includes("Unlabeled") &&
        !p.name.includes("Wrapped") &&
        !p.name.includes("Boxes") &&
        !p.name.includes("Thermacol") &&
        !p.name.includes("Cardboard"))
  );

  const rawProducts = products?.filter(
    (p) =>
      p.name.includes("Unlabeled") ||
      p.name.includes("Wrapped") ||
      p.name.includes("Boxes") ||
      p.name.includes("Thermacol") ||
      p.name.includes("Cardboard")
  );

  const sortProducts = (productsToSort: typeof products) => {
    return [...(productsToSort || [])].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  const sortedReadyProducts = sortProducts(readyProducts);
  const sortedRawProducts = sortProducts(rawProducts);

  const InventoryTable = ({ data }: { data: typeof products }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() =>
                setSortOrder((current) => (current === "asc" ? "desc" : "asc"))
              }
              className="flex items-center gap-1"
            >
              Product
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell>{product.quantity}</TableCell>
            <TableCell>
              {product.quantity < 100 ? (
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

      <Tabs defaultValue="ready" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ready">Ready Products</TabsTrigger>
          <TabsTrigger value="raw">Raw Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-4">
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ready Products Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryTable data={sortedReadyProducts || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Raw Materials Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryTable data={sortedRawProducts || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
