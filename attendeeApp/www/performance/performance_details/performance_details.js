/* ============================================================
   performance_details.js — WHOLE NUMBER ROUNDING VERSION
   ============================================================ */

const BASE_URL = "http://26.209.189.89:5000";

function goBack() {
    history.back();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const now = new Date();

    // FORCE CURRENT QUARTER:
    // This ensures that since today is April 19, 2026, it forces 'Q2'.
    const currentRealQuarter = getCurrentQuarter();

    const repData = {
        name:    params.get('name') || 'Medical Representative',
        loc:     params.get('location') || params.get('area') || 'Assignment Area',
        id:      params.get('user_id') || params.get('id'),
        quarter: currentRealQuarter, 
        year:    params.get('year') || now.getFullYear().toString()
    };

    // Update UI Header
    document.getElementById('repName').textContent = repData.name;
    document.getElementById('repLoc').textContent  = repData.loc;
    document.getElementById('quarterBadge').textContent = `${repData.quarter} · ${repData.year}`;

    if (repData.id) {
        fetchPerformanceData(repData);
    } else {
        console.error("No User ID provided.");
        document.getElementById('repName').textContent = "User ID Missing";
    }
});

/* ============================================================
   HELPERS
   ============================================================ */
function getCurrentQuarter() {
    const m = new Date().getMonth(); 
    if (m <= 2) return 'Q1';
    if (m <= 5) return 'Q2';
    if (m <= 8) return 'Q3';
    return 'Q4';
}

/* ============================================================
   FETCH DATA
   ============================================================ */
async function fetchPerformanceData(rep) {
    try {
        const url = `${BASE_URL}/api/medrep/performance?user_id=${rep.id}&quarter=${rep.quarter}&year=${rep.year}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Network error");

        const data = await res.json();

        if (data.error) {
            console.error("API Error:", data.error);
            return;
        }

        updateScore(data.scores);
        renderMostVisited(data.top_doctors);

    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

/* ============================================================
   UPDATE SCORE UI (ROUNDED TO WHOLE NUMBERS)
   ============================================================ */
function updateScore(s) {
    if (!s) return;

    // Using Math.floor() to always round down to the nearest whole number
    document.getElementById('cvOnTime').textContent     = `${Math.floor(s.on_time ?? 0)}%`;
    document.getElementById('cvAttendance').textContent = `${Math.floor(s.attendance ?? 0)}%`;
    document.getElementById('cvVisits').textContent     = `${Math.floor(s.visits_done ?? 0)}%`;
    document.getElementById('cvMissing').textContent    = `${Math.floor(s.missed_visits ?? 0)}%`;

    const pct  = Math.floor(s.overall_average || 0);
    const ring = document.getElementById('ring');
    const circ = 2 * Math.PI * 66;

    document.getElementById('pctLabel').textContent = `${pct}%`;

    const color =
        pct >= 80 ? '#3ecf5a' :
        pct >= 50 ? '#f0a030' :
                    '#e05c5c';

    ring.style.stroke = color;

    requestAnimationFrame(() => {
        ring.style.strokeDashoffset = circ * (1 - pct / 100);
    });
}

/* ============================================================
   SIGNATURE LEADER (TOP DOCTORS)
   ============================================================ */
function renderMostVisited(doctors) {
    const container = document.getElementById('mvdList');
    if (!container) return;

    container.innerHTML = '';

    if (!doctors || doctors.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; opacity:0.6;">
                <p>No signed visits recorded for this quarter.</p>
            </div>`;
        return;
    }

    // --- ADDED LIMIT HERE ---
    // .slice(0, 10) takes only the first 10 items from the array
    const limitedDoctors = doctors.slice(0, 10);

    limitedDoctors.forEach((doc, i) => {
        const rank = i + 1;
        
        // ... rest of your existing logic (displayName, displayLoc, etc.)
        const displayName = doc.name || doc.pharmacy_name || 'Unknown Entity';
        const displayLoc = (doc.location && doc.location !== 'N/A') 
            ? doc.location 
            : (doc.city_address_province || 'Location N/A');

        const total = doc.total_visits_planned || 0;
        const signed = doc.signed_visits || 0;
        const pct = total > 0 ? Math.floor((signed / total) * 100) : 0;
        const isComplete = signed === total;
        const barColor = isComplete ? '#3ecf5a' : '#1e6fa8';
        const initials = displayName.charAt(0).toUpperCase();

        const el = document.createElement('div');
        el.className = 'mvd-item';
        el.innerHTML = `
            <div class="mvd-rank">#${rank}</div>
            <div class="mvd-av">${initials}</div>
            <div class="mvd-body">
                <div class="mvd-top-row">
                    <div>
                        <div class="mvd-name">${displayName}</div>
                        <div class="mvd-loc">${displayLoc}</div>
                    </div>
                </div>
                <div class="mvd-bar-row">
                    <div class="mvd-bar-bg">
                        <div class="mvd-bar-fill" style="width:0%; background:${barColor}; transition: width 0.8s ease;" data-target="${pct}"></div>
                    </div>
                    <div class="mvd-bar-meta"><b>${signed}/${total}</b></div>
                </div>
            </div>`;
        container.appendChild(el);
    });

    setTimeout(() => {
        container.querySelectorAll('.mvd-bar-fill').forEach(b => {
            b.style.width = b.dataset.target + '%';
        });
    }, 300);
}