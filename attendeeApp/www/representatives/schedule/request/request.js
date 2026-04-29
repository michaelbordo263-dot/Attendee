import { fetchMedreps } from '../../../common/backend_connection.js';

// =====================================
//  CONFIG & URL HANDLING (UUID ONLY)
// =====================================
const urlParams = new URLSearchParams(window.location.search);
const selectedRepId = urlParams.get('id');

const BASE_URL = "http://26.209.189.89:5000/api";

let currentYear = new Date().getFullYear();
let minYear = currentYear;
let maxYear = currentYear;

// =====================================
//  INITIALIZE UI ELEMENTS
// =====================================
const yearLabel  = document.getElementById('yearLabel');
const prevBtn    = document.getElementById('prevYear');
const nextBtn    = document.getElementById('nextYear');
const navSchedule = document.getElementById('navSchedule');
const alertDot   = document.querySelector('.alert-dot');

// OPTIONAL HEADER (SAFE FALLBACK)
const repNameEl = document.getElementById('repName');
const repAreaEl = document.getElementById('repArea');

// =====================================
//  SAFE HEADER (NO API DEPENDENCY)
// =====================================
function setFallbackHeader() {
    if (repNameEl) repNameEl.textContent = "Medical Representative";
    if (repAreaEl) repAreaEl.textContent = "Assignment Area";
}

// =====================================
//  NAVIGATION
// =====================================
if (navSchedule && selectedRepId) {
    navSchedule.onclick = () => {
        const safeId = encodeURIComponent(String(selectedRepId).trim());
        window.location.href = `../schedule.html?id=${safeId}`;
    };
}

// =====================================
//  BOOTSTRAP
// =====================================
async function init() {
    if (!selectedRepId) {
        console.error("❌ No ID provided in URL");
        setFallbackHeader();
        return;
    }

    // Always set header immediately (no loading stuck)
    setFallbackHeader();

    // Fetch real name and area
    await updateHeaderDetails();

    try {
        const yearRes = await fetch(`${BASE_URL}/requests/years/${selectedRepId}`);

        if (yearRes.ok) {
            const yearData = await yearRes.json();

            if (yearData.years && yearData.years.length > 0) {
                minYear = Math.min(...yearData.years);
                maxYear = Math.max(...yearData.years);
                currentYear = maxYear;
            }
        }
    } catch (e) {
        console.warn("⚠ Could not fetch year range", e);
    }

    await checkAnyPending();
    updateYearDisplay();
}

async function updateHeaderDetails() {
    try {
        const result = await fetchMedreps();
        if (result && (result.success || Array.isArray(result))) {
            // Extract array from various potential backend structures
            let reps = result.data || result.medreps || result.representatives || result;
            if (!Array.isArray(reps)) {
                reps = Object.keys(result)
                    .filter(key => !isNaN(key))
                    .sort((a, b) => Number(a) - Number(b))
                    .map(key => result[key]);
            }

            // Find the rep matching our ID
            const foundRep = (reps || []).find(rep => 
                String(rep.uuid || rep.uui || rep.id || rep.employee_id || rep.user_id) === String(selectedRepId)
            );

            if (foundRep) {
                const f = foundRep.first_name || foundRep.FirstName || '';
                const l = foundRep.last_name || foundRep.LastName || '';
                const fullName = `${f} ${l}`.trim();
                const area = foundRep.area || 'Assignment Area';

                if (repNameEl) repNameEl.textContent = fullName;
                if (repAreaEl) repAreaEl.textContent = area;
            }
        }
    } catch (err) {
        console.error("Error updating request header:", err);
    }
}

// =====================================
//  CHECK PENDING
// =====================================
async function checkAnyPending() {
    if (!alertDot) return;

    try {
        const res = await fetch(`${BASE_URL}/requests/has-pending/${selectedRepId}`);

        if (res.ok) {
            const data = await res.json();
            alertDot.style.display = data.has_pending ? 'inline-block' : 'none';
        } else {
            alertDot.style.display = 'none';
        }
    } catch (e) {
        console.warn("⚠ Pending check failed", e);
        alertDot.style.display = 'none';
    }
}

// =====================================
//  FETCH QUARTERS
// =====================================
async function fetchAllQuarterStatuses() {
    if (!selectedRepId) return;

    [1, 2, 3, 4].forEach(q => setCardLoading(q));

    try {
        const response = await fetch(
            `${BASE_URL}/requests/status/${selectedRepId}?year=${currentYear}`
        );

        if (!response.ok) throw new Error("Failed to fetch status");

        const data = await response.json();
        const statusMap = data.quarters_with_pending;

        [1, 2, 3, 4].forEach(q => {
            updateCardUI(q, statusMap[`q${q}`]);
        });

    } catch (error) {
        console.error("❌ Fetch Error:", error);
        [1, 2, 3, 4].forEach(q => updateCardUI(q, 'none'));
    }
}

// =====================================
//  LOADING STATE
// =====================================
function setCardLoading(qNumber) {
    const card = document.getElementById(`q-card-${qNumber}`);
    if (!card) return;

    const badge = card.querySelector('.status-badge');

    card.classList.remove('status-none', 'pending', 'approved');
    card.style.pointerEvents = 'none';
    card.style.opacity = '0.6';

    if (badge) {
        badge.textContent = 'Loading...';
    }
}

// =====================================
//  UPDATE UI
// =====================================
function updateCardUI(qNumber, status) {
    const card = document.getElementById(`q-card-${qNumber}`);
    if (!card) return;

    const badge = card.querySelector('.status-badge');
    const dot   = card.querySelector('.red-dot');

    card.classList.remove('status-none', 'pending', 'approved');
    if (badge) badge.classList.remove('none', 'pending', 'approved');

    const normalizedStatus = status ? status.toLowerCase() : 'none';

    if (normalizedStatus === 'pending') {
        card.classList.add('pending');
        if (badge) { badge.classList.add('pending'); badge.textContent = 'Pending'; }
        if (dot) dot.style.display = 'block';

        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
        card.style.cursor = 'pointer';

    } else if (normalizedStatus === 'approved') {
        card.classList.add('approved');
        if (badge) { badge.classList.add('approved'); badge.textContent = 'Approved'; }
        if (dot) dot.style.display = 'none';

        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
        card.style.cursor = 'pointer';

    } else {
        card.classList.add('status-none');
        if (badge) { badge.classList.add('none'); badge.textContent = 'No Request Yet'; }
        if (dot) dot.style.display = 'none';

        card.style.pointerEvents = 'none';
        card.style.opacity = '0.7';
        card.style.cursor = 'default';
    }
}

// =====================================
//  YEAR NAVIGATION
// =====================================
function updateYearDisplay() {
    if (yearLabel) yearLabel.textContent = currentYear;

    if (prevBtn) prevBtn.disabled = currentYear <= minYear;
    if (nextBtn) nextBtn.disabled = currentYear >= maxYear;

    fetchAllQuarterStatuses();
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (currentYear > minYear) {
            currentYear--;
            updateYearDisplay();
        }
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        if (currentYear < maxYear) {
            currentYear++;
            updateYearDisplay();
        }
    });
}

// =====================================
//  CARD CLICK → DETAILS
// =====================================
window.handleCardClick = function(qNumber) {
    const safeId = encodeURIComponent(String(selectedRepId).trim());

    window.location.href =
        `request_details/request_details.html?q=${qNumber}&year=${currentYear}&id=${safeId}`;
};

// =====================================
//  START
// =====================================
init();