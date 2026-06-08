/* profile/profile.js */

/* ── INJECT MODAL HTML ── */
function injectProfileModals() {
    const html = `
        <div id="profileOverlay" class="profile-overlay" role="dialog" aria-modal="true" style="display:none;">
            <div class="profile-modal">
                <button class="profile-modal-close" id="closeProfileModal">&times;</button>

                <div class="profile-avatar-wrap">
                    <div class="profile-avatar">
                        <svg viewBox="0 0 80 80" width="80" height="80">
                            <circle cx="40" cy="40" r="40" fill="#e8f4f8"/>
                            <circle cx="40" cy="30" r="14" fill="#f5cba7"/>
                            <path d="M26 62c0-8 6-14 14-14s14 6 14 14" fill="#f5cba7"/>
                        </svg>
                    </div>
                </div>

                <h2 class="profile-title" id="user-role-header">User Profile</h2>

                <div class="profile-info-grid">
                    <div class="info-item">
                        <span class="info-label">Full Name</span>
                        <span class="info-value" id="user-fullname">...</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Employee ID</span>
                        <span class="info-value" id="user-employee-id">...</span>
                    </div>
                </div>

                <div class="button-row" style="margin-top: 20px; justify-content: center;">
                    <button class="btn-logout" id="logoutBtn" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

/* ── OPEN / CLOSE ── */
function openProfileModal() {
    const overlay = document.getElementById('profileOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loadProfileData();
    }
}

function closeProfileModal() {
    const overlay = document.getElementById('profileOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

/* ── LOGOUT ── */
function handleLogout() {
    // 1. Clear all session data
    localStorage.clear();
    sessionStorage.clear();

    // 2. Redirect using a relative path for Cordova local files
    window.location.href = '../auth/login.html';
}

/* ── LOAD & DISPLAY PROFILE DATA ── */
async function loadProfileData() {
    // 1. Try to load from cache immediately for speed
    const cachedUser = localStorage.getItem('user_profile');
    if (cachedUser) {
        try { displayUserData(JSON.parse(cachedUser)); } catch (e) { console.error(e); }
    }

    const empId = localStorage.getItem('current_emp_id');
    if (!empId) {
        handleLogout();
        return;
    }

    // 2. Refresh from API
    try {
        const result = await API.fetchAccount(empId);
        const data = Array.isArray(result?.data) ? result.data[0] : (result?.data || result);

        if (data && data.employee_id) {
            displayUserData(data);
            localStorage.setItem('user_profile', JSON.stringify(data));
        }
    } catch (err) {
        console.error('Could not refresh profile data:', err);
    }
}

function displayUserData(user) {
    if (!user || Object.keys(user).length === 0) return;

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    
    // --- 🔹 ROLE MAPPING LOGIC ---
    // This converts raw database values like 'super_admin' to 'Administrator'
    let rawRole = user.roles || 'user';
    let displayRole = 'User'; // Default fallback

    if (rawRole === 'super_admin') {
        displayRole = 'Super Administrator';
    } else if (rawRole === 'admin') {
        displayRole = 'Administrator'; 
    } else if (rawRole === 'medrep') {
        displayRole = 'Medical Representative';
    } else {
        // Capitalize the first letter if it doesn't match the above
        displayRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    }

    const elements = {
        'user-role-header': displayRole,
        'user-fullname': fullName || 'N/A',
        'user-employee-id': user.employee_id || 'N/A'
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

/* ── EVENT LISTENERS ── */
function initProfileListeners() {
    document.getElementById('closeProfileModal')?.addEventListener('click', closeProfileModal);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    const profileOverlay = document.getElementById('profileOverlay');
    profileOverlay?.addEventListener('click', (e) => {
        if (e.target === profileOverlay) closeProfileModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeProfileModal();
    });
}

/* ── INIT ── */
function initProfile() {
    injectProfileModals();
    initProfileListeners();
}

/* ── EXPORTS ── */
window.initProfile        = initProfile;
window.openProfileModal   = openProfileModal;
window.closeProfileModal  = closeProfileModal;
window.handleLogout       = handleLogout;