// ── STATE ──────────────────────────────────────────

// ── TOAST NOTIFICATION ──────────────────────────────
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed; bottom: 32px; right: 32px;
            display: flex; flex-direction: column; gap: 10px;
            z-index: 99999; pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const colors = {
        success: { bg: '#e8f5e9', border: '#4caf50', icon: '✓', text: '#2e7d32' },
        error:   { bg: '#fdecea', border: '#f44336', icon: '✕', text: '#c62828' },
        warning: { bg: '#fff8e1', border: '#ffc107', icon: '⚠', text: '#a07010' },
    };
    const c = colors[type] || colors.success;

    const toast = document.createElement('div');
    toast.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        background: ${c.bg}; border: 1.5px solid ${c.border};
        border-radius: 12px; padding: 14px 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        font-size: 14px; font-weight: 600; color: ${c.text};
        min-width: 260px; max-width: 380px;
        opacity: 0; transform: translateY(12px);
        transition: opacity 0.25s, transform 0.25s;
        pointer-events: auto;
    `;
    toast.innerHTML = `
        <span style="font-size:18px; flex-shrink:0;">${c.icon}</span>
        <span style="flex:1;">${message}</span>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
// ─────────────────────────────────────────────────────

const _now = new Date();
let schedTab     = 'Pending';
let schedQuarter = Math.ceil((_now.getMonth() + 1) / 3); // current quarter
let schedYear    = _now.getFullYear();                     // current year
let rdPendingAction = { id: null, quarter: null, year: null }; // ADD THIS LINE

let scheduleData   = [];
let productsData   = [];
let unusualReports = [];
let isSavingProduct = false;

// ── MISSED CALL REPORT STATE ───────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let missedMonth = _now.getMonth() + 1;  // 1-12
let missedYear  = _now.getFullYear();


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
window.openProductsModal = () => openModal('productsModal'); // This is a modal, keeping as is
window.openUnusualModal = () => openModal('unusualModal'); // This is a modal, keeping as is
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
window.openPerformanceModal = () => window.location.href = '../performance/performance.html';

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

    if (!generic || !brand || !file) {
        isSavingProduct = false;
        if (!generic || !brand) showToast("Please fill in both Generic and Brand names.", "warning");
        else showToast("Please upload a product image.", "warning");
        return;
    }

    console.log("DEBUG: Payload data gathered:", { generic, brand, hasFile: !!file });

    // Use FormData to package the binary file and text fields together
    const formData = new FormData();
    formData.append('product_generic_name', generic);
    formData.append('product_brand_name', brand);
    formData.append('product_image', file);

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
            showToast("Product saved successfully!");
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
            showToast("Server error: " + errorMsg.slice(0, 100), "error");
        }
    } catch (err) {
        console.error("Save Product Error:", err);
        showToast("Connection error. Make sure the backend is running.", "error");
    } finally {
        isSavingProduct = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Product";
        }
    }

};

window.openUnusualModal = () => {
    // Sync labels to current missedMonth/missedYear
    _syncMissedLabels();
    _renderMissedList();
    openModal('unusualModal');
};

function _syncMissedLabels() {
    const mEl = document.getElementById('missedMonthLabel');
    const yEl = document.getElementById('missedYearLabel');
    if (mEl) mEl.textContent = MONTH_NAMES[missedMonth - 1];
    if (yEl) yEl.textContent = missedYear;
}

window.missedChangeMonth = (dir) => {
    missedMonth += dir;
    if (missedMonth < 1)  { missedMonth = 12; missedYear--; }
    if (missedMonth > 12) { missedMonth = 1;  missedYear++; }
    _syncMissedLabels();
    _renderMissedList();
};

window.missedChangeYear = (dir) => {
    missedYear += dir;
    _syncMissedLabels();
    _renderMissedList();
};

function _isMissed(dateStr) {
    // Option A: NULL visit treated as Missed only if the month is already over
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    // If selected month/year is in the past → count NULLs as Missed
    if (missedYear < currentYear) return true;
    if (missedYear === currentYear && missedMonth < currentMonth) return true;
    return false; // current or future month → still Pending
}

function _renderMissedList() {
    const listContainer = document.getElementById('unusualList');
    const countEl       = document.getElementById('unusualCount');
    if (!listContainer) return;

    const isPastMonth = _isMissed();

    // 1. Process and filter the data based on current month/year selection
    const filtered = unusualReports.map(rep => {
        const matchingDetails = (rep.details || []).filter(d => {
            if (!d.date_missed) return false;
            const dt = new Date(d.date_missed);
            return (dt.getMonth() + 1) === missedMonth && dt.getFullYear() === missedYear;
        });
        // Attach the specific month context to the object
        return { ...rep, monthDetails: matchingDetails, monthMissed: matchingDetails.length };
    }).filter(rep => {
        if (!isPastMonth) return false; 
        return rep.monthMissed > 0;
    });

    // 2. Update the status/count message
    if (countEl) {
        countEl.textContent = isPastMonth
            ? `Showing ${filtered.length} representative${filtered.length !== 1 ? 's' : ''}`
            : `No missed calls recorded yet for ${MONTH_NAMES[missedMonth - 1]} ${missedYear} — month not yet completed.`;
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="padding:40px; text-align:center; color:#aab0be;">
                <p>${isPastMonth ? 'No missed calls for ' + MONTH_NAMES[missedMonth-1] + ' ' + missedYear + '.' : ''}</p>
            </div>`;
        return;
    }

    // 3. Render cards using data-index to avoid syntax errors from quotes
    listContainer.innerHTML = filtered.map(rep => {
        const initials = getInitials(rep.name);
        // Find the original index in the main unusualReports array
        const originalIndex = unusualReports.findIndex(r => r.name === rep.name);
        
        return `
            <div class="missed-rep-card unusual-modal-clickable" data-index="${originalIndex}" style="cursor:pointer;">
                <div class="missed-rep-avatar">${initials}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:#1e2d3d; font-size:14px;">${rep.name}</div>
                </div>
                <div class="missed-rep-badge">
                    ${rep.monthMissed} Total Missed Call
                </div>
            </div>`;
    }).join('');

    // 4. Delegated Click Detector for the Modal
    listContainer.onclick = (e) => {
        const card = e.target.closest('.unusual-modal-clickable');
        if (!card) return;
        
        const idx = card.getAttribute('data-index');
        const repData = unusualReports[idx];
        
        if (repData) {
            // Re-calculate the specific month's details before opening the modal
            const matchingDetails = (repData.details || []).filter(d => {
                if (!d.date_missed) return false;
                const dt = new Date(d.date_missed);
                return (dt.getMonth() + 1) === missedMonth && dt.getFullYear() === missedYear;
            });
            
            const repWithContext = { 
                ...repData, 
                monthDetails: matchingDetails,
                monthMissed: matchingDetails.length 
            };
            
            openUnusualDetail(repWithContext);
        }
    };
}


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

    const perfPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
        p.querySelector('.panel-title')?.textContent.toLowerCase().includes('performance')
    );
    const container = perfPanel ? perfPanel.querySelector('.panel-body') : document.querySelector('.panel .panel-body');
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
        'Rejected': 'status-badge--rejected',
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
        } else if (schedTab === 'Rejected') {
            const idx = filtered.indexOf(r);
            window._rejectedScheduleData = filtered;
            clickHandler = `window._openRejectedByIndex(${idx})`;
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


// ── UPDATED UNUSUAL UI RENDERER ──────────────────
// =====================================
// 3. MISSED CALL REPORTS (UNUSUAL)
// =====================================

function updateUnusualUI() {
    const panel = document.getElementById('unusualPanelBody');
    if (!panel) return;

    if (!unusualReports || unusualReports.length === 0) {
        panel.innerHTML = `
            <div style="padding:40px; text-align:center; color:#888;">
                <p>No approved schedules found for Q${schedQuarter}</p>
            </div>`;
        return;
    }

    const withMisses = unusualReports.filter(r => (r.total_missed || 0) > 0);
    const allClear   = unusualReports.filter(r => (r.total_missed || 0) === 0);

    let html = '';

    // Robust card renderer using data-index instead of JSON strings in attributes
    const renderCard = (r, isClear) => {
        const initials = getInitials(r.name);
        const originalIdx = unusualReports.indexOf(r);
        const badgeStyle = isClear ? 'background:#dcfce7; color:#166534; border:1px solid #bbf7d0;' : '';
        const badgeClass = isClear ? '' : 'badge--red';
        const badgeText = isClear ? 'No misses' : `${r.total_missed} missed calls`;
        const avatarStyle = isClear ? 'background:#e2e8f0; color:#64748b;' : '';

        return `
            <div class="report-item unusual-panel-card" data-index="${originalIdx}" style="cursor:pointer;">
                <div class="perf-avatar" style="${avatarStyle}">${initials}</div>
                <div class="report-info">
                    <span class="perf-name">${r.name}</span>
                    <span class="report-badge ${badgeClass}" style="${badgeStyle}">${badgeText}</span>
                </div>
                <div style="color: #cbd5e1; margin-left: auto;">&#10217;</div>
            </div>
            <div class="report-divider"></div>
        `;
    };

    if (withMisses.length > 0) {
        html += withMisses.map(r => renderCard(r, false)).join('');
    }

    if (allClear.length > 0) {
        html += `<div style="padding: 8px 16px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em; background: #f8fafc; border-top: 1px solid #f1f5f9;">ALL CLEAR</div>`;
        html += allClear.map(r => renderCard(r, true)).join('');
    }

    panel.innerHTML = html;

    // Use a single delegated click listener to handle names with quotes correctly
    panel.onclick = (e) => {
        const card = e.target.closest('.unusual-panel-card');
        if (!card) return;
        const idx = card.getAttribute('data-index');
        const rep = unusualReports[idx];
        if (rep) openUnusualDetail(rep);
    };
}

function openUnusualDetail(rep) {
    const modal           = document.getElementById('unusualDetailModal');
    const listContainer   = document.getElementById('detailDoctorsList');
    const headerContainer = document.getElementById('detailRepHeader');
    const issueBar        = document.getElementById('detailIssueBar');

    const isPastMonth = _isMissed();
    const initials = getInitials(rep.name);
    
    headerContainer.style.cssText = `position:sticky; top:0; background:#fff; z-index:100; border-bottom:1px solid #edf2f7; padding:16px 24px; box-shadow:0 2px 4px rgba(0,0,0,0.04);`;
    headerContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:44px; height:44px; background:#cfe0ef; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:800; color:#2c4e68; font-size:14px; flex-shrink:0;">${initials}</div>
            <div style="flex:1; min-width:0;"><div style="font-size:15px; font-weight:700; color:#0f172a;">${rep.name}</div></div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                <div class="quarter-nav" style="min-width:unset;">
                    <button class="nav-btn" onclick="missedDetailChangeMonth(-1, unusualReports[${unusualReports.indexOf(rep)}])">&#8249;</button>
                    <div class="nav-label">
                        <span class="nav-label-main" id="detailMonthLabel">${MONTH_NAMES[missedMonth - 1]}</span>
                        <span class="nav-label-sub">Month</span>
                    </div>
                    <button class="nav-btn" onclick="missedDetailChangeMonth(1, unusualReports[${unusualReports.indexOf(rep)}])">&#8250;</button>
                </div>
            </div>
        </div>
    `;

    if (!isPastMonth) {
        if (issueBar) {
            issueBar.style.cssText = 'padding:10px 24px 4px;';
            issueBar.innerHTML = `<span style="color:#7a8fa0; font-weight:700; font-size:13px;">Month not yet completed</span>`;
        }
        if (listContainer) {
            listContainer.innerHTML = `<div style="padding:40px; text-align:center; color:#aab0be;"><p>No missed calls recorded yet for ${MONTH_NAMES[missedMonth - 1]} ${missedYear}.</p></div>`;
        }
    } else {
        const details = rep.monthDetails || rep.details || [];
        const monthMissed = rep.monthMissed ?? details.length;
        if (issueBar) {
            issueBar.style.cssText = 'padding:10px 24px 4px;';
            issueBar.innerHTML = `<span style="color:#c0392b; font-weight:700; font-size:13px;">Showing ${monthMissed} Missed Call</span>`;
        }
        _renderDetailList(listContainer, details);
    }
    modal.classList.add('active');
}

// 1. GLOBAL DATA STORE
let currentUnusualData = []; 

function renderUnusualReports(data) {
    const container = document.getElementById('unusualReportsContainer'); 
    if (!container) return;

    // 2. CLEAN & FILTER DATA — backend sends total_missed, not count/type
    currentUnusualData = data.filter(rep => (rep.total_missed || 0) > 0);

    if (currentUnusualData.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">No alerts.</div>';
        return;
    }

    // 3. RENDER WITH DATA-ATTRIBUTES
    // Notice: NO onclick="" here. We handle clicks separately.
    container.innerHTML = currentUnusualData.map((rep, index) => {
        const initials = rep.name.split(' ').map(n => n[0]).join('').toUpperCase();
        
        return `
            <div class="unusual-card" 
                 data-rep-index="${index}" 
                 style="cursor: pointer !important; display: flex; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid #f1f5f9; position: relative; z-index: 1000;">
                
                <div style="pointer-events: none; width: 44px; height: 44px; background: #e0f2fe; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0369a1; flex-shrink: 0;">
                    ${initials}
                </div>
                
                <div style="pointer-events: none; flex-grow: 1;">
                    <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 4px;">${rep.name}</div>
                    <div style="background: #fee2e2; color: #991b1b; font-size: 12px; padding: 2px 10px; border-radius: 12px; display: inline-block; font-weight: 600; border: 1px solid #fecaca;">
                        ${rep.total_missed} unresolved misses
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 4. THE "DELEGATED" CLICK DETECTOR
    // We attach the click to the CONTAINER. Even if the card is weird, the container will catch the click.
    container.onclick = function(event) {
        const card = event.target.closest('.unusual-card');
        if (!card) return;

        const index = card.getAttribute('data-rep-index');
        const rep = currentUnusualData[index];
        
        if (rep) {
            console.log("Success! Clicking:", rep.name);
            openUnusualDetail(rep);
        }
    };
}

function openUnusualDetail(rep) {
    const modal           = document.getElementById('unusualDetailModal');
    const listContainer   = document.getElementById('detailDoctorsList');
    const headerContainer = document.getElementById('detailRepHeader');
    const issueBar        = document.getElementById('detailIssueBar');

    // Apply Option A logic gate
    const isPastMonth = _isMissed();

    // ── STICKY REP HEADER ─────────────────────────
    const initials = getInitials(rep.name);
    
    headerContainer.style.cssText = `
        position:sticky; top:0; background:#fff; z-index:100;
        border-bottom:1px solid #edf2f7; padding:16px 24px;
        box-shadow:0 2px 4px rgba(0,0,0,0.04);
    `;

    headerContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:44px; height:44px; background:#cfe0ef; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:800; color:#2c4e68; font-size:14px; flex-shrink:0;">
                ${initials}
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-size:15px; font-weight:700; color:#0f172a;">${rep.name}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                <div class="quarter-nav" style="min-width:unset;">
                    <button class="nav-btn" onclick="missedDetailChangeMonth(-1, ${JSON.stringify(rep).replace(/"/g,'&quot;')})">&#8249;</button>
                    <div class="nav-label">
                        <span class="nav-label-main" id="detailMonthLabel">${MONTH_NAMES[missedMonth - 1]}</span>
                        <span class="nav-label-sub">Month</span>
                    </div>
                    <button class="nav-btn" onclick="missedDetailChangeMonth(1, ${JSON.stringify(rep).replace(/"/g,'&quot;')})">&#8250;</button>
                </div>
                <div class="quarter-nav" style="min-width:unset;">
                    <button class="nav-btn" onclick="missedDetailChangeYear(-1, ${JSON.stringify(rep).replace(/"/g,'&quot;')})">&#8249;</button>
                    <div class="nav-label">
                        <span class="nav-label-main" id="detailYearLabel">${missedYear}</span>
                        <span class="nav-label-sub">Year</span>
                    </div>
                    <button class="nav-btn" onclick="missedDetailChangeYear(1, ${JSON.stringify(rep).replace(/"/g,'&quot;')})">&#8250;</button>
                </div>
            </div>
        </div>
    `;

    // ── CONDITIONAL CONTENT RENDERING ──────────────
    if (!isPastMonth) {
        // Hide data if month/year is current or future
        if (issueBar) {
            issueBar.style.cssText = 'padding:10px 24px 4px;';
            issueBar.innerHTML = `<span style="color:#7a8fa0; font-weight:700; font-size:13px;">Month not yet completed</span>`;
        }
        if (listContainer) {
            listContainer.innerHTML = `
                <div style="padding:40px; text-align:center; color:#aab0be;">
                    <p>No missed calls recorded yet for ${MONTH_NAMES[missedMonth - 1]} ${missedYear}.</p>
                </div>`;
        }
    } else {
        // Render normally for past months
        const details = rep.monthDetails || rep.details || [];
        const monthMissed = rep.monthMissed ?? details.length;

        if (issueBar) {
            issueBar.style.cssText = 'padding:10px 24px 4px;';
            issueBar.innerHTML = `
                <span style="color:#c0392b; font-weight:700; font-size:13px;">
                    Showing ${monthMissed} Missed Call
                </span>`;
        }

        _renderDetailList(listContainer, details);
    }

    modal.classList.add('active');
}

function _renderDetailList(listContainer, details) {
    if (!listContainer) return;

    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    const grouped = details.reduce((acc, d) => {
        const name = d.display_name || 'Unknown';
        if (!acc[name]) acc[name] = [];
        acc[name].push(d);
        return acc;
    }, {});

    if (Object.keys(grouped).length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:#94a3b8;">
                <p>No missed calls for ${MONTH_NAMES[missedMonth-1]} ${missedYear}.</p>
            </div>`;
        return;
    }

    listContainer.innerHTML = Object.entries(grouped).map(([name, visits]) => {
        const rows = visits.map(v => {
            const dt      = v.date_missed ? new Date(v.date_missed) : null;
            const dayName = dt ? DAY_NAMES[dt.getDay()] : 'N/A';
            const qLabel  = v.quarter ? `Q${v.quarter}` : 'N/A';
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 16px; border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:13px; color:#334155; font-weight:500;">${v.date_missed || 'N/A'}</span>
                    <span style="font-size:12px; color:#64748b;">${dayName} | ${qLabel}</span>
                </div>`;
        }).join('');

        return `
            <div style="margin-bottom:14px; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0;">
                <div style="background:#2c4e68; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; color:#fff; font-size:14px;">${name}</span>
                    <span style="font-size:12px; color:#cbd5e1;">${visits.length} missed</span>
                </div>
                ${rows}
            </div>`;
    }).join('');
}

window.missedDetailChangeMonth = (dir, rep) => {
    missedMonth += dir;
    if (missedMonth < 1)  { missedMonth = 12; missedYear--; }
    if (missedMonth > 12) { missedMonth = 1;  missedYear++; }
    
    // update labels
    const mEl = document.getElementById('detailMonthLabel');
    const yEl = document.getElementById('detailYearLabel');
    if (mEl) mEl.textContent = MONTH_NAMES[missedMonth - 1];
    if (yEl) yEl.textContent = missedYear;

    const issueBar = document.getElementById('detailIssueBar');
    const listContainer = document.getElementById('detailDoctorsList');

    // ✅ Apply Option A logic to navigation
    const isPastMonth = _isMissed();

    if (!isPastMonth) {
        if (issueBar) {
            issueBar.innerHTML = `<span style="color:#7a8fa0; font-weight:700; font-size:13px;">Month not yet completed</span>`;
        }
        if (listContainer) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:40px; color:#94a3b8;">
                    <p>No missed calls recorded yet for ${MONTH_NAMES[missedMonth-1]} ${missedYear}.</p>
                </div>`;
        }
    } else {
        // re-filter details for new month if it is in the past
        const details = (rep.details || []).filter(d => {
            if (!d.date_missed) return false;
            const dt = new Date(d.date_missed);
            return (dt.getMonth() + 1) === missedMonth && dt.getFullYear() === missedYear;
        });
        
        if (issueBar) {
            issueBar.innerHTML = `<span style="color:#c0392b; font-weight:700; font-size:13px;">Showing ${details.length} Missed Call</span>`;
        }
        _renderDetailList(listContainer, details);
    }
    
    // also sync the list modal labels
    _syncMissedLabels();
};

window.missedDetailChangeYear = (dir, rep) => {
    missedYear += dir;
    const mEl = document.getElementById('detailMonthLabel');
    const yEl = document.getElementById('detailYearLabel');
    if (mEl) mEl.textContent = MONTH_NAMES[missedMonth - 1];
    if (yEl) yEl.textContent = missedYear;

    const issueBar = document.getElementById('detailIssueBar');
    const listContainer = document.getElementById('detailDoctorsList');

    // ✅ Apply Option A logic to navigation
    const isPastMonth = _isMissed();

    if (!isPastMonth) {
        if (issueBar) {
            issueBar.innerHTML = `<span style="color:#7a8fa0; font-weight:700; font-size:13px;">Month not yet completed</span>`;
        }
        if (listContainer) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:40px; color:#94a3b8;">
                    <p>No missed calls recorded yet for ${MONTH_NAMES[missedMonth-1]} ${missedYear}.</p>
                </div>`;
        }
    } else {
        const details = (rep.details || []).filter(d => {
            if (!d.date_missed) return false;
            const dt = new Date(d.date_missed);
            return (dt.getMonth() + 1) === missedMonth && dt.getFullYear() === missedYear;
        });
        
        if (issueBar) {
            issueBar.innerHTML = `<span style="color:#c0392b; font-weight:700; font-size:13px;">Showing ${details.length} Missed Call</span>`;
        }
        _renderDetailList(listContainer, details);
    }
    _syncMissedLabels();
};

function backToUnusualList() {
    document.getElementById('unusualDetailModal').classList.remove('active');
}
// ── INIT ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Redirect "View all" link in the Med Rep Performance panel to the dedicated Performance tab
    const perfPanel = Array.from(document.querySelectorAll('.panel')).find(p => 
        p.querySelector('.panel-title')?.textContent.toLowerCase().includes('performance')
    );
    if (perfPanel) {
        const viewAllLink = perfPanel.querySelector('.panel-viewall');
        if (viewAllLink) viewAllLink.setAttribute('href', '../performance/performance.html');
    }

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
            #rejectModal .modal-card {
                width: 580px;
                height: 380px;
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

    // Reset UI state
    document.getElementById('rdLoading').style.display = 'flex';
    document.getElementById('rdSummaryContent').style.display = 'none';
    document.getElementById('rdRepName').textContent = '---';
    document.getElementById('rdArea').textContent = '---';
    document.getElementById('rdPeriodPill').textContent = '';
    document.getElementById('rdStatusBadge').innerHTML = '';
    document.getElementById('rdActions').style.display = 'flex';
    document.getElementById('rdAccordionContainer').innerHTML = '<p style="color:#999;font-size:13px;">Loading...</p>';
    rdShowCalEmpty();

    // Wire buttons - These trigger the confirmation modals seen in image_39cedb.jpg
    document.getElementById('rdAcceptBtn').onclick = () => handleRdAccept(repId, quarter, year);
    document.getElementById('rdRejectBtn').onclick = () => handleRdReject(repId, quarter, year);
    
    openModal('requestDetailModal');

    try {
        const data = await API.fetchSummary(repId, quarter, year);

        // Store the name for the confirmation modal text (e.g., "Ben Things")
        const currentName = data.medrep?.name || '---';
        rdPendingAction.repName = currentName;

        // Populate Rep info
        document.getElementById('rdRepName').textContent = currentName;
        document.getElementById('rdArea').textContent = data.medrep?.area || '---';

        // Period pill logic
        const qLabels = {
            1: ['Jan','Mar'], 2: ['Apr','Jun'],
            3: ['Jul','Sep'], 4: ['Oct','Dec']
        };
        const [s, e] = qLabels[quarter] || ['--','--'];
        document.getElementById('rdPeriodPill').textContent = `Q${quarter} · ${s} – ${e} ${year}`;

        // Status logic: Hide buttons if already finalized
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

        // Render sections
        rdRenderStats(data.summary || {}, dcpRows);
        rdRenderBreakdown(dcpRows);

        document.getElementById('rdLoading').style.display = 'none';
        document.getElementById('rdSummaryContent').style.display = 'flex';

    } catch (err) {
        console.error('Request Detail Modal error:', err);
        document.getElementById('rdLoading').innerHTML = '<p style="color:#c62828;">Failed to load summary.</p>';
    }
};

// 2. Handler for the "Accept" button
function handleRdAccept(repId, quarter, year) {
    rdPendingAction = { ...rdPendingAction, repId, quarter, year };
    
    // Update the text in the small confirmation modal (image_39cedb.jpg)
    const nameSpan = document.querySelector('#acceptModal .modal-body b');
    if (nameSpan) nameSpan.textContent = rdPendingAction.repName;
    
    openModal('acceptModal'); // Opens the confirmation box
}

// 3. Handler for the "Reject" button[cite: 24]
function handleRdReject(repId, quarter, year) {
    rdPendingAction = { ...rdPendingAction, repId, quarter, year };
    
    const nameSpan = document.querySelector('#rejectModal .modal-body b');
    if (nameSpan) nameSpan.textContent = rdPendingAction.repName;
    
    // Clear previous remarks[cite: 24]
    const remarksInput = document.getElementById('rdRejectRemarks');
    if (remarksInput) remarksInput.value = "";
    
    openModal('rejectModal');
}

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

    document.getElementById('rdStatDoctors').textContent = doctorVisited;
    document.getElementById('rdStatVisits').textContent =
        summary.total_visits || dcpList.length || 0;
    document.getElementById('rdStatPharmacies').textContent = pharmacyVisited;
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
            ? (entry.display_name || entry.pharmacy_name || entry.Pharmacy_Name || 'Unnamed Pharmacy')
            : (entry.display_name || entry.doctor_name || entry.name || 'Unnamed Doctor');
        const id = entry.cds_id || entry.id || name;
        const map = isPharmacy ? pharmacyMap : doctorMap;
        if (!map[id]) map[id] = { name, dates: [], recordType: rt, frequency: entry.frequency ?? null };
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
            const { name, dates, recordType, frequency } = map[id];

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
                        ${frequency != null ? `
                        <div class="rd-freq-row">
                            <span class="rd-freq-label">Expected Frequency</span>
                            <span class="rd-freq-value">${frequency}x / month</span>
                        </div>` : ''}
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
        showDashToast('Please provide a reason for rejection.', 'error');
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
            showDashToast(newStatus === 'Approved' ? 'Request Approved' : 'Request Rejected', newStatus === 'Approved' ? 'success' : 'error');
            
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
            showDashToast(`Failed to update: ${result?.error || "Unknown Error"}`, 'error');
        }
    } catch (err) {
        console.error("Status Update Error:", err);
        showDashToast('A connection error occurred.', 'error');
    }
}

// ── REJECTION REMARKS MODAL ──────────────────────────────
window.openRejectionRemarksModal = function(repName, remarks) {
    const modal = document.getElementById('rejectionRemarksModal');
    if (!modal) return;
    const nameEl    = modal.querySelector('.rrm-rep-name');
    const remarksEl = modal.querySelector('.rrm-remarks-text');
    if (nameEl)    nameEl.textContent    = repName;
    if (remarksEl) remarksEl.textContent = (remarks || 'No remarks provided.').trim();
    modal.style.display = 'flex';
};

window._openRejectedByIndex = function(idx) {
    const r = window._rejectedScheduleData?.[idx];
    if (!r) return;
    openRejectionRemarksModal(
        r.name || '',
        (r.remarks || 'No remarks provided.').trim()
    );
};

window.closeRejectionRemarksModal = function() {
    const modal = document.getElementById('rejectionRemarksModal');
    if (modal) modal.style.display = 'none';
};

function showDashToast(message, type = 'info') {
    const toast = document.getElementById('dash-app-toast');
    if (!toast) return;
    const isSuccess = type === 'success';
    toast.innerHTML = `
        <div class="dash-toast-body ${isSuccess ? 'success' : 'error'}">
            <span class="dash-toast-icon">${isSuccess ? '✓' : '✕'}</span>
            <span class="dash-toast-text">${message}</span>
        </div>
        <div class="dash-toast-progress"></div>
    `;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}