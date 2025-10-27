-- Modifier la colonne SKU pour avoir une valeur par défaut auto-générée
-- Utiliser une fonction pour générer un SKU unique basé sur l'ID

-- Créer une fonction pour générer le SKU automatiquement
CREATE OR REPLACE FUNCTION public.generate_product_sku()
RETURNS TRIGGER AS $$
BEGIN
  -- Générer un SKU au format PRD-XXXXX où XXXXX est l'ID avec padding
  NEW.sku := 'PRD-' || LPAD(NEW.id::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger qui génère le SKU avant l'insertion
DROP TRIGGER IF EXISTS set_product_sku ON public.products;
CREATE TRIGGER set_product_sku
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_product_sku();

-- Rendre la colonne description nullable (elle l'est déjà mais on s'assure)
ALTER TABLE public.products ALTER COLUMN description DROP NOT NULL;

-- Rendre la colonne SKU nullable temporairement pour permettre l'insertion
ALTER TABLE public.products ALTER COLUMN sku DROP NOT NULL;