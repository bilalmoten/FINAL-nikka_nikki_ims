# Nikka Nikki IMS Database Schema

## Tables

### 1. Products

- `id` (integer, PK): Auto-incrementing product ID
- `name` (varchar[255]): Product name
- `stage` (USER-DEFINED): Product stage
- `quantity` (integer): Total quantity (default: 0)
- `created_at` (timestamp): Creation timestamp
- `updated_at` (timestamp): Last update timestamp

### 2. Locations

- `id` (integer, PK): Auto-incrementing location ID
- `name` (varchar[255]): Location name
- `address` (text): Optional location address
- `created_at` (timestamp): Creation timestamp

### 3. Location Products

- `location_id` (integer, FK): Reference to locations
- `product_id` (integer, FK): Reference to products
- `quantity` (integer): Quantity at location (default: 0)
- `last_updated` (timestamp): Last update timestamp

### 4. Sales

- `id` (bigint, PK): Sale ID
- `invoice_number` (text): Unique invoice number
- `buyer_name` (text): Customer name
- `contact_no` (text): Optional contact number
- `sale_date` (date): Date of sale
- `bill_discount_percentage` (numeric): Optional percentage discount
- `bill_discount_amount` (numeric): Optional fixed discount
- `total_amount` (numeric): Total before discounts
- `final_amount` (numeric): Final amount after discounts
- `notes` (text): Optional notes
- `created_at` (timestamp): Creation timestamp
- `credit_sale` (boolean): Whether it's a credit sale (default: false)
- `customer_id` (bigint, FK): Reference to customers
- `payment_received` (numeric): Amount received (default: 0)

### 5. Sale Items

- `id` (bigint, PK): Sale item ID
- `sale_id` (bigint, FK): Reference to sales
- `product_id` (bigint, FK): Reference to products
- `quantity` (integer): Quantity sold
- `price_per_unit` (numeric): Unit price
- `trade_scheme` (text): Optional trade scheme
- `discount_percentage` (numeric): Optional percentage discount
- `discount_amount` (numeric): Optional fixed discount
- `total_price` (numeric): Total before discounts
- `final_price` (numeric): Final price after discounts
- `created_at` (timestamp): Creation timestamp
- `location_id` (integer, FK): Reference to locations

### 6. Transfers

- `id` (integer, PK): Transfer ID
- `product_id` (integer, FK): Reference to products
- `from_location_id` (integer, FK): Source location
- `to_location_id` (integer, FK): Destination location
- `quantity` (integer): Transfer quantity
- `transfer_date` (date): Date of transfer
- `notes` (text): Optional notes
- `created_at` (timestamp): Creation timestamp

### 7. Production

- `id` (integer, PK): Production ID
- `process` (varchar[255]): Production process
- `quantity` (integer): Quantity produced
- `production_date` (date): Date of production
- `created_at` (timestamp): Creation timestamp

### 8. Purchases

- `id` (integer, PK): Purchase ID
- `product_id` (integer, FK): Reference to products
- `quantity` (integer): Purchase quantity
- `price` (numeric): Purchase price
- `purchase_date` (date): Date of purchase
- `product_name` (text): Product name reference
- `created_at` (timestamp): Creation timestamp

### 9. Wastage

- `id` (integer, PK): Wastage ID
- `product_id` (integer, FK): Reference to products
- `quantity` (integer): Wastage quantity
- `wastage_date` (date): Date of wastage
- `reason` (varchar[255]): Optional reason
- `created_at` (timestamp): Creation timestamp

### 10. Customers

- `id` (bigint, PK): Customer ID
- `name` (text): Customer name
- `phone` (text): Optional phone number
- `address` (text): Optional address
- `total_sales` (numeric): Total sales amount (default: 0)
- `total_payments` (numeric): Total payments received (default: 0)
- `current_balance` (numeric): Current balance (default: 0)
- `created_at` (timestamp): Creation timestamp
- `updated_at` (timestamp): Last update timestamp

### 11. Payments

- `id` (bigint, PK): Payment ID
- `customer_id` (bigint, FK): Reference to customers
- `sale_id` (bigint, FK): Optional reference to sales
- `amount` (numeric): Payment amount
- `payment_date` (date): Date of payment
- `payment_type` (text): Type of payment
- `payment_method` (text): Optional payment method
- `reference_no` (text): Optional reference number
- `notes` (text): Optional notes
- `created_at` (timestamp): Creation timestamp

## Functions and Triggers

### Stock Management

1. `update_location_quantities()`: Trigger function for location stock updates
2. `update_product_quantity(p_id bigint, qty integer)`: Updates product quantities
3. `update_timestamp()`: Trigger for timestamp updates
4. `update_location_quantity(p_product_id int, p_location_id int, p_quantity int)`: Updates location-specific quantities

### Transaction Management

1. `record_transfer(p_product_id int, p_from_location_id int, p_to_location_id int, p_quantity int, p_transfer_date date, p_notes text)`: Records product transfers
2. `record_production(p_process text, p_quantity int, p_production_date date)`: Records production entries
3. `handle_purchase()`: Trigger for purchase processing

### Customer Management

1. `update_customer_on_sale()`: Trigger to update customer balances after sales
2. `update_customer_on_payment()`: Trigger to update customer balances after payments

### Reversal Functions

1. `reverse_sale(sale_id int)`: Reverses a sale transaction
2. `reverse_transfer(transfer_id int)`: Reverses a transfer
3. `reverse_production(production_id int)`: Reverses a production entry
4. `reverse_wastage(wastage_id int)`: Reverses a wastage entry
