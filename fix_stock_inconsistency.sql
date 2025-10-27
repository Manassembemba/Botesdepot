-- CORRECTION DES DONNÉES INCOHÉRENTES
-- Script pour recalculer le stock depuis les entrées

-- 1. Sauvegarder l'état actuel (pour rollback si nécessaire)
CREATE TEMP TABLE backup_locker_stock AS
SELECT * FROM public.locker_stock;

-- 2. Vider le stock actuel
DELETE FROM public.locker_stock;

-- 3. Recalculer depuis les entrées de stock
INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles, updated_at)
SELECT
  COALESCE(locker_id, 1) as locker_id, -- Utiliser le casier principal si NULL
  product_id,
  SUM(qty_bottles) as total_bottles,
  now() as updated_at
FROM public.stock_entries
WHERE qty_bottles > 0
GROUP BY product_id, locker_id;

-- 4. Vérifier le nouveau total
SELECT
  'TOTAL ENTREES' as description,
  SUM(qty_bottles) as total_bottles
FROM public.stock_entries
UNION ALL
SELECT
  'STOCK RECALCULE' as description,
  SUM(quantity_bottles) as total_bottles
FROM public.locker_stock;

-- 5. Comparer avec l'ancien stock
SELECT
  'ANCIEN STOCK' as description,
  SUM(quantity_bottles) as total_bottles
FROM backup_locker_stock
UNION ALL
SELECT
  'NOUVEAU STOCK' as description,
  SUM(quantity_bottles) as total_bottles
FROM public.locker_stock;

-- 6. Nettoyer la table temporaire
DROP TABLE backup_locker_stock;
