-- Add cost (purchase price) columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_per_bottle numeric,
ADD COLUMN IF NOT EXISTS cost_half_case numeric,
ADD COLUMN IF NOT EXISTS cost_full_case numeric;

-- Update existing columns to be more explicit about being sale prices
COMMENT ON COLUMN public.products.price_per_bottle IS 'Prix de vente par bouteille';
COMMENT ON COLUMN public.products.price_half_case IS 'Prix de vente demi-caisse';
COMMENT ON COLUMN public.products.price_full_case IS 'Prix de vente caisse complète';
COMMENT ON COLUMN public.products.cost_per_bottle IS 'Prix d''achat par bouteille';
COMMENT ON COLUMN public.products.cost_half_case IS 'Prix d''achat demi-caisse';
COMMENT ON COLUMN public.products.cost_full_case IS 'Prix d''achat caisse complète';
COMMENT ON COLUMN public.products.bottles_per_case IS 'Nombre de bouteilles par caisse (12, 20, ou 24)';