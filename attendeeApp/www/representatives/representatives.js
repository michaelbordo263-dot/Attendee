import { fetchMedreps } from '../common/backend_connection.js';

let allRepresentatives = [];

const searchInput = document.querySelector('.search-input');
const repCountLabel = document.getElementById('repCount');
const areaSelect = document.getElementById('areaSelect'); // Ensure your HTML has this ID

/* ── DROPDOWN CHANGE LOGIC ── */
if (areaSelect) {
    areaSelect.addEventListener('change', () => {
        filterData(searchInput.value.toLowerCase());
    });
}

/* ── LIVE SEARCH LOGIC ── */
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    filterData(term);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const term = e.target.value.toLowerCase();
        filterData(term);
    }
});

function filterData(term) {
    const selectedArea = areaSelect ? areaSelect.value.toLowerCase() : '';

    const filtered = allRepresentatives.filter(rep => {
        const fullName = `${rep.first_name} ${rep.last_name}`.toLowerCase();
        const area = (rep.area || '').toLowerCase();
        
        const matchesSearch = fullName.includes(term) || area.includes(term);
        const matchesArea = selectedArea === "" || area === selectedArea;

        return matchesSearch && matchesArea;
    });

    renderRepresentatives(filtered);

    if (repCountLabel) {
        repCountLabel.textContent = `Showing ${filtered.length} representative${filtered.length === 1 ? '' : 's'}`;
    }
}

function populateAreaDropdown(reps) {
    if (!areaSelect) return;

    // Extract unique areas from the 'area' column, filtering out null/empty
    const uniqueAreas = [...new Set(reps.map(rep => rep.area).filter(Boolean))].sort();

    // Reset dropdown but keep the first "All Areas" option
    areaSelect.innerHTML = '<option value="">All Areas</option>';

    uniqueAreas.forEach(area => {
        const opt = document.createElement('option');
        opt.value = area;
        opt.textContent = area;
        areaSelect.appendChild(opt);
    });
}

async function loadPage() {
    const result = await fetchMedreps();
    console.log("DEBUG: Raw result from fetchMedreps():", result);

    if (result && result.success === true) {
        // Handle different backend response structures:
        // 1. { data: [...] }, 2. { medreps: [...] }, or 3. Numeric keys { 0:..., 1:... }
        let extracted = result.data || result.medreps;

        if (!Array.isArray(extracted)) {
            extracted = Object.keys(result)
                .filter(key => !isNaN(key))
                .sort((a, b) => Number(a) - Number(b))
                .map(key => result[key]);
        }

        allRepresentatives = (extracted || []).filter(rep => {
            const role = (rep.roles || rep.role || rep.type || '').toLowerCase().trim();
            const status = (rep.status || '').toLowerCase().trim();

            // Strict check: Only show 'medrep' with 'active' status.
            return role === 'medrep' && status === 'active';
        });

        console.log("DEBUG: Extracted Representative Data Array:", allRepresentatives);

        if (allRepresentatives.length > 0) {
            // Populate the dropdown with unique areas before rendering
            populateAreaDropdown(allRepresentatives);
            
            renderRepresentatives(allRepresentatives);
            repCountLabel.textContent = `Showing ${allRepresentatives.length} representatives`;
        } else {
            document.getElementById('repList').innerHTML =
                "<p class='no-data'>No representatives found in database.</p>";
            repCountLabel.textContent = "0 representatives found";
        }

    } else {
        const errorMsg = result?.error || "Connection Error: Check if server is running.";
        alert(errorMsg);
        repCountLabel.textContent = "Connection Error";
    }
}

function renderRepresentatives(reps) {
    const repList = document.getElementById('repList');
    repList.innerHTML = '';

    reps.forEach(rep => {

        const fName = rep.first_name || '';
        const lName = rep.last_name || '';
        const fullName = `${fName} ${lName}`.trim();
        const areaName = rep.area || 'No Area';
        const initials = (fName.charAt(0) + lName.charAt(0)).toUpperCase();

        // Prioritize uuid or uui (unique identifiers) from backend over the internal id field
        const repId = rep.uuid || rep.uui || rep.id;

        console.log(`--- Representative Debug: ${fullName} ---`);
        console.log(`Selected repId (sent to schedule):`, repId);
        console.log(`Available Keys:`, Object.keys(rep));
        console.log(`uuid field:`, rep.uuid);
        console.log(`uui field:`, rep.uui);
        console.log(`id field:`, rep.id);

        // 🚨 HARD GUARD (prevents silent undefined bugs)
        if (!repId) {
            console.error("❌ Missing 'id' in backend record:", rep);
            return; // skip broken record
        }

        const card = document.createElement('div');
        card.className = 'rep-card';

        card.innerHTML = `
            <div class="rep-avatar">${initials}</div>
            <div class="rep-info">
                <h3>${fullName}</h3>
                <p>${areaName}</p>
            </div>
            <button class="view-btn">View</button>
        `;

        card.querySelector('.view-btn').addEventListener('click', () => {
            window.viewDetails(repId);
        });

        repList.appendChild(card);
    });
}

window.viewDetails = function(id) {

    // 🔴 strict validation
    if (!id || id === "undefined") {
        console.error("Invalid ID passed from View button:", id);
        return;
    }

    const safeId = String(id).trim();

    window.location.href =
        `schedule/schedule.html?id=${encodeURIComponent(safeId)}`;
};

loadPage();