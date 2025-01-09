CREATE OR REPLACE FUNCTION public.record_production(
  p_process TEXT,
  p_quantity INTEGER,
  p_production_date DATE
)
RETURNS VOID AS $$
BEGIN
  -- Insert the production record
  INSERT INTO production (process, quantity, production_date)
  VALUES (p_process, p_quantity, p_production_date);

  -- Update inventory based on the production process
  CASE p_process
    WHEN 'soapBoxing' THEN
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Soap (Wrapped)';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Soap Boxes';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Soap (Ready)';
    WHEN 'shampooLabeling' THEN
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Shampoo (Unlabeled)';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Shampoo (Ready)';
    WHEN 'lotionLabeling' THEN
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Lotion (Unlabeled)';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Lotion (Ready)';
    WHEN 'giftSetAssembly' THEN
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Soap (Ready)';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Shampoo (Ready)';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Lotion (Ready)';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Powder';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Gift Box Outer Cardboard';
      UPDATE products SET quantity = quantity - p_quantity WHERE name = 'Empty Thermacol';
      UPDATE products SET quantity = quantity + p_quantity WHERE name = 'Gift Set';
  END CASE;
END;
$$ LANGUAGE plpgsql;

