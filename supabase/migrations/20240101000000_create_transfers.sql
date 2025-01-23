-- Create locations table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default locations
INSERT INTO locations (name) VALUES 
    ('Factory'),
    ('Camp Office'),
    ('Shop'),
    ('Warehouse');

-- Create transfers table
CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    from_location_id INTEGER REFERENCES locations(id),
    to_location_id INTEGER REFERENCES locations(id),
    quantity INTEGER NOT NULL,
    transfer_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create function to handle transfers
CREATE OR REPLACE FUNCTION record_transfer(
    p_product_id INTEGER,
    p_from_location_id INTEGER,
    p_to_location_id INTEGER,
    p_quantity INTEGER,
    p_transfer_date DATE,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Record the transfer
    INSERT INTO transfers (
        product_id,
        from_location_id,
        to_location_id,
        quantity,
        transfer_date,
        notes
    ) VALUES (
        p_product_id,
        p_from_location_id,
        p_to_location_id,
        p_quantity,
        p_transfer_date,
        p_notes
    );

    -- Update product quantity (assuming we want to track total quantity across all locations)
    -- In this case, we don't need to update the quantity since it's just moving between locations
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql; 