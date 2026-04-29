/* navigation.js */

// Security Check: Immediately redirect to login if no session is found
(function authGuard() {
    const empId = localStorage.getItem('current_emp_id');
    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.includes('login.html');

    if (!empId && !isLoginPage) {
        // 1. Force-hide the UI immediately
        document.documentElement.style.display = 'none';
        
        // 2. Calculate dynamic path to auth/login.html
        // This handles varying folder depths (e.g., dashboard vs request_details)
        const segments = window.location.pathname.split('/').filter(Boolean);
        let depth = 0;
        
        // Find how many steps to get back to the project root (Attendee_Project or www)
        const rootIndex = Math.max(segments.indexOf('Attendee_Project'), segments.indexOf('www'));
        if (rootIndex !== -1) {
            depth = segments.length - rootIndex - 2; 
        } else {
            // Fallback: assume 1 level if we can't determine root
            depth = 1; 
        }

        const prefix = depth > 0 ? "../".repeat(depth) : "./";
        window.location.replace(prefix + 'auth/login.html');
        
    } else if (empId && isLoginPage) {
        // If already logged in, don't allow going back to login page
        window.location.href = '../dashboard/dashboard.html';
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Define the HTML for your shared header
    const headerHTML = `
        <header class="top-nav-bar">
            <nav class="nav-container">
                <a href="../dashboard/dashboard.html" class="nav-item">Dashboard</a>
                <a href="../representatives/representatives.html" class="nav-item">Representatives</a>
                <a href="../performance/performance.html" class="nav-item">Performances</a>
                <a href="../accounts/accounts.html" class="nav-item">Accounts</a>
            </nav>
            <div class="profile-section">
                <div class="profile-circle"></div>
            </div>
        </header>
    `;

    // 2. Inject it at the very top of the body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    // 3. Highlight the current active tab
    const navItems = document.querySelectorAll('.nav-item');
    const currentPath = window.location.pathname.toLowerCase();

    navItems.forEach(item => {
        // Get the filename from the href (e.g., 'dashboard.html')
        const linkPath = item.getAttribute('href').split('/').pop().toLowerCase();
        
        // If the current URL includes this link's filename, make it active
        if (currentPath.includes(linkPath)) {
            item.classList.add('active');
        }
    });
});