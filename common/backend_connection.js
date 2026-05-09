/* =========================================================
    🔧 CENTRAL API CONNECTION MODULE (GLOBAL VERSION)
========================================================= */

/*Coolify Connection
window.BASE_URL = "http://s9fl1d5oewnuc80uxtd5mwz3.148.230.102.204.sslip.io/api";
*/

/**/
window.BASE_URL = "http://127.0.0.1:5000/api";


/* ── UI NOTIFICATIONS ── */
function showNotification(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-weight:700; font-size:14px;">${message}</span>
        </div>
        <span style="margin-left:20px; cursor:pointer; font-weight:900; opacity:0.4" onclick="this.parentElement.remove()">✕</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

/* ── CORE FETCH ── */
async function apiFetch(url, method = "GET", body = null) {
    console.log(`🌐 API CALL → [${method}]`, url);

    try {
        const options = {
            method,
            headers: {}
        };

        if (body) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        const res = await fetch(url, options);

        // Global Auth Handler
        if (res.status === 401 && !url.includes('change-password')) {
            showNotification("Session expired. Redirecting...", "error");
            localStorage.clear();
            setTimeout(() => {
                window.location.href = '../auth/login.html';
            }, 1500);
            return [];
        }

        console.log("📡 STATUS →", res.status);

        const text = await res.text();

        try {
            const data = JSON.parse(text);
            if (!res.ok) {
                console.error(`❌ API ERROR [${res.status}] →`, data.error || data.message || data);
            }
            return data;
        } catch (err) {
            console.error(`❌ API ERROR [${res.status}] Non-JSON response →`, text);
            return [];
        }

    } catch (err) {
        console.error("❌ FETCH ERROR →", url, err);
        showNotification("Network error. Please check your connection.", "error");
        return [];
    }
}

/* =========================================================
    🌍 GLOBAL API (CLEAN + CENTRALIZED)
========================================================= */

window.API = {
    BASE_URL: window.BASE_URL,
    apiFetch,
    showNotification,

    /* ── DASHBOARD ── */
    fetchDashboard: (q, year) =>
        apiFetch(`${BASE_URL}/dashboard/summary?q=${q}&year=${year}`),

    fetchPerformance: () =>
        apiFetch(`${BASE_URL}/dashboard/performance`),

    fetchPerformanceByPeriod: (q, year) =>
        apiFetch(`${BASE_URL}/performance?q=${q}&year=${year}`),

    fetchMedrepPerformanceDetails: (userId, quarter, year) =>
        apiFetch(`${BASE_URL}/medrep/performance?user_id=${userId}&quarter=${quarter}&year=${year}`),

    fetchSchedules: (status, q, year) =>
        apiFetch(`${BASE_URL}/dashboard/schedules?status=${status}&q=${q}&year=${year}`),

    fetchProducts: () =>
        apiFetch(`${BASE_URL}/dashboard/products`),

    fetchUnusual: (q, year) =>
        apiFetch(`${BASE_URL}/dashboard/unusual?q=${q}&year=${year}`),

    /* ── MEDREPS ── */
    fetchMedreps: () =>
        apiFetch(`${BASE_URL}/medreps`),

    /* ── SCHEDULE ── */
    fetchScheduleByRep: (repId) =>
        apiFetch(`${BASE_URL}/dcp/schedule/${repId}`),

    fetchDCPByRep: (repId, year) =>
        apiFetch(`${BASE_URL}/cds_dcp/fetch_quarter_status/${repId}?year=${year || new Date().getFullYear()}`),

    /* ── REQUESTS ── */
    fetchRequestYears: (repId) =>
        apiFetch(`${BASE_URL}/requests/years/${repId}`),

    fetchHasPending: (repId) =>
        apiFetch(`${BASE_URL}/requests/has-pending/${repId}`),

    fetchRequestDetails: (repId, quarter, year) =>
        apiFetch(`${BASE_URL}/requests/details?id=${repId}&quarter=${quarter}&year=${year}`),

    updateGlobalStatus: (payload) =>
        apiFetch(`${BASE_URL}/requests/update-status`, "POST", payload),

    fetchQuarterStatus: (repId, year) =>
        apiFetch(`${BASE_URL}/requests/status/${repId}?year=${year}`),

    /* ── SUMMARY ── */
    fetchSummary: (id, quarter, year) =>
        apiFetch(`${BASE_URL}/summary?id=${id}&quarter=${quarter}&year=${year}`),

    /* ── ACCOUNTS ── */
    fetchAccounts: () =>
        apiFetch(`${BASE_URL}/accounts`),

    fetchAccount: (id) =>
        apiFetch(`${BASE_URL}/accounts/${id}`),

    createAccount: (payload) =>
        apiFetch(`${BASE_URL}/accounts`, "POST", payload),

    updateAccount: (empId, payload) =>
        apiFetch(`${BASE_URL}/accounts/${empId}`, "PUT", payload),

    /**
     * 🔹 FIXED: Uses UUID (user_id) instead of Employee ID.
     * Supabase Auth Admin API requires the UUID to update credentials[cite: 7].
     */
    changePassword: (empId, currentPw, newPw) => {
        const userId = localStorage.getItem('user_id');
        
        if (!userId) {
            console.error("❌ Error: user_id (UUID) not found in localStorage.");
            showNotification("Session error. Please try logging in again.", "error");
            return { error: "Session identification missing" };
        }

        return apiFetch(`${BASE_URL}/accounts/${userId}/change-password`, "POST", { 
            new_password: newPw 
        });
    },

    /* ── RESET ACCOUNT STATUS (FORCE CHANGE) ── */
    resetAccountStatus: (user_id) => {
        return apiFetch(`${BASE_URL}/accounts/${user_id}/reset-password`, "POST");
    },

    fetchDoctorDetails: (id) =>
        apiFetch(`${BASE_URL}/doctor_details/${id}`),

    /* ── CDS/DCP UPLOADS ── */
    uploadCDS: (formData) =>
        fetch(`${BASE_URL}/cds_dcp/upload_cds`, {
            method: "POST",
            body: formData
        }),

    uploadDCP: (formData) =>
        fetch(`${BASE_URL}/cds_dcp/upload_dcp`, {
            method: "POST",
            body: formData
        }),

    syncUnmatchedToCDS: (body) =>
        fetch(`${BASE_URL}/cds_dcp/sync_unmatched_to_cds`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }),

    /* ── PRODUCTS ── */
    addProduct: (formData) =>
        fetch(`${BASE_URL}/dashboard/products/add`, {
            method: "POST",
            body: formData
        }),

    /* ── AUTH ── */
    /**
     * 🔹 FIXED: Captures the user_id (UUID) and saves it to localStorage.
     * This ensures the changePassword function has the UUID it needs[cite: 13, 14].
     */
    loginUser: async (employee_id, password) => {
        const result = await apiFetch(`${BASE_URL}/auth/login`, "POST", {
            employee_id,
            password
        });

        if (result && result.user && result.user.id) {
            localStorage.setItem('user_id', result.user.id);
            localStorage.setItem('current_emp_id', result.user.employee_id);
            localStorage.setItem('user_profile', JSON.stringify(result.user));
        }
        
        return result;
    },

    updateFirstPassword: (userId, newPassword) =>
        apiFetch(`${BASE_URL}/auth/update-first-password`, "POST", {
            user_id: userId,
            new_password: newPassword
        })
};