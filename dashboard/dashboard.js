// ── STATE ──────────────────────────────────────────
const _now = new Date();
let schedTab     = 'Pending';
let schedQuarter = Math.ceil((_now.getMonth() + 1) / 3); // current quarter
let schedYear    = _now.getFullYear();                     // current year
let rdPendingAction = { id: null, quarter: null, year: null }; // ADD THIS LINE

let scheduleData   = [];
let productsData   = [];
let unusualReports = [];
let isSavingProduct = false;


// ── UTIL ───────────────────────────────────────────
function getInitials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}


// ── CLOCK ──────────────────────────────────────────
function updateClock() {
    const now = new Date();

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    document.getElementById('clock-day').textContent = now.getDate();

    document.getElementById('clock-month').textContent =
        `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getFullYear()}`;

    let h = now.getHours();
    let m = now.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';

    h = h % 12 || 12;

    document.getElementById('clock-time').textContent =
        `${h}:${m.toString().padStart(2,'0')} ${ampm}`;
}

updateClock();
setInterval(updateClock, 1000);

// ── MODAL ──────────────────────────────────────────
function openModal(id) {
    const modal = document.getElementById(id);

    if (!modal) {
        console.warn(`Modal not found: ${id}`);
        return;
    }

    modal.classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

window.openScheduleModal = () => {
    // Reset to current date defaults each time modal opens
    const now     = new Date();
    schedQuarter  = Math.ceil((now.getMonth() + 1) / 3);
    schedYear     = now.getFullYear();
    schedTab      = 'Pending';

    // Reset tab buttons
    document.querySelectorAll('#scheduleModal .tab-btn')
        .forEach((b, i) => b.classList.toggle('active', i === 0));

    // Update quarter/year labels
    const qEl = document.getElementById('qLabel');
    const yEl = document.getElementById('yLabel');
    if (qEl) qEl.textContent = `Q${schedQuarter}`;
    if (yEl) yEl.textContent = schedYear;

    // Clear search
    const s = document.getElementById('schedSearch');
    if (s) s.value = '';

    loadSchedulesFromAPI();
    openModal('scheduleModal');
};

window.setSchedTab = (tab, btn) => {
    schedTab = tab;

    document.querySelectorAll('#scheduleModal .tab-btn')
        .forEach(b => b.classList.remove('active'));

    if (btn) btn.classList.add('active');

    // 🔥 KEY FIX: reload from API instead of just re-rendering old data
    loadSchedulesFromAPI();
};

window.changeQuarter = (dir) => {
    schedQuarter = schedQuarter + dir;
    if (schedQuarter < 1) { schedQuarter = 4; schedYear--; }
    if (schedQuarter > 4) { schedQuarter = 1; schedYear++; }
    const qEl = document.getElementById('qLabel');
    const yEl = document.getElementById('yLabel');
    if (qEl) qEl.textContent = `Q${schedQuarter}`;
    if (yEl) yEl.textContent = schedYear;
    loadSchedulesFromAPI();
    loadUnusualReports();
    loadDashboardStats();
};

window.changeYear = (dir) => {
    schedYear += dir;
    const yEl = document.getElementById('yLabel');
    if (yEl) yEl.textContent = schedYear;
    loadSchedulesFromAPI();
    loadUnusualReports();
    loadDashboardStats();
};
window.openProductsModal = () => openModal('productsModal');
window.openUnusualModal = () => openModal('unusualModal');
window.openAddProductModal = () => {
    // Reset all fields before opening
    const generic      = document.getElementById('genericNameInput');
    const brand        = document.getElementById('brandNameInput');
    const fileInput    = document.getElementById('productImageInput');
    const preview      = document.getElementById('imgPreview');
    const placeholder  = document.getElementById('imgPlaceholder');

    if (generic)     generic.value        = '';
    if (brand)       brand.value          = '';
    if (fileInput)   fileInput.value      = '';
    if (preview)   { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';

    openModal('addProductModal');
};
window.openPerformanceModal = () => openModal('performanceModal');

window.previewImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('imgPreview');
        const placeholder = document.getElementById('imgPlaceholder');
        if (preview && placeholder) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
};

window.saveProduct = async () => {
    // 1. Prevent concurrent submissions
    if (isSavingProduct) return;

    console.log("DEBUG [dashboard.js]: saveProduct function triggered.");
    isSavingProduct = true;

    const generic = document.getElementById('genericNameInput').value.trim();
    const brand = document.getElementById('brandNameInput').value.trim();
    const fileInput = document.getElementById('productImageInput');
    const file = fileInput.files[0];

    const saveBtn = document.querySelector('.save-product-btn');

    if (!generic || !brand) {
        isSavingProduct = false;
        return alert("Please enter both Generic and Brand names.");
    }

    console.log("DEBUG: Payload data gathered:", { generic, brand, hasFile: !!file });

    // Use FormData to package the binary file and text fields together
    const formData = new FormData();
    formData.append('product_generic_name', generic);
    formData.append('product_brand_name', brand);
    if (file) {
        formData.append('product_image', file);
    }

    try {
        if (saveBtn) { 
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
        }

        const res = await fetch(`${BASE_URL}/dashboard/products/add`, {
            method: 'POST',
            // NOTE: Remove Content-Type header. 
            // The browser will set it to 'multipart/form-data' automatically.
            body: formData
        });

        console.log("DEBUG: Response Status:", res.status);

        if (res.ok) {
            alert("Product saved successfully!");
            // 1. Clear inputs
            document.getElementById('genericNameInput').value = '';
            document.getElementById('brandNameInput').value = '';
            fileInput.value = '';
            
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Product";
            }

            // 2. Reset Image Preview
            const preview = document.getElementById('imgPreview');
            const placeholder = document.getElementById('imgPlaceholder');
            if (preview) preview.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';

            // 3. Close and Refresh data
            closeModal('addProductModal');
            loadProductsFromAPI();
            loadDashboardStats();
        } else {
            // More robust error reading in case the server sends HTML instead of JSON
            const responseText = await res.text();
            console.error("DEBUG: Server Error Content:", responseText);
            let errorMsg = responseText;
            try {
                const json = JSON.parse(responseText);
                errorMsg = json.error || json.message || responseText;
            } catch (e) {}
            alert("Server Error: " + errorMsg.slice(0, 150));
        }
    } catch (err) {
        console.error("Save Product Error:", err);
        alert("Connection Error: Could not reach the server. Make sure the backend is running.");
    } finally {
        isSavingProduct = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Product";
        }
    }
};


// ── SUMMARY ────────────────────────────────────────
async function loadDashboardStats() {
    // Pass quarter and year to summary to get period-accurate counts
    const data = await apiFetch(`${BASE_URL}/dashboard/summary?q=${schedQuarter}&year=${schedYear}`);

    console.log("📊 SUMMARY:", data);

    const el = document.getElementById('totalMedRepsValue');
    if (el) el.textContent = data.medreps ?? 0;

    // Update the sub-label for the Schedule Request card to reflect current period
    const sub = document.getElementById('scheduleSubLabel');
    if (sub) sub.textContent = `Q${schedQuarter} - ${schedYear}`;

    const prod = document.getElementById('totalProductsValue');
    if (prod) {
        prod.textContent = data.products ?? 0;
        const prodCard = prod.closest('.card') || prod.closest('.stat-card') || prod.parentElement;
        if (prodCard) { // Make the entire card clickable
            prodCard.style.cursor = 'pointer'; 
            prodCard.onclick = () => openModal('productsModal'); // Open the modal
        }
    }

    const sched = document.getElementById('totalSchedulesValue');
    if (sched) sched.textContent = data.requestedSchedules ?? 0;
}


// ── PERFORMANCE ────────────────────────────────────
async function loadPerformance() {
    const data = await apiFetch(`${BASE_URL}/dashboard/performance`);

    const container = document.querySelector('.panel .panel-body');
    if (!container) return;

    container.innerHTML = (Array.isArray(data) ? data : []).map(rep => {
        const repId = rep.uuid || rep.uui || rep.id;
        const name = rep.name || 'Unknown';
        const pct = Math.floor(rep.progress || 0);
        return `
        <div class="perf-item" 
             style="cursor: pointer;" 
             onclick="window.location.href='../performance/performance_details/performance_details.html?id=${encodeURIComponent(repId)}&name=${encodeURIComponent(name)}'">
            <div class="perf-avatar">${getInitials(rep.name || '?')}</div>
            <div class="perf-info">
                <span class="perf-name">${rep.name || 'Unknown'}</span>
                <span class="perf-area">${rep.territory || ''}</span>
            </div>
            <div class="perf-bar-wrap">
                <div class="perf-bar-track">
                    <div class="perf-bar" style="width:${pct}%"></div>
                </div>
                <span class="perf-pct">${pct}%</span>
            </div>
        </div>
    `;}).join('');
}


// ── SCHEDULES (FULL FIX) ───────────────────────────
async function loadSchedulesFromAPI() {
    // 🔥 Added status param (THIS is what enables real-time correct tab data)
    const url = `${BASE_URL}/dashboard/schedules?status=${schedTab}&q=${schedQuarter}&year=${schedYear}`;

    console.log("📡 Fetching schedules:", url);

    const data = await apiFetch(url);

    console.log("📅 RAW RESPONSE:", data);

    // ✅ KEEP your original safe normalization
    let extracted = data.data || data.schedules || data;

    if (!Array.isArray(extracted) && typeof extracted === 'object' && extracted !== null) {
        extracted = Object.keys(extracted)
            .filter(key => !isNaN(key))
            .sort((a, b) => Number(a) - Number(b))
            .map(key => extracted[key]);
    }

    scheduleData = Array.isArray(extracted) ? extracted : [];

    console.log("📦 NORMALIZED:", scheduleData);

    // ✅ KEEP dashboard counter logic
    const pendingCount = scheduleData.filter(r =>
        (r.status || '').toLowerCase() === 'pending'
    ).length;

    const schedEl = document.getElementById('totalSchedulesValue');
    if (schedEl) schedEl.textContent = pendingCount;

    // ✅ KEEP label
    const sub = document.getElementById('scheduleSubLabel');
    if (sub) sub.textContent = `Q${schedQuarter} - ${schedYear}`;

    renderScheduleList(scheduleData);
}

// ── PRODUCTS ───────────────────────────────────────
async function loadProductsFromAPI() {
    const data = await apiFetch(`${BASE_URL}/dashboard/products`);
    let extracted = data.data || data.products || data;
    if (!Array.isArray(extracted) && typeof extracted === 'object' && extracted !== null) {
        extracted = Object.keys(extracted)
            .filter(key => !isNaN(key))
            .sort((a, b) => Number(a) - Number(b))
            .map(key => extracted[key]);
    }
    productsData = Array.isArray(extracted) ? extracted : [];
    renderProductsList();
}

window.renderProductsList = () => {
    const list = document.getElementById('productsList');
    const count = document.getElementById('prodCount');
    if (!list || !count) return;

    const query = document.getElementById('prodSearch')?.value.toLowerCase() || '';

    // 1. Filter by search query
    const filtered = productsData.filter(p =>
        (p.product_generic_name || p.Product_Generic_Name || '').toLowerCase().includes(query) ||
        (p.product_brand_name || p.Product_Brand_Name || '').toLowerCase().includes(query)
    );

    count.textContent = `Showing ${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#aab0be;font-size:14px;font-weight:600;">No products found.</div>`;
        return;
    }

    // Correct Supabase Base URL (ensuring ydcucj spelling)
    const SUPABASE_BASE = "https://qsqjjswydcucjtuglwai.supabase.co/storage/v1/object/public/Product_Image/product_photos/";

    list.innerHTML = filtered.map(p => {
        const generic = p.product_generic_name || p.Product_Generic_Name || '—';
        const brand = p.product_brand_name || p.Product_Brand_Name || '—';

        // ── IMAGE HANDLING (CLEAN + SAFE) ──
        let rawImg = p.product_image || p.Product_Image || p.image_url || '';
        let imgSrc = String(rawImg || '').trim();

        if (imgSrc && imgSrc !== 'null' && imgSrc !== '' && !imgSrc.includes('[object Object]')) {
            // 🔥 FIX: Correct common domain typo (yducuj -> ydcucj) to resolve NAME_NOT_RESOLVED errors
            imgSrc = imgSrc.replace('qsqjjswyducujtuglwai', 'qsqjjswydcucjtuglwai');

            // If it's just a filename, prepend the Supabase Base URL
            if (!imgSrc.startsWith('http')) {
                imgSrc = SUPABASE_BASE + imgSrc;
            }
        }

        // Add cache buster only if valid URL
        const displayUrl =
            imgSrc && imgSrc.startsWith('http')
                ? `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`
                : '';

        return `
            <div class="product-card">
                <div class="product-card-img" style="height: 140px; display: flex; align-items: center; justify-content: center; background: #f8fafc; overflow: hidden; border-bottom: 1px solid #edf2f7;">

                    ${displayUrl
                        ? `<img
                            src="${displayUrl}"
                            alt="${brand}"
                            style="max-width: 100%; max-height: 100%; object-fit: contain; padding: 10px;"
                            onerror="this.onerror=null; this.src='assets/default-pill.png';"
                        >`
                        : `<div class="product-card-img-placeholder">&#128138;</div>`
                    }

                </div>

                <div class="product-card-body">
                    <div class="product-card-generic">Generic Name</div>
                    <div class="product-card-name">${generic}</div>

                    <div class="product-card-generic" style="margin-top:6px;">Brand Name</div>
                    <div class="product-card-brand">${brand}</div>
                </div>
            </div>
        `;
    }).join('');
};


// ── RENDER SCHEDULE ────────────────────────────────
function renderScheduleList(data) {
    const list  = document.getElementById('schedList');
    const count = document.getElementById('schedCount');
    if (!list || !count) return;

    const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const isSuperAdmin = userProfile.roles === 'super_admin';

    const search = (document.getElementById('schedSearch')?.value || '').toLowerCase();

    const statusClass = {
        'Pending':  'status-badge--pending',
        'Approved': 'status-badge--approved',
        'Missing':  'status-badge--missing',
    };

    // The API already filters by status (schedTab), so only apply the search filter here.
    // Previously double-filtering caused records without a 'status' field to be dropped silently.
    const filtered = (data || []).filter(r => {
        const matchSearch = !search ||
            (r.name || '').toLowerCase().includes(search) ||
            (r.spec || '').toLowerCase().includes(search) ||
            (r.hosp || '').toLowerCase().includes(search);
        return matchSearch;
    });

    count.textContent = `Showing ${filtered.length} representative${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="padding:30px;text-align:center;color:#aab0be;font-size:14px;font-weight:600;">
                0 ${schedTab} schedules found
            </div>`;
        return;
    }

    list.innerHTML = filtered.map(r => {
        const statusKey  = r.status || schedTab;
        const badgeClass = statusClass[statusKey] || 'status-badge--pending';
        const sub        = [r.spec, r.hosp].filter(Boolean).join(' – ') || r.area || '';
        
        // Prioritize UUID for better referencing in navigation
        const repId = r.uuid || r.uui || r.id || '';
        
        let clickHandler = '';
        let cursorStyle = 'cursor: pointer;';

        if (schedTab === 'Pending') {
            if (isSuperAdmin) {
                clickHandler = `openRequestDetailModal('${encodeURIComponent(repId)}', ${schedQuarter}, ${schedYear})`;
            } else {
                // Disable clicking for non-super_admins on the Pending tab
                clickHandler = 'return false;';
                cursorStyle = 'cursor: default;';
            }
        } else {
            clickHandler = `window.location.href='../representatives/schedule/schedule.html?id=${encodeURIComponent(repId)}&quarter=${schedQuarter}&year=${schedYear}'`;
        }

        return `
        <div class="sched-card" onclick="${clickHandler}" style="${cursorStyle}">
            <div class="perf-avatar">${getInitials(r.name || 'MR')}</div>
            <div class="sched-info">
                <div class="sched-name">${r.name || r.id || '—'}</div>
                ${sub ? `<div class="sched-sub">${sub}</div>` : ''}
            </div>
            <span class="status-badge ${badgeClass}">
                ${statusKey === 'Missing' ? 'No Request' : statusKey}
            </span>
        </div>`;
    }).join('');
}


// ── UNUSUAL ────────────────────────────────────────
async function loadUnusualReports() {
    const url = `${BASE_URL}/dashboard/unusual?q=${schedQuarter}&year=${schedYear}`;
    console.log("🔍 Fetching Unusual Reports:", url);

    try {
        const data = await apiFetch(url);

        unusualReports = Array.isArray(data) ? data : [];

        console.log("📥 RAW UNUSUAL DATA:", unusualReports);

        updateUnusualUI();

    } catch (err) {
        console.error("❌ Unusual Load Error:", err);
        unusualReports = [];
        updateUnusualUI();
    }
}


function updateUnusualUI() {
    const panel = document.getElementById('unusualPanelBody');

    if (!panel) return;

    // ── FIX: SAFE FILTERING (NO OVER-RESTRICTION) ──
    const displayData = unusualReports.filter(r => {
        const type = (r.type || '').toLowerCase();

        // Only keep valid unusual types
        return type === 'missed' || type === 'no_request';
    });

    console.log("✅ FILTERED UNUSUAL DATA:", displayData);

    renderUnusualList(displayData);

    // ── EMPTY STATE ───────────────────────────────
    if (displayData.length === 0) {
        panel.innerHTML = `
            <div style="padding:20px;text-align:center;color:#888;">
                No unusual reports for Q${schedQuarter}
            </div>`;
        return;
    }

    // ── DASHBOARD PREVIEW (TOP 4 ONLY) ────────────
    panel.innerHTML = displayData.slice(0, 4).map((r, index) => {

        const initials = getInitials(r.name);
        const isLast = index === Math.min(displayData.length, 4) - 1;

        const type = (r.type || '').toLowerCase();
        const isMissed = type === 'missed';

        const badgeClass = isMissed ? 'badge--red' : 'badge--yellow';

        const badgeText = isMissed
            ? `${r.count || 0} unresolved misses`
            : `No Q${schedQuarter} Request`;

        const description = isMissed
            ? `Missed visits detected for this quarter.`
            : `No schedule request submitted for Q${schedQuarter} ${schedYear}.`;

        return `
            <div class="report-item">
                <div class="perf-avatar">${initials}</div>
                <div class="report-info">
                    <span class="perf-name">${r.name}</span>
                    <span class="report-desc">${description}</span>
                    <span class="report-badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
            ${!isLast ? '<div class="report-divider"></div>' : ''}
        `;
    }).join('');
}


function renderUnusualList(data) {
    const el = document.getElementById('unusualList');
    if (!el) return;

    if (!data || data.length === 0) {
        el.innerHTML = `
            <div style="padding:40px;text-align:center;color:#aab0be;">
                No unusual reports found.
            </div>`;
        return;
    }

    el.innerHTML = data.map(r => {

        const type = (r.type || '').toLowerCase();
        const isMissed = type === 'missed';

        const badgeClass = isMissed ? 'badge--red' : 'badge--yellow';

        const badgeText = isMissed
            ? `${r.count || 0} unresolved misses`
            : `No Request`;

        const description = isMissed
            ? `Unresolved missed visits detected.`
            : `Missing schedule request for this quarter.`;

        return `
            <div class="unusual-card">
                <div class="perf-avatar">${getInitials(r.name)}</div>
                <div class="report-info">
                    <span class="perf-name">${r.name}</span>
                    <span class="report-desc">${description}</span>
                    <span class="report-badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
        `;
    }).join('');
}


// ── INIT ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    loadPerformance();
    loadSchedulesFromAPI();
    loadProductsFromAPI();
    loadUnusualReports();

    // Inject modals directly — no fetch needed, no path issues
    injectDashboardModals();
});

// ── MODAL INJECTION ────────────────────────────────
// Inlines the Accept and Reject modal HTML directly so they are always
// present in the DOM regardless of the page's directory depth or server path.
function injectDashboardModals() {
    // Don't inject twice if modals already exist (e.g. hot-reload)
    if (document.getElementById('acceptModal') || document.getElementById('rejectModal')) return;

    // Inject the modal styles if modal.css isn't already linked on this page
    if (!document.getElementById('dashModalStyles')) {
        const style = document.createElement('style');
        style.id = 'dashModalStyles';
        style.textContent = `
            #acceptModal.modal-overlay,
            #rejectModal.modal-overlay {
                position: fixed;
                z-index: 99999;
                left: 0; top: 0;
                width: 100%; height: 100%;
                background-color: rgba(0,0,0,0.4);
                justify-content: center;
                align-items: center;
            }
            #acceptModal .modal-card,
            #rejectModal .modal-card {
                background-color: #3e627a;
                width: 450px;
                height: 270px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            #acceptModal .modal-header,
            #rejectModal .modal-header {
                padding: 15px 20px;
                display: flex;
                justify-content: flex-start;
                align-items: center;
                color: white;
                gap: 10px;
                cursor: pointer;
                transition: background 0.2s;
            }
            #acceptModal .modal-header:hover,
            #rejectModal .modal-header:hover {
                background-color: #335368;
            }
            #acceptModal .modal-header h3,
            #rejectModal .modal-header h3 {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 500;
            }
            #acceptModal .header-icon,
            #rejectModal .header-icon {
                font-size: 0.8rem;
                cursor: pointer;
                padding: 5px;
                transition: transform 0.2s, color 0.2s;
                color: white;
            }
            #acceptModal .modal-body,
            #rejectModal .modal-body {
                flex-grow: 1;
                padding: 20px;
                background-color: #f1f5f9;
                display: flex;
                flex-direction: column;
            }
            #acceptModal .modal-content-box,
            #rejectModal .modal-content-box {
                flex-grow: 1;
                background-color: #ffffff;
                border: 2px solid #3b82f6;
                border-radius: 10px;
                padding: 25px;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            #acceptModal .modal-content-box p,
            #rejectModal .modal-content-box p {
                color: #334155;
                line-height: 1.5;
                margin-bottom: 20px;
            }
            #acceptModal .modal-actions,
            #rejectModal .modal-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            #dashAcceptReviewBtn {
                background-color: #b8b8b8;
                color: #444;
                border: none;
                padding: 8px 50px;
                border-radius: 20px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            #dashAcceptConfirmBtn {
                background-color: #dcfce7;
                color: #166534;
                border: 1px solid #22c55e;
                padding: 8px 50px;
                border-radius: 20px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            #dashAcceptConfirmBtn:hover { background-color: #bbf7d0; }
            #rejectModal .remarks-input {
                width: 100%;
                flex-grow: 1;
                border: none;
                outline: none;
                resize: none;
                font-family: inherit;
                font-size: 1rem;
                color: #3e627a;
                text-align: left;
                padding-top: 10px;
                background: transparent;
                box-sizing: border-box;
            }
            #dashRejectCancelBtn {
                background-color: #fca5a5;
                color: #991b1b;
                border: 1px solid #ef4444;
                padding: 8px 50px;
                border-radius: 20px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            #dashRejectConfirmBtn {
                background-color: #dcfce7;
                color: #166534;
                border: 1px solid #22c55e;
                padding: 8px 50px;
                border-radius: 20px;
                font-weight: 600;
                cursor: pointer;
            }
            #dashRejectConfirmBtn:hover { background-color: #bbf7d0; }
        `;
        document.head.appendChild(style);
    }

    const modalHTML = `
        <!-- Accept Modal -->
        <div id="acceptModal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <div class="modal-header" onclick="switchDashboardModal('reject')">
                    <h3>Accept Request</h3>
                    <span class="header-icon">▼</span>
                </div>
                <div class="modal-body">
                    <div class="modal-content-box">
                        <p>Are you sure you want to accept
                            <strong class="dynamic-rep-name">Medical Representative's</strong> Request?
                        </p>
                        <div class="modal-actions">
                            <button class="btn-review" id="dashAcceptReviewBtn">Review</button>
                            <button class="btn-confirm" id="dashAcceptConfirmBtn">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Reject Modal -->
        <div id="rejectModal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <div class="modal-header" onclick="switchDashboardModal('accept')">
                    <h3>Reject Request</h3>
                    <span class="header-icon">▼</span>
                </div>
                <div class="modal-body">
                    <div class="modal-content-box">
                        <textarea class="remarks-input" id="dashRejectRemarks" placeholder="Enter remarks here.."></textarea>
                        <div class="modal-actions">
                            <button class="btn-cancel-red" id="dashRejectCancelBtn">Cancel</button>
                            <button class="btn-confirm-reject" id="dashRejectConfirmBtn">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Wire up buttons now that the HTML exists in the DOM
    document.getElementById('dashAcceptReviewBtn').onclick  = () => closeDashboardModal('acceptModal');
    document.getElementById('dashAcceptConfirmBtn').onclick = confirmAcceptFromModal;
    document.getElementById('dashRejectCancelBtn').onclick  = () => {
        closeDashboardModal('rejectModal');
        document.getElementById('dashRejectRemarks').value = '';
    };
    document.getElementById('dashRejectConfirmBtn').onclick = confirmRejectFromModal;
}

// Switch between Accept ↔ Reject modal from within the modal header
window.switchDashboardModal = function(target) {
    if (target === 'reject') {
        closeDashboardModal('acceptModal');
        // carry the rep name across
        const name = document.querySelector('#acceptModal .dynamic-rep-name')?.textContent || '';
        const rd   = document.querySelector('#rejectModal .dynamic-rep-name');
        if (rd && name) rd.textContent = name;
        document.getElementById('rejectModal').style.display = 'flex';
    } else {
        closeDashboardModal('rejectModal');
        const name = document.querySelector('#rejectModal .dynamic-rep-name')?.textContent || '';
        const ad   = document.querySelector('#acceptModal .dynamic-rep-name');
        if (ad && name) ad.textContent = name;
        document.getElementById('acceptModal').style.display = 'flex';
    }
};

// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// REQUEST DETAIL MODAL — SUMMARY VIEW
// ══════════════════════════════════════════════════

const monthNames = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
const shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                         "Jul","Aug","Sep","Oct","Nov","Dec"];

let rdActiveDoctor = null;
let rdCalMonthIndex = 0;

window.openRequestDetailModal = async function(repId, quarter, year) {
    const modal = document.getElementById('requestDetailModal');
    if (!modal) return;

    // Reset
    document.getElementById('rdLoading').style.display = 'flex';
    document.getElementById('rdSummaryContent').style.display = 'none';
    document.getElementById('rdRepName').textContent = '---';
    document.getElementById('rdArea').textContent = '---';
    document.getElementById('rdPeriodPill').textContent = '';
    document.getElementById('rdStatusBadge').innerHTML = '';
    document.getElementById('rdActions').style.display = 'flex';
    document.getElementById('rdAccordionContainer').innerHTML = '<p style="color:#999;font-size:13px;">Loading...</p>';
    rdShowCalEmpty();

    // Wire buttons
    document.getElementById('rdAcceptBtn').onclick = () => handleRdAccept(repId, quarter, year);
    document.getElementById('rdRejectBtn').onclick = () => handleRdReject(repId, quarter, year);
    
    openModal('requestDetailModal');

    try {
        const data = await API.fetchSummary(repId, quarter, year);

        // Rep info
        document.getElementById('rdRepName').textContent = data.medrep?.name || '---';
        document.getElementById('rdArea').textContent = data.medrep?.area || '---';

        // Period pill
        const qLabels = {
            1: ['Jan','Mar'], 2: ['Apr','Jun'],
            3: ['Jul','Sep'], 4: ['Oct','Dec']
        };
        const [s, e] = qLabels[quarter] || ['--','--'];
        document.getElementById('rdPeriodPill').textContent = `Q${quarter} · ${s} – ${e} ${year}`;

        // Status
        const dcpRows = data.dcp_list || [];
        const allApproved = dcpRows.length > 0 && dcpRows.every(r => (r.status || '').toLowerCase() === 'approved');
        const anyRejected = dcpRows.some(r => (r.status || '').toLowerCase() === 'rejected');

        if (anyRejected) {
            document.getElementById('rdActions').style.display = 'none';
            document.getElementById('rdStatusBadge').innerHTML = '<span class="rd-status-rejected" style="color:#ef4444; font-weight:700;">✖ Rejected</span>';
        } else if (allApproved) {
            document.getElementById('rdActions').style.display = 'none';
            document.getElementById('rdStatusBadge').innerHTML = '<span class="rd-status-approved">✓ Approved</span>';
        }

        // Stats
        rdRenderStats(data.summary || {}, dcpRows);

        // Breakdown accordion
        rdRenderBreakdown(dcpRows);

        document.getElementById('rdLoading').style.display = 'none';
        document.getElementById('rdSummaryContent').style.display = 'flex';

    } catch (err) {
        console.error('Request Detail Modal error:', err);
        document.getElementById('rdLoading').innerHTML = '<p style="color:#c62828;">Failed to load summary.</p>';
    }
};

/* ─── 1. RENDER DOCTOR LIST (ACCORDION STYLE) ─── */
function renderRequestDetail(data) {
    const listContainer = document.getElementById('rdDoctorList');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    const doctorMap = {};
    const pharmacyMap = {};

    // Grouping logic similar to summary.js
    data.dcp_list.forEach(item => {
        const type = (item.record_type || '').toUpperCase();
        const targetMap = type === 'PHARMACY' ? pharmacyMap : doctorMap;
        
        if (!targetMap[item.name]) {
            targetMap[item.name] = { 
                name: item.name, 
                dates: [], 
                type: item.record_type,
                area: item.area || 'N/A'
            };
        }
        targetMap[item.name].dates.push(new Date(item.date));
    });

    const renderGroup = (map, title) => {
        const entries = Object.values(map);
        if (entries.length === 0) return;

        const groupHeader = document.createElement('div');
        groupHeader.className = 'rd-group-title'; 
        groupHeader.innerText = title;
        listContainer.appendChild(groupHeader);

        entries.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'rd-doctor-item';
            
            // Set up the click event to update the calendar on the right
            item.onclick = () => selectDoctorForCalendar(doc, item);

            item.innerHTML = `
                <div class="rd-doc-info">
                    <div class="rd-doc-name">${doc.name}</div>
                    <div class="rd-doc-area">${doc.area}</div>
                </div>
                <div class="rd-doc-count">${doc.dates.length} Visits</div>
            `;
            listContainer.appendChild(item);
        });
    };

    renderGroup(doctorMap, 'DOCTORS');
    renderGroup(pharmacyMap, 'PHARMACIES');
}

/* ─── 2. SELECTION LOGIC (BRIDGING LIST TO CALENDAR) ─── */
function selectDoctorForCalendar(doc, element) {
    // UI: Highlight the selected doctor
    document.querySelectorAll('.rd-doctor-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    // Logic: Map dates to the specific months of the viewed quarter
    const monthsInQuarter = getMonthsForQuarter(schedQuarter);
    const monthList = monthsInQuarter.map(mIdx => {
        return {
            monthIndex: mIdx,
            year: schedYear,
            dates: doc.dates.filter(d => d.getMonth() === mIdx)
        };
    });

    // Update Global Modal State
    rdActiveDoctor = {
        name: doc.name,
        monthList: monthList
    };
    rdCalMonthIndex = 0; 

    // Show the calendar
    document.getElementById('rdCalEmpty').classList.add('hidden');
    document.getElementById('rdCalActive').classList.remove('hidden');
    
    // Call your existing calendar render function
    rdRenderCalendar();
}

/* ─── 3. HELPER: QUARTER TO MONTH MAPPING ─── */
function getMonthsForQuarter(q) {
    const quarters = { 1: [0,1,2], 2: [3,4,5], 3: [6,7,8], 4: [9,10,11] };
    return quarters[q] || [0,1,2];
}

function rdRenderStats(summary, dcpList) {
    const visitedDoctorIds = new Set();
    const visitedPharmacyIds = new Set();
    dcpList.forEach(entry => {
        if (entry.cds_id) {
            const rt = (entry.record_type || entry.RecordType || entry.type || 'doctor').toLowerCase();
            if (rt === 'pharmacy') visitedPharmacyIds.add(entry.cds_id);
            else visitedDoctorIds.add(entry.cds_id);
        }
    });

    const totalCdsDoctors = summary.total_cds_doctors ?? 75;
    const totalCdsPharmacies = summary.total_cds_pharmacies ?? 75;
    const doctorVisited = visitedDoctorIds.size || summary.total_doctors || 0;
    const pharmacyVisited = visitedPharmacyIds.size || summary.total_pharmacies || 0;

    document.getElementById('rdStatDoctors').innerHTML =
        `${doctorVisited}<span class="rd-stat-total">/${totalCdsDoctors}</span>`;
    document.getElementById('rdStatVisits').textContent =
        summary.total_visits || dcpList.length || 0;
    document.getElementById('rdStatPharmacies').innerHTML =
        `${pharmacyVisited}<span class="rd-stat-total">/${totalCdsPharmacies}</span>`;
}

function rdRenderBreakdown(dcpList) {
    const container = document.getElementById('rdAccordionContainer');
    const doctorMap = {}, pharmacyMap = {};

    const rdMonthNames = ["January","February","March","April","May","June",
                          "July","August","September","October","November","December"];

    dcpList.forEach(entry => {
        const rt = (entry.record_type || entry.RecordType || entry.type || 'doctor').toLowerCase();
        const isPharmacy = rt === 'pharmacy';
        const name = isPharmacy
            ? (entry.pharmacy_name || entry.Pharmacy_Name || entry.doctors || 'Unnamed Pharmacy')
            : (entry.doctors || entry.doctor_name || entry.name || 'Unnamed Doctor');
        const id = entry.cds_id || entry.id || name;
        const map = isPharmacy ? pharmacyMap : doctorMap;
        if (!map[id]) map[id] = { name, dates: [], recordType: rt };
        if (entry.dcp_date) map[id].dates.push(entry.dcp_date);
    });

    container.innerHTML = '';

    const renderGroup = (map, groupLabel) => {
        if (!Object.keys(map).length) return;

        const lbl = document.createElement('p');
        lbl.className = 'rd-group-label';
        lbl.textContent = groupLabel;
        container.appendChild(lbl);

        Object.keys(map).sort().forEach(id => {
            const { name, dates, recordType } = map[id];

            // Build month buckets (same logic as summary.js)
            const monthBuckets = {};
            dates.forEach(raw => {
                const d = new Date(raw);
                const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
                if (!monthBuckets[key]) monthBuckets[key] = { label: rdMonthNames[d.getMonth()], days: new Set() };
                monthBuckets[key].days.add(d.getDate());
            });

            const sortedKeys = Object.keys(monthBuckets).sort();

            const rowsHtml = sortedKeys.map(key => {
                const { label: mLabel, days } = monthBuckets[key];
                const sortedDays = Array.from(days).sort((a, b) => a - b);
                return `
                    <div class="rd-visit-row">
                        <span class="rd-visit-month">${mLabel}</span>
                        <div class="rd-dates-wrapper">
                            <span class="rd-dates-sublabel">DATES</span>
                            <div class="rd-chip-wrap">
                                ${sortedDays.map(d => `<span class="rd-chip">${d}</span>`).join('')}
                            </div>
                        </div>
                        <span class="rd-freq"><b>${sortedDays.length}x</b> visits</span>
                    </div>`;
            }).join('');

            const datesEncoded = JSON.stringify(dates).replace(/"/g, '&quot;');

            const item = document.createElement('div');
            item.className = 'rd-acc-item';
            item.innerHTML = `
                <div class="rd-acc-header"
                     onclick="rdToggleAccordion(this, '${name.replace(/'/g,"\\'")}', JSON.parse(this.dataset.dates), '${recordType}')"
                     data-dates="${datesEncoded}">
                    <span class="rd-acc-name">${name}</span>
                    <span class="rd-acc-chevron">&#8964;</span>
                </div>
                <div class="rd-acc-body">
                    <div class="rd-acc-inner">
                        ${rowsHtml}
                        <div class="rd-acc-footer">
                            <span>TOTAL VISITS</span>
                            <span class="rd-bold-total">${dates.length} visits</span>
                        </div>
                    </div>
                </div>`;
            container.appendChild(item);
        });
    };

    renderGroup(doctorMap, 'DOCTORS');
    renderGroup(pharmacyMap, 'PHARMACY');
}

window.rdToggleAccordion = function(headerEl, name, dates, recordType) {
    const item = headerEl.closest('.rd-acc-item');
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.rd-acc-item.active').forEach(i => i.classList.remove('active'));
    if (!isActive) {
        item.classList.add('active');
        rdShowCalendar(name, dates, recordType);
    } else {
        rdShowCalEmpty();
    }
};

function rdShowCalendar(name, dates, recordType) {
    const rdMonthNames = ["January","February","March","April","May","June",
                          "July","August","September","October","November","December"];
    rdActiveDoctor = {
        name,
        dates: dates.map(d => new Date(d)),
        recordType,
        rdMonthNames
    };

    const monthSet = new Set(rdActiveDoctor.dates.map(d => `${d.getFullYear()}-${d.getMonth()}`));
    rdActiveDoctor.monthList = Array.from(monthSet)
        .map(key => { const [y, m] = key.split('-').map(Number); return { year: y, month: m }; })
        .sort((a, b) => a.year - b.year || a.month - b.month);

    rdCalMonthIndex = 0;

    document.getElementById('rdCalEmpty').style.display = 'none';
    const active = document.getElementById('rdCalActive');
    active.classList.remove('hidden');
    active.style.display = 'flex';

    rdRenderCalendar();
}

function rdShowCalEmpty() {
    rdActiveDoctor = null;
    document.getElementById('rdCalEmpty').style.display = 'flex';
    const active = document.getElementById('rdCalActive');
    active.classList.add('hidden');
    active.style.display = 'none';
}

function rdRenderCalendar() {
    if (!rdActiveDoctor || !rdActiveDoctor.monthList.length) return;

    const rdMonthNames = rdActiveDoctor.rdMonthNames || ["January","February","March","April","May","June",
                          "July","August","September","October","November","December"];

    const { year: y, month: m } = rdActiveDoctor.monthList[rdCalMonthIndex];
    document.getElementById('rdCalMonthLabel').textContent = `${rdMonthNames[m]} ${y}`;

    const prevBtn = document.querySelector('#rdCalActive .rd-cal-nav-btn:first-child');
    const nextBtn = document.querySelector('#rdCalActive .rd-cal-nav-btn:last-child');
    if (prevBtn) prevBtn.classList.toggle('nav-hidden', rdCalMonthIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('nav-hidden', rdCalMonthIndex === rdActiveDoctor.monthList.length - 1);

    const scheduledDays = new Set(
        rdActiveDoctor.dates
            .filter(d => d.getFullYear() === y && d.getMonth() === m)
            .map(d => d.getDate())
    );

    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const grid = document.getElementById('rdCalGrid');
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const el = document.createElement('div');
        el.className = 'rd-cal-day rd-empty';
        grid.appendChild(el);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const el = document.createElement('div');
        el.className = 'rd-cal-day' + (scheduledDays.has(d) ? ' rd-scheduled' : '');
        el.textContent = d;
        grid.appendChild(el);
    }
}

window.rdChangeMonth = (dir) => {
    if (!rdActiveDoctor) return;
    const newIdx = rdCalMonthIndex + dir;
    if (newIdx < 0 || newIdx >= rdActiveDoctor.monthList.length) return;
    rdCalMonthIndex = newIdx;
    rdRenderCalendar();
};

function handleRdAccept(repId, quarter, year) {
    // Save context so the "Confirm" button knows which row we clicked
    rdPendingAction = { id: repId, quarter, year };
    
    const modal = document.getElementById('acceptModal');
    if (modal) {
        // Try to find the rep's name from your scheduleData array
        const rep = scheduleData.find(r => String(r.id) === String(repId));
        const nameDisplay = modal.querySelector('.dynamic-rep-name');
        if (nameDisplay) {
            nameDisplay.textContent = (rep ? rep.name : "Representative") + "'s";
        }
        
        modal.style.display = 'flex'; // This makes it visible
    } else {
        console.error("acceptModal not found in DOM. Check if loadDashboardModal worked.");
    }
}

function handleRdReject(repId, quarter, year) {
    rdPendingAction = { id: repId, quarter, year };
    
    const modal = document.getElementById('rejectModal');
    if (modal) {
        modal.style.display = 'flex'; // This makes it visible
    } else {
        console.error("rejectModal not found in DOM.");
    }
}

// Function for the "Confirm" button in Accept Modal
async function confirmAcceptFromModal() {
    await updateRdGlobalStatus('Approved', null, rdPendingAction.id, rdPendingAction.quarter, rdPendingAction.year);
    closeDashboardModal('acceptModal');
}

// Function for the "Confirm" button in Reject Modal
async function confirmRejectFromModal() {
    const remarksInput = document.getElementById('dashRejectRemarks') ||
                         document.querySelector('#rejectModal .remarks-input');
    const remarks = remarksInput?.value.trim();

    if (!remarks) {
        alert("Please provide a reason for rejection.");
        return;
    }

    await updateRdGlobalStatus('Rejected', remarks, rdPendingAction.id, rdPendingAction.quarter, rdPendingAction.year);
    closeDashboardModal('rejectModal');
    if (remarksInput) remarksInput.value = '';
}

function closeDashboardModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

async function updateRdGlobalStatus(newStatus, remarks, repId, quarter, year) {
    // 1. Create a clean payload object
    const payload = { 
        id: repId, 
        quarter: parseInt(quarter), 
        year: parseInt(year), 
        status: newStatus, 
        remarks: remarks || "" 
    };

    try {
        // 2. Call the API directly
        const result = await API.updateGlobalStatus(payload);
        
            if (result && !result.error) {
            alert(`Request successfully ${newStatus}!`);
            
            // Close modals
            closeDashboardModal('acceptModal');
            closeDashboardModal('rejectModal');
            closeModal('requestDetailModal');
            
            // Switch tab to match the new status so you see the change
            schedTab = newStatus;

            // FIX: Sync the tab button active class with the new schedTab
            document.querySelectorAll('#scheduleModal .tab-btn').forEach(b => {
                b.classList.toggle('active', b.textContent.trim() === newStatus);
            });

            // Refresh data
            loadDashboardStats();
            loadSchedulesFromAPI();
        }else {
            alert(`Failed to update status: ${result?.error || "Unknown Error"}`);
        }
    } catch (err) {
        console.error("Status Update Error:", err);
        alert("A connection error occurred while updating status.");
    }
}