// public/js/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sidebar JS Loaded"); // Debug check

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
        // Toggle click event
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop clicks from closing immediately
            console.log("Toggle Clicked"); // Debug check
            sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                e.target !== sidebarToggle) {
                
                console.log("Closing Sidebar"); // Debug check
                sidebar.classList.remove('active');
            }
        });
    } else {
        console.error("Error: Sidebar elements not found. Check IDs 'sidebar' and 'sidebar-toggle'");
    }
});