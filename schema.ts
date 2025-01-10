export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            products: {
                Row: {
                    id: number
                    name: string
                    quantity: number
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    name: string
                    quantity: number
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    name?: string
                    quantity?: number
                    created_at?: string | null
                }
            }
            sales: {
                Row: {
                    id: number
                    product_id: number
                    quantity: number
                    price: number
                    sale_date: string
                    created_at: string | null
                    buyer_name: string
                    contact_no: string | null
                    price_per_unit: number
                    total_price: number
                    discount_percentage: number | null
                    discount_amount: number | null
                    final_price: number
                    notes: string | null
                }
                Insert: {
                    id?: number
                    product_id: number
                    quantity: number
                    price: number
                    sale_date: string
                    created_at?: string | null
                    buyer_name: string
                    contact_no?: string | null
                    price_per_unit: number
                    total_price: number
                    discount_percentage?: number | null
                    discount_amount?: number | null
                    final_price: number
                    notes?: string | null
                }
                Update: {
                    id?: number
                    product_id?: number
                    quantity?: number
                    price?: number
                    sale_date?: string
                    created_at?: string | null
                    buyer_name?: string
                    contact_no?: string | null
                    price_per_unit?: number
                    total_price?: number
                    discount_percentage?: number | null
                    discount_amount?: number | null
                    final_price?: number
                    notes?: string | null
                }
            }
            production: {
                Row: {
                    id: number
                    process: string
                    quantity: number
                    production_date: string
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    process: string
                    quantity: number
                    production_date: string
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    process?: string
                    quantity?: number
                    production_date?: string
                    created_at?: string | null
                }
            }
            wastage: {
                Row: {
                    id: number
                    product_id: number
                    quantity: number
                    wastage_date: string
                    reason: string
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    product_id: number
                    quantity: number
                    wastage_date: string
                    reason: string
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    product_id?: number
                    quantity?: number
                    wastage_date?: string
                    reason?: string
                    created_at?: string | null
                }
            }
        }
        Functions: {
            update_product_quantity: {
                Args: {
                    p_id: number
                    qty: number
                }
                Returns: boolean
            }
        }
    }
} 