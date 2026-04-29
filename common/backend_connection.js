/* =========================================================
   🔧 CENTRAL API CONNECTION MODULE (GLOBAL VERSION)
========================================================= */

window.BASE_URL = "http://s9fl1d5oewnuc80uxtd5mwz3.148.230.102.204.sslip.io/api";

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

        // Global Auth Handler: If server returns Unauthorized, force logout
        if (res.status === 401) {
            localStorage.clear();
            window.location.href = '../auth/login.html';
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
        return [];
    }
}

/* =========================================================
   🌍 GLOBAL API (CLEAN + CENTRALIZED)
========================================================= */

window.API = {
    BASE_URL: window.BASE_URL,
    apiFetch,

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

    fetchDCPByRep: (repId) =>
        apiFetch(`${BASE_URL}/cds_dcp/fetch_quarter_status/${repId}`),

    /* ── REQUESTS ── */
    fetchRequestYears: (repId) =>
        apiFetch(`${BASE_URL}/requests/years/${repId}`),

    fetchHasPending: (repId) =>
        apiFetch(`${BASE_URL}/requests/has-pending/${repId}`),

    fetchRequestDetails: (repId, quarter, year) =>
        apiFetch(`${BASE_URL}/requests/details?id=${repId}&quarter=${quarter}&year=${year}`),

    updateGlobalStatus: (payload) =>
        apiFetch(`${BASE_URL}/dcp/global-status`, "POST", payload),

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

    changePassword: (empId, currentPw, newPw) =>
        apiFetch(`${BASE_URL}/accounts/${empId}/change-password`, "POST", { current_password: currentPw, new_password: newPw }),

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

    // Syncs unmatched DCP rows into the CDS masterlist
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
    loginUser: (employee_id, password) =>
        apiFetch(`${BASE_URL}/auth/login`, "POST", {
            employee_id,
            password
        }),

    updateFirstPassword: (userId, newPassword) =>
        apiFetch(`${BASE_URL}/auth/update-first-password`, "POST", {
            user_id: userId,
            new_password: newPassword
        })
};