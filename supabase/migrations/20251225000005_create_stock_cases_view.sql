-- View to calculate case equivalents for stock display
-- This ensures all calculations are done in the database for consistency
CREATE OR REPLACE VIEW public.v_product_stock_with_cases AS
SELECT
  p.id,
  p.name,
  p.sku,
  p.price_per_bottle,
  p.price_half_case,
  p.price_full_case,
  p.bottles_per_case,
  p.cost_per_bottle,
  p.is_active,
  p.created_at,
  COALESCE(SUM(ls.quantity_bottles), 0) as total_stock_bottles,
  -- Calculate case equivalents
  CASE
    WHEN COALESCE(SUM(ls.quantity_bottles), 0) > 0 THEN
      FLOOR(COALESCE(SUM(ls.quantity_bottles), 0) / p.bottles_per_case)
    ELSE 0
  END as full_cases,
  CASE
    WHEN COALESCE(SUM(ls.quantity_bottles), 0) > 0 THEN
      MOD(COALESCE(SUM(ls.quantity_bottles), 0), p.bottles_per_case)
    ELSE 0
  END as remaining_bottles
FROM public.products p
LEFT JOIN public.locker_stock ls ON p.id = ls.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sku, p.price_per_bottle, p.price_half_case,
         p.price_full_case, p.bottles_per_case, p.cost_per_bottle,
         p.is_active, p.created_at;

-- Grant access to the view
GRANT SELECT ON public.v_product_stock_with_cases TO authenticated;
