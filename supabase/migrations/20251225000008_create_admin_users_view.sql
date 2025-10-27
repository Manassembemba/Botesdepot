-- Vue pour la gestion des utilisateurs (accessible aux admins seulement)
-- Cette vue combine profiles et user_roles avec des informations auth basiques
CREATE OR REPLACE VIEW public.v_admin_users AS
SELECT
  p.id,
  p.full_name,
  ur.role,
  p.created_at,
  -- Note: email et last_sign_in_at ne sont pas accessibles sans API admin
  -- Dans un environnement de production, il faudrait une fonction sécurisée
  'admin@example.com' as email,
  p.created_at as last_sign_in_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE ur.role IS NOT NULL
ORDER BY p.created_at DESC;

-- Politique RLS pour la vue (admins seulement)
ALTER VIEW public.v_admin_users SET (security_barrier = true);
CREATE POLICY "Admins can view all users" ON public.v_admin_users
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
