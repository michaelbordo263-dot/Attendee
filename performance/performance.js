/* ============================================================
   performance.js — User Performance Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // STATE
    let allReps = [];
    const _now = new Date();
    let currentQuarter = Math.ceil((_now.getMonth() + 1) / 3);
    let currentYear = _now.getFullYear();

    const grid = document.getElementById('performance-grid');
    const searchInput = document.getElementById('perf-search');
    const resultsCount = document.getElementById('results-count');
    const quarterLabel = document.getElementById('quarter-label');
    const yearLabel = document.getElementById('year-label');

    const SILHOUETTE_SVG = `
        <svg viewBox="0 0 30 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="15" cy="10" rx="7" ry="8" fill="rgba(255,255,255,0.75)"/>
            <path d="M0 34 Q0 22 15 22 Q30 22 30 34Z" fill="rgba(255,255,255,0.75)"/>
        </svg>`;

    function renderSkeletons() {
        grid.innerHTML = Array(6).fill(0).map(() => `
            <div class="rep-card" style="opacity:0.5; pointer-events:none;">
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
                    <div style="width:42px;height:42px;background:#ddd;border-radius:50%;flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div style="height:12px;background:#ddd;border-radius:6px;margin-bottom:6px;width:60%;"></div>
                        <div style="height:9px;background:#eee;border-radius:6px;width:40%;"></div>
                    </div>
                </div>
                <div style="height:8px;background:#eee;border-radius:10px;margin:10px 0;"></div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;margin-top:12px;">
                    ${Array(4).fill(0).map(() => `<div style="padding:10px 6px;border-right:1px solid #e0e0e0;"><div style="height:15px;background:#ddd;border-radius:4px;margin-bottom:4px;"></div><div style="height:8px;background:#eee;border-radius:4px;"></div></div>`).join('')}
                </div>
            </div>
        `).join('');
        resultsCount.textContent = 'Fetching data...';
    }

    function renderOffline() {
        grid.innerHTML = `
            <div class="empty-state">
                <p>Unable to connect to the server.</p>
                <button onclick="location.reload()" 
                    style="margin-top:12px; padding:8px 20px; border-radius:8px; border:none;
                           background:var(--primary-navy); color:#fff; font-weight:700; cursor:pointer;">
                    Retry Connection
                </button>
            </div>`;
    }

    function getBarColor(pct) {
        if (pct >= 90) return '#4caf50';
        if (pct >= 75) return '#ff9800';
        return '#f44336';
    }

    function getStatusLabel(pct) {
        if (pct >= 90) return 'Great';
        if (pct >= 75) return 'Good';
        return 'Okay';
    }

    function render(list) {
        grid.innerHTML = '';

        if (!list || list.length === 0) {
            grid.innerHTML = '<div class="empty-state">No matching records found.</div>';
            resultsCount.textContent = 'Showing (0) Records';
            return;
        }

        list.forEach(rep => {
            const successPct  = rep.success_rate ?? 0;
            // MIA is calculated as the inverse of success rate for individual cards
            const miaPct      = 100 - successPct;
            const barColor    = getBarColor(successPct);
            // The status label now reflects performance quality while the filter ensures they are 'active'
            const statusLabel = getStatusLabel(successPct);
            const statusClass = `status-${statusLabel.toLowerCase()}`;

            const card = document.createElement('div');
            card.className = 'rep-card';
            card.style.cursor = 'pointer';

            card.onclick = () => {
                const url = `performance_details/performance_details.html?name=${encodeURIComponent(rep.name)}&area=${encodeURIComponent(rep.location || '')}&id=${encodeURIComponent(rep.id || '')}&q=Q${currentQuarter}&year=${currentYear}`;
                window.location.href = url;
            };

            card.innerHTML = `
                <div class="card-top">
                    <div class="user-info">
                        <div class="avatar-wrap">${SILHOUETTE_SVG}</div>
                        <div class="name-box">
                            <span class="name">${rep.name || 'Unknown Rep'}</span>
                            <span class="location">${rep.location || 'N/A'}</span>
                        </div>
                    </div>
                    <span class="status-pill ${statusClass}">${statusLabel}</span>
                </div>

                <div class="progress-section">
                    <div class="progress-row">
                        <div class="progress-track">
                            <div class="seg-fill" style="width:${successPct}%; background:${barColor};"></div>
                        </div>
                        <span class="percent-label" style="color:${barColor};">${successPct}%</span>
                    </div>
                </div>

                <div class="card-footer">
                    <div class="stat">
                        <span class="val">${successPct}%</span>
                        <span class="lbl">Rate</span>
                    </div>
                    <div class="stat">
                        <span class="val">${rep.signed ?? 0}</span>
                        <span class="lbl">Signed</span>
                    </div>
                    <div class="stat">
                        <span class="val">${rep.visited ?? 0}</span>
                        <span class="lbl">Visited</span>
                    </div>
                    <div class="stat stat-missing">
                        <span class="val">${rep.rejected ?? 0}</span>
                        <span class="lbl">Rejected</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        resultsCount.textContent = `Showing (${list.length}) Records`;
        updateKPIs(list);
    }

    function updateKPIs(list) {
        const totalSigned = list.reduce((sum, r) => sum + (r.signed ?? 0), 0);
        const totalRejected = list.reduce((sum, r) => sum + (r.rejected ?? 0), 0);
        const totalMIA = list.reduce((sum, r) => sum + (r.mia ?? 0), 0);
        
        document.getElementById('kpi-total').textContent  = list.length;
        document.getElementById('kpi-signed').textContent = totalSigned;
        document.getElementById('kpi-missed').textContent = totalRejected;
        document.getElementById('kpi-rate').textContent   = totalMIA;
    }

    function applyFilters() {
        const term = searchInput.value.toLowerCase().trim();
        const filtered = term
            ? allReps.filter(r =>
                (r.name && r.name.toLowerCase().includes(term)) ||
                (r.location && r.location.toLowerCase().includes(term))
              )
            : allReps;
        render(filtered);
    }

    async function loadData(q, year) {
        renderSkeletons();
        try {
            const result = await API.fetchPerformanceByPeriod(q, year);

            const rawList = Array.isArray(result) ? result : [];
            console.log("DEBUG: Raw data received from /api/performance:", rawList);

            allReps = rawList.filter(rep => {
                // Strictly checking 'roles' and 'status' keys as requested
                const rawRoleValue = rep.roles; 
                const rawStatusValue = rep.status;

                const roleNormalized = (rawRoleValue || '').toLowerCase().trim();
                const statusNormalized = (rawStatusValue || '').toLowerCase().trim();

                const isMedrep = roleNormalized === 'medrep';
                const isActive = statusNormalized === 'active';

                console.groupCollapsed(`Filtering Rep: ${rep.name || 'ID: ' + rep.id}`);
                console.log("Target Criteria: roles='medrep', status='active'");
                console.log("Received Values: roles=", rawRoleValue, ", status=", rawStatusValue);
                console.log("Final Decision:", isMedrep && isActive ? "✅ ACCEPTED" : "❌ REJECTED");
                console.groupEnd();

                return isMedrep && isActive;
            });

            quarterLabel.textContent = `Q${currentQuarter}`;
            yearLabel.textContent    = currentYear;
            
            updateNavButtons();
            applyFilters();
        } catch (error) {
            console.error('Fetch failed:', error);
            renderOffline();
        }
    }

    function updateNavButtons() {
        // Navigation is now dynamic; buttons remain enabled for all periods.
    }

    /* --- Navigation Listeners --- */
    document.getElementById('q-prev').addEventListener('click', () => {
        currentQuarter--;
        if (currentQuarter < 1) {
            currentQuarter = 4;
            currentYear--;
        }
        loadData(currentQuarter, currentYear);
    });

    document.getElementById('q-next').addEventListener('click', () => {
        currentQuarter++;
        if (currentQuarter > 4) {
            currentQuarter = 1;
            currentYear++;
        }
        loadData(currentQuarter, currentYear);
    });

    document.getElementById('y-prev').addEventListener('click', () => {
        currentYear--;
        loadData(currentQuarter, currentYear);
    });

    document.getElementById('y-next').addEventListener('click', () => {
        currentYear++;
        loadData(currentQuarter, currentYear);
    });

    searchInput.addEventListener('input', applyFilters);

    // Initial Load
    loadData(currentQuarter, currentYear);
});