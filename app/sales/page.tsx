'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from 'lucide-react'

export default function Sales() {
  const [sale, setSale] = useState({ quantity: '', price: '', date: new Date().toISOString().split('T')[0] })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { quantity, price, date } = sale
    const quantityNum = parseInt(quantity)
    const priceNum = parseFloat(price)

    if (isNaN(quantityNum) || isNaN(priceNum)) {
      toast({
        title: "Error",
        description: "Please fill in all fields correctly",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .insert([
          { quantity: quantityNum, price: priceNum, sale_date: date }
        ])

      if (error) throw error

      // Update gift set inventory
      const { data: giftSet, error: fetchError } = await supabase
        .from('products')
        .select('quantity')
        .eq('name', 'Gift Set')
        .single()

      if (fetchError) throw fetchError

      const newQuantity = giftSet.quantity - quantityNum

      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('name', 'Gift Set')

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Sale recorded successfully",
      })
      setSale({ quantity: '', price: '', date: new Date().toISOString().split('T')[0] })
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record sale. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSale({ ...sale, [e.target.name]: e.target.value })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Sale</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity of Gift Sets Sold</Label>
          <Input id="quantity" name="quantity" type="number" value={sale.quantity} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Total Sale Price</Label>
          <Input id="price" name="price" type="number" step="0.01" value={sale.price} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Sale Date</Label>
          <Input id="date" name="date" type="date" value={sale.date} onChange={handleChange} required />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Record Sale
        </Button>
      </form>
    </div>
  )
}

