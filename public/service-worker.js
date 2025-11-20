// CHANGE v1 TO v2 HERE (Idhu dhan mukkiyam)
const CACHE_NAME = "savings-partner-v2"; 

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/accounts.html",
  "/transactions.html",
  "/goals.html",
  "/connections.html",
  "/notes.html",
  "/calculator.html",
  "/settings.html",
  "/account-details.html",
  "/ledger-details.html",
  "/connected-goal-details.html",
  "/admin.html",
  "/css/style.css",
  "/css/sidebar.css",
  "/css/dashboard.css",
  "/css/accounts.css",
  "/css/transactions.css",
  "/css/goals.css",
  "/css/connections.css",
  "/css/notes.css",
  "/css/calculator.css",
  "/css/settings.css",
  "/css/account-details.css",
  "/css/ledger-details.css",
  "/css/connected-goal-details.css",
  "/js/script.js",
  "/js/main.js",
  "/js/sidebar.js",
  "/js/accounts.js",
  "/js/goals.js",
  "/js/connections.js",
  "/js/notes.js",
  "/js/settings.js",
  "/js/account-details.js",
  "/js/ledger-details.js",
  "/js/connected-goal-details.js",
  "/js/admin.js",
  "/js/pwa.js", 
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css",
  "https://cdn.jsdelivr.net/npm/toastify-js"
];

// Install Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Forces this new worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Service Worker (Delete Old Cache)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Deleting Old Cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

// Fetch Strategy
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});