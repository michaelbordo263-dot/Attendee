// =====================================
//  SECURITY CHECK (SUPER ADMIN ONLY)
// =====================================
(function accessGuard() {
    const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    if (userProfile.roles !== 'super_admin') {
        // Immediately hide UI and redirect unauthorized users
        document.documentElement.style.display = 'none';
        alert("Access Denied: This page is restricted to Super Administrators.");
        window.location.replace('../../../dashboard/dashboard.html');
    }
})();

// =====================================
//  CONFIG & URL HANDLING (UUID ONLY)
// =====================================
const urlParams = new URLSearchParams(window.location.search);
let selectedRepId = urlParams.get('id');
let repName = urlParams.get('name') || "Medical Representative";
let repArea = urlParams.get('area') || "Assignment Area";

// Restore representative state from session storage when the URL does not provide it
const storedRepJson = sessionStorage.getItem('active_rep_data');
const storedRep = storedRepJson ? JSON.parse(storedRepJson) : {};
if (!selectedRepId && storedRep.id) {
    selectedRepId = storedRep.id;
    repName = storedRep.name || repName;
    repArea = storedRep.area || repArea;
}

if (selectedRepId) {
    sessionStorage.setItem('active_rep_data', JSON.stringify({
        id: selectedRepId,
        name: repName,
        area: repArea
    }));
}

let currentYear = new Date().getFullYear();
let minYear = currentYear;
let maxYear = currentYear;

// =====================================
//  INITIALIZE UI ELEMENTS
// =====================================
const yearLabel  = document.getElementById('yearLabel');
const prevBtn    = document.getElementById('prevYear');
const nextBtn    = document.getElementById('nextYear');

// OPTIONAL HEADER (SAFE FALLBACK)
const repNameEl = document.getElementById('repName');
const repAreaEl = document.getElementById('repArea');

// =====================================
//  SAFE HEADER (NO API DEPENDENCY)
// =====================================
function setFallbackHeader() {
    if (repNameEl) repNameEl.textContent = repName;
    if (repAreaEl) repAreaEl.textContent = repArea;
}

// --- BACK BUTTON LOGIC ---
const backBtn = document.getElementById('goBack') || document.querySelector('.back-btn');
if (backBtn) {
    backBtn.onclick = null;
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate back to the medical representative's profile page with clean URL
        window.location.href = `../../representative_details/representative_details.html`;
    });
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
        const yearData = await API.fetchRequestYears(selectedRepId);

        if (yearData && yearData.years && yearData.years.length > 0) {
            minYear = Math.min(...yearData.years);
            maxYear = Math.max(...yearData.years);
            currentYear = new Date().getFullYear();  // ← stays on real current year
            if (currentYear < minYear) currentYear = minYear;
            if (currentYear > maxYear) currentYear = maxYear;
        }
    } catch (e) {
        console.warn("⚠ Could not fetch year range", e);
    }

    updateYearDisplay();
}

async function updateHeaderDetails() {
    try {
        const result = await API.fetchMedreps();
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
                repName = `${f} ${l}`.trim();
                repArea = foundRep.area || 'Assignment Area';

                if (repNameEl) repNameEl.textContent = repName;
                if (repAreaEl) repAreaEl.textContent = repArea;
            }
        }
    } catch (err) {
        console.error("Error updating request header:", err);
    }
}


// =====================================
//  FETCH QUARTERS
// =====================================
async function fetchAllQuarterStatuses() {
    if (!selectedRepId) return;

    // Show loading state on all 4 cards
    [1, 2, 3, 4].forEach(q => setCardLoading(q));

    try {
        // Fetch statuses for the selected year
        const data = await API.fetchQuarterStatus(selectedRepId, currentYear);

        // data.quarters_with_pending follows our priority logic: pending > approved > rejected > none
        if (!data || !data.quarters_with_pending) throw new Error("Failed to fetch status");
        const statusMap = data.quarters_with_pending;

        [1, 2, 3, 4].forEach(q => {
            // Update each card based on the q1, q2, q3, q4 keys from the backend
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

    card.classList.remove('status-none', 'pending', 'approved', 'rejected');
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

    card.classList.remove('status-none', 'pending', 'approved', 'rejected');
    if (badge) badge.classList.remove('none', 'pending', 'approved', 'rejected');

    const normalizedStatus = status ? status.toLowerCase() : 'none';

    // Enable interaction and set correct visual style based on status
    if (normalizedStatus === 'pending') {
        card.classList.add('pending');
        if (badge) { badge.classList.add('pending'); badge.textContent = 'Pending'; }
        if (dot) dot.style.display = 'block'; // Show red notification dot for pending items

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

    } else if (normalizedStatus === 'rejected') {
        card.classList.add('rejected');
        if (badge) { badge.classList.add('rejected'); badge.textContent = 'Rejected'; }
        if (dot) dot.style.display = 'none';

        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
        card.style.cursor = 'pointer';

    } else {
        // 'none' status: data exists in DB but doesn't fit a quarter, or no data at all
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
    console.log("selectedRepId at click:", selectedRepId); // add this
    const safeId = encodeURIComponent(String(selectedRepId).trim());

    // Pass q, year, and id to the details page
    window.location.href =
        `request_details/request_details.html?q=${qNumber}&year=${currentYear}&id=${safeId}`;
};

// =====================================
//  START
// =====================================
init();