// public/js/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    // 1. Sidebar Toggle Logic
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                e.target !== sidebarToggle) {
                sidebar.classList.remove('active');
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('active');
            }
        });
    }

    // 2. LOGOUT LOGIC (NEW ADDITION)
    // Ella page layum sidebar footer la logout link iruku. Adha pidichu handle pandrom.
    const logoutLink = document.querySelector('.sidebar-footer a[href*="index.html"]');
    
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Link vela seiya vidama thadukurom
            
            // Clear Data
            localStorage.removeItem('user');
            
            // Redirect to Login
            window.location.href = '/index.html';
        });
    }
});