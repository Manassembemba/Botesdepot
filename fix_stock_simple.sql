-- VERSION ALTERNATIVE ULTRA-SIMPLE
-- Si la première version ne marche pas, utilisez celle-ci

-- 1. Supprimer seulement les triggers problématiques
DROP TRIGGER IF EXISTS trg_update_locker_stock_from_entry ON public.stock_entries;
DROP TRIGGER IF EXISTS trg_handle_stock_entry_updates ON public.stock_entries;
DROP TRIGGER IF EXISTS trg_handle_stock_entry_deletes ON public.stock_entries;

-- 2. Créer une fonction très simple
CREATE OR REPLACE FUNCTION public.simple_add_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Just add the stock - no complex logic
  INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
  VALUES (NEW.locker_id, NEW.product_id, NEW.qty_bottles, now())
  ON CONFLICT (locker_id, product_id)
  DO UPDATE SET
    quantity_bottles = locker_stock.quantity_bottles + NEW.qty_bottles,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Un seul trigger pour INSERT seulement
CREATE TRIGGER simple_add_stock_trigger
AFTER INSERT ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.simple_add_stock();

-- 4. Message de confirmation
SELECT '✅ Version alternative appliquée - testez maintenant!' as status;
