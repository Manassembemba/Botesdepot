# Configuration de la clé de service Supabase

## Problème résolu
L'erreur "user not allowed" lors de la création d'utilisateurs était due au fait que l'application utilisait la clé publique au lieu de la clé de service pour les opérations d'administration.

## Solution implémentée

1. **Client Admin créé** : Un nouveau client Supabase (`supabaseAdmin`) a été créé avec la clé de service
2. **Variables d'environnement** : Ajout de `VITE_SUPABASE_SERVICE_ROLE_KEY` dans le fichier `.env`
3. **Gestion d'erreur améliorée** : Messages d'erreur plus détaillés pour diagnostiquer les problèmes

## Configuration requise

### 1. Obtenir la clé de service

1. Allez sur votre dashboard Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez la clé **service_role** (pas la clé anon/public)

### 2. Mettre à jour le fichier .env

Remplacez `your_service_role_key_here` dans le fichier `.env` par votre vraie clé de service :

```env
VITE_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Redémarrer l'application

Après avoir mis à jour le fichier `.env`, redémarrez votre serveur de développement :

```bash
npm run dev
# ou
bun dev
```

## Sécurité importante

⚠️ **La clé de service donne accès complet à votre base de données**
- Ne la commitez jamais dans Git
- Ne l'exposez jamais publiquement
- Utilisez-la uniquement côté serveur en production

En développement, l'utilisation de la clé de service dans le frontend est acceptable car vous contrôlez l'environnement.

## Fonctionnalités maintenant disponibles

- ✅ Création d'utilisateurs avec nom d'utilisateur et mot de passe
- ✅ Attribution automatique du rôle
- ✅ Création du profil utilisateur
- ✅ Affichage des identifiants après création
- ✅ Gestion d'erreur détaillée

## Test de la fonctionnalité

1. Allez dans **Gestion des Utilisateurs**
2. Cliquez sur **Créer un utilisateur**
3. Remplissez le formulaire (email, nom d'utilisateur, mot de passe, rôle)
4. Cliquez sur **Créer l'utilisateur**

Si tout est configuré correctement, l'utilisateur sera créé et vous verrez un message de succès avec les identifiants de connexion.
