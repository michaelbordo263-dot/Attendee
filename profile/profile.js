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

                <h2 class="profile-title" id="user-fullname">Administrator</h2>

                <div class="profile-info-grid">
                    <div class="info-item">
                        <span class="info-label">Employee ID</span>
                        <span class="info-value" id="user-role-display">...</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Username</span>
                        <span class="info-value" id="user-username">...</span>
                    </div>
                </div>

                <div class="button-row">
                    <button class="btn-change-pw" id="openChangePassword">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Change Password
                    </button>
                    <button class="btn-logout" id="logoutBtn">
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

        <div id="changePasswordOverlay" class="profile-overlay" style="display:none;">
            <div class="profile-modal change-pw-modal">
                <button class="profile-modal-close" id="closeChangePassword">&times;</button>
                <h2 class="profile-title">Change Password</h2>
                <div class="pw-form">
                    <div class="pw-field" style="position:relative;">
                        <label>Current Password</label>
                        <input type="password" id="currentPw" placeholder="Enter current password">
                        <span class="pw-toggle" style="position:absolute; right:10px; top:30px; cursor:pointer; opacity:0.35;">👁️</span>
                    </div>
                    <div class="pw-field" style="position:relative;">
                        <label>New Password</label>
                        <input type="password" id="newPw" placeholder="Enter new password">
                        <span class="pw-toggle" style="position:absolute; right:10px; top:30px; cursor:pointer; opacity:0.35;">👁️</span>
                    </div>
                    <div class="pw-field" style="position:relative;">
                        <label>Confirm New Password</label>
                        <input type="password" id="confirmPw" placeholder="Repeat new password">
                        <span class="pw-toggle" style="position:absolute; right:10px; top:30px; cursor:pointer; opacity:0.35;">👁️</span>
                    </div>
                    <p class="pw-error" id="pwError"></p>
                    <button class="btn-change-pw" id="submitNewPassword" style="width:100%;">Update Password</button>
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
        const pwOverlay = document.getElementById('changePasswordOverlay');
        if (!pwOverlay || pwOverlay.style.display !== 'flex') {
            document.body.style.overflow = '';
        }
    }
}

function openChangePasswordModal() {
    const overlay = document.getElementById('changePasswordOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('currentPw').value = '';
        document.getElementById('newPw').value = '';
        document.getElementById('confirmPw').value = '';
        const errorEl = document.getElementById('pwError');
        if (errorEl) { errorEl.textContent = ''; errorEl.style.color = '#e74c3c'; }
    }
}

function closeChangePasswordModal() {
    const overlay = document.getElementById('changePasswordOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        const profileOverlay = document.getElementById('profileOverlay');
        if (!profileOverlay || profileOverlay.style.display !== 'flex') {
            document.body.style.overflow = '';
        }
    }
}

/* ── LOGOUT ── */
function handleLogout() {
    localStorage.clear();
    // Dynamic redirect to login
    const segments = window.location.pathname.split('/').filter(Boolean);
    const rootIndex = Math.max(segments.indexOf('Attendee_Project'), segments.indexOf('www'));
    let depth = (rootIndex !== -1) ? (segments.length - rootIndex - 2) : 1;
    
    const prefix = depth > 0 ? "../".repeat(depth) : "./";
    window.location.href = prefix + 'auth/login.html';
}

/* ── LOAD & DISPLAY PROFILE DATA ── */
async function loadProfileData() {
    const cachedUser = localStorage.getItem('user_profile');
    if (cachedUser) {
        try { displayUserData(JSON.parse(cachedUser)); } catch (e) { console.error(e); }
    }
    
    // FIX: Use current_emp_id (the human-readable ID) instead of the UUID
    const empId = localStorage.getItem('current_emp_id');
    if (!empId) {
        handleLogout();
        return;
    }

    try {
        const result = await API.fetchAccount(empId);
        const data = Array.isArray(result?.data) ? result.data[0] : (result?.data || result);

        if (data && typeof data === 'object' && data.employee_id) {
        displayUserData(data);
        localStorage.setItem('user_profile', JSON.stringify(data));
        }
    } catch (err) {
        console.error('Could not refresh profile data:', err);
    }
}

function displayUserData(user) {
    // Safety check: Don't process if user data is an empty array or null
    if (!user || (Array.isArray(user) && user.length === 0) || Object.keys(user).length === 0) return;

    // Mapping 'admin' or 'super_admin' to pretty text
    const roleLabels = {
        'admin': 'Administrator',
        'super_admin': 'Super Administrator'
    };

    // 1. Get the dynamic role label
    const displayRole = roleLabels[user.roles] || user.roles || 'User';
    
    // 2. Format name
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Administrator';

    // 3. Map to your HTML IDs
    const elements = {
        'user-fullname': displayRole, // Large title now shows the Role
        'user-role-display': user.employee_id || 'N/A',
        'user-username': fullName     // Name is kept here in the field
    };

    // 4. Update the UI
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }
}

/* ── CHANGE PASSWORD ── */
async function handlePasswordChange() {
    // Passwords should not be trimmed as spaces can be intentional
    const currentPw = document.getElementById('currentPw').value;
    const newPw     = document.getElementById('newPw').value;
    const confirmPw = document.getElementById('confirmPw').value;

    if (!currentPw || !newPw || !confirmPw) {
        alert("Please fill in all fields.");
        return;
    }
    if (newPw !== confirmPw) {
        alert("Passwords do not match!");
        return;
    }

    const empId = localStorage.getItem('current_emp_id');
    try {
        const result = await API.changePassword(empId, currentPw, newPw);
        
        // Check specifically for success. apiFetch returns [] on hard failure, so we check for an object with a message or no error.
        if (result && !result.error && !Array.isArray(result)) {
            alert("Password updated successfully! Please log in again with your new credentials.");
            handleLogout(); // Force logout like the reload in login.js
        } else {
            alert(result?.error || result?.message || "Failed to update password. Please check your current password.");
        }
    } catch {
        alert("Connection failed. Ensure the server is reachable.");
    }
}

/* ── EVENT LISTENERS ── */
function initProfileListeners() {
    document.getElementById('closeProfileModal')?.addEventListener('click', closeProfileModal);
    document.getElementById('openChangePassword')?.addEventListener('click', openChangePasswordModal);
    document.getElementById('closeChangePassword')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('submitNewPassword')?.addEventListener('click', handlePasswordChange);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Password Visibility Toggle Logic (matching login.js style)
    document.querySelectorAll('.pw-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.parentElement.querySelector('input');
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.style.opacity = isPassword ? '1' : '0.35';
        });
    });

    const profileOverlay = document.getElementById('profileOverlay');
    profileOverlay?.addEventListener('click', (e) => { if (e.target === profileOverlay) closeProfileModal(); });

    const pwOverlay = document.getElementById('changePasswordOverlay');
    pwOverlay?.addEventListener('click', (e) => { if (e.target === pwOverlay) closeChangePasswordModal(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (pwOverlay?.style.display === 'flex') closeChangePasswordModal();
            else if (profileOverlay?.style.display === 'flex') closeProfileModal();
        }
    });
}

/* ── INIT (called by navigation.js after script loads) ── */
function initProfile() {
    injectProfileModals();
    initProfileListeners();
}

/* ── EXPORTS ── */
window.initProfile          = initProfile;
window.openProfileModal     = openProfileModal;
window.closeProfileModal    = closeProfileModal;
window.initProfileListeners = initProfileListeners;
window.handleLogout         = handleLogout;