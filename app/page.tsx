import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Gift, Package, ShoppingBag, DollarSign, TrendingUp, Activity, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies })
  
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')

    if (productsError) {
      console.error('Error fetching products:', productsError)
      throw new Error('Failed to fetch products')
    }

    const inventory = {
      giftSet: products.find(p => p.name === 'Gift Set')?.quantity || 0,
      readyProducts: {
        soap: products.find(p => p.name === 'Soap (Ready)')?.quantity || 0,
        powder: products.find(p => p.name === 'Powder')?.quantity || 0,
        lotion: products.find(p => p.name === 'Lotion (Ready)')?.quantity || 0,
        shampoo: products.find(p => p.name === 'Shampoo (Ready)')?.quantity || 0,
      },
      unfinishedProducts: {
        soap: { 
          wrapped: products.find(p => p.name === 'Soap (Wrapped)')?.quantity || 0,
          emptyBoxes: products.find(p => p.name === 'Soap Boxes')?.quantity || 0
        },
        lotion: { 
          filledUnlabeled: products.find(p => p.name === 'Lotion (Unlabeled)')?.quantity || 0
        },
        shampoo: { 
          filledUnlabeled: products.find(p => p.name === 'Shampoo (Unlabeled)')?.quantity || 0
        }
      }
    }

    // Fetch summary data
    const { data: salesData } = await supabase
      .from('sales')
      .select('price, sale_date')
    
    const { data: purchasesData } = await supabase
      .from('purchases')
      .select('price, purchase_date')

    const { data: productionData } = await supabase
      .from('production')
      .select('quantity, production_date')

    const { data: wastageData } = await supabase
      .from('wastage')
      .select('quantity, wastage_date')

    const summary = {
      totalPurchases: purchasesData?.reduce((sum, p) => sum + p.price, 0) || 0,
      totalSales: salesData?.reduce((sum, s) => sum + s.price, 0) || 0,
      productionToday: productionData?.filter(p => p.production_date === new Date().toISOString().split('T')[0]).reduce((sum, p) => sum + p.quantity, 0) || 0,
      wastageToday: wastageData?.filter(w => w.wastage_date === new Date().toISOString().split('T')[0]).reduce((sum, w) => sum + w.quantity, 0) || 0
    }

    const readyGiftSets = inventory.giftSet
    const potentialGiftSets = Math.min(
      inventory.readyProducts.soap,
      inventory.readyProducts.powder,
      inventory.readyProducts.lotion,
      inventory.readyProducts.shampoo,
      products.find(p => p.name === 'Gift Box Outer Cardboard')?.quantity || 0,
      products.find(p => p.name === 'Empty Thermacol')?.quantity || 0
    )

    // Prepare data for charts
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    const salesChartData = last7Days.map(date => ({
      date,
      sales: salesData?.filter(s => s.sale_date === date).reduce((sum, s) => sum + s.price, 0) || 0
    }))

    const productionChartData = last7Days.map(date => ({
      date,
      production: productionData?.filter(p => p.production_date === date).reduce((sum, p) => sum + p.quantity, 0) || 0
    }))

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-primary">Nikka Nikki Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-pink-500 to-rose-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gift Sets</CardTitle>
              <Gift className="h-4 w-4 text-pink-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{readyGiftSets}</div>
              <p className="text-xs text-pink-200">Ready to sell</p>
              <Progress className="mt-2" value={(readyGiftSets / 1000) * 100} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Potential Gift Sets</CardTitle>
              <Package className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{potentialGiftSets}</div>
              <p className="text-xs text-purple-200">Can be assembled</p>
              <Progress className="mt-2" value={(potentialGiftSets / 1000) * 100} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Production</CardTitle>
              <Activity className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.productionToday}</div>
              <p className="text-xs text-blue-200">Gift sets assembled today</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Wastage</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.wastageToday}</div>
              <p className="text-xs text-yellow-200">Items wasted today</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 row-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-primary">Ready Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(inventory.readyProducts).map(([product, count]) => (
                  <div key={product} className="flex items-center space-x-2 bg-secondary/10 p-3 rounded-lg">
                    <ShoppingBag className="h-5 w-5 text-secondary" />
                    <div>
                      <p className="text-sm font-medium capitalize">{product}</p>
                      <p className="text-xl font-bold text-primary">{count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-primary">Unfinished Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {Object.entries(inventory.unfinishedProducts).map(([product, details]) => (
                  <li key={product} className="flex justify-between items-center bg-secondary/10 p-2 rounded">
                    <span className="capitalize text-sm">{product}</span>
                    <span className="font-bold text-primary">{Object.values(details)[0]}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Financial Summary</CardTitle>
              <DollarSign className="h-4 w-4 text-green-200" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-green-200">Total Sales</p>
                  <p className="text-lg font-bold">${summary.totalSales.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-200" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-green-200">Profit</p>
                <p className="text-lg font-bold">${(summary.totalSales - summary.totalPurchases).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="production" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in Dashboard:', error)
    return <div>Error loading dashboard. Please try again later.</div>
  }
}

