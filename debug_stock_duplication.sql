-- DEBUG: Vérifier le contenu des tables stock pour détecter la duplication
-- Exécutez ce script dans Supabase SQL Editor pour voir les données

-- 1. Voir toutes les entrées de stock
SELECT
  id,
  product_id,
  locker_id,
  qty_bottles,
  received_at,
  received_by,
  supplier,
  unit_cost
FROM public.stock_entries
ORDER BY received_at DESC
LIMIT 10;

-- 2. Voir le stock actuel par casier/produit
SELECT
  locker_id,
  product_id,
  quantity_bottles,
  updated_at
FROM public.locker_stock
ORDER BY updated_at DESC;

-- 3. Compter le nombre total d'entrées par produit
SELECT
  p.name,
  COUNT(se.id) as entry_count,
  SUM(se.qty_bottles) as total_bottles_added,
  ls.quantity_bottles as current_stock,
  CASE
    WHEN ls.quantity_bottles = SUM(se.qty_bottles) THEN '✅ OK - Totaux correspondent'
    WHEN ls.quantity_bottles > SUM(se.qty_bottles) THEN '❌ Stock > Entrées (stock initial?)'
    WHEN ls.quantity_bottles < SUM(se.qty_bottles) THEN '❌ Stock < Entrées (duplication!)'
    ELSE '❓ Inconnu'
  END as status
FROM public.products p
LEFT JOIN public.stock_entries se ON p.id = se.product_id
LEFT JOIN public.locker_stock ls ON p.id = ls.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, ls.quantity_bottles
ORDER BY p.name;

-- 4. Vérifier s'il y a des triggers actifs
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'stock_entries';

-- 5. Vérifier les politiques RLS
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'stock_entries';
