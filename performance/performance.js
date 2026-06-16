/* ============================================================
   performance.js — User Performance Page (integer rates)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // 1. STATE
    let allReps = [];
    const _now = new Date();
    let currentMonth = _now.getMonth() + 1;
    let currentYear = _now.getFullYear();

    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];

    const grid = document.getElementById('performance-grid');
    const searchInput = document.getElementById('perf-search');
    const resultsCount = document.getElementById('results-count');

    const SILHOUETTE_SVG = `
        <svg viewBox="0 0 30 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="15" cy="10" rx="7" ry="8" fill="rgba(255,255,255,0.75)"/>
            <path d="M0 34 Q0 22 15 22 Q30 22 30 34Z" fill="rgba(255,255,255,0.75)"/>
        </svg>`;

    function updateMonthLabel() {
        document.getElementById('quarter-label').textContent = MONTH_NAMES[currentMonth - 1];
        document.getElementById('year-label').textContent = currentYear;
    }

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
            // Coerce to integer to match detail view
            const successPct  = Math.round(Number(rep.success_rate || 0));
            const barColor    = getBarColor(successPct);
            const statusLabel = getStatusLabel(successPct);
            const statusClass = `status-${statusLabel.toLowerCase()}`;

            const card = document.createElement('div');
            card.className = 'rep-card';
            card.style.cursor = 'pointer';

            card.onclick = () => {
                const url = `performance_details/performance_details.html?name=${encodeURIComponent(rep.name)}&area=${encodeURIComponent(rep.location || '')}&id=${encodeURIComponent(rep.id || '')}&month=${currentMonth}&year=${currentYear}`;
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
                        <span class="val">${Math.round(Number(rep.signed || 0))}</span>
                        <span class="lbl">Signed & Selfie</span>
                    </div>
                    <div class="stat">
                        <span class="val">${Math.round(Number(rep.mia || 0))}</span>
                        <span class="lbl">MIA</span>
                    </div>
                    <div class="stat stat-missing">
                        <span class="val">${Math.round(Number(rep.rejected || 0))}</span>
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
        const totalSigned   = list.reduce((sum, r) => sum + Math.round(Number(r.signed || 0)), 0);
        const totalRejected = list.reduce((sum, r) => sum + Math.round(Number(r.rejected || 0)), 0);
        const totalMIA      = list.reduce((sum, r) => sum + Math.round(Number(r.mia || 0)), 0);

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

    async function loadData(month, year, force = false) {
        updateMonthLabel();
        const grid = document.getElementById('performance-grid');
        grid.innerHTML = '';
        updateKPIs([]);
        resultsCount.textContent = 'Loading...';

        const CACHE_KEY = `perf_page_data_${month}_${year}`;
        const CACHE_TTL = 3 * 60 * 1000;

        // Nuke corrupted cache
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (!parsed.d || !Array.isArray(parsed.d)) {
                    localStorage.removeItem(CACHE_KEY);
                }
            }
        } catch {
            localStorage.removeItem(CACHE_KEY);
        }

        // Stale-while-revalidate
        if (!force) {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const { d, t } = JSON.parse(cached);
                    if (Date.now() - t < CACHE_TTL) {
                        processAndRenderData(d, month, year);
                        API.fetchPerformanceByPeriod(month, year).then(result => {
                            if (Array.isArray(result)) {
                                // coerce rates to integers before cache
                                const normalized = result.map(r => ({ ...r, success_rate: Math.round(Number(r.success_rate || 0)), signed: Math.round(Number(r.signed || 0)), mia: Math.round(Number(r.mia || 0)), rejected: Math.round(Number(r.rejected || 0)) }));
                                localStorage.setItem(CACHE_KEY, JSON.stringify({ d: normalized, t: Date.now() }));
                                processAndRenderData(normalized, month, year);
                            }
                        }).catch(() => {});
                        return;
                    } else {
                        localStorage.removeItem(CACHE_KEY);
                    }
                } catch (e) {
                    localStorage.removeItem(CACHE_KEY);
                }
            }
        }

        // Full fetch
        const overlay = document.getElementById('sync-overlay');
        overlay.style.display = 'flex';
        renderSkeletons();

        try {
            const result = await API.fetchPerformanceByPeriod(month, year);
            if (Array.isArray(result)) {
                const normalized = result.map(r => ({ ...r, success_rate: Math.round(Number(r.success_rate || 0)), signed: Math.round(Number(r.signed || 0)), mia: Math.round(Number(r.mia || 0)), rejected: Math.round(Number(r.rejected || 0)) }));
                localStorage.setItem(CACHE_KEY, JSON.stringify({ d: normalized, t: Date.now() }));
                processAndRenderData(normalized, month, year);
            } else {
                grid.innerHTML = `<div class="empty-state">No records found for ${MONTH_NAMES[month - 1]} ${year}.</div>`;
                resultsCount.textContent = 'Showing (0) Records';
            }
        } catch (error) {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { d } = JSON.parse(cached);
                    processAndRenderData(d, month, year);
                    return;
                }
            } catch {}
            renderOffline();
        } finally {
            overlay.style.display = 'none';
        }
    }

    function processAndRenderData(rawList, month, year) {
        currentMonth = month;
        currentYear = year;

        // ensure all rates are integers
        allReps = rawList.map(rep => ({ ...rep, success_rate: Math.round(Number(rep.success_rate || 0)), signed: Math.round(Number(rep.signed || 0)), mia: Math.round(Number(rep.mia || 0)), rejected: Math.round(Number(rep.rejected || 0)) }));

        allReps = allReps.filter(rep => {
            const roleNormalized   = (rep.roles || '').toLowerCase().trim();
            const statusNormalized = (rep.status || '').toLowerCase().trim();
            return roleNormalized === 'medrep' && statusNormalized === 'active';
        });

        updateMonthLabel();
        applyFilters();
    }

    /* --- Navigation Listeners --- */
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadData(currentMonth, currentYear, true);
    });

    document.getElementById('q-prev').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        loadData(currentMonth, currentYear);
    });

    document.getElementById('q-next').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        loadData(currentMonth, currentYear);
    });

    document.getElementById('y-prev').addEventListener('click', () => {
        currentYear--;
        loadData(currentMonth, currentYear);
    });

    document.getElementById('y-next').addEventListener('click', () => {
        currentYear++;
        loadData(currentMonth, currentYear);
    });

    searchInput.addEventListener('input', applyFilters);

    // Initial Load
    loadData(currentMonth, currentYear);
});
