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
    // 1. Inject shared header
    const headerHTML = `
        <header class="top-nav-bar">
            <div class="nav-logo-section">
                <div class="nav-logo-link">
                    <img src="../common/assets/premier_logo_clean.png" alt="Premier Pharmaceuticals Marketing Corp." class="nav-logo-img" />
                </div>
            </div>
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
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    // 2. Load profile CSS
    const profileStyles = document.createElement('link');
    profileStyles.rel = 'stylesheet';
    profileStyles.href = '../profile/profile.css';
    document.head.appendChild(profileStyles);

    // 3. Load profile JS (it injects its own modal HTML + listeners)
    const profileScript = document.createElement('script');
    profileScript.src = '../profile/profile.js';
    profileScript.onload = () => {
        if (typeof initProfile === 'function') initProfile();
    };
    document.head.appendChild(profileScript);

    // 4. Connect profile circle click with DYNAMIC DATA
    const profileSection = document.querySelector('.profile-section');
    if (profileSection) {
        profileSection.style.cursor = 'pointer';
        profileSection.addEventListener('click', () => {
            if (typeof openProfileModal === 'function') {
                // Open the modal container
                openProfileModal();
            }
        });
    }

    // 5. Highlight active tab
    const navItems = document.querySelectorAll('.nav-item');
    const currentPath = window.location.pathname.toLowerCase();
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            const linkPath = href.split('/').pop().toLowerCase();
            if (currentPath.includes(linkPath)) {
                item.classList.add('active');
            }
        }
    });

});