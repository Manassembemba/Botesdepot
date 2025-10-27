-- TRIGGER ULTRA-SIMPLE QUI NE PEUT PAS DOUBLER
-- Remplace complètement le système complexe

-- Supprimer TOUS les triggers existants
DROP TRIGGER IF EXISTS trg_update_locker_stock_from_entry ON public.stock_entries;
DROP TRIGGER IF EXISTS fix_stock_duplication_trigger ON public.stock_entries;
DROP TRIGGER IF EXISTS manage_locker_stock_trigger ON public.stock_entries;

-- Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS public.update_locker_stock_from_entry();
DROP FUNCTION IF EXISTS public.manage_locker_stock();
DROP FUNCTION IF EXISTS public.fix_stock_duplication();

-- Fonction ultra-simple : juste ajouter la quantité
CREATE OR REPLACE FUNCTION public.simple_stock_add()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert simple avec ON CONFLICT
  INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
  VALUES (NEW.locker_id, NEW.product_id, NEW.qty_bottles, now())
  ON CONFLICT (locker_id, product_id)
  DO UPDATE SET
    quantity_bottles = locker_stock.quantity_bottles + NEW.qty_bottles,
    updated_at = now();

  -- Log pour debug (à supprimer après test)
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (NEW.received_by, 'stock_add_debug', jsonb_build_object(
    'product_id', NEW.product_id,
    'added_qty', NEW.qty_bottles,
    'new_total', (SELECT quantity_bottles FROM public.locker_stock WHERE locker_id = NEW.locker_id AND product_id = NEW.product_id)
  ));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Un seul trigger simple
CREATE TRIGGER simple_stock_add_trigger
AFTER INSERT ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.simple_stock_add();
