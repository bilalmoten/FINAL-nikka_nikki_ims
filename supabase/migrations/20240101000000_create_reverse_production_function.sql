CREATE OR REPLACE FUNCTION public.reverse_production(production_id INTEGER)
RETURNS VOID AS $$
DECLARE
  p_process TEXT;
  p_quantity INTEGER;
BEGIN
  -- Get the production record details
  SELECT process, quantity INTO p_process, p_quantity
  FROM production
  WHERE id = production_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production record not found';
  END IF;

  -- Reverse inventory changes based on the production process
  CASE p_process
    WHEN 'soap_boxing' THEN
      -- Add back the used materials
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Soap (Wrapped)';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Soap Boxes';
      -- Remove the produced item
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Soap (Ready)';
      
    WHEN 'shampoo_labeling' THEN
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Shampoo (Unlabeled)';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Shampoo (Ready)';
      
    WHEN 'lotion_labeling' THEN
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Lotion (Unlabeled)';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Lotion (Ready)';
      
    WHEN 'gift_set_assembly' THEN
      -- Add back all the components
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Soap (Ready)';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Shampoo (Ready)';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Lotion (Ready)';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Powder';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Gift Box Outer Cardboard';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Empty Thermacol';
      -- Remove the assembled gift set
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Gift Set';
  END CASE;

  -- Delete the production record
  DELETE FROM production WHERE id = production_id;
END;
$$ LANGUAGE plpgsql; 