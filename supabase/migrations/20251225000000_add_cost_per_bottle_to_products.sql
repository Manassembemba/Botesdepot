-- Add cost_per_bottle column to products table
-- This is needed for profit calculations in the Historique page

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_per_bottle numeric(12,2);

-- Add comment for documentation
COMMENT ON COLUMN public.products.cost_per_bottle IS 'Cost per bottle for profit calculations';

-- Update existing products with a default cost (optional - you may want to set this manually)
-- UPDATE public.products SET cost_per_bottle = price_per_bottle * 0.8 WHERE cost_per_bottle IS NULL;
