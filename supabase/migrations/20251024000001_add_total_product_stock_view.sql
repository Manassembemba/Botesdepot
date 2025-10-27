-- Vue pour agréger le stock total par produit
CREATE OR REPLACE VIEW public.v_total_product_stock
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  COALESCE(SUM(ls.quantity_bottles), 0) AS total_stock_bottles
FROM public.products p
LEFT JOIN public.locker_stock ls ON p.id = ls.product_id
GROUP BY p.id, p.name;
