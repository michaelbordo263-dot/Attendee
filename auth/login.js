document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const forceChangeForm = document.getElementById('forceChangeForm');

    // --- 0. PRE-FLIGHT CHECK ---
    try {
        const response = await fetch('http://127.0.0.1:5000/api/health');
        if (!response.ok) console.warn("Backend is reachable but returned an error.");
    } catch (err) {
        console.error("Backend unreachable. Ensure your Flask server is running at http://127.0.0.1:5000");
        alert("Cannot connect to the server. Please ensure the Python backend is running.");
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
                alert("Please enter both Employee ID and Password.");
                return;
            }

            try {
                const result = await API.loginUser(empId, pass);
                
                if (result && result.user) {
                    const user = result.user;

                    // RULE: Admin roles only
                    const allowedRoles = ['admin', 'super_admin'];
                    if (!allowedRoles.includes(user.roles)) {
                        alert("Access Denied: This portal is for Administrators only.");
                        return;
                    }

                    // RULE: Handle Forced Password Change
                    if (user.is_New === true) {
                        // ✅ CRITICAL: Save the UUID temporarily to use for the update route
                        localStorage.setItem('temp_user_id', user.id);

                        const hiddenUser = document.getElementById('forceUsername');
                        if (hiddenUser) hiddenUser.value = empId;

                        document.getElementById('loginArea').style.display = 'none';
                        document.getElementById('forceChangePasswordArea').style.display = 'block';
                        return;
                    }

                    saveSessionAndRedirect(result);
                } else {
                    alert(result?.message || result?.error || "Invalid Credentials");
                }
            } catch (err) {
                console.error("Connection error:", err);
                alert("Connection failed. Ensure your Flask backend is running on port 5000.");
            }
        });
    }

    // --- 3. Handle Forced Password Change ---
    if (forceChangeForm) {
        forceChangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // ✅ We pull the UUID saved during the login attempt
            const userId = localStorage.getItem('temp_user_id'); 
            const currentPass = document.getElementById('password').value; 
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            // Basic validation
            if (!userId) {
                alert("Session expired. Please log in again.");
                window.location.reload();
                return;
            }

            if (newPass.length < 8) {
                alert("Password must be at least 8 characters long.");
                return;
            }

            if (newPass !== confirmPass) {
                alert("Passwords do not match!");
                return;
            }

            if (newPass === currentPass) {
                alert("New password cannot be the same as the temporary password.");
                return;
            }

            try {
                // ✅ Call API using the UUID (userId) instead of just the Employee ID string
                const result = await API.changePassword(userId, currentPass, newPass);

                if (result && !result.error) {
                    alert("Password updated successfully! Please login with your new password.");
                    localStorage.removeItem('temp_user_id'); // Clean up
                    window.location.reload(); 
                } else {
                    alert(result.error || "Failed to update password.");
                }
            } catch (err) {
                console.error("Update error:", err);
                alert("An error occurred while updating the password.");
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