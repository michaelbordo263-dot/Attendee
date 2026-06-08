// ── ATTENDANCE CARD & MODAL ──────────────────────────
// Fetches today's attendance for all reps and renders
// the card counts + a modal with Present/Absent tabs.
// Late logic: on_time + time_in >= 9:31 AM = Late (counts as Present)

const ATT_TODAY = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
})();

let _attAllLogs  = []; // flat: [{repId, repName, territory, log|null}, ...]
let _attTab      = 'present'; // 'present' | 'absent'
let _attLoaded   = false;

// ── HELPERS ──────────────────────────────────────────

function attIsLate(timetz) {
    if (!timetz || timetz === '--:--') return false;
    const m = String(timetz).match(/^(\d{2}):(\d{2})/);
    if (!m) return false;
    const h = parseInt(m[1]), min = parseInt(m[2]);
    return (h > 9) || (h === 9 && min >= 31);
}

function attFormatTime(timetz) {
    if (!timetz || timetz === '--:--') return '--:--';
    const m = String(timetz).match(/^(\d{2}):(\d{2})/);
    if (!m) return timetz;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    const period = h >= 12 ? 'PM' : 'AM';
    const dh = h % 12 === 0 ? 12 : h % 12;
    return `${dh}:${String(min).padStart(2,'0')} ${period}`;
}

function attGetInitials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || '?';
}

function attGetStatus(log) {
    if (!log) return 'absent';
    const s = (log.attendance_status || '').toLowerCase();
    if (s.includes('on_time') || s.includes('on time') || s.includes('present')) {
        return attIsLate(log.time_in) ? 'late' : 'on_time';
    }
    if (s.includes('late')) return 'late';
    if (s.includes('absent')) return 'absent';
    return 'absent';
}

// ── LOAD DATA ─────────────────────────────────────────

async function loadAttendanceCard() {
    try {
        const base = window.BASE_URL;

        // Reset
        _attAllLogs = [];
        attUpdateCard();

        // 1. Get all reps
        const repsRes = await fetch(`${base}/accounts`);
        const repsData = repsRes.ok ? await repsRes.json() : [];
        const reps = Array.isArray(repsData) ? repsData : (repsData.data || []);

        // 2. Fetch each rep's attendance — update card as each one comes in
        await Promise.all(reps.map(async rep => {
            if ((rep.status || '').toLowerCase() !== 'active') return;
            if ((rep.roles || '').toLowerCase() !== 'medrep') return;
            const repId = rep.id;
            const repName = `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'Unknown';
            const territory = rep.area || 'No Area Assigned';

            try {
                const res = await fetch(`${base}/attendance?id=${repId}`);
                const logs = res.ok ? await res.json() : [];
                const allLogs = Array.isArray(logs) ? logs : (logs.data || []);
                const todayLog = allLogs.find(l => {
                    const raw = l.attendance_date || l.date || '';
                    return String(raw).startsWith(ATT_TODAY);
                }) || null;

                _attAllLogs.push({ repId, repName, lastName: (rep.last_name || '').trim().toLowerCase(), territory, log: todayLog });
            } catch {
                _attAllLogs.push({ repId, repName, lastName: (rep.last_name || '').trim().toLowerCase(), territory, log: null });
            }

            // Update card counts after every single rep loads
            attUpdateCard();
        }));

        _attLoaded = true;

    } catch (err) {
        console.error('Attendance card load error:', err);
        const sub = document.getElementById('attendance-sub-label');
        if (sub) sub.textContent = 'Failed to load';
    }
}

function attUpdateCard() {
    const today = new Date();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = `${dayNames[today.getDay()]}, ${monthNames[today.getMonth()]} ${today.getDate()}`;

    const sub = document.getElementById('attendance-sub-label');
    if (sub) sub.textContent = label;

    const presentList = _attAllLogs.filter(r => {
        const s = attGetStatus(r.log);
        return s === 'on_time' || s === 'late';
    });
    const absentList = _attAllLogs.filter(r => attGetStatus(r.log) === 'absent');

    const pc = document.getElementById('att-present-count');
    const ac = document.getElementById('att-absent-count');
    if (pc) pc.textContent = presentList.length;
    if (ac) ac.textContent = absentList.length;
}

// ── MODAL ─────────────────────────────────────────────

function openAttendanceModal() {
    const modal = document.getElementById('attModal');
    if (!modal) return;
    modal.classList.add('active');
    attRenderModal();
}

function closeAttendanceModal() {
    const modal = document.getElementById('attModal');
    if (modal) modal.classList.remove('active');
}

function attSetTab(tab) {
    _attTab = tab;
    document.querySelectorAll('.att-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    attRenderList();
}

function attRenderModal() {
    const presentList = _attAllLogs.filter(r => {
        const s = attGetStatus(r.log);
        return s === 'on_time' || s === 'late';
    });
    const absentList = _attAllLogs.filter(r => attGetStatus(r.log) === 'absent');

    document.getElementById('att-tab-present-count').textContent = presentList.length;
    document.getElementById('att-tab-absent-count').textContent = absentList.length;

    attRenderList();
}

function attRenderList() {
    const container = document.getElementById('att-modal-list');
    if (!container) return;

    const isPresentTab = _attTab === 'present';
    const list = _attAllLogs.filter(r => {
        const s = attGetStatus(r.log);
        if (isPresentTab) return s === 'on_time' || s === 'late';
        return s === 'absent';
    });

    list.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

    if (list.length === 0) {
        container.innerHTML = `<div class="att-empty">No records found</div>`;
        return;
    }

        container.innerHTML = list.map(r => {
        const status = attGetStatus(r.log);
        const initials = attGetInitials(r.repName);

        let badgeClass = 'att-badge-absent';
        let badgeLabel = 'Absent';
        if (status === 'on_time') { badgeClass = 'att-badge-present'; badgeLabel = 'On Time'; }
        if (status === 'late')    { badgeClass = 'att-badge-late';    badgeLabel = 'Late'; }

        const timeIn  = r.log?.time_in  ? attFormatTime(r.log.time_in)  : '--:--';
        const timeOut = r.log?.time_out ? attFormatTime(r.log.time_out) : '--:--';

        return `
        <div class="att-rep-row" onclick="attOpenDetail('${r.repId}', '${(r.repName || 'Unknown').replace(/'/g,"\\'")}')"> 
            <div class="att-rep-avatar">${initials}</div>
            <div class="att-rep-info">
                <div class="att-rep-name">${r.repName}</div>
                ${isPresentTab
                    ? `<div class="att-rep-time">In: ${timeIn} &nbsp;|&nbsp; Out: ${timeOut}</div>`
                    : `<div class="att-rep-time" style="color:#f87171;">No Time In &nbsp;|&nbsp; No Time Out</div>`}
            </div>
            <span class="att-badge ${badgeClass}">${badgeLabel}</span>
        </div>`;
    }).join('');
}

// ── DETAIL MODAL ──

function attOpenDetail(repId, repName) {
    const btn = document.getElementById('att-view-att-btn');
    if (btn) {
        const entry2 = _attAllLogs.find(r => String(r.repId) === String(repId));
        const area = encodeURIComponent(entry2?.territory || '');
        const name = encodeURIComponent(repName);
        btn.href = `../../representatives/representative_details/attendance/attendance.html?id=${repId}&name=${name}&area=${area}`;
        btn.onclick = null;
    }

    const entry = _attAllLogs.find(r => String(r.repId) === String(repId));
    if (!entry) return;

    const log = entry.log;
    const status = attGetStatus(log);
    const initials = attGetInitials(repName);

    let badgeClass = 'badge-present'; 
    let badgeLabel = 'On Time';
    if (status === 'absent') { badgeClass = 'badge-absent'; badgeLabel = 'Absent'; }
    if (status === 'late')   { badgeClass = 'badge-late';   badgeLabel = 'Late'; }

    const hasPic = log?.daily_picture && log.daily_picture !== 'null' && log.daily_picture !== '';
    const mapBase = 'https://www.google.com/maps/search/?api=1&query=';
    
    // FIX: Check multiple location keys
    const locationStr = log?.tagged_location || log?.location || log?.address || '';
    const locQuery = locationStr ? encodeURIComponent(locationStr) : '';

    document.getElementById('att-detail-body').innerHTML = `
    <div style="padding:24px; background:#fff;">
        <div style="display:flex; gap:28px; align-items:flex-start;">
            <div style="flex-shrink:0; width:270px; height:270px; border-radius:14px; background:#dce7f0; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                ${hasPic
                    ? `<img src="${log.daily_picture}" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;" onclick="attOpenLightbox('${log.daily_picture}')">`
                    : `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
                           <div style="width:60px;height:60px;border-radius:50%;background:#a8c4d8;color:#2c4a60;font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center;">${initials}</div>
                           <div style="font-size:12px;color:#5a7a8f;font-weight:500;text-align:center;">${repName}</div>
                       </div>`
                }
            </div>
            <div style="flex:1; padding-top:4px;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px;">
                    <span style="font-size:18px;font-weight:700;color:#1e2d3d;flex:1;">${repName}</span>
                    <span class="modal-status-badge ${badgeClass}">${badgeLabel}</span>
                </div>
                <div style="font-size:13px;color:#7a9ab0;font-weight:500;margin-bottom:16px;">${entry.territory || 'N/A'}</div>
                <div style="height:1px;background:#e8edf2;margin-bottom:16px;"></div>
                <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#8aabb9;width:70px;flex-shrink:0;">Time In</span>
                    <span style="font-size:14px;font-weight:600;color:#2c4a60;">${log?.time_in ? attFormatTime(log.time_in) : '--:--'}</span>
                </div>
                <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#8aabb9;width:70px;flex-shrink:0;">Time Out</span>
                    <span style="font-size:14px;font-weight:600;color:#2c4a60;">${log?.time_out ? attFormatTime(log.time_out) : '--:--'}</span>
                </div>
                <div style="display:flex;align-items:flex-start;gap:16px;margin-top:8px;">
                    <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#8aabb9;width:70px;flex-shrink:0;">Tagged Location</span>
                    <span style="font-size:12px;font-weight:600;color:#2c4a60;">
                        ${locationStr
                            ? `<a href="${mapBase}${locQuery}" target="_blank" style="color:#007bff;text-decoration:none;">📍 ${locationStr}</a>`
                            : 'N/A'}
                    </span>
                </div>
            </div>
        </div>
    </div>`;

    document.getElementById('att-modal-list-view').style.display = 'none';
    document.getElementById('att-modal-detail-view').style.display = 'flex';
}

function attBackToList() {
    document.getElementById('att-modal-list-view').style.display = 'flex';
    document.getElementById('att-modal-detail-view').style.display = 'none';
}

// ── INJECT MODAL HTML ─────────────────────────────────

function attInjectModal() {
    const today = new Date();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dateLabel = `${dayNames[today.getDay()]} | ${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    const html = `
    <div class="modal-overlay" id="attModal">
            <div class="modal-box att-modal-box" style="position:relative; display:flex; flex-direction:column;">

            <div id="att-modal-list-view" style="display:flex; flex-direction:column; overflow:hidden;">
                <div class="modal-header" style="display:flex; align-items:center; justify-content:space-between;">
                    <h2 style="margin:0;">Attendance Today</h2>
                </div>
                <button class="sched-float-close" onclick="closeAttendanceModal()">✕</button>

                <div class="att-tabs" style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex;">
                        <button class="att-tab-btn active" data-tab="present" onclick="attSetTab('present')">
                            Present <span id="att-tab-present-count" class="att-tab-count">0</span>
                        </button>
                        <button class="att-tab-btn" data-tab="absent" onclick="attSetTab('absent')">
                            Absent <span id="att-tab-absent-count" class="att-tab-count">0</span>
                        </button>
                    </div>
                        <div style="font-size:13px; color:#6ab4f5; font-weight:600;">${dateLabel}</div>
                </div>

                <div class="att-modal-list" id="att-modal-list">
                    <div class="att-empty">Loading...</div>
                </div>
            </div>

            <div id="att-modal-detail-view" style="display:none; flex-direction:column; flex:1; overflow:hidden;">
                <div class="modal-card-header" style="display:flex; align-items:center; gap:12px; padding:18px 24px;">
                    <button class="att-back-btn" onclick="attBackToList()">‹</button>
                    <span class="modal-date-title" id="att-detail-date-title">Attendance Detail</span>
                    <a id="att-view-att-btn" href="#" class="att-view-att-btn" onclick="return false;">View Attendance</a>
                </div>
                    <div id="att-detail-body" style="overflow-y:auto;"></div>
            </div>

        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('attModal').addEventListener('click', e => {
        if (e.target.id === 'attModal') closeAttendanceModal();
    });
}


// ── LIGHTBOX ──────────────────────────────────────────

function attInjectLightbox() {
    if (document.getElementById('attLightbox')) return;
    const html = `
    <div id="attLightbox" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); align-items:center; justify-content:center;">
        <button onclick="attCloseLightbox()" style="position:absolute; top:20px; right:20px; font-size:44px; color:white; background:rgba(0,0,0,0.3); border:none; border-radius:50%; width:64px; height:64px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:100000;">✕</button>
        <div style="position:relative; display:inline-block;">
            <button onclick="attRotateLightbox()" style="position:absolute; top:10px; right:10px; z-index:100001; background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:40px; height:40px; color:white; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Rotate">↻</button>
            <img id="attLightboxImg" src="" alt="Expanded Attendance" style="max-width:90vw; max-height:90vh; border-radius:4px; box-shadow:0 0 50px rgba(0,0,0,0.8); display:block; transition:transform 0.3s ease;">
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('attLightbox').addEventListener('click', e => {
        if (e.target.id === 'attLightbox') attCloseLightbox();
    });
}

let _attRotation = 0;

function attOpenLightbox(src) {
    const lb = document.getElementById('attLightbox');
    if (!lb) return;
    _attRotation = 0;
    const img = document.getElementById('attLightboxImg');
    img.src = src;
    img.style.transform = 'rotate(0deg)';
    lb.style.display = 'flex';
}

function attRotateLightbox() {
    _attRotation = (_attRotation + 90) % 360;
    document.getElementById('attLightboxImg').style.transform = `rotate(${_attRotation}deg)`;
}

function attCloseLightbox() {
    const lb = document.getElementById('attLightbox');
    if (lb) lb.style.display = 'none';
}

// ── INIT ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    attInjectModal();
    attInjectLightbox();
    loadAttendanceCard();
});