'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function Production() {
  const [production, setProduction] = useState({ process: '', quantity: '', date: new Date().toISOString().split('T')[0] })
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { process, quantity, date } = production
    const quantityNum = parseInt(quantity)

    if (!process || isNaN(quantityNum)) {
      alert('Please fill in all fields correctly')
      return
    }

    // Call the Supabase function
    const { data, error } = await supabase.rpc('record_production', {
      p_process: process,
      p_quantity: quantityNum,
      p_production_date: date
    })

    if (error) {
      alert('Error recording production: ' + error.message)
    } else {
      alert('Production recorded successfully')
      setProduction({ process: '', quantity: '', date: new Date().toISOString().split('T')[0] })
      router.refresh()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProduction({ ...production, [e.target.name]: e.target.value })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Production</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="process">Production Process</Label>
          <Select onValueChange={(value) => setProduction({ ...production, process: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select process" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soapBoxing">Put Soap in Boxes</SelectItem>
              <SelectItem value="shampooLabeling">Label Shampoo Bottles</SelectItem>
              <SelectItem value="lotionLabeling">Label Lotion Bottles</SelectItem>
              <SelectItem value="giftSetAssembly">Assemble Gift Sets</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity Processed</Label>
          <Input id="quantity" name="quantity" type="number" value={production.quantity} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Production Date</Label>
          <Input id="date" name="date" type="date" value={production.date} onChange={handleChange} required />
        </div>
        <Button type="submit">Record Production</Button>
      </form>
    </div>
  )
}

