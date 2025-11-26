# AivenaPilot Multi-Tenant Backend

Backend Express pour la plateforme multi-tenant AivenaPilot.

## Fonctionnalités

- 🏪 Gestion multi-tenant de boutiques
- 🌐 Sous-domaines : `nike.aivenapilot.com`
- 📊 Base de données JSON simple
- ⚡ API REST complète
- 🎨 Templates Tailwind CSS

## URLs

- **API** : `/api/shops`
- **Boutiques** : `/:shopSlug` (ex: `/nike`)

## Déploiement

### Railway
```bash
railway login
railway link
railway up
```

### Variables d'environnement
- `NODE_ENV=production`
- `PORT=3000` (auto par Railway)

## Développement Local

```bash
npm install
npm start
# Serveur sur http://localhost:3012
```

## API Endpoints

- `GET /api/shops` - Liste des boutiques
- `POST /api/shops` - Créer une boutique
- `PUT /api/shops/:slug` - Mettre à jour
- `GET /:shopSlug` - Afficher la boutique

## Structure Data

```json
{
  "shops": {
    "nike": {
      "id": "123",
      "name": "Nike",
      "slug": "nike",
      "template": "ecommerce",
      "config": {...},
      "products": [...],
      "stats": {...}
    }
  }
}
```