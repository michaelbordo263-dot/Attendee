/* ── CRASH REPORTS MODAL ───────────────────────────── */

let crashReports = [];
let crashExpandedId = null;
let crashExpandedTraceId = null;
let crashSearch = '';
let crashStatusFilter = 'all';
let crashPeriodFilter = 'all';
let crashNewlyArrivedIds = new Set();

let crashPollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    injectCrashModal();
    loadCrashBadgeCount();

    // Keep the badge fresh even when the modal is closed
    setInterval(loadCrashBadgeCount, 30 * 1000);
});

/* ── INJECT MODAL MARKUP ONCE ── */
function injectCrashModal() {
    if (document.getElementById('crashReportsModal')) return;

    const modal = document.createElement('div');
    modal.id = 'crashReportsModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="crash-modal-box">
            <div class="crash-modal-header">
                <div class="crash-modal-title-wrap">
                    <h2 class="crash-modal-title">Crash reports</h2>
                </div>
                <button class="crash-modal-close" onclick="closeCrashReports()">✕</button>
            </div>

            <div class="crash-filters">
                <input type="text" id="crashSearchInput" class="crash-search-input" placeholder="Search by employee or crash ID...">

                <div class="crash-filter-row">
                    <div class="crash-filter-col">
                        <p class="crash-filter-label">Period</p>
                        <select id="crashPeriodSelect" class="crash-filter-select">
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>
                    <div class="crash-filter-col">
                        <p class="crash-filter-label">Status</p>
                        <select id="crashStatusSelect" class="crash-filter-select">
                            <option value="all">All status</option>
                            <option value="unresolved">Unresolved</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="crash-count-label" id="crashCountLabel">Showing 0 of 0 crash reports</div>

            <div class="crash-modal-list" id="crashList"></div>
            <div class="crash-toast" id="crashToast"></div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('crashSearchInput').addEventListener('input', (e) => {
        crashSearch = e.target.value;
        renderCrashList();
    });

    const periodSelect = document.getElementById('crashPeriodSelect');
    const statusSelect = document.getElementById('crashStatusSelect');

    periodSelect.addEventListener('change', (e) => {
        crashPeriodFilter = e.target.value;
        renderCrashList();
    });

    statusSelect.addEventListener('change', (e) => {
        crashStatusFilter = e.target.value;
        renderCrashList();
    });

    [periodSelect, statusSelect].forEach(sel => {
        sel.addEventListener('focus', () => sel.closest('.crash-filter-col').classList.add('is-open'));
        sel.addEventListener('blur', () => sel.closest('.crash-filter-col').classList.remove('is-open'));
    });
}

/* ── OPEN / CLOSE ── */
window.openCrashReports = async function () {
    injectCrashModal();
    document.getElementById('crashReportsModal').classList.add('active');
    await loadCrashReports();

    if (crashPollInterval) clearInterval(crashPollInterval);
    crashPollInterval = setInterval(() => loadCrashReports(true), 15 * 1000);
};

window.closeCrashReports = function () {
    const modal = document.getElementById('crashReportsModal');
    if (modal) modal.classList.remove('active');
    crashExpandedId = null;
    crashExpandedTraceId = null;

    if (crashPollInterval) {
        clearInterval(crashPollInterval);
        crashPollInterval = null;
    }
};

/* ── LOAD DATA ── */
async function loadCrashReports(isPoll) {
    try {
        const result = await API.fetchCrashReports();
        const newReports = Array.isArray(result) ? result : [];

        if (isPoll) {
            const existingIds = new Set(crashReports.map(r => r.crash_id));
            const incomingIds = newReports.map(r => r.crash_id);
            const hasNew = incomingIds.some(id => !existingIds.has(id));

            // Nothing changed in count or resolved-status — skip re-render to avoid disrupting the admin
            const resolvedChanged = newReports.some(nr => {
                const old = crashReports.find(r => r.crash_id === nr.crash_id);
                return old && old.resolved !== nr.resolved;
            });

            if (!hasNew && !resolvedChanged) return;

            crashNewlyArrivedIds = hasNew
                ? new Set(incomingIds.filter(id => !existingIds.has(id)))
                : new Set();
        } else {
            crashNewlyArrivedIds = new Set();
        }

        crashReports = newReports;
        renderCrashList();

        if (isPoll && crashNewlyArrivedIds.size > 0) {
            loadCrashBadgeCount();
        }
    } catch (err) {
        console.error('Failed to load crash reports:', err);
        if (!isPoll) {
            crashReports = [];
            renderCrashList();
        }
    }
}

async function loadCrashBadgeCount() {
    try {
        const result = await API.fetchUnresolvedCrashCount();
        const count = (result && typeof result.count === 'number') ? result.count : 0;
        const badge = document.getElementById('crashBadge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        console.error('Failed to load crash badge count:', err);
    }
}

/* ── DATE HELPERS ── */
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getStartOfWeek(date) {
    const d = new Date(date);
    d.setDate(date.getDate() - date.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
}

function groupLabel(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay(d, now)) return 'TODAY';
    if (isSameDay(d, yesterday)) return 'YESTERDAY';
    if (d >= getStartOfWeek(now)) return 'THIS WEEK';
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'THIS MONTH';

    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

function matchesPeriod(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();

    if (crashPeriodFilter === 'all') return true;
    if (crashPeriodFilter === 'today') return isSameDay(d, now);
    if (crashPeriodFilter === 'yesterday') {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        return isSameDay(d, y);
    }
    if (crashPeriodFilter === 'week') return d >= getStartOfWeek(now);
    if (crashPeriodFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

    return true;
}

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatFullDateTime(dateStr) {
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getEmployeeName(report) {
    return report.employee_name || report.name || report.employee_id || 'Unknown';
}

function getStackTraceLines(report) {
    const raw = report.stack_trace || '';
    return raw.split('\n').filter(line => line.trim() !== '');
}

function getDeviceInfo(report) {
    if (!report.device_info) return {};
    if (typeof report.device_info === 'string') {
        try { return JSON.parse(report.device_info); } catch { return {}; }
    }
    return report.device_info;
}

/* ── RENDER ── */
function renderCrashRow(r) {
    const isExpanded = crashExpandedId === r.crash_id;
    const isTraceExpanded = crashExpandedTraceId === r.crash_id;
    const traceLines = getStackTraceLines(r);
    const firstLine = traceLines[0] || '(no stack trace)';
    const restLines = traceLines.slice(1);
    const deviceInfo = getDeviceInfo(r);
    const name = getEmployeeName(r);

    const pillClass = r.resolved ? 'crash-status-resolved' : 'crash-status-unresolved';
    const pillLabel = r.resolved ? 'Resolved' : 'Unresolved';

    let detailHtml = '';
    if (isExpanded) {
        const deviceRows = Object.entries(deviceInfo).map(([k, v]) => `
            <tr>
                <td>${k.replace(/_/g, ' ')}</td>
                <td>${v}</td>
            </tr>`).join('');

        const traceLinesHtml = restLines.length
            ? `<div class="crash-trace-lines">${restLines.map(l => `<div>${escapeHtml(l)}</div>`).join('')}</div>`
            : '';

        detailHtml = `
            <div class="crash-row-detail">
                <p class="crash-detail-section-label">Stack trace</p>
                <div class="crash-trace-box">
                    <div class="crash-trace-head" data-trace-id="${r.crash_id}">
                        <span>${escapeHtml(firstLine)}</span>
                        <div class="crash-trace-head-actions">
                            <button class="crash-copy-btn" data-copy-id="${r.crash_id}" title="Copy stack trace">
                                <i class="crash-copy-icon">⧉</i> Copy
                            </button>
                            <i class="crash-chevron ${isTraceExpanded ? 'expanded' : ''}">▾</i>
                        </div>
                    </div>
                    ${isTraceExpanded ? traceLinesHtml : ''}
                </div>

                <div data-device-anchor="${r.crash_id}">
                    <p class="crash-detail-section-label">Device info</p>
                    <table class="crash-device-table">${deviceRows}</table>

                    <div class="crash-meta-row">
                        <span>v${r.app_version || 'N/A'}</span>
                        <span>${formatFullDateTime(r.created_at)}</span>
                    </div>

                    ${r.resolved
                        ? `<button class="crash-resolve-btn is-resolved" disabled>Resolved</button>`
                        : `<button class="crash-resolve-btn" data-toggle-id="${r.crash_id}">Mark as resolved</button>`
                    }
                </div>
            </div>`;
    }

    const isNew = crashNewlyArrivedIds.has(r.crash_id);

    return `
        <div class="crash-row ${isNew ? 'crash-row-new' : ''}" data-row-id="${r.crash_id}">
            <div class="crash-row-top">
                <div class="crash-row-left">
                    <div class="crash-icon">⚠</div>
                    <div class="crash-row-info">
                        <p class="crash-row-name">${escapeHtml(name)}</p>
                        <p class="crash-row-id">${r.crash_id}</p>
                    </div>
                </div>
                <div class="crash-row-right">
                    <span class="crash-row-time">${formatTime(r.created_at)}</span>
                    <span class="crash-status-pill ${pillClass}">${pillLabel}</span>
                    <i class="crash-chevron ${isExpanded ? 'expanded' : ''}">▾</i>
                </div>
            </div>
            ${detailHtml}
        </div>`;
}

function renderCrashList(preserveScrollForId) {
    const list = document.getElementById('crashList');
    if (!list) return;

    const q = crashSearch.toLowerCase();

    const filtered = crashReports.filter(r => {
        const name = getEmployeeName(r).toLowerCase();
        const empId = (r.employee_id || '').toLowerCase();
        const crashId = (r.crash_id || '').toLowerCase();

        const matchesSearch = !q || name.includes(q) || empId.includes(q) || crashId.includes(q);
        const matchesStatus = crashStatusFilter === 'all' || (crashStatusFilter === 'resolved' ? r.resolved : !r.resolved);
        const matchesPeriodFilter = matchesPeriod(r.created_at);

        return matchesSearch && matchesStatus && matchesPeriodFilter;
    });

    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const countLabel = document.getElementById('crashCountLabel');
    if (countLabel) {
        countLabel.textContent = `Showing ${filtered.length} crash report${filtered.length !== 1 ? 's' : ''}`;
    }

    const anchorEl = preserveScrollForId ? list.querySelector(`[data-device-anchor="${preserveScrollForId}"]`) : null;
    const anchorOffsetBefore = anchorEl ? anchorEl.getBoundingClientRect().top : null;

    if (!filtered.length) {
        list.innerHTML = `<div class="crash-empty">No matching crash reports</div>`;
    } else {
        let html = '';
        let lastGroup = null;
        filtered.forEach(r => {
            const g = groupLabel(r.created_at);
            if (g !== lastGroup) {
                html += `<div class="crash-group-label">${g}</div>`;
                lastGroup = g;
            }
            html += renderCrashRow(r);
        });
        list.innerHTML = html;
    }

    if (anchorOffsetBefore !== null) {
        const anchorElAfter = list.querySelector(`[data-device-anchor="${preserveScrollForId}"]`);
        if (anchorElAfter) {
            const anchorOffsetAfter = anchorElAfter.getBoundingClientRect().top;
            list.scrollTop += (anchorOffsetAfter - anchorOffsetBefore);
        }
    }

    attachCrashRowListeners(list);
}

function attachCrashRowListeners(list) {
    list.querySelectorAll('[data-row-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('[data-toggle-id]') || e.target.closest('[data-trace-id]') || e.target.closest('[data-copy-id]')) return;
            const id = el.getAttribute('data-row-id');
            crashExpandedId = crashExpandedId === id ? null : id;
            if (crashExpandedId !== id) crashExpandedTraceId = null;
            renderCrashList();
        });
    });

    list.querySelectorAll('[data-trace-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('[data-copy-id]')) return;
            const id = el.getAttribute('data-trace-id');
            crashExpandedTraceId = crashExpandedTraceId === id ? null : id;
            renderCrashList(id);
        });
    });

    list.querySelectorAll('[data-toggle-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-toggle-id');
            toggleCrashResolved(id);
        });
    });

    list.querySelectorAll('[data-copy-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-copy-id');
            copyCrashTrace(id, btn);
        });
    });
}

/* ── RESOLVE TOGGLE ── */
async function toggleCrashResolved(crashId) {
    const report = crashReports.find(r => String(r.crash_id) === String(crashId));
    if (!report || report.resolved) return;

    try {
        const result = await API.updateCrashReport(crashId, true);

        if (result && !result.error) {
            report.resolved = true;
            renderCrashList();
            loadCrashBadgeCount();
            showCrashToast('Marked as resolved');
        } else {
            console.error('Failed to update crash report:', result?.error);
            showCrashToast('Failed to update crash report');
        }
    } catch (err) {
        console.error('Crash report update error:', err);
        showCrashToast('Server connection error');
    }
}

/* ── COPY STACK TRACE ── */
function copyCrashTrace(crashId, btnEl) {
    const report = crashReports.find(r => String(r.crash_id) === String(crashId));
    if (!report) return;

    const fullTrace = report.stack_trace || '';

    const fallbackCopy = () => {
        const textarea = document.createElement('textarea');
        textarea.value = fullTrace;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try { document.execCommand('copy'); } catch (err) { console.error('Copy failed:', err); }
        document.body.removeChild(textarea);
    };

    const showCopied = () => {
        if (btnEl) {
            const original = btnEl.innerHTML;
            btnEl.innerHTML = '<i class="crash-copy-icon">✓</i> Copied';
            btnEl.classList.add('copied');
            setTimeout(() => {
                btnEl.innerHTML = original;
                btnEl.classList.remove('copied');
            }, 1500);
        }
        showCrashToast('Stack trace copied');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullTrace).then(showCopied).catch(() => {
            fallbackCopy();
            showCopied();
        });
    } else {
        fallbackCopy();
        showCopied();
    }
}

/* ── UTIL ── */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ── CRASH-SCOPED TOAST ── */
function showCrashToast(msg) {
    const t = document.getElementById('crashToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}