/* =========================================================
   📦 STATE
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

    let allRepresentatives = [];

    const searchInput = document.getElementById('searchInput');
    const repCountLabel = document.getElementById('repCount');
    const areaSelect = document.getElementById('locationFilter');

    /* =========================================================
       🔄 INIT
    ========================================================= */
    loadPage();

    /* =========================================================
       🎯 EVENTS
    ========================================================= */
    if (areaSelect) {
        areaSelect.addEventListener('change', () => {
            filterData(searchInput.value.toLowerCase());
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterData(e.target.value.toLowerCase());
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterData(e.target.value.toLowerCase());
            }
        });
    }

    /* =========================================================
       🔍 FILTER LOGIC
    ========================================================= */
    function filterData(term) {

        const selectedArea = areaSelect ? areaSelect.value.toLowerCase() : '';

        const filtered = allRepresentatives.filter(rep => {
            const fullName = `${rep.first_name} ${rep.last_name}`.toLowerCase();
            const area = (rep.area || '').toLowerCase();

            const matchesSearch = fullName.includes(term) || area.includes(term);

            const matchesArea =
                selectedArea === "" ||
                selectedArea === "all" ||
                area === selectedArea;

            return matchesSearch && matchesArea;
        });

        renderRepresentatives(filtered);

        if (repCountLabel) {
            repCountLabel.textContent =
                `Showing ${filtered.length} representative${filtered.length === 1 ? '' : 's'}`;
        }
    }

    /* =========================================================
       📥 LOAD DATA (BACKEND CONNECTION USED HERE)
    ========================================================= */
    async function loadPage() {

        // 🔥 THIS is the real backend connection
        const result = await API.fetchMedreps();

        // console.log("🌐 RAW RESULT:", result); //

        let extracted = [];

        if (Array.isArray(result)) {
            extracted = result;
        } else if (result?.data) {
            extracted = result.data;
        } else if (result?.medreps) {
            extracted = result.medreps;
        }

        // console.log("📦 EXTRACTED:", extracted); // 

        allRepresentatives = extracted.filter(rep => {
            const role = (rep.role || rep.roles || rep.type || '').toLowerCase().trim();
            const status = (rep.status || '').toLowerCase().trim();

            return role === 'medrep' && status === 'active';
        });

        // console.log("✅ FILTERED REPS:", allRepresentatives); //

        if (allRepresentatives.length > 0) {
            populateAreaDropdown(allRepresentatives);
            renderRepresentatives(allRepresentatives);

            repCountLabel.textContent =
                `Showing ${allRepresentatives.length} representatives`;
        } else {
            document.getElementById('repList').innerHTML =
                "<p class='no-data'>No representatives found in database.</p>";

            repCountLabel.textContent = "0 representatives found";
        }
    }

    /* =========================================================
       🧩 DROPDOWN
    ========================================================= */
    function populateAreaDropdown(reps) {
        if (!areaSelect) return;

        const uniqueAreas = [...new Set(
            reps.map(rep => rep.area).filter(Boolean)
        )].sort();

        areaSelect.innerHTML = '<option value="all">All Locations</option>';

        uniqueAreas.forEach(area => {
            const opt = document.createElement('option');
            opt.value = area;
            opt.textContent = area;
            areaSelect.appendChild(opt);
        });
    }

    /* =========================================================
       🖼 RENDER UI
    ========================================================= */
    function renderRepresentatives(reps) {
        const repList = document.getElementById('repList');
        repList.innerHTML = '';

        reps.forEach(rep => {

            const fName = rep.first_name || '';
            const lName = rep.last_name || '';
            const fullName = `${fName} ${lName}`.trim();
            const areaName = rep.area || 'No Area';
            const initials = (fName.charAt(0) + lName.charAt(0)).toUpperCase();

            const repId = rep.uuid || rep.uui || rep.id;

            if (!repId) {
                console.error("❌ Missing ID:", rep);
                return;
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
                window.viewDetails(repId, fullName, areaName);
            });

            repList.appendChild(card);
        });
    }

    /* =========================================================
       🚀 NAVIGATION
    ========================================================= */
    window.viewDetails = function (id, name, area) {
        if (!id || id === "undefined") {
            console.error("Invalid ID:", id);
            return;
        }

        const query = new URLSearchParams({
            id: id,
            name: name || '',
            area: area || ''
        }).toString();

        window.location.href = `representative_details/representative_details.html?${query}`;
    };

});