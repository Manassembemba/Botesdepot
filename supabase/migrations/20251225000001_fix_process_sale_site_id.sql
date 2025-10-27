-- Fix process_sale function to include site_id
-- This fixes the "null value in column site_id violates not-null constraint" error

-- Ultra-simple version for debugging
CREATE OR REPLACE FUNCTION public.process_sale(
  p_reference text,
  p_created_by uuid,
  p_locker_id bigint,
  p_items jsonb
)
RETURNS bigint AS $$
DECLARE
  v_sale_id bigint;
  v_site_id uuid;
  v_item record;
  v_item_count int := 0;
BEGIN
  -- Get the default site ID
  SELECT id INTO v_site_id FROM public.sites WHERE code = 'MAIN' LIMIT 1;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'Site par défaut "MAIN" introuvable';
  END IF;

  -- Create the sale with site_id
  INSERT INTO public.sales(reference, created_by, total_amount, payment_status, site_id)
  VALUES (p_reference, p_created_by, 0, 'pending', v_site_id)
  RETURNING id INTO v_sale_id;

  -- Count items for total calculation
  SELECT COUNT(*) INTO v_item_count FROM jsonb_array_elements(p_items);

  -- For now, calculate total from items without processing stock
  -- This helps debug if the issue is with stock processing or basic sale creation
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items)
      AS (product_id bigint, unit_type text, qty int, unit_price numeric)
  LOOP
    INSERT INTO public.sale_items(
      sale_id, product_id, locker_id, unit_type, unit_price, qty, qty_bottles, total_price
    ) VALUES (
      v_sale_id, v_item.product_id, p_locker_id, v_item.unit_type,
      v_item.unit_price, v_item.qty, 0, v_item.unit_price * v_item.qty
    );
  END LOOP;

  -- Update the total amount (without stock processing for now)
  UPDATE public.sales SET total_amount = (
    SELECT COALESCE(SUM(unit_price * qty), 0)
    FROM public.sale_items
    WHERE sale_id = v_sale_id
  ) WHERE id = v_sale_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
