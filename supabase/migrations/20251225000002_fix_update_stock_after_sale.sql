-- Fix update_stock_after_sale function to create stock automatically
-- This fixes the "Aucun stock trouvé pour ce casier/produit" error

-- Update the update_stock_after_sale function to create stock automatically if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_stock_after_sale(
  locker bigint,
  product bigint,
  qty_bottles int
) RETURNS void AS $$
DECLARE
  current_qty int;
BEGIN
  SELECT quantity_bottles INTO current_qty
  FROM public.locker_stock
  WHERE locker_id = locker AND product_id = product;

  IF current_qty IS NULL THEN
    -- Créer automatiquement une entrée de stock si elle n'existe pas
    INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles)
    VALUES (locker, product, 0);
    current_qty := 0;
  END IF;

  IF current_qty < qty_bottles THEN
    RAISE EXCEPTION 'Stock insuffisant (% bouteilles disponibles, % demandées)', current_qty, qty_bottles;
  END IF;

  UPDATE public.locker_stock
  SET quantity_bottles = quantity_bottles - qty_bottles,
      updated_at = now()
  WHERE locker_id = locker AND product_id = product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
