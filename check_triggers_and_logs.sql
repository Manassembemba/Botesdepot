-- VÉRIFIER TOUS LES TRIGGERS ACTIFS ET DERNIERS LOGS
-- Script pour diagnostiquer le problème de trigger

-- 1. Voir TOUS les triggers sur stock_entries
SELECT
  trigger_name,
  event_manipulation,
  action_statement,
  created
FROM information_schema.triggers
WHERE event_object_table = 'stock_entries'
ORDER BY trigger_name;

-- 2. Voir les DERNIERS logs de debug (10 plus récents)
SELECT
  id,
  action,
  details,
  created_at
FROM public.audit_logs
WHERE action LIKE '%stock%'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Voir les DERNIÈRES entrées de stock
SELECT
  id,
  product_id,
  locker_id,
  qty_bottles,
  received_at
FROM public.stock_entries
ORDER BY received_at DESC
LIMIT 10;

-- 4. Vérifier si le trigger simple est le seul actif
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%stock%'
AND routine_type = 'FUNCTION';
