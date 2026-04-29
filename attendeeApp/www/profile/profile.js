/* profile/profile.js */

const API_BASE = "http://26.209.189.89:5000";

/* ── OPEN / CLOSE HELPERS ── */
function openProfileModal() {
    const overlay = document.getElementById('profileOverlay');
    overlay.style.display = 'flex';
    loadProfileData();
}

function closeProfileModal() {
    document.getElementById('profileOverlay').style.display = 'none';
}

function openChangePasswordModal() {
    document.getElementById('changePasswordOverlay').style.display = 'flex';
    // Clear fields
    document.getElementById('currentPw').value = '';
    document.getElementById('newPw').value = '';
    document.getElementById('confirmPw').value = '';
    document.getElementById('pwError').textContent = '';
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordOverlay').style.display = 'none';
}

/* ── LOAD PROFILE DATA ── */
async function loadProfileData() {
    const empId = localStorage.getItem('current_emp_id');

    // Set employee ID immediately
    const empIdEl = document.getElementById('profile-emp-id');
    if (empIdEl) empIdEl.textContent = empId || '—';

    if (!empId) {
        document.getElementById('profile-first-name').textContent = 'Unknown';
        document.getElementById('profile-last-name').textContent = 'User';
        document.getElementById('profile-role').textContent = '—';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/accounts/${empId}`);
        const result = await response.json();

        if (response.ok && result.data) {
            const data = Array.isArray(result.data) ? result.data[0] : result.data;
            document.getElementById('profile-first-name').textContent = data.first_name || '—';
            document.getElementById('profile-last-name').textContent  = data.last_name  || '—';
            document.getElementById('profile-role').textContent       = data.role        || '—';
        } else {
            throw new Error(result.error || 'Not found');
        }
    } catch (err) {
        console.error('Profile load error:', err);
        document.getElementById('profile-first-name').textContent = 'Server';
        document.getElementById('profile-last-name').textContent  = 'Offline';
        document.getElementById('profile-role').textContent       = '—';
    }
}

/* ── CHANGE PASSWORD SUBMIT ── */
async function handlePasswordChange() {
    const currentPw = document.getElementById('currentPw').value.trim();
    const newPw     = document.getElementById('newPw').value.trim();
    const confirmPw = document.getElementById('confirmPw').value.trim();
    const errorEl   = document.getElementById('pwError');
    errorEl.textContent = '';

    if (!currentPw || !newPw || !confirmPw) {
        errorEl.textContent = 'Please fill in all fields.'; return;
    }
    if (newPw !== confirmPw) {
        errorEl.textContent = 'New passwords do not match.'; return;
    }
    if (newPw.length < 4) {
        errorEl.textContent = 'Password must be at least 4 characters.'; return;
    }

    const empId = localStorage.getItem('current_emp_id');
    try {
        const res = await fetch(`${API_BASE}/api/accounts/${empId}/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: currentPw, new_password: newPw })
        });
        const data = await res.json();
        if (res.ok) {
            errorEl.style.color = '#27ae60';
            errorEl.textContent = 'Password updated successfully!';
            setTimeout(closeChangePasswordModal, 1500);
        } else {
            errorEl.style.color = '#e74c3c';
            errorEl.textContent = data.error || 'Failed to update password.';
        }
    } catch {
        errorEl.style.color = '#e74c3c';
        errorEl.textContent = 'Server is not reachable.';
    }
}

/* ── EVENT LISTENERS ── */
// Called by navigation.js AFTER it injects the modal HTML into the page
function initProfileListeners() {
    document.getElementById('closeProfileModal')?.addEventListener('click', closeProfileModal);
    document.getElementById('openChangePassword')?.addEventListener('click', openChangePasswordModal);
    document.getElementById('closeChangePassword')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('submitNewPassword')?.addEventListener('click', handlePasswordChange);

    document.getElementById('profileOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('profileOverlay')) closeProfileModal();
    });
    document.getElementById('changePasswordOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('changePasswordOverlay')) closeChangePasswordModal();
    });
}

/* ── EXPORTS ── */
window.openProfileModal      = openProfileModal;
window.closeProfileModal     = closeProfileModal;
window.initProfileListeners  = initProfileListeners;