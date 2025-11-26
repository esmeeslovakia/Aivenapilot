const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3012;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database simple (JSON)
const DB_PATH = path.join(__dirname, 'data', 'shops.json');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Pour permettre les styles inline
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Fonctions utilitaires
const initDB = async () => {
  const dataDir = path.join(__dirname, 'data');
  await fs.ensureDir(dataDir);
  
  if (!await fs.pathExists(DB_PATH)) {
    await fs.writeJSON(DB_PATH, {
      shops: {},
      stats: {
        totalShops: 0,
        totalViews: 0,
        lastUpdate: new Date().toISOString()
      }
    }, { spaces: 2 });
  }
};

const getDB = async () => {
  return await fs.readJSON(DB_PATH);
};

const saveDB = async (data) => {
  await fs.writeJSON(DB_PATH, data, { spaces: 2 });
};

// Middleware pour détecter le sous-domaine
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const parts = host.split('.');
  
  // Détection sous-domaine : nike.aivenapilot.com ou nike.localhost
  if (parts.length >= 2) {
    const subdomain = parts[0];
    
    // Ignorer www et domaine principal
    if (subdomain !== 'www' && subdomain !== 'aivenapilot' && subdomain !== 'localhost') {
      req.shopSlug = subdomain;
    }
  }
  
  next();
});

// Routes API pour le dashboard
app.get('/api/shops', async (req, res) => {
  try {
    const db = await getDB();
    res.json({
      success: true,
      shops: Object.values(db.shops),
      stats: db.stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/shops', async (req, res) => {
  try {
    const { name, slug, template = 'ecommerce', config = {}, products = [] } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug required' });
    }
    
    const db = await getDB();
    
    // Vérifier si la boutique existe déjà
    if (db.shops[slug]) {
      return res.status(409).json({ success: false, error: 'Shop already exists' });
    }
    
    // Créer la boutique
    const shop = {
      id: Date.now().toString(),
      name,
      slug,
      template,
      config: {
        theme: {
          primaryColor: config.theme?.primaryColor || '#3B82F6',
          secondaryColor: config.theme?.secondaryColor || '#F3F4F6',
          fontFamily: config.theme?.fontFamily || 'Inter',
          layout: config.theme?.layout || 'modern'
        },
        seo: {
          title: config.seo?.title || `${name} - Boutique`,
          description: config.seo?.description || `Découvrez les produits ${name}`,
          keywords: config.seo?.keywords || name
        }
      },
      products: products || [],
      stats: {
        views: 0,
        createdAt: new Date().toISOString(),
        lastVisit: null
      }
    };
    
    db.shops[slug] = shop;
    db.stats.totalShops++;
    db.stats.lastUpdate = new Date().toISOString();
    
    await saveDB(db);
    
    res.json({
      success: true,
      shop,
      url: NODE_ENV === 'production' 
        ? `https://${slug}.aivenapilot.com` 
        : `http://${slug}.localhost:${PORT}`
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/shops/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const updates = req.body;
    
    const db = await getDB();
    
    if (!db.shops[slug]) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    
    // Mise à jour
    db.shops[slug] = { ...db.shops[slug], ...updates };
    db.stats.lastUpdate = new Date().toISOString();
    
    await saveDB(db);
    
    res.json({ success: true, shop: db.shops[slug] });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route principale pour les boutiques
app.get('*', async (req, res) => {
  try {
    const shopSlug = req.shopSlug;
    
    if (!shopSlug) {
      // Page d'accueil ou dashboard
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>AivenaPilot - Multi-Tenant Shops</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50">
          <div class="min-h-screen flex items-center justify-center">
            <div class="text-center">
              <h1 class="text-4xl font-bold text-gray-900 mb-4">🚀 AivenaPilot</h1>
              <p class="text-gray-600 mb-8">Multi-Tenant Shop Platform</p>
              <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-4">Test Subdomains:</h3>
                <ul class="space-y-2 text-sm">
                  <li><a href="http://nike.localhost:${PORT}" class="text-blue-600 hover:underline">nike.localhost:${PORT}</a></li>
                  <li><a href="http://adidas.localhost:${PORT}" class="text-blue-600 hover:underline">adidas.localhost:${PORT}</a></li>
                  <li><a href="http://test.localhost:${PORT}" class="text-blue-600 hover:underline">test.localhost:${PORT}</a></li>
                </ul>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    
    const db = await getDB();
    const shop = db.shops[shopSlug];
    
    if (!shop) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Boutique non trouvée</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50">
          <div class="min-h-screen flex items-center justify-center">
            <div class="text-center">
              <h1 class="text-2xl font-bold text-gray-900 mb-4">🛍️ Boutique "${shopSlug}" non trouvée</h1>
              <p class="text-gray-600 mb-8">Cette boutique n'existe pas encore.</p>
              <a href="http://localhost:3000" class="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
                Créer cette boutique
              </a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    
    // Incrémenter les vues
    db.shops[shopSlug].stats.views++;
    db.shops[shopSlug].stats.lastVisit = new Date().toISOString();
    db.stats.totalViews++;
    await saveDB(db);
    
    // Générer la boutique
    const html = generateShopHTML(shop);
    res.send(html);
    
  } catch (error) {
    console.error('Error serving shop:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fonction pour générer le HTML de la boutique
function generateShopHTML(shop) {
  const { name, config, products } = shop;
  const theme = config.theme || {};
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.seo?.title || name}</title>
  <meta name="description" content="${config.seo?.description || `Boutique ${name}`}">
  <meta name="keywords" content="${config.seo?.keywords || name}">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '${theme.primaryColor || '#3B82F6'}',
            secondary: '${theme.secondaryColor || '#F3F4F6'}'
          },
          fontFamily: {
            sans: ['${theme.fontFamily || 'Inter'}', 'sans-serif']
          }
        }
      }
    }
  </script>
  <style>
    .hero-gradient {
      background: linear-gradient(135deg, ${theme.primaryColor || '#3B82F6'}, ${theme.secondaryColor || '#F3F4F6'});
    }
  </style>
</head>
<body class="font-sans">
  <!-- Navigation -->
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
            ${name.charAt(0).toUpperCase()}
          </div>
          <span class="text-xl font-bold text-gray-900">${name}</span>
        </div>
        <div class="hidden md:flex space-x-8">
          <a href="#accueil" class="text-gray-700 hover:text-primary transition-colors">Accueil</a>
          <a href="#produits" class="text-gray-700 hover:text-primary transition-colors">Produits</a>
          <a href="#contact" class="text-gray-700 hover:text-primary transition-colors">Contact</a>
        </div>
        <div class="flex items-center space-x-4">
          <button class="p-2 text-gray-400 hover:text-gray-600">
            🔍
          </button>
          <button class="p-2 text-gray-400 hover:text-gray-600">
            👤
          </button>
          <button class="relative p-2 text-gray-400 hover:text-gray-600">
            🛒
            <span class="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section id="accueil" class="hero-gradient text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div class="text-center">
        <h1 class="text-4xl md:text-6xl font-bold mb-6">
          Bienvenue chez ${name}
        </h1>
        <p class="text-xl md:text-2xl mb-8 opacity-90">
          Découvrez nos produits exceptionnels
        </p>
        <a href="#produits" class="inline-block bg-white text-primary px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors">
          Découvrir la collection
        </a>
      </div>
    </div>
  </section>

  <!-- Products Section -->
  <section id="produits" class="py-16 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nos Produits</h2>
        <p class="text-lg text-gray-600 max-w-2xl mx-auto">
          Une sélection soigneusement choisie de produits de qualité
        </p>
      </div>
      
      ${products && products.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${products.map(product => `
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <div class="aspect-square bg-gray-100 flex items-center justify-center">
                ${product.imageUrl ? 
                  `<img src="${product.imageUrl}" alt="${product.name}" class="w-full h-full object-cover">` :
                  `<span class="text-4xl">📦</span>`
                }
              </div>
              <div class="p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">${product.name}</h3>
                <p class="text-gray-600 text-sm mb-4">${product.description || 'Produit de qualité'}</p>
                <div class="flex justify-between items-center">
                  <span class="text-2xl font-bold text-primary">${product.price}€</span>
                  <button class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                    Ajouter au panier
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">🛍️</div>
          <p class="text-xl text-gray-500 mb-8">Produits bientôt disponibles !</p>
          <div class="bg-secondary rounded-lg p-8 max-w-md mx-auto">
            <p class="text-gray-600">Cette boutique est en cours de configuration.</p>
          </div>
        </div>
      `}
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-gray-900 text-white py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center">
        <div class="flex items-center justify-center space-x-3 mb-4">
          <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
            ${name.charAt(0).toUpperCase()}
          </div>
          <span class="text-xl font-bold">${name}</span>
        </div>
        <p class="text-gray-400 mb-6">Boutique en ligne propulsée par AivenaPilot</p>
        <div class="border-t border-gray-800 pt-6">
          <p class="text-sm text-gray-500">© 2024 ${name}. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  </footer>

  <script>
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  </script>
</body>
</html>
  `;
}

// Démarrage du serveur
const startServer = async () => {
  try {
    await initDB();
    
    app.listen(PORT, () => {
      console.log('🚀 AivenaPilot Multi-Tenant Server');
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log('🛍️  Test shops:');
      console.log(`   • http://nike.localhost:${PORT}`);
      console.log(`   • http://adidas.localhost:${PORT}`);
      console.log(`   • http://test.localhost:${PORT}`);
      console.log('⚙️  API endpoint: http://localhost:${PORT}/api/shops');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();