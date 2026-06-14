async function loadHeaderData(empIdParam = null) {
    const empId = empIdParam || localStorage.getItem('current_emp_id');
    
    const nameElement = document.getElementById('rep-name') || document.getElementById('repName'); 
    const locationElement = document.getElementById('rep-location') || document.getElementById('repArea');

    if (!empId) {
        console.error("Header Error: No Employee ID found.");
        return;
    }

    const API_BASE = "window.BASE_URL";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        console.log("Header fetching for ID:", empId);

        const response = await fetch(`${API_BASE}/api/accounts/${empId}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const result = await response.json();

        if (response.ok && result.data) {
            // Handle both object and array responses
            const adminData = Array.isArray(result.data) ? result.data[0] : result.data;

            if (nameElement) {
                const fName = adminData.first_name || "";
                const lName = adminData.last_name || "";
                nameElement.textContent = `${fName} ${lName}`.trim() || "Unknown User";
            }

            if (locationElement) {
                locationElement.textContent = adminData.area || adminData.district || "Main Office";
            }
        } else {
            throw new Error(result.error || "Account not found");
        }

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("Dashboard Connection Error:", error);

        if (nameElement) nameElement.textContent = "Server Offline";
        if (locationElement) locationElement.textContent = "Check Connection";
        
        if (error.name === 'AbortError') {
            console.warn("Connection timeout. Check Radmin IP 26.209.189.89.");
        }
    }
}