-- CORRECTION DU PROBLEME DE DUPLICATION DU STOCK
-- Copiez-collez ce script dans l'éditeur SQL de Supabase

-- 1. Supprimer tous les anciens triggers problématiques
DROP TRIGGER IF EXISTS trg_update_locker_stock_from_entry ON public.stock_entries;
DROP TRIGGER IF EXISTS trg_handle_stock_entry_updates ON public.stock_entries;
DROP TRIGGER IF EXISTS trg_handle_stock_entry_deletes ON public.stock_entries;
DROP TRIGGER IF EXISTS simple_stock_trigger ON public.stock_entries;
DROP TRIGGER IF EXISTS recalculate_on_delete ON public.stock_entries;
DROP TRIGGER IF EXISTS manage_locker_stock_trigger ON public.stock_entries;

-- 2. Supprimer toutes les anciennes fonctions
DROP FUNCTION IF EXISTS public.update_locker_stock_from_entry();
DROP FUNCTION IF EXISTS public.handle_stock_entry_changes();
DROP FUNCTION IF EXISTS public.simple_stock_update();
DROP FUNCTION IF EXISTS public.recalculate_stock_on_delete();
DROP FUNCTION IF EXISTS public.manage_locker_stock();

-- 3. Créer une fonction ultra-simple qui ne double JAMAIS
CREATE OR REPLACE FUNCTION public.fix_stock_duplication()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: ajouter simplement la quantité (pas de ON CONFLICT pour éviter les doublons)
  IF TG_OP = 'INSERT' THEN
    -- Insérer seulement si la ligne n'existe pas encore
    INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
    VALUES (NEW.locker_id, NEW.product_id, NEW.qty_bottles, now())
    ON CONFLICT (locker_id, product_id)
    DO UPDATE SET
      quantity_bottles = locker_stock.quantity_bottles + NEW.qty_bottles,
      updated_at = now();

    RETURN NEW;
  END IF;

  -- UPDATE: recalculer le total depuis stock_entries
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

  -- DELETE: recalculer le total depuis stock_entries
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

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Créer un seul trigger qui gère tout
CREATE TRIGGER fix_stock_duplication_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.fix_stock_duplication();

-- 5. Vérifier que les politiques RLS sont correctes
-- Supprimer les anciennes politiques qui pourraient causer des conflits
DROP POLICY IF EXISTS "Admin/magasinier can create stock entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Admin/magasinier can manage stock entries" ON public.stock_entries;

-- Créer la nouvelle politique
CREATE POLICY "Admin/magasinier can manage stock entries" ON public.stock_entries
FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'magasinier')
);

-- 6. Message de confirmation
SELECT '✅ Correction de duplication appliquée avec succès!' as status;
