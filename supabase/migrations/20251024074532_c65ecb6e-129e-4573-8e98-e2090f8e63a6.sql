-- Corriger le search_path de la fonction generate_product_sku
CREATE OR REPLACE FUNCTION public.generate_product_sku()
RETURNS TRIGGER AS $$
BEGIN
  -- Générer un SKU au format PRD-XXXXX où XXXXX est l'ID avec padding
  NEW.sku := 'PRD-' || LPAD(NEW.id::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';