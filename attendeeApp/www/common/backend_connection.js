/* =========================================================
    🔧 CENTRAL API CONNECTION (TOGGLE SWITCH)
========================================================= */

// --- 🟢 STEP 1: CHOOSE YOUR ENVIRONMENT ---

const ENV_URL = "https://api.premierpharmaceuticalsmarketingcorporation.cloud/api"; // COOLIFY (Production)

// --- 🔵 STEP 2: GLOBAL ASSIGNMENT ---
window.BASE_URL = ENV_URL;

console.log("🚀 API SOURCE SET TO:", window.BASE_URL);

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

/* ── MODIFIED CORE FETCH ── */
async function apiFetch(url, method = "GET", body = null) {
    console.log(`🌐 API CALL → [${method}]`, url);

    // 1. Retrieve current credentials from storage
    const userId = localStorage.getItem('user_id');
    const deviceId = localStorage.getItem('device_id');

    try {
        const options = {
            method,
            headers: {
                // 2. Attach security headers
                "X-User-ID": userId || "",
                "X-Device-ID": deviceId || ""
            }
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

    fetchScheduleTodayAll: () =>
        apiFetch(`${BASE_URL}/dashboard/schedule-today/all`),

    fetchPerformance: () =>
        apiFetch(`${BASE_URL}/dashboard/performance`),

    fetchPerformanceByPeriod: (month, year) =>
        apiFetch(`${BASE_URL}/performance?month=${month}&year=${year}`),

    fetchMedrepPerformanceDetails: (userId, month, year) =>
        apiFetch(`${BASE_URL}/medrep/performance?user_id=${userId}&month=${month}&year=${year}`),

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

    /* ── CRASH REPORTS ── */
    fetchCrashReports: (status) =>
        apiFetch(`${BASE_URL}/crash-reports${status ? `?status=${status}` : ''}`),

    fetchUnresolvedCrashCount: () =>
        apiFetch(`${BASE_URL}/crash-reports/unresolved-count`),

    updateCrashReport: (crashId, resolved) =>
        apiFetch(`${BASE_URL}/crash-reports/${crashId}`, "PATCH", { resolved }),

    /* ── CHANGE PASSWORD ── */
     
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

    // NEW
    fetchDoctorDetails: (id, dcpId) =>
        apiFetch(`${BASE_URL}/doctor_details/${id}${dcpId ? `?dcp_id=${dcpId}` : ''}`),

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
    /* ── AUTH ── */
    loginUser: async (employee_id, password) => {
    const result = await apiFetch(`${BASE_URL}/auth/login`, "POST", {
        employee_id,
        password
    });

    if (result && result.user && result.user.id) {
        localStorage.setItem('user_id', result.user.id);
        localStorage.setItem('device_id', result.device_id); // <--- ADD THIS
        localStorage.setItem('current_emp_id', result.user.employee_id);
        localStorage.setItem('user_profile', JSON.stringify(result.user));
    }
    
    return result;
},

    updateFirstPassword: (userId, newPassword) =>
        apiFetch(`${BASE_URL}/auth/update-first-password`, "POST", {
            user_id: userId,
            new_password: newPassword
        }
    
    )
        
};

/* --- ULTRA-LIGHT BOOTER --- */
/* --- PRODUCTION-READY LIGHT BOOTER --- */
// ==========================================
// CENTRALIZED SESSION SECURITY (THE BOOTER)
// ==========================================
/* --- INSTANT-REACTION SECURITY LOCKOUT --- */
let lastSecurityCheck = 0;
const SECURITY_COOLDOWN = 3000; // Reduced to 3s for a snappier response

function showBootModal() {
    if (document.getElementById('security-lockout-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = "security-lockout-overlay";
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #0f172a; display: flex; align-items: center; 
        justify-content: center; z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background: #ffffff; width: 90%; max-width: 400px; padding: 40px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-top: 6px solid #dc2626;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <div style="background: #fee2e2; padding: 12px; border-radius: 50%; margin-right: 16px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h2 style="margin: 0; font-size: 1.3rem; font-weight: 800; color: #111827; letter-spacing: -0.025em;">Security Conflict</h2>
            </div>
            
            <p style="margin: 0 0 28px 0; font-size: 0.95rem; line-height: 1.6; color: #4b5563;">
                Your session has been terminated because this account was logged into from another device. For your protection, you have been disconnected.
            </p>

            <button onclick="window.location.replace(window.location.origin + '/auth/login.html')" 
                style="width: 100%; background: #111827; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;">
                Return to Login
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
}

async function runSecuritySync() {
    // 🛑 THE BYPASS: If the URL has 'login', STOP immediately.
    // This prevents the script from ever hitting the server or showing a popup.
    const url = window.location.href.toLowerCase();
    if (url.includes('login.html')) {
        return; 
    }

    // Existing session check
    const uid = localStorage.getItem('user_id');
    const did = localStorage.getItem('device_id');
    
    // If not logged in, also stop
    if (!uid || !did) return;

    const now = Date.now();
    // Only block if a check happened less than 3 seconds ago
    if (now - lastSecurityCheck < SECURITY_COOLDOWN) return;
    lastSecurityCheck = now;

    try {
        const response = await fetch(`${window.BASE_URL}/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: uid, device_id: did })
        });

        if (response.status === 401) {
            localStorage.clear();
            showBootModal();
            // Stop all further checks once booted
            lastSecurityCheck = Infinity; 
        }
    } catch (err) {
        console.warn("Security sync: connection unstable.");
    }
}

// ── HIGH-SPEED TRIGGERS ──
// Trigger on click, move, scroll, and touch for absolute "instant" feel
['mousedown', 'mousemove', 'wheel', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, runSecuritySync, { passive: true });
});

// Trigger the moment the window is focused or tab becomes visible
window.addEventListener('focus', runSecuritySync);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runSecuritySync();
});

// Light background heartbeat for idle tabs (every 1 minute)
setInterval(runSecuritySync, 60000);