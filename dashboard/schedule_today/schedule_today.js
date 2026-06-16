/* =====================================================
   SCHEDULE TODAY — JS
===================================================== */

const ST_MONTHS = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
const ST_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                         'Jul','Aug','Sep','Oct','Nov','Dec'];
const ST_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const ST_STATUS_ORDER = {
    'pending': 0, 'advance': 1, 'complete': 2,
    'makeup': 3, 'mia': 4, 'missed': 5, 'rejected': 6
};

let stTodayData    = [];
let stCurrentRep   = null;
let stBaseDate     = null;
let stSelectedDate = null;

// ── HELPERS ────────────────────────────────────────
function stInitials(name = '') {
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function stDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function stNormalizeStatus(raw) {
    const s = (raw || '').toLowerCase().trim();
    if (s === 'complete' || s === 'completed' || s === 'signed') return 'complete';
    if (s === 'advance' || s === 'advanced') return 'advance';
    if (s.includes('make up') || s.includes('makeup')) return 'makeup';
    if (s.includes('missed')) return 'missed';
    if (s === 'mia') return 'mia';
    if (s === 'rejected') return 'rejected';
    return 'pending';
}

function stBadgeHtml(status) {
    const map = {
        pending:  ['sl-badge-pending',  'Pending'],
        complete: ['sl-badge-complete', 'Complete'],
        advance:  ['sl-badge-advance',  'Advance'],
        makeup:   ['sl-badge-makeup',   'Make Up Call'],
        missed:   ['sl-badge-missed',   'Missed Call'],
        mia:      ['sl-badge-mia',      'MIA'],
        rejected: ['sl-badge-rejected', 'Rejected'],
    };
    const [cls, label] = map[status] || ['sl-badge-pending','Pending'];
    return `<span class="sl-badge ${cls}">${label}</span>`;
}

function stPillHtml(status, count) {
    const map = {
        pending:  ['st-pill-pending',  'Pending'],
        complete: ['st-pill-complete', 'Complete'],
        advance:  ['st-pill-advance',  'Advance'],
        makeup:   ['st-pill-makeup',   'Make Up'],
        missed:   ['st-pill-missed',   'Missed'],
        mia:      ['st-pill-mia',      'MIA'],
        rejected: ['st-pill-rejected', 'Rejected'],
    };
    const [cls, label] = map[status] || ['st-pill-pending','Pending'];
    return `<span class="st-pill ${cls}">${count} ${label}</span>`;
}

function stSortCalls(calls) {
    return [...calls].sort((a,b) =>
        (ST_STATUS_ORDER[a.status]??0) - (ST_STATUS_ORDER[b.status]??0)
    );
}

// Get sub-label: area for Doctor, city for Pharmacy
function stGetSub(call) {
    const type = (call.type || '').toLowerCase();
    if (type === 'pharmacy') return call.city || '';
    return call.area || '';
}

// ── INJECT MODALS ──────────────────────────────────
function stInjectModals() {
    if (document.getElementById('scheduleTodayModal')) return;

    const html = `
    <!-- SCREEN 1: SCHEDULE TODAY LIST -->
    <div class="modal-overlay" id="scheduleTodayModal">
        <div class="modal-box" style="position:relative;">
            <div class="modal-header">
                <h2>Schedule Today</h2>
                <div class="st-header-right">
                    <span class="st-header-date" id="stHeaderDate"></span>
                    <button class="sched-float-close" style="position:static;flex-shrink:0;" onclick="stCloseModal()">✕</button>
                </div>
            </div>
            <div class="st-rep-list" id="stRepList">
                <div class="st-loading">Loading schedules...</div>
            </div>
        </div>
    </div>

    <!-- SCREEN 2: SCHEDULE LOGS -->
    <div class="modal-overlay" id="scheduleLogsModal">
        <div class="modal-box">
            <div class="modal-header">
                <h2>Schedule Logs</h2>
            </div>
            <div class="sl-sub-nav">
                <button class="sl-back-btn" onclick="stBackToList()">&#8249;</button>
                <div class="sl-rep-info">
                    <span class="sl-rep-name" id="slRepName"></span>
                    <span class="sl-rep-area" id="slRepArea"></span>
                </div>
                <button class="sl-view-sched-btn" onclick="stViewFullSchedule()">View Schedule</button>
            </div>
            <div class="sl-date-bar">
                <span class="sl-date-label">Select Date:</span>
                <select id="slMonth"></select>
                <select id="slDay"></select>
                <select id="slYear"></select>
                <button class="sl-go-btn" onclick="slApplyDate()">Go</button>
                <button class="sl-reset-btn" id="slResetBtn" onclick="slResetDate()">Reset</button>
            </div>
            <div class="sl-body" id="slBody"></div>
        </div>
    </div>

    <!-- SCREEN 3: DOCUMENT IFRAME -->
    <div class="modal-overlay" id="scheduleDocModal" style="align-items:flex-start; justify-content:center; padding-top:11vh;">        <div style="width:900px; max-width:calc(100vw - 48px); max-height:90vh; background:transparent; border-radius:16px; overflow:hidden; display:flex; flex-direction:column;">
            <iframe id="scheduleDocIframe" src="" scrolling="yes" style="border:none; width:111%; height:600px; transform:scale(0.9); transform-origin:top left; border-radius:16px;"></iframe>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

// ── CACHE ──────────────────────────────────────────
const ST_CACHE_KEY = 'st_schedule_cache';
const ST_CACHE_DATE_KEY = 'st_schedule_cache_date';

// ── OPEN SCHEDULE TODAY ────────────────────────────
window.openScheduleTodayModal = async function () {
    stInjectModals();
    console.log('BASE_URL:', BASE_URL); // add this temporarily

    const now = new Date();
    stBaseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = stDateKey(stBaseDate);

    const headerDate = document.getElementById('stHeaderDate');
    if (headerDate) {
        headerDate.textContent = `${ST_DAYS[stBaseDate.getDay()]} | ${ST_MONTHS[stBaseDate.getMonth()]} ${stBaseDate.getDate()}, ${stBaseDate.getFullYear()}`;
    }

    document.getElementById('scheduleTodayModal').classList.add('active');

    // Use cache if same day
    const cachedDate = localStorage.getItem(ST_CACHE_DATE_KEY) || window._stCacheDate;
    const cachedData = localStorage.getItem(ST_CACHE_KEY);
    if (cachedDate === todayKey) {
        if (cachedData) {
            stTodayData = JSON.parse(cachedData);
            stRenderRepList();
            return;
        } else if (window._stCache) {
            stTodayData = window._stCache;
            stRenderRepList();
            return;
        }
    }

    const list = document.getElementById('stRepList');
    list.innerHTML = '<div class="st-loading">Loading schedules...</div>';

    try {
        const response = await apiFetch(`${BASE_URL}/dashboard/schedule-today/all`);

        if (!response || response.error) {
            list.innerHTML = '<div class="st-empty">Failed to load schedules.</div>';
            return;
        }

        const repMap = response.data || {};
        const results = Object.values(repMap).map(item => ({
            rep: item.rep,
            allCalls: item.allCalls || [],
            todayCalls: (item.allCalls || [])
                .filter(c => (c.date || '').slice(0,10) === todayKey)
                .map(c => ({ ...c, status: stNormalizeStatus(c.visit_status) }))
        }));

        stTodayData = results.filter(r => r.todayCalls.length > 0);

        if (stTodayData.length > 0) {
            // Only cache todayCalls + rep info — skip allCalls (too large)
            const slimData = stTodayData.map(r => ({
                rep: r.rep,
                todayCalls: r.todayCalls,
                allCalls: [] // strip allCalls from cache
            }));

            try {
                const serialized = JSON.stringify(slimData);
                localStorage.setItem(ST_CACHE_KEY, serialized);
                localStorage.setItem(ST_CACHE_DATE_KEY, todayKey);
                console.log(`✅ Schedule cached: ${(serialized.length/1024).toFixed(1)}KB`);
            } catch (e) {
                console.warn('localStorage full, using in-memory cache');
                window._stCache = stTodayData;
                window._stCacheDate = todayKey;
            }
        }

        stRenderRepList();

    } catch (err) {
        console.error('Schedule Today Error:', err);
        list.innerHTML = '<div class="st-empty">Failed to load schedules.</div>';
    }
};

// ── RENDER REP LIST ────────────────────────────────
function stRenderRepList() {
    const list = document.getElementById('stRepList');

    if (!stTodayData.length) {
        list.innerHTML = '<div class="st-empty">No schedules found for today.</div>';
        return;
    }

    const todayKey = stDateKey(stBaseDate);

    list.innerHTML = stTodayData.map((item, i) => {
        const { rep, todayCalls, allCalls } = item;
        const name = `${rep.first_name || ''} ${rep.last_name || ''}`.trim();

        // Count statuses from today's scheduled calls
        const counts = {};
        todayCalls.forEach(c => {
            if (c.status !== 'advance') {
                counts[c.status] = (counts[c.status]||0)+1;
            }
        });

        // Add advance calls actually done today (document_date = today, dcp_date != today)
        const advanceDoneToday = allCalls.filter(c => {
            const s = stNormalizeStatus(c.visit_status);
            const docDate = (c.document_date || '').slice(0,10);
            const callDate = (c.date || '').slice(0,10);
            return s === 'advance' && docDate === todayKey && callDate !== todayKey;
        });
        if (advanceDoneToday.length) {
            counts['advance'] = (counts['advance'] || 0) + advanceDoneToday.length;
        }

        // Add makeup calls actually done today (document_date = today, dcp_date != today)
        const makeupDoneToday = allCalls.filter(c => {
            const s = stNormalizeStatus(c.visit_status);
            const docDate = (c.document_date || '').slice(0,10);
            const callDate = (c.date || '').slice(0,10);
            return s === 'makeup' && docDate === todayKey && callDate !== todayKey;
        });
        if (makeupDoneToday.length) {
            counts['makeup'] = (counts['makeup'] || 0) + makeupDoneToday.length;
        }

        const statusOrder = ['pending','complete','advance','makeup','missed','mia','rejected'];
        const pillsHtml = statusOrder
            .filter(s => counts[s])
            .map(s => stPillHtml(s, counts[s]))
            .join('');

        return `
        <div class="st-rep-card">
            <div class="st-rep-avatar">${stInitials(name)}</div>
            <div class="st-rep-info">
                <div class="st-rep-name">${name}</div>
                <div class="st-pills-row">${pillsHtml || '<span class="st-pill st-pill-pending">No calls</span>'}</div>
            </div>
            <button class="st-view-btn" onclick="stOpenLogs(${i})">View</button>
        </div>`;
    }).join('');
}

// ── OPEN SCHEDULE LOGS ─────────────────────────────
window.stOpenLogs = async function (idx) {
    const item = stTodayData[idx];
    if (!item) return;

    // If allCalls was stripped from cache, re-fetch
    if (!item.allCalls || item.allCalls.length === 0) {
        document.getElementById('scheduleTodayModal').classList.remove('active');
        document.getElementById('scheduleLogsModal').classList.add('active');
        document.getElementById('slBody').innerHTML = '<div class="sl-loading">Loading details...</div>';

        try {
            // Check per-rep cache first
            const repCacheKey = `st_rep_${item.rep.id}_${stDateKey(stBaseDate)}`;
            const repCached = localStorage.getItem(repCacheKey);
            if (repCached) {
                item.allCalls = JSON.parse(repCached);
                console.log(`✅ Rep calls loaded from cache: ${item.rep.first_name}`);
            } else {
                const response = await apiFetch(`${BASE_URL}/dashboard/schedule-today/all?rep_id=${item.rep.id}`);
                item.allCalls = response.data?.[item.rep.id]?.allCalls || [];

                // Save to cache for next time
                try {
                    localStorage.setItem(repCacheKey, JSON.stringify(item.allCalls));
                } catch (e) {
                    console.warn('Rep cache save failed:', e);
                }
            }
        } catch (e) {
            console.warn('Re-fetch failed:', e);
        }
    }

    stCurrentRep = item;
    stSelectedDate = new Date(stBaseDate);

    const name = `${item.rep.first_name || ''} ${item.rep.last_name || ''}`.trim();
    const area = item.rep.area || item.rep.territory || 'N/A';

    document.getElementById('slRepName').textContent = name;
    document.getElementById('slRepArea').textContent = area;

    slBuildDatePicker(stSelectedDate);
    document.getElementById('slResetBtn').classList.remove('visible');

    slRenderBody(stSelectedDate);

    document.getElementById('scheduleTodayModal').classList.remove('active');
    document.getElementById('scheduleLogsModal').classList.add('active');
};

// ── DATE PICKER ────────────────────────────────────
function slBuildDatePicker(date) {
    const mSel = document.getElementById('slMonth');
    const dSel = document.getElementById('slDay');
    const ySel = document.getElementById('slYear');

    mSel.innerHTML = ST_MONTHS.map((m,i) =>
        `<option value="${i+1}"${i===date.getMonth()?' selected':''}>${m}</option>`
    ).join('');

    const dim = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
    dSel.innerHTML = Array.from({length:dim},(_,i)=>i+1).map(d =>
        `<option value="${d}"${d===date.getDate()?' selected':''}>${d}</option>`
    ).join('');

    const curY = date.getFullYear();
    ySel.innerHTML = [curY-1, curY, curY+1].map(y =>
        `<option value="${y}"${y===curY?' selected':''}>${y}</option>`
    ).join('');

    mSel.onchange = ySel.onchange = () => {
        const y = parseInt(ySel.value);
        const m = parseInt(mSel.value)-1;
        const newDim = new Date(y, m+1, 0).getDate();
        const curD = Math.min(parseInt(dSel.value), newDim);
        dSel.innerHTML = Array.from({length:newDim},(_,i)=>i+1).map(d =>
            `<option value="${d}"${d===curD?' selected':''}>${d}</option>`
        ).join('');
    };
}

window.slApplyDate = function () {
    const y = parseInt(document.getElementById('slYear').value);
    const m = parseInt(document.getElementById('slMonth').value);
    const d = parseInt(document.getElementById('slDay').value);
    stSelectedDate = new Date(y, m-1, d);

    const isToday = stDateKey(stSelectedDate) === stDateKey(stBaseDate);
    const resetBtn = document.getElementById('slResetBtn');
    if (isToday) resetBtn.classList.remove('visible');
    else resetBtn.classList.add('visible');

    slRenderBody(stSelectedDate);
};

window.slResetDate = function () {
    stSelectedDate = new Date(stBaseDate);
    slBuildDatePicker(stSelectedDate);
    document.getElementById('slResetBtn').classList.remove('visible');
    slRenderBody(stSelectedDate);
};

function slRenderBody(date) {
    const body = document.getElementById('slBody');
    if (!stCurrentRep) return;

    const dk = stDateKey(date);
    const isToday = dk === stDateKey(stBaseDate);
    const dateLabel = isToday
        ? `Today's Calls`
        : `Calls — ${ST_MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

    const allForDate = stCurrentRep.allCalls
        .filter(c => (c.date || '').slice(0,10) === dk)
        .map(c => ({ ...c, status: stNormalizeStatus(c.visit_status) }));

    const regularCalls = stSortCalls(allForDate);

    const makeupCalls = stCurrentRep.allCalls
        .filter(c => {
            const s = stNormalizeStatus(c.visit_status);
            const docDate = (c.document_date || '').slice(0,10);
            const callDate = (c.date || '').slice(0,10);
            return s === 'makeup' && docDate === dk && callDate !== dk;
        });

    const advanceCalls = stCurrentRep.allCalls
        .filter(c => {
            const s = stNormalizeStatus(c.visit_status);
            const docDate = (c.document_date || '').slice(0,10);
            const callDate = (c.date || '').slice(0,10);
            return s === 'advance' && docDate === dk && callDate !== dk;
        });

    let html = '';

    // ── TODAY'S CALLS ──
    if (regularCalls.length) {
        html += `<div class="sl-section-label">${dateLabel} — ${regularCalls.length} total</div>`;
        html += regularCalls.map(c => {
            const name = c.name || c.pharmacy_name || 'Unknown';
            const sub = stGetSub(c);

            let subExtra = '';
            if (c.status === 'advance' && c.document_date) {
                const docDate = new Date(c.document_date);
                if (!isNaN(docDate)) {
                    subExtra = ` <span class="sl-call-sub-link">~ from ${ST_MONTHS_SHORT[docDate.getMonth()]} ${docDate.getDate()} Calls</span>`;
                }
            }
            if (c.status === 'makeup' && c.document_date) {
                const docDate = new Date(c.document_date);
                if (!isNaN(docDate)) {
                    subExtra = ` <span class="sl-call-sub-link">~ from ${ST_MONTHS_SHORT[docDate.getMonth()]} ${docDate.getDate()} Calls</span>`;
                }
            }

            return `
            <div class="sl-call-card" style="cursor:pointer;" onclick="stOpenDocument('${c.cds_id}','${c.dcp_id}','${c.date}','${stCurrentRep.rep.id}')">
                <div class="sl-call-avatar">${stInitials(name)}</div>
                <div class="sl-call-info">
                    <div class="sl-call-name">${name}</div>
                    ${sub || subExtra ? `<div class="sl-call-sub">${sub}${subExtra}</div>` : ''}
                </div>
                ${stBadgeHtml(c.status)}
            </div>`;
        }).join('');
    }

    // ── MAKE UP CALLS ──
    if (makeupCalls.length) {
        html += `<div class="sl-section-label">Make Up Calls</div>`;
        html += makeupCalls.map(c => {
            const name = c.name || c.pharmacy_name || 'Unknown';
            const sub = stGetSub(c);
            const fromDate = c.date ? new Date(c.date) : null;
            const toLabel = fromDate && !isNaN(fromDate)
                ? `${ST_MONTHS_SHORT[fromDate.getMonth()]} ${fromDate.getDate()} Calls`
                : 'another date';
            return `
            <div class="sl-call-card" style="cursor:pointer;" onclick="stOpenDocument('${c.cds_id}','${c.dcp_id}','${c.date}','${stCurrentRep.rep.id}')">
                <div class="sl-call-avatar">${stInitials(name)}</div>
                <div class="sl-call-info">
                    <div class="sl-call-name">${name}</div>
                    <div class="sl-call-sub">${sub}${sub ? ' ' : ''}<span class="sl-call-sub-link">~ to ${toLabel}</span></div>
                </div>
                ${stBadgeHtml('makeup')}
            </div>`;
        }).join('');
    }

    // ── ADVANCE CALLS ──
    if (advanceCalls.length) {
        html += `<div class="sl-section-label">Advance Calls</div>`;
        html += advanceCalls.map(c => {
            const name = c.name || c.pharmacy_name || 'Unknown';
            const sub = stGetSub(c);
            const toDate = c.date ? new Date(c.date) : null;
            const toLabel = toDate && !isNaN(toDate)
                ? `${ST_MONTHS_SHORT[toDate.getMonth()]} ${toDate.getDate()} Calls`
                : 'another date';
            return `
            <div class="sl-call-card" style="cursor:pointer;" onclick="stOpenDocument('${c.cds_id}','${c.dcp_id}','${c.date}','${stCurrentRep.rep.id}')">
                <div class="sl-call-avatar">${stInitials(name)}</div>
                <div class="sl-call-info">
                    <div class="sl-call-name">${name}</div>
                    <div class="sl-call-sub">${sub}${sub ? ' ' : ''}<span class="sl-call-sub-link">~ to ${toLabel}</span></div>
                </div>
                ${stBadgeHtml('advance')}
            </div>`;
        }).join('');
    }

    if (!html) {
        html = '<div class="sl-empty">No calls scheduled for this date.</div>';
    }

    body.innerHTML = html;
}

// ── NAVIGATION ─────────────────────────────────────
window.stViewFullSchedule = function () {
    if (!stCurrentRep) return;
    const rep = stCurrentRep.rep;
    const name = encodeURIComponent(`${rep.first_name||''} ${rep.last_name||''}`.trim());
    const area = encodeURIComponent(rep.area || rep.territory || 'N/A');
    window.location.href = `../representatives/schedule/schedule.html?id=${rep.id}&name=${name}&area=${area}`;
};

window.stBackToList = function () {
    document.getElementById('scheduleLogsModal').classList.remove('active');
    document.getElementById('scheduleTodayModal').classList.add('active');
};

window.stCloseModal = function () {
    document.getElementById('scheduleTodayModal').classList.remove('active');
};

// ── OPEN DOCUMENT ───────────────────────────────────
window.stOpenDocument = function(cdsId, dcpId, date, repId) {
    if (!cdsId) return;
    const base = window.location.origin;
    const url = `${base}/representatives/schedule/document/document.html?cds_id=${cdsId}&user_id=${repId}&date=${encodeURIComponent(date)}&dcp_id=${dcpId}&from=modal`;
    const iframe = document.getElementById('scheduleDocIframe');
    iframe.src = url;
    iframe.onload = function() {
        try {
            const height = iframe.contentWindow.document.body.scrollHeight;
            iframe.style.height = height + 'px';
        } catch(e) {}
    };
    document.getElementById('scheduleLogsModal').classList.remove('active');
    document.getElementById('scheduleDocModal').classList.add('active');
};

window.stCloseDocument = function() {
    document.getElementById('scheduleDocModal').classList.remove('active');
    document.getElementById('scheduleDocIframe').src = '';
    document.getElementById('scheduleLogsModal').classList.add('active');
};