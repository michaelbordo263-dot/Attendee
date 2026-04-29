/* BACKEND CONNECTION (TEAM / LAN SETUP) */

const BASE_URL = "http://26.209.189.89:5000";

/* ── GENERIC FETCH FUNCTION ── */
async function callBackend(endpoint, method = "GET", body = null) {
  try {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(BASE_URL + endpoint, options);

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error("Backend error:", data);
      return {
        success: false, // Added for easier checking
        error: data.error || "Something went wrong"
      };
    }

    return { success: true, ...data };

  } catch (err) {
    console.error(`❌ Connection Error (${endpoint}):`, err);
    return {
      success: false,
      error: "Server is not reachable"
    };
  }
}

/* ── API FUNCTIONS ── */

export async function loginUser(employee_id, password) {
  return await callBackend("/api/auth/login", "POST", {
    employee_id: employee_id,
    password: password
  });
}

export async function registerUser(data) {
  return await callBackend("/api/auth/register", "POST", data);
}

export async function fetchMedreps() {
  // Check if your Flask route is "/medreps" or "/api/medreps"
  return await callBackend("/api/medreps", "GET");
}

export async function fetchDashboard() {
  return await callBackend("/api/dashboard", "GET");
}