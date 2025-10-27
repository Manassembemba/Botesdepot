-- Add cost_per_bottle column to products table
-- This fixes the 0 values in profit and cost calculations in Historique

-- Add cost_per_bottle column to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_per_bottle numeric(12,2);

-- Update existing products with a default cost (can be adjusted later)
-- Default cost is set to 80% of price_per_bottle for demonstration
UPDATE public.products
SET cost_per_bottle = price_per_bottle * 0.8
WHERE cost_per_bottle IS NULL;

-- Make cost_per_bottle NOT NULL after setting default values
ALTER TABLE public.products
ALTER COLUMN cost_per_bottle SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.cost_per_bottle IS 'Cost price per bottle for profit calculations';
