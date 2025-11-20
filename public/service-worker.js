const CACHE_NAME = "savings-partner-v1";
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
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css",
  "https://cdn.jsdelivr.net/npm/toastify-js"
];

// Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Strategy: Network First for API, Cache First for Static Files
self.addEventListener("fetch", (event) => {
  // If request is for API, go to Network directly (Don't cache API responses for now to ensure fresh data)
  if (event.request.url.includes("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other files (HTML, CSS, JS), try Cache first, then Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});