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
            <button class="hamburger-btn" id="hamburgerBtn" aria-label="Toggle navigation">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="profile-section">
                <div class="profile-circle"></div>
            </div>
        </header>
        <div class="mobile-nav-overlay" id="mobileNav">
            <a href="../dashboard/dashboard.html" class="nav-item">Dashboard</a>
            <a href="../representatives/representatives.html" class="nav-item">Representatives</a>
            <a href="../performance/performance.html" class="nav-item">Performances</a>
            <a href="../accounts/accounts.html" class="nav-item">Accounts</a>
        </div>
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
    const profileCircle = document.querySelector('.profile-circle');

    if (profileSection) {
        profileSection.style.cursor = 'pointer';
        profileSection.addEventListener('click', () => {
            if (typeof openProfileModal === 'function') {
                // Open the modal container
                openProfileModal();
            }
        });
    }

    // Load initials into profile circle
    // Load initials into profile circle
    // Load initials into profile circle
    const empId = localStorage.getItem('current_emp_id');
    if (empId && profileCircle) {
        const loadInitials = () => {
            window.API.fetchAccount(empId)
                .then(result => {
                    if (result.data) {
                        const data = Array.isArray(result.data) ? result.data[0] : result.data;
                        const first = (data.first_name || '').trim().charAt(0).toUpperCase();
                        const last = (data.last_name || '').trim().charAt(0).toUpperCase();
                        profileCircle.textContent = first + last;
                    }
                })
                .catch(() => {
                    profileCircle.textContent = '?';
                });
        };

        if (window.API) {
            loadInitials();
        } else {
            window.addEventListener('load', loadInitials);
        }
    }

    // 5. Highlight active tab (desktop + mobile overlay)
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

    // 6. Hamburger toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileNav = document.getElementById('mobileNav');

    if (hamburgerBtn && mobileNav) {
        hamburgerBtn.addEventListener('click', () => {
            hamburgerBtn.classList.toggle('open');
            mobileNav.classList.toggle('open');
        });

        // Close when a nav item is clicked
        mobileNav.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                hamburgerBtn.classList.remove('open');
                mobileNav.classList.remove('open');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            const clickedOutside = !hamburgerBtn.contains(e.target) && !mobileNav.contains(e.target);
            if (clickedOutside && mobileNav.classList.contains('open')) {
                hamburgerBtn.classList.remove('open');
                mobileNav.classList.remove('open');
            }
        });

        // Auto-close when resized back to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) {
                hamburgerBtn.classList.remove('open');
                mobileNav.classList.remove('open');
            }
        });
    }

});