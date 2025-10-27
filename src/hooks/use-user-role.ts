import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "magasinier" | "client" | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        // Vérifier si l'utilisateur est connecté
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setRole(null);
          setLoading(false);
          return;
        }

        // Récupérer le rôle de l'utilisateur
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (error) {
          console.error("Erreur lors de la récupération du rôle:", error);
          setRole(null);
        } else {
          setRole(data?.role as UserRole);
        }
      } catch (error) {
        console.error("Erreur:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setRole(null);
      } else {
        fetchUserRole();
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return { role, loading };
}