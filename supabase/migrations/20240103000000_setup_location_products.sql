-- Create location_products table
CREATE TABLE location_products (
    location_id INTEGER REFERENCES locations(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (location_id, product_id)
);

-- Initialize location_products with existing transfer data
WITH other_locations_stock AS (
    -- First calculate stock for non-factory locations
    SELECT 
        l.id as location_id,
        p.id as product_id,
        COALESCE(
            SUM(CASE 
                WHEN t.to_location_id = l.id THEN t.quantity
                WHEN t.from_location_id = l.id THEN -t.quantity
                ELSE 0
            END),
            0
        ) as quantity
    FROM locations l
    CROSS JOIN products p
    LEFT JOIN transfers t 
        ON (t.to_location_id = l.id OR t.from_location_id = l.id)
        AND t.product_id = p.id
    WHERE l.name != 'Factory'
    GROUP BY l.id, p.id
)
INSERT INTO location_products (location_id, product_id, quantity)
SELECT 
    l.id as location_id,
    p.id as product_id,
    CASE 
        WHEN l.name = 'Factory' THEN 
            -- For Factory: total product quantity minus sum of other locations
            p.quantity - COALESCE((
                SELECT SUM(quantity)
                FROM other_locations_stock
                WHERE product_id = p.id
            ), 0)
        ELSE 
            -- For other locations: use the calculated transfer-based quantity
            COALESCE((
                SELECT quantity 
                FROM other_locations_stock 
                WHERE location_id = l.id AND product_id = p.id
            ), 0)
    END as quantity
FROM locations l
CROSS JOIN products p;

-- Create function to update location quantities
CREATE OR REPLACE FUNCTION update_location_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- For transfers from Factory, just decrease Factory quantity
    IF NEW.from_location_id = (SELECT id FROM locations WHERE name = 'Factory' LIMIT 1) THEN
        UPDATE location_products 
        SET quantity = quantity - NEW.quantity
        WHERE location_id = NEW.from_location_id 
        AND product_id = NEW.product_id;
    -- For transfers to Factory, just increase Factory quantity
    ELSIF NEW.to_location_id = (SELECT id FROM locations WHERE name = 'Factory' LIMIT 1) THEN
        UPDATE location_products 
        SET quantity = quantity + NEW.quantity
        WHERE location_id = NEW.to_location_id 
        AND product_id = NEW.product_id;
    -- For transfers between other locations
    ELSE
        -- Decrease quantity at source location
        UPDATE location_products 
        SET quantity = quantity - NEW.quantity
        WHERE location_id = NEW.from_location_id 
        AND product_id = NEW.product_id;

        -- Increase quantity at destination location
        INSERT INTO location_products (location_id, product_id, quantity)
        VALUES (NEW.to_location_id, NEW.product_id, NEW.quantity)
        ON CONFLICT (location_id, product_id) 
        DO UPDATE SET quantity = location_products.quantity + NEW.quantity;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transfers
CREATE TRIGGER after_transfer_insert
AFTER INSERT ON transfers
FOR EACH ROW
EXECUTE FUNCTION update_location_quantities();

-- Create a function to handle purchases (automatically assign to factory)
CREATE OR REPLACE FUNCTION handle_purchase()
RETURNS TRIGGER AS $$
DECLARE
    factory_id INTEGER;
BEGIN
    -- Get the factory location id
    SELECT id INTO factory_id FROM locations WHERE name = 'Factory' LIMIT 1;
    
    -- Update or insert into location_products for the factory
    INSERT INTO location_products (location_id, product_id, quantity)
    VALUES (factory_id, NEW.id, NEW.quantity)
    ON CONFLICT (location_id, product_id) 
    DO UPDATE SET quantity = location_products.quantity + NEW.quantity;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new purchases
CREATE TRIGGER after_product_insert_or_update
AFTER INSERT OR UPDATE OF quantity ON products
FOR EACH ROW
EXECUTE FUNCTION handle_purchase(); 