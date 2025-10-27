// Type for users with their roles (based on user_roles and profiles tables)
export type UserWithRole = {
  id: string;
  email: string; // Placeholder since email is not accessible
  full_name: string;
  role: 'admin' | 'magasinier' | 'client';
  created_at: string;
  last_sign_in_at: string | null;
  user_roles: {
    role: 'admin' | 'magasinier' | 'client';
  }[];
};
