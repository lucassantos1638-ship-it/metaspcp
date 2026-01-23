-- Add stock columns to materiais table
ALTER TABLE materiais 
ADD COLUMN estoque_estamparia NUMERIC DEFAULT 0,
ADD COLUMN estoque_tingimento NUMERIC DEFAULT 0,
ADD COLUMN estoque_fabrica NUMERIC DEFAULT 0;
