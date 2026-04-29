function checkApiHealth() {
    if (!localStorage.getItem('current_emp_id')) return;
    fetch("http://192.168.100.44:5000/api/health")
      .then(r => r.json())
      .then(d => console.log("TEST OK:", d))
      .catch(e => console.log("TEST FAIL:", e));
}

// ── DEBUG WRAPPER ──────────────────────────────────
async function apiFetch(url) {
    console.log("🌐 API CALL →", url);

    try {
        const res = await fetch(url);
        console.log("📡 STATUS →", res.status);

        const data = await res.json();
        console.log("📥 RESPONSE →", url, data);

        return data;
    } catch (err) {
        console.error("❌ FETCH ERROR →", url, err);
        return [];
    }
}


// ── STATE ──────────────────────────────────────────
const _now = new Date();
let schedTab     = 'Pending';
let schedQuarter = Math.ceil((_now.getMonth() + 1) / 3); // current quarter
let schedYear    = _now.getFullYear();                     // current year

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
    document.getElementById(id).classList.add('active');
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
    if (el) el.textContent = (data && data.medreps !== undefined) ? data.medreps : '---';

    // Update the sub-label for the Schedule Request card to reflect current period
    const sub = document.getElementById('scheduleSubLabel');
    if (sub) sub.textContent = `Q${schedQuarter} - ${schedYear}`;

    const prod = document.getElementById('totalProductsValue');
    if (prod) {
        prod.textContent = (data && data.products !== undefined) ? data.products : '---';
        const prodCard = prod.closest('.card') || prod.closest('.stat-card') || prod.parentElement;
        if (prodCard) { // Make the entire card clickable
            prodCard.style.cursor = 'pointer'; 
            prodCard.onclick = () => openModal('productsModal'); // Open the modal
        }
    }

    const sched = document.getElementById('totalSchedulesValue');
    if (sched) sched.textContent = (data && data.requestedSchedules !== undefined) ? data.requestedSchedules : '---';
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
    
    // Handle { data: [...] }, { products: [...] } or direct array
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

        // 2. Image handling
        let rawImg = p.product_image || p.Product_Image || p.image_url || '';
        let imgSrc = '';

        // If Supabase returns an object, extract the URL; otherwise treat as string
        if (typeof rawImg === 'object' && rawImg !== null) {
            imgSrc = rawImg.publicUrl || rawImg.url || '';
        } else {
            imgSrc = String(rawImg || '').trim();
        }

        if (imgSrc && imgSrc !== 'null' && imgSrc !== '' && !imgSrc.includes('[object Object]')) {
            // 🔥 FIX: Correct common domain typo (yducuj -> ydcucj) to resolve NAME_NOT_RESOLVED errors
            imgSrc = imgSrc.replace('qsqjjswyducujtuglwai', 'qsqjjswydcucjtuglwai');

            if (!imgSrc.startsWith('http')) {
                imgSrc = SUPABASE_BASE + imgSrc;
            }
        }

        const displayUrl =
            imgSrc && imgSrc.startsWith('http')
                ? `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`
                : '';

        return `
        <div class="product-card">
            <div class="product-card-img">
                ${displayUrl
                    ? `<img
                        src="${displayUrl}"
                        alt="${brand}"
                        style="width:100%;height:100%;object-fit:cover;"
                        onerror="this.parentElement.innerHTML='<div class=\\'product-card-img-placeholder\\'>&#128138;</div>';">`
                    : `<div class="product-card-img-placeholder">&#128138;</div>`
                }
            </div>
            <div class="product-card-body">
                <div class="product-card-generic">Generic Name</div>
                <div class="product-card-name">${generic}</div>
                <div class="product-card-generic" style="margin-top:6px;">Brand Name</div>
                <div class="product-card-brand">${brand}</div>
            </div>
        </div>`;
    }).join('');
};


// ── RENDER SCHEDULE ────────────────────────────────
function renderScheduleList(data) {
    const list  = document.getElementById('schedList');
    const count = document.getElementById('schedCount');
    if (!list || !count) return;

    const search = (document.getElementById('schedSearch')?.value || '').toLowerCase();

    const statusClass = {
        'Pending':  'status-badge--pending',
        'Approved': 'status-badge--approved',
        'Missing':  'status-badge--missing',
    };

    // Filter by active tab AND search term
    const filtered = (data || []).filter(r => {
    let rStatus = (r.status || '').toLowerCase().trim();
    let tStatus = schedTab.toLowerCase().trim();

    // 🔥 KEY FIX: support "Missing" even if backend sends no status
    if (!r.status && tStatus === 'missing') {
        rStatus = 'missing';
    }

    const matchTab = rStatus === tStatus;

    const matchSearch = !search ||
        (r.name || '').toLowerCase().includes(search) ||
        (r.spec || '').toLowerCase().includes(search) ||
        (r.hosp || '').toLowerCase().includes(search);

    return matchTab && matchSearch;
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
        
        return `
        <div class="sched-card"
             onclick="window.location.href='../representatives/schedule/schedule.html?id=${encodeURIComponent(repId)}'">
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
    checkApiHealth();
});