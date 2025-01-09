import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gift, Package, Droplet, Wind, Zap } from 'lucide-react'

// This would typically come from a database
const inventory = {
  giftSet: {
    readyInCartons: 800,
    outerCardboard: 214,
    emptyThermacol: 98
  },
  soap: {
    wrapped: 92,
    emptyBoxes: 48,
    ready: 73
  },
  powder: {
    ready: 939
  },
  lotion: {
    filledUnlabeled: 747,
    ready: 292
  },
  shampoo: {
    filledUnlabeled: 928,
    ready: 913
  }
}

const productIcons = {
  giftSet: Gift,
  soap: Droplet,
  powder: Wind,
  lotion: Droplet,
  shampoo: Zap
}

export default function DetailedInventory() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Detailed Inventory</h1>
      
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Products</TabsTrigger>
          <TabsTrigger value="giftSet">Gift Set</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(inventory).map(([product, stages]) => {
              const Icon = productIcons[product as keyof typeof productIcons]
              return (
                <Card key={product} className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    <CardTitle className="flex items-center space-x-2">
                      <Icon className="h-5 w-5" />
                      <span className="capitalize">{product}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {Object.entries(stages).map(([stage, quantity]) => (
                          <TableRow key={`${product}-${stage}`}>
                            <TableCell className="font-medium capitalize">{stage}</TableCell>
                            <TableCell className="text-right">{quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
        <TabsContent value="giftSet">
          <Card>
            <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
              <CardTitle className="flex items-center space-x-2">
                <Gift className="h-5 w-5" />
                <span>Gift Set Components</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(inventory.giftSet).map(([component, quantity]) => (
                    <TableRow key={component}>
                      <TableCell className="font-medium capitalize">{component}</TableCell>
                      <TableCell className="text-right">{quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="components">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(inventory).filter(([product]) => product !== 'giftSet').map(([product, stages]) => {
              const Icon = productIcons[product as keyof typeof productIcons]
              return (
                <Card key={product}>
                  <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                    <CardTitle className="flex items-center space-x-2">
                      <Icon className="h-5 w-5" />
                      <span className="capitalize">{product}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stage</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(stages).map(([stage, quantity]) => (
                          <TableRow key={`${product}-${stage}`}>
                            <TableCell className="font-medium capitalize">{stage}</TableCell>
                            <TableCell className="text-right">{quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

