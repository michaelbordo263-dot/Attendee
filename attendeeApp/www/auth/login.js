document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const forceChangeForm = document.getElementById('forceChangeForm');

    /* ── Toast Helper ── */
    function showToast(msg) {
        const t = document.getElementById('loginToast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }

    // --- 0. PRE-FLIGHT CHECK ---
    try {
        const response = await fetch(window.BASE_URL);
        if (!response.ok) console.warn("Backend is reachable but returned an error.");
    } catch (err) {
        console.error("Backend unreachable. Ensure your Flask server is running.");
        showToast("Cannot connect to the server.");
    }

    // --- 1. Password Visibility Toggles ---
    const setupToggle = (buttonId, inputId) => {
        const btn = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.style.opacity = isPassword ? '1' : '0.35';
            });
        }
    };

    setupToggle('togglePassword', 'password');
    setupToggle('toggleNewPassword', 'newPassword');
    setupToggle('toggleConfirmPassword', 'confirmPassword');

    // --- 2. Main Login Logic ---
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const empId = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value;

            if (!empId || !pass) {
                showToast("Please enter both Employee ID and Password.");
                return;
            }

            try {
                const result = await API.loginUser(empId, pass);
                
                if (result && result.user) {
                    const user = result.user;

                    // RULE: Admin roles only
                    const allowedRoles = ['admin', 'super_admin'];
                    if (!allowedRoles.includes(user.roles)) {
                        showToast("Access Denied: Administrators only.");
                        return;
                    }

                    // RULE: Block inactive accounts
                    if (user.status === 'inactive') {
                        showToast("Access Denied: Your account is inactive.");
                        return;
                    }

                    // RULE: Handle Forced Password Change
                    if (user.is_New === true) {
                        localStorage.setItem('temp_user_id', user.id);

                        const hiddenUser = document.getElementById('forceUsername');
                        if (hiddenUser) hiddenUser.value = empId;

                        document.getElementById('loginArea').style.display = 'none';
                        document.getElementById('forceChangePasswordArea').style.display = 'block';
                        return;
                    }

                    saveSessionAndRedirect(result);
                } else {
                    showToast(result?.message || result?.error || "Invalid Credentials");
                }
            } catch (err) {
                console.error("Connection error:", err);
                showToast("Connection failed. Check your backend.");
            }
        });
    }

    // --- 3. Handle Forced Password Change ---
    if (forceChangeForm) {
        forceChangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = localStorage.getItem('temp_user_id'); 
            const currentPass = document.getElementById('password').value; 
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            if (!userId) {
                showToast("Session expired. Please log in again.");
                setTimeout(() => window.location.reload(), 2600);
                return;
            }

            if (newPass.length < 8) {
                showToast("Password must be at least 8 characters.");
                return;
            }

            if (newPass !== confirmPass) {
                showToast("Passwords do not match!");
                return;
            }

            if (newPass === currentPass) {
                showToast("New password cannot be the same as the current one.");
                return;
            }

            try {
                const result = await API.changePassword(userId, currentPass, newPass);

                if (result && !result.error) {
                    showToast("Password updated! Please login with your new password.");
                    localStorage.removeItem('temp_user_id');
                    setTimeout(() => window.location.reload(), 2600);
                } else {
                    showToast(result.error || "Failed to update password.");
                }
            } catch (err) {
                console.error("Update error:", err);
                showToast("An error occurred. Please try again.");
            }
        });
    }

    function saveSessionAndRedirect(data) {
        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('current_emp_id', data.user.employee_id);
        localStorage.setItem('device_id', data.device_id || 'unknown');
        localStorage.setItem('user_profile', JSON.stringify(data.user));
        
        window.location.href = '../dashboard/dashboard.html';
    }
});