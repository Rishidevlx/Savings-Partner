// public/js/pwa.js

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Update UI to notify the user they can add to home screen
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
      installBtn.style.display = 'flex'; // Button ah Show pannu
  }
});

// Function to trigger install (Called from HTML)
async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    
    // Hide button after install
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'none';
  }
}

// Service Worker Registration
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((reg) => console.log('Service Worker Registered'))
        .catch((err) => console.log('Service Worker Error:', err));
    });
  }
});