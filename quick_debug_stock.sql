-- DIAGNOSTIC RAPIDE DU PROBLEME DE DUPLICATION
-- Script simple à exécuter dans Supabase

-- 1. Vérifier les entrées récentes
SELECT id, product_id, qty_bottles, received_at
FROM public.stock_entries
ORDER BY received_at DESC
LIMIT 5;

-- 2. Vérifier le stock actuel
SELECT p.name, ls.quantity_bottles, ls.updated_at
FROM public.locker_stock ls
JOIN public.products p ON ls.product_id = p.id
ORDER BY ls.updated_at DESC;

-- 3. Comparaison simple: total ajouté vs stock actuel
SELECT
  'TOTAL ENTREES' as description,
  SUM(qty_bottles) as total_bottles
FROM public.stock_entries
UNION ALL
SELECT
  'STOCK ACTUEL' as description,
  SUM(quantity_bottles) as total_bottles
FROM public.locker_stock;

-- 4. Si duplication détectée, nettoyer et recalculer
-- ⚠️ ATTENTION: Ce script supprime et recalcule TOUT le stock!

/*
-- DECOMMENTER SEULEMENT SI DUPLICATION CONFIRMEE:

-- Supprimer tout le stock actuel
DELETE FROM public.locker_stock;

-- Recalculer depuis les entrées
INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
SELECT
  locker_id,
  product_id,
  SUM(qty_bottles),
  now()
FROM public.stock_entries
WHERE locker_id IS NOT NULL
GROUP BY locker_id, product_id;

-- Vérifier le résultat
SELECT '✅ Stock recalculé - vérifiez maintenant!' as status;
*/
