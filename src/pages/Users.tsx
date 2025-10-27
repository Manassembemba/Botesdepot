/**
 * USER MANAGEMENT PAGE
 *
 * Features:
 * - List all users with their roles
 * - Change user roles (admin only)
 * - View user details and activity
 * - Admin-only access
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users as UsersIcon, UserPlus, Shield, User, Clock, Mail, Calendar } from "lucide-react";
import { supabase, supabaseAdmin } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { UserWithRole } from "@/types/user";
import { Tables } from "@/integrations/supabase/types";

const Users = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role: currentUserRole, loading: roleLoading } = useUserRole();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<string>("magasinier");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'magasinier' | 'client'>("magasinier");
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // Only admins can access user management
      if (currentUserRole !== 'admin') {
        toast({
          title: "Accès refusé",
          description: "Seuls les administrateurs peuvent gérer les utilisateurs",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      fetchUsers();
    };

    if (!roleLoading) {
      checkAuth();
    }
  }, [navigate, currentUserRole, roleLoading, toast]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Get user roles (admin can read all roles)
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Get profiles (admin can read all profiles)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      // Combine the data from roles and profiles
      const usersWithRoles: UserWithRole[] = (userRoles || []).map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);

        return {
          id: role.user_id,
          email: `${role.user_id.substring(0, 8)}@example.com`, // Placeholder since we don't have email access
          full_name: profile?.full_name || 'Utilisateur',
          role: role.role as 'admin' | 'magasinier' | 'client',
          created_at: role.created_at,
          last_sign_in_at: null, // Not available without admin API
          user_roles: [{ role: role.role }]
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createEmail || !createUsername || !createPassword || !createRole) return;

    try {
      // Check if email already exists in profiles table (simplified)
      const { data: existingProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", createEmail);

      if (existingProfiles && existingProfiles.length > 0) {
        toast({
          title: "Erreur",
          description: `L'email ${createEmail} est déjà utilisé par un utilisateur existant.`,
          variant: "destructive",
        });
        return;
      }

      // Create user with Supabase Admin API
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: createEmail,
        password: createPassword,
        email_confirm: true,
        user_metadata: {
          username: createUsername,
          role: createRole
        }
      });

      if (error) throw error;

      // Create or update user role in user_roles table (UPSERT to handle conflicts)
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: data.user.id,
          role: createRole as 'admin' | 'magasinier' | 'client'
        }, {
          onConflict: 'user_id'
        });

      if (roleError) throw roleError;

      // Create or update profile entry (UPSERT to handle conflicts)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: data.user.id,
          full_name: createUsername,
          email: createEmail
        }, {
          onConflict: 'id'
        });

      if (profileError) throw profileError;

      toast({
        title: "Succès",
        description: `L'utilisateur ${createUsername} a été créé avec succès\n\nIdentifiants de connexion:\nNom d'utilisateur: ${createUsername}\nMot de passe: ${createPassword}\nEmail: ${createEmail}`,
      });

      // Close dialog and refresh users
      setShowCreateDialog(false);
      setCreateEmail("");
      setCreateUsername("");
      setCreatePassword("");
      setCreateRole("magasinier");
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);

      let errorMessage = "Impossible de créer l'utilisateur";
      let shouldRefresh = false;

      // Handle specific Supabase Admin API errors
      if (error.message?.includes('email_exists') || error.code === 'email_exists') {
        // Email already exists in auth.users, try to create missing local records
        try {
          console.log('Email exists in auth, checking local tables...');

          // Get the existing user from auth
          const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

          if (!listError && existingUsers && existingUsers.users) {
            const existingUser = existingUsers.users.find((u: any) => u.email === createEmail);

            if (existingUser) {
              // Check if user exists in user_roles
              const { data: existingRole, error: roleCheckError } = await supabaseAdmin
                .from("user_roles")
                .select("*")
                .eq("user_id", existingUser.id)
                .single();

              if (roleCheckError && roleCheckError.code === 'PGRST116') {
                // User doesn't exist in user_roles, create it
                const { error: roleCreateError } = await supabaseAdmin
                  .from("user_roles")
                  .upsert({
                    user_id: existingUser.id,
                    role: createRole as 'admin' | 'magasinier' | 'client'
                  }, {
                    onConflict: 'user_id'
                  });

                if (!roleCreateError) {
                  // Check if user exists in profiles
                  const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
                    .from("profiles")
                    .select("*")
                    .eq("id", existingUser.id)
                    .single();

                  if (profileCheckError && profileCheckError.code === 'PGRST116') {
                    // User doesn't exist in profiles, create it
                    const { error: profileCreateError } = await supabaseAdmin
                      .from("profiles")
                      .upsert({
                        id: existingUser.id,
                        full_name: createUsername,
                        email: createEmail
                      }, {
                        onConflict: 'id'
                      });

                    if (!profileCreateError) {
                      errorMessage = `L'utilisateur ${createUsername} existait déjà dans le système d'authentification. Le profil et le rôle ont été créés avec succès.`;
                      shouldRefresh = true;
                    }
                  } else {
                    errorMessage = `L'utilisateur avec l'email ${createEmail} existe déjà dans le système avec un profil complet.`;
                  }
                }
              } else {
                errorMessage = `L'utilisateur avec l'email ${createEmail} existe déjà dans le système avec un rôle assigné.`;
              }
            }
          }
        } catch (fallbackError: any) {
          console.error('Error in fallback user creation:', fallbackError);
          errorMessage = `L'email ${createEmail} est déjà utilisé par un autre utilisateur. Veuillez utiliser une autre adresse email.`;
        }
      } else if (error.message?.includes('user not allowed') || error.message?.includes('unauthorized')) {
        errorMessage = "Erreur d'autorisation: La clé de service Supabase n'est pas configurée correctement. Veuillez vérifier la configuration dans le fichier .env";
      } else if (error.message?.includes('service role')) {
        errorMessage = "Erreur de configuration: Clé de service manquante. Ajoutez VITE_SUPABASE_SERVICE_ROLE_KEY dans le fichier .env";
      } else if (error.message?.includes('Invalid API key')) {
        errorMessage = "Clé API invalide: Vérifiez que la clé de service est correcte dans le fichier .env";
      } else if (error.message?.includes('duplicate') || error.message?.includes('unique constraint') || error.status === 409) {
        errorMessage = `L'utilisateur avec l'email ${createEmail} existe déjà dans le système. Utilisez une autre adresse email ou contactez l'administrateur.`;
      } else if (error.message) {
        errorMessage = `Erreur lors de la création: ${error.message}`;
      }

      // Show success message if we successfully created missing records
      if (shouldRefresh) {
        toast({
          title: "Succès",
          description: errorMessage,
        });

        // Close dialog and refresh users
        setShowCreateDialog(false);
        setCreateEmail("");
        setCreateUsername("");
        setCreatePassword("");
        setCreateRole("magasinier");
        fetchUsers();
      } else {
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    try {
      // Update user role in the database
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", selectedUser.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Le rôle de ${selectedUser.full_name} a été mis à jour`,
      });

      // Close dialog and refresh users
      setShowRoleDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rôle de l'utilisateur",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (user: UserWithRole) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${user.full_name} ?`)) return;

    try {
      // Remove user role (this effectively disables their access)
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      // TODO: In production, you might also want to disable the auth user
      // const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
      //   banned_until: '2099-12-31T23:59:59.999Z'
      // });

      toast({
        title: "Succès",
        description: `${user.full_name} a été supprimé`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      });
    }
  };

  const openRoleDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleDialog(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'magasinier': return 'default';
      case 'client': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'magasinier': return <User className="h-4 w-4" />;
      case 'client': return <Mail className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Chargement...</span>
      </div>
    );
  }

  if (currentUserRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Accès Restreint</h3>
            <p className="text-muted-foreground">
              Seuls les administrateurs peuvent accéder à cette page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <UsersIcon className="h-8 w-8" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les utilisateurs, leurs rôles et permissions
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Utilisateurs ({users.length})</h2>
            <p className="text-muted-foreground">Gérez les comptes et permissions</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Créer un utilisateur
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatDate(user.last_sign_in_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoleDialog(user)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changer le rôle de {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Nouveau rôle</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Administrateur</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="magasinier">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Magasinier</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="client">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Client</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleRoleChange}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
            <DialogDescription>
              Créer un nouveau compte utilisateur avec nom d'utilisateur et mot de passe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="utilisateur@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                placeholder="nom_utilisateur"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createRole">Rôle par défaut</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Administrateur</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="magasinier">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Magasinier</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="client">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Client</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateUser}>
                Créer l'utilisateur
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Users;
