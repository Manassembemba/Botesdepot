-- Fix the disconnect between stock_entries and locker_stock
-- This fixes the "Aucun stock trouvé pour ce casier/produit" error

-- Create a trigger function to update locker_stock when stock_entries are inserted
CREATE OR REPLACE FUNCTION public.update_locker_stock_from_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple insert or update: if exists, add to current stock
  INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
  VALUES (NEW.locker_id, NEW.product_id, NEW.qty_bottles, now())
  ON CONFLICT (locker_id, product_id)
  DO UPDATE SET
    quantity_bottles = locker_stock.quantity_bottles + NEW.qty_bottles,
    updated_at = now();

  -- Log the stock entry in audit_logs
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (NEW.received_by, 'stock_entry', jsonb_build_object(
    'product_id', NEW.product_id,
    'locker_id', NEW.locker_id,
    'qty_bottles', NEW.qty_bottles,
    'supplier', NEW.supplier,
    'unit_cost', NEW.unit_cost
  ));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER trg_update_locker_stock_from_entry
AFTER INSERT ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_locker_stock_from_entry();

-- Also create a trigger for deletes only (no UPDATE trigger to avoid duplication)
CREATE OR REPLACE FUNCTION public.handle_stock_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- For deletes (should be very rare)
  IF TG_OP = 'DELETE' THEN
    -- Recalculate the stock for this locker/product combination
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

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for deletes only
CREATE TRIGGER trg_handle_stock_entry_deletes
AFTER DELETE ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_entry_changes();

-- Update RLS policies for stock_entries to allow the trigger to work
-- The trigger runs with SECURITY DEFINER, so it bypasses RLS, but let's make sure
DROP POLICY IF EXISTS "Admin/magasinier can create stock entries" ON public.stock_entries;
CREATE POLICY "Admin/magasinier can manage stock entries" ON public.stock_entries
FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'magasinier')
);
