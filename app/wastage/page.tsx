'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from 'lucide-react'

export default function Wastage() {
  const [wastage, setWastage] = useState({ item: '', quantity: '', reason: '', date: new Date().toISOString().split('T')[0] })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { item, quantity, reason, date } = wastage
    const quantityNum = parseInt(quantity)

    if (!item || isNaN(quantityNum) || !reason) {
      toast({
        title: "Error",
        description: "Please fill in all fields correctly",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    try {
      // Record wastage
      const { error: wastageError } = await supabase
        .from('wastage')
        .insert([
          { product_id: item, quantity: quantityNum, reason, wastage_date: date }
        ])

      if (wastageError) throw wastageError

      // Update inventory
      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: supabase.raw('quantity - ' + quantityNum) })
        .eq('id', item)

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Wastage recorded successfully",
      })
      setWastage({ item: '', quantity: '', reason: '', date: new Date().toISOString().split('T')[0] })
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record wastage. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWastage({ ...wastage, [e.target.name]: e.target.value })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Wastage</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="item">Item</Label>
          <Select onValueChange={(value) => setWastage({ ...wastage, item: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Gift Set</SelectItem>
              <SelectItem value="2">Soap (Ready)</SelectItem>
              <SelectItem value="3">Powder</SelectItem>
              <SelectItem value="4">Lotion (Ready)</SelectItem>
              <SelectItem value="5">Shampoo (Ready)</SelectItem>
              <SelectItem value="6">Soap (Wrapped)</SelectItem>
              <SelectItem value="7">Soap Boxes</SelectItem>
              <SelectItem value="8">Lotion (Unlabeled)</SelectItem>
              <SelectItem value="9">Shampoo (Unlabeled)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity Wasted</Label>
          <Input id="quantity" name="quantity" type="number" value={wastage.quantity} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Wastage</Label>
          <Input id="reason" name="reason" value={wastage.reason} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Wastage Date</Label>
          <Input id="date" name="date" type="date" value={wastage.date} onChange={handleChange} required />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Record Wastage
        </Button>
      </form>
    </div>
  )
}

