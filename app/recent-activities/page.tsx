import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// This would typically come from a database
const recentActivities = {
  purchases: [
    { id: 1, date: '2023-06-01', item: 'Soap (Wrapped)', quantity: 1000, price: 5000 },
    { id: 2, date: '2023-06-02', item: 'Shampoo (Unlabeled)', quantity: 500, price: 2500 },
    { id: 3, date: '2023-06-03', item: 'Lotion (Unlabeled)', quantity: 500, price: 2500 },
  ],
  sales: [
    { id: 1, date: '2023-06-04', quantity: 100, price: 10000 },
    { id: 2, date: '2023-06-05', quantity: 50, price: 5000 },
    { id: 3, date: '2023-06-06', quantity: 75, price: 7500 },
  ],
  production: [
    { id: 1, date: '2023-06-01', process: 'Gift Set Assembly', quantity: 200 },
    { id: 2, date: '2023-06-02', process: 'Shampoo Labeling', quantity: 300 },
    { id: 3, date: '2023-06-03', process: 'Lotion Labeling', quantity: 300 },
  ],
}

export default function RecentActivities() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Recent Activities</h1>
      
      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivities.purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{purchase.date}</TableCell>
                  <TableCell>{purchase.item}</TableCell>
                  <TableCell>{purchase.quantity}</TableCell>
                  <TableCell className="text-right">${purchase.price}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="sales">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivities.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{sale.date}</TableCell>
                  <TableCell>{sale.quantity}</TableCell>
                  <TableCell className="text-right">${sale.price}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="production">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Process</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivities.production.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell>{prod.date}</TableCell>
                  <TableCell>{prod.process}</TableCell>
                  <TableCell className="text-right">{prod.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  )
}

