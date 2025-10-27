-- Fonction pour créer une entrée locker_stock par défaut pour les nouveaux produits
CREATE OR REPLACE FUNCTION public.handle_new_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  product_locker_id bigint;
  locker_name text;
  locker_code text;
BEGIN
  locker_name := 'CASIER ' || NEW.name;
  locker_code := 'CASIER-' || NEW.id; -- Using product ID for unique code

  -- Créer un nouveau casier pour ce produit
  INSERT INTO public.lockers (code, name, location, capacity)
  VALUES (locker_code, locker_name, 'Produit Spécifique', 0)
  RETURNING id INTO product_locker_id;

  -- Insérer une entrée dans locker_stock avec une quantité initiale de 0
  INSERT INTO public.locker_stock (locker_id, product_id, quantity_bottles)
  VALUES (product_locker_id, NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pour appeler la fonction après chaque insertion dans products
CREATE TRIGGER trg_after_product_insert
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_product_stock();
