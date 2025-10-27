-- Migration pour ajouter le support multi-sites
-- =====================================================

-- 1️⃣ Créer la table sites
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  address text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2️⃣ Ajouter la colonne site_id à la table sales
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);

-- 3️⃣ Créer un site par défaut "Principal" si la table sites est vide
INSERT INTO public.sites (name, code, address)
SELECT 'Site Principal', 'MAIN', 'Adresse principale'
WHERE NOT EXISTS (SELECT 1 FROM public.sites LIMIT 1);

-- 4️⃣ Mettre à jour toutes les ventes existantes avec le site par défaut
UPDATE public.sales
SET site_id = (SELECT id FROM public.sites WHERE code = 'MAIN' LIMIT 1)
WHERE site_id IS NULL;

-- 5️⃣ Rendre site_id NOT NULL après la mise à jour
ALTER TABLE public.sales
ALTER COLUMN site_id SET NOT NULL;

-- 6️⃣ Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_sales_site_id ON public.sales(site_id);
CREATE INDEX IF NOT EXISTS idx_sites_code ON public.sites(code);

-- 7️⃣ Mettre à jour les politiques RLS pour inclure le filtrage par site
DROP POLICY IF EXISTS "Users can read own sales" ON public.sales;
CREATE POLICY "Users can read own sales" ON public.sales
FOR SELECT USING (
  created_by = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  site_id IN (
    SELECT s.id FROM public.sites s WHERE s.is_active = true
  )
);

DROP POLICY IF EXISTS "Admin can read all sales" ON public.sales;
CREATE POLICY "Admin can read all sales" ON public.sales
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 8️⃣ Mettre à jour les politiques pour sale_items
DROP POLICY IF EXISTS "Users can read sale items of own sales" ON public.sale_items;
CREATE POLICY "Users can read sale items of own sales" ON public.sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
    AND (s.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ) OR
  EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.sites st ON s.site_id = st.id
    WHERE s.id = sale_items.sale_id
    AND st.is_active = true
  )
);

DROP POLICY IF EXISTS "Admin can read all sale items" ON public.sale_items;
CREATE POLICY "Admin can read all sale items" ON public.sale_items
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 9️⃣ Activer RLS sur la table sites
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- 10️⃣ Politiques pour sites
CREATE POLICY "Everyone can read active sites" ON public.sites
FOR SELECT USING (is_active = true);

CREATE POLICY "Admin can manage sites" ON public.sites
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 11️⃣ Mettre à jour les types TypeScript
-- (Note: Les types seront mis à jour automatiquement lors du prochain build)
