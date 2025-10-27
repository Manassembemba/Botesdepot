-- SUPPRIMER LE TRIGGER DUPLICATA QUI CAUSE LE DOUBLE AJOUT
-- Script pour nettoyer les triggers concurrents

-- 1. Supprimer le trigger dupliqué
DROP TRIGGER IF EXISTS trg_after_stock_entry_insert ON public.stock_entries;

-- 2. Supprimer la fonction obsolète si elle existe
DROP FUNCTION IF EXISTS public.handle_stock_entry_update();

-- 3. Vérifier qu'il ne reste que le bon trigger
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'stock_entries';

-- 4. Confirmer qu'une seule fonction stock existe
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%stock%' AND routine_type = 'FUNCTION';

-- 5. Message de confirmation
SELECT '✅ Trigger dupliqué supprimé - plus de double ajout!' as status;
