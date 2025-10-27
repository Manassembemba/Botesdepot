# 🚀 Configuration Rapide - Clé de Service Supabase

## ✅ Problème résolu
L'erreur "user not allowed" était due à l'utilisation de la clé publique au lieu de la clé de service.

## ⚡ Étapes pour résoudre l'erreur :

### 1. Obtenir la clé de service
```
🌐 Dashboard Supabase → Settings → API → service_role → Copy
```

### 2. Remplacer dans .env
```env
VITE_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."
```

### 3. Redémarrer
```bash
npm run dev
```

## 🔧 Ce qui a été configuré :

- ✅ **Client Admin** créé avec clé de service
- ✅ **Variables d'environnement** ajoutées
- ✅ **Gestion d'erreur** améliorée
- ✅ **Code prêt** à créer des utilisateurs

## 🎯 Test après configuration :

1. **Gestion des Utilisateurs** → **Créer un utilisateur**
2. Remplir : Email, Username, Password, Rôle
3. **Créer l'utilisateur**

**Résultat attendu :**
```
✅ L'utilisateur jean.dupont a été créé avec succès

Identifiants de connexion:
Nom d'utilisateur: jean.dupont
Mot de passe: MonMotDePasse123
Email: jean.dupont@botes.com
```

## 🔒 Sécurité
⚠️ Clé de service = Accès complet à la DB
✅ Acceptable en développement
❌ Ne pas exposer en production

**Prêt à tester ?** 🎉
