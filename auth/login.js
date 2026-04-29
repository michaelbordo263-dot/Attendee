document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const forceChangeForm = document.getElementById('forceChangeForm');

    // 1. Password Visibility Toggle
    document.getElementById('togglePassword').addEventListener('click', () => {
        const passInput = document.getElementById('password');
        const isPassword = passInput.type === 'password';
        passInput.type = isPassword ? 'text' : 'password';
        document.getElementById('togglePassword').style.opacity = isPassword ? '1' : '0.35';
    });

    // 2. Main Login Logic
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const empId = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        try {
            const result = await API.loginUser(empId, pass);
            
            if (result && result.user) {
                const user = result.user;

                // RULE: Must be Admin
                if (user.roles !== 'admin' && user.roles !== 'super_admin') {
                    alert("Access Denied: This portal is for Administrators only.");
                    return;
                }

                // RULE: Check if account is new
                if (user.is_New === true) {
                    document.getElementById('loginArea').style.display = 'none';
                    document.getElementById('forceChangePasswordArea').style.display = 'block';
                    // Store ID temporarily for the password update
                    localStorage.setItem('temp_user_id', user.id); 
                    return;
                }

                // SUCCESS: Logged in and not a new user
                saveSessionAndRedirect(result);
            } else {
                alert(result?.message || result?.error || "Invalid Credentials");
            }
        } catch (err) {
            console.error("Connection error:", err);
            alert("Connection failed. Ensure Radmin VPN is connected.");
        }
    });

    // 3. Handle Forced Password Change
    forceChangeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        const userId = localStorage.getItem('temp_user_id');

        if (newPass !== confirmPass) {
            alert("Passwords do not match!");
            return;
        }

        try {
            const result = await API.updateFirstPassword(userId, newPass);

            if (result && !result.error) {
                alert("Password updated successfully!");
                // Clear temp ID and redirect
                localStorage.removeItem('temp_user_id');
                window.location.reload(); // Reload to login with new password
            }
        } catch (err) {
            alert("Failed to update password.");
        }
    });

    function saveSessionAndRedirect(data) {
    // Save the identifiers
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('current_emp_id', data.user.employee_id);
    localStorage.setItem('device_id', data.device_id);
    
    // Save the user details as a string so profile.js can read them immediately
    localStorage.setItem('user_profile', JSON.stringify(data.user));
    
    window.location.href = '../dashboard/dashboard.html';
}
});