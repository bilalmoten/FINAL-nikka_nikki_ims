-- Function to reverse a sale
CREATE OR REPLACE FUNCTION reverse_sale(p_sale_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    sale_item RECORD;
BEGIN
    -- Get all items in the sale and reverse their quantities
    FOR sale_item IN (
        SELECT product_id, quantity
        FROM sale_items
        WHERE sale_id = p_sale_id
    ) LOOP
        -- Add the quantities back to inventory
        PERFORM update_product_quantity(sale_item.product_id, sale_item.quantity);
    END LOOP;

    -- Delete the sale items
    DELETE FROM sale_items WHERE sale_id = p_sale_id;
    
    -- Delete the sale
    DELETE FROM sales WHERE id = p_sale_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reverse a production process
CREATE OR REPLACE FUNCTION reverse_production(p_production_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    prod_record RECORD;
BEGIN
    -- Get the production record
    SELECT * INTO prod_record FROM production WHERE id = p_production_id;
    
    -- Reverse different production processes
    CASE prod_record.process
        WHEN 'soap_boxing' THEN
            -- Decrease Ready Soap
            UPDATE products 
            SET quantity = quantity - prod_record.quantity 
            WHERE name = 'Soap (Ready)';
            
            -- Increase Wrapped Soap and Empty Boxes
            UPDATE products 
            SET quantity = quantity + prod_record.quantity 
            WHERE name = 'Soap (Wrapped)';
            
            UPDATE products 
            SET quantity = quantity + prod_record.quantity 
            WHERE name = 'Soap Boxes';

        WHEN 'shampoo_labeling' THEN
            -- Decrease Ready Shampoo
            UPDATE products 
            SET quantity = quantity - prod_record.quantity 
            WHERE name = 'Shampoo (Ready)';
            
            -- Increase Unlabeled Shampoo
            UPDATE products 
            SET quantity = quantity + prod_record.quantity 
            WHERE name = 'Shampoo (Unlabeled)';

        WHEN 'lotion_labeling' THEN
            -- Decrease Ready Lotion
            UPDATE products 
            SET quantity = quantity - prod_record.quantity 
            WHERE name = 'Lotion (Ready)';
            
            -- Increase Unlabeled Lotion
            UPDATE products 
            SET quantity = quantity + prod_record.quantity 
            WHERE name = 'Lotion (Unlabeled)';

        WHEN 'gift_set_assembly' THEN
            -- Decrease Gift Sets
            UPDATE products 
            SET quantity = quantity - prod_record.quantity 
            WHERE name = 'Gift Set';
            
            -- Increase components
            UPDATE products 
            SET quantity = quantity + prod_record.quantity 
            WHERE name IN (
                'Soap (Ready)', 
                'Shampoo (Ready)', 
                'Lotion (Ready)', 
                'Powder',
                'Gift Box Outer Cardboard',
                'Empty Thermacol'
            );
    END CASE;

    -- Delete the production record
    DELETE FROM production WHERE id = p_production_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reverse a transfer
CREATE OR REPLACE FUNCTION reverse_transfer(p_transfer_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Delete the transfer record
    -- Since we're tracking location-based inventory through transfers,
    -- just deleting the transfer is sufficient
    DELETE FROM transfers WHERE id = p_transfer_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reverse wastage
CREATE OR REPLACE FUNCTION reverse_wastage(p_wastage_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    wastage_record RECORD;
BEGIN
    -- Get the wastage record
    SELECT * INTO wastage_record FROM wastage WHERE id = p_wastage_id;
    
    -- Add the quantity back to inventory
    PERFORM update_product_quantity(
        wastage_record.product_id,
        wastage_record.quantity
    );

    -- Delete the wastage record
    DELETE FROM wastage WHERE id = p_wastage_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql; 