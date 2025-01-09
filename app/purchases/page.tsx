'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function Purchases() {
  const [purchase, setPurchase] = useState({ item: '', quantity: '', price: '', date: new Date().toISOString().split('T')[0] })
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { item, quantity, price, date } = purchase
    const quantityNum = parseInt(quantity)
    const priceNum = parseFloat(price)

    if (!item || isNaN(quantityNum) || isNaN(priceNum)) {
      alert('Please fill in all fields correctly')
      return
    }

    const { data, error } = await supabase
      .from('purchases')
      .insert([
        { product_id: item, quantity: quantityNum, price: priceNum, purchase_date: date }
      ])

    if (error) {
      alert('Error recording purchase: ' + error.message)
    } else {
      alert('Purchase recorded successfully')
      setPurchase({ item: '', quantity: '', price: '', date: new Date().toISOString().split('T')[0] })
      router.refresh()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPurchase({ ...purchase, [e.target.name]: e.target.value })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Purchase</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="item">Item</Label>
          <Select onValueChange={(value) => setPurchase({ ...purchase, item: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Soap (Wrapped)</SelectItem>
              <SelectItem value="5">Soap Boxes</SelectItem>
              <SelectItem value="10">Shampoo (Unlabeled)</SelectItem>
              <SelectItem value="8">Lotion (Unlabeled)</SelectItem>
              <SelectItem value="7">Powder</SelectItem>
              <SelectItem value="3">Empty Thermacol</SelectItem>
              <SelectItem value="2">Gift Box Outer Cardboard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" name="quantity" type="number" value={purchase.quantity} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Total Price</Label>
          <Input id="price" name="price" type="number" step="0.01" value={purchase.price} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Purchase Date</Label>
          <Input id="date" name="date" type="date" value={purchase.date} onChange={handleChange} required />
        </div>
        <Button type="submit">Record Purchase</Button>
      </form>
    </div>
  )
}

