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
            locations: {
                Row: {
                    id: number
                    name: string
                    address: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    name: string
                    address?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    name?: string
                    address?: string | null
                    created_at?: string | null
                }
            }
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
                    invoice_number: string
                    buyer_name: string
                    contact_no: string | null
                    sale_date: string
                    bill_discount_percentage: number | null
                    bill_discount_amount: number | null
                    total_amount: number
                    final_amount: number
                    notes: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    invoice_number: string
                    buyer_name: string
                    contact_no?: string | null
                    sale_date: string
                    bill_discount_percentage?: number | null
                    bill_discount_amount?: number | null
                    total_amount: number
                    final_amount: number
                    notes?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    invoice_number?: string
                    buyer_name?: string
                    contact_no?: string | null
                    sale_date?: string
                    bill_discount_percentage?: number | null
                    bill_discount_amount?: number | null
                    total_amount?: number
                    final_amount?: number
                    notes?: string | null
                    created_at?: string | null
                }
            }
            sale_items: {
                Row: {
                    id: number
                    sale_id: number
                    product_id: number
                    quantity: number
                    price_per_unit: number
                    trade_scheme: string | null
                    discount_percentage: number | null
                    discount_amount: number | null
                    total_price: number
                    final_price: number
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    sale_id: number
                    product_id: number
                    quantity: number
                    price_per_unit: number
                    trade_scheme?: string | null
                    discount_percentage?: number | null
                    discount_amount?: number | null
                    total_price: number
                    final_price: number
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    sale_id?: number
                    product_id?: number
                    quantity?: number
                    price_per_unit?: number
                    trade_scheme?: string | null
                    discount_percentage?: number | null
                    discount_amount?: number | null
                    total_price?: number
                    final_price?: number
                    created_at?: string | null
                }
            }
            transfers: {
                Row: {
                    id: number
                    product_id: number
                    from_location_id: number
                    to_location_id: number
                    quantity: number
                    transfer_date: string
                    notes: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    product_id: number
                    from_location_id: number
                    to_location_id: number
                    quantity: number
                    transfer_date: string
                    notes?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    product_id?: number
                    from_location_id?: number
                    to_location_id?: number
                    quantity?: number
                    transfer_date?: string
                    notes?: string | null
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
            record_transfer: {
                Args: {
                    p_product_id: number
                    p_from_location_id: number
                    p_to_location_id: number
                    p_quantity: number
                    p_transfer_date: string
                    p_notes?: string
                }
                Returns: boolean
            }
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