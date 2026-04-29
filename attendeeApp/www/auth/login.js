document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const empId = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        // 1. DYNAMIC BASE URL (Handles localhost or Network IP automatically)
        const BASE_URL = `http://26.209.189.89:5000`;

        // 2. CALL THE LOGIN ENDPOINT
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                employee_id: empId, 
                password: pass 
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            // 2. SUCCESS: The backend verified the credentials
            console.log("Login successful!");
            
            // Save the ID so we can use it to fetch the account details later
            localStorage.setItem('current_emp_id', empId);
            
            // Redirect to dashboard
            window.location.href = '../dashboard/dashboard.html';
        } else {
            alert(result.error || "Invalid Credentials");
        }
    } catch (err) {
        alert("Connection failed. Is the Flask server running on port 5000?");
    }
});