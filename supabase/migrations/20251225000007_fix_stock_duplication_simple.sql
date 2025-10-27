-- ULTRA SIMPLE FIX for stock duplication
-- This replaces all complex triggers with a simple solution

-- Drop ALL existing triggers and functions
DROP TRIGGER IF EXISTS trg_update_locker_stock_from_entry ON public.stock_entries;
DROP TRIGGER IF EXISTS trg_handle_stock_entry_updates ON public.stock_entries;
DROP TRIGGER IF EXISTS trg_handle_stock_entry_deletes ON public.stock_entries;
DROP TRIGGER IF EXISTS simple_stock_trigger ON public.stock_entries;
DROP TRIGGER IF EXISTS recalculate_on_delete ON public.stock_entries;

DROP FUNCTION IF EXISTS public.update_locker_stock_from_entry();
DROP FUNCTION IF EXISTS public.handle_stock_entry_changes();
DROP FUNCTION IF EXISTS public.simple_stock_update();
DROP FUNCTION IF EXISTS public.recalculate_stock_on_delete();

-- Single simple function that handles everything
CREATE OR REPLACE FUNCTION public.manage_locker_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT: add the new quantity to existing stock
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
    VALUES (NEW.locker_id, NEW.product_id, NEW.qty_bottles, now())
    ON CONFLICT (locker_id, product_id)
    DO UPDATE SET
      quantity_bottles = locker_stock.quantity_bottles + NEW.qty_bottles,
      updated_at = now();
    RETURN NEW;
  END IF;

  -- For DELETE: recalculate total from all entries
  IF TG_OP = 'DELETE' THEN
    UPDATE public.locker_stock
    SET quantity_bottles = (
      SELECT COALESCE(SUM(qty_bottles), 0)
      FROM public.stock_entries
      WHERE locker_id = OLD.locker_id AND product_id = OLD.product_id
    ),
    updated_at = now()
    WHERE locker_id = OLD.locker_id AND product_id = OLD.product_id;
    RETURN OLD;
  END IF;

  -- For UPDATE: recalculate total
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.locker_stock
    SET quantity_bottles = (
      SELECT COALESCE(SUM(qty_bottles), 0)
      FROM public.stock_entries
      WHERE locker_id = NEW.locker_id AND product_id = NEW.product_id
    ),
    updated_at = now()
    WHERE locker_id = NEW.locker_id AND product_id = NEW.product_id;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Single trigger that handles all operations
CREATE TRIGGER manage_locker_stock_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.manage_locker_stock();
