document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. CONFIG & STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    const selectedRepId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('rep_id');
    let selectedRepName = urlParams.get('name') || "Medical Representative";
    let selectedRepArea = urlParams.get('area') || "Assignment Area";

    const now = new Date();
    let currentMonthIndex = now.getMonth();
    let currentYear = now.getFullYear();

    let globalAttendanceLogs = [];

    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

    const calendarGrid = document.querySelector('.calendar-grid');

    // Update Header immediately
    const nameEl = document.getElementById('rep-name');
    const areaEl = document.getElementById('rep-location');
    if (nameEl) nameEl.textContent = selectedRepName;
    if (areaEl) areaEl.textContent = selectedRepArea;

    // --- BACK BUTTON ---
    const backBtn = document.getElementById('goBack') || document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.onclick = null;
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedRepId) { window.history.back(); return; }
            const query = new URLSearchParams({
                id: selectedRepId,
                name: selectedRepName,
                area: selectedRepArea
            }).toString();
            window.location.href = `../representative_details.html?${query}`;
        });
    }

    // --- TIMEZONE HELPER ---
    function formatLocalTime(timetz) {
        if (!timetz || timetz === '--:--') return '--:--';
        // DB stores local time already (e.g. 10:27:33+08 means 10:27 AM local)
        // Just extract HH:MM and convert to 12-hour — don't re-apply the offset
        const match = String(timetz).match(/^(\d{2}):(\d{2})/);
        if (!match) return timetz;
        let hours = parseInt(match[1]);
        let minutes = parseInt(match[2]);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 === 0 ? 12 : hours % 12;
        const displayMin = String(minutes).padStart(2, '0');
        return `${displayHour}:${displayMin} ${period}`;
    }

    // --- DATE NORMALIZATION --- (mirrors schedule.js exactly)
    function getNormalizedItemDate(item) {
        let raw = item.attendance_date || item.dcp_date || item.date || item.Date;

        if (!raw) {
            const autoKey = Object.keys(item).find(k => k.toLowerCase().includes('date'));
            if (autoKey) raw = item[autoKey];
        }

        if (!raw) return null;
        const match = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
    }

    // --- LOAD DATA ---
    async function loadAttendance() {
        if (!selectedRepId) {
            console.error("No Representative ID found in URL.");
            return;
        }

        try {
            // Use window.BASE_URL from backend_connection.js, fallback to local
            const _base = (window.BASE_URL || "http://127.0.0.1:5000/api");
            const logsRes = await fetch(`${_base}/attendance?id=${selectedRepId}`);
            const logsData = logsRes.ok ? await logsRes.json() : null;

            console.log("DEBUG: Attendance Logs raw response:", logsData);
            globalAttendanceLogs = Array.isArray(logsData) ? logsData : (logsData?.data || []);
            console.log("DEBUG: globalAttendanceLogs:", globalAttendanceLogs);

            const monthEl = document.getElementById('monthName');
            const yearEl  = document.getElementById('yearNumber');
            const prevBtn = document.getElementById('prevMonth');
            const nextBtn = document.getElementById('nextMonth');

            if (globalAttendanceLogs.length === 0) {
                // No logs — show current month, disable nav
                if (calendarGrid) calendarGrid.style.display = 'grid';
                if (monthEl) monthEl.textContent = monthNames[currentMonthIndex];
                if (yearEl)  yearEl.textContent  = currentYear;
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
                renderCalendar(currentMonthIndex, currentYear);
                return;
            }

            // Land on closest future log date, or most recent past — mirrors schedule.js exactly
            const validDates = globalAttendanceLogs
                .map(item => new Date(getNormalizedItemDate(item)))
                .filter(d => !isNaN(d.getTime()))
                .sort((a, b) => a - b);

            if (validDates.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const target = validDates.find(d => d >= today) || validDates[validDates.length - 1];
                currentMonthIndex = target.getMonth();
                currentYear = target.getFullYear();
                console.log(`🚀 Landing on: ${monthNames[currentMonthIndex]} ${currentYear}`);
            }

            if (calendarGrid) calendarGrid.style.display = 'grid';
            updateNavigationAndRender();

        } catch (err) {
            console.error("Attendance Load Error:", err);
            renderCalendar(currentMonthIndex, currentYear);
        }
    }

    // --- NAVIGATION --- (mirrors schedule.js updateNavigationAndRender exactly)
    function updateNavigationAndRender() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        // Find ANY log that exists before the current month/year
        const hasPrev = globalAttendanceLogs.some(item => {
            const d = new Date(getNormalizedItemDate(item));
            return (d.getFullYear() < currentYear) ||
                   (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex);
        });

        // Find ANY log that exists after the current month/year
        const hasNext = globalAttendanceLogs.some(item => {
            const d = new Date(getNormalizedItemDate(item));
            return (d.getFullYear() > currentYear) ||
                   (d.getFullYear() === currentYear && d.getMonth() > currentMonthIndex);
        });

        if (prevBtn) prevBtn.disabled = !hasPrev;
        if (nextBtn) nextBtn.disabled = !hasNext;

        renderCalendar(currentMonthIndex, currentYear);
    }

    // --- CALENDAR RENDER ---
    function renderCalendar(month, year) {
        if (!calendarGrid) return;

        const dayHeaders = Array.from(calendarGrid.querySelectorAll('.day-name'));
        calendarGrid.innerHTML = '';
        dayHeaders.forEach(h => calendarGrid.appendChild(h));

        const monthEl = document.getElementById('monthName');
        const yearEl  = document.getElementById('yearNumber');
        if (monthEl) monthEl.textContent = monthNames[month];
        if (yearEl)  yearEl.textContent  = year;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'date-item empty';
            calendarGrid.appendChild(empty);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'date-item';

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // Blue dot only if there's a real attendance log for this day
            const log = globalAttendanceLogs.find(item => getNormalizedItemDate(item) === dateStr);

            dateDiv.innerHTML = `<span class="date-number">${d}</span>`;

            if (log) {
                dateDiv.classList.add('has-visit');
            }

            dateDiv.onclick = () => openDateModal(d, month, year, log);
            calendarGrid.appendChild(dateDiv);
        }
    }

    // --- MODAL ---
    window.openDateModal = (day, month, year, log) => {
        const modal = document.getElementById('dateModal');
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalDateTitle');

        const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const dayOfWeek = dayNames[new Date(year, month, day).getDay()];
        if (modalTitle) modalTitle.textContent = `${monthNames[month]} ${day}, ${year} — ${dayOfWeek}`;

        // Initials from rep name
        const initials = selectedRepName
            .trim().split(/\s+/)
            .map(w => w[0]).filter(Boolean)
            .slice(0, 2).join('').toUpperCase() || '?';

        // Status badge — handles on_time, on time, present, late, absent
        const rawStatus = (log?.attendance_status || '').toLowerCase();
        let badgeClass = 'badge-nolog';
        let statusLabel = 'No Log';
        if (rawStatus.includes('on_time') || rawStatus.includes('on time') || rawStatus.includes('present')) {
            badgeClass = 'badge-present'; statusLabel = 'On Time';
        } else if (rawStatus.includes('late')) {
            badgeClass = 'badge-late'; statusLabel = 'Late';
        } else if (rawStatus.includes('absent')) {
            badgeClass = 'badge-absent'; statusLabel = 'Absent';
        } else if (log?.attendance_status) {
            statusLabel = log.attendance_status;
        }

        const hasPicture = log?.daily_picture && log.daily_picture !== 'null' && log.daily_picture !== '';

        const mapBase = "https://www.google.com/maps/search/?api=1&query=";
        const taggedLocQuery = log?.tagged_location ? encodeURIComponent(log.tagged_location) : "";
        const fallbackLocQuery = log?.location ? encodeURIComponent(log.location) : "";

        modalBody.innerHTML = `
            <div class="modal-two-col">
                <div class="modal-img-box">
                    ${hasPicture
                        ? `<img src="${log.daily_picture}" id="attendanceImg" alt="Daily Attendance Picture" style="cursor: zoom-in;">`
                        : `<div class="modal-img-initials">
                               <div class="initials-badge">${initials}</div>
                               <div class="initials-label">${selectedRepName}</div>
                           </div>`
                    }
                </div>
                <div class="modal-info-col">
                    <div class="modal-name-row">
                        <span class="modal-rep-name">${selectedRepName}</span>
                        <span class="modal-status-badge ${badgeClass}">${statusLabel}</span>
                    </div>
                    <div class="modal-rep-area">${selectedRepArea}</div>
                    <div class="modal-info-divider"></div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Time In</span>
                        <span class="modal-info-value">${log?.time_in ? formatLocalTime(log.time_in) : '--:--'}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Time Out</span>
                        <span class="modal-info-value">${log?.time_out ? formatLocalTime(log.time_out) : '--:--'}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Tagged Location</span>
                        <span class="modal-info-value" style="font-size:12px;">
                            ${log?.tagged_location
                                ? `<a href="${mapBase}${taggedLocQuery}" target="_blank" style="color:#007bff;text-decoration:none;">
                                       📍 ${log.tagged_location}
                                   </a>`
                                : 'N/A'}
                        </span>
                    </div>
                    ${log?.location ? `
                    <div class="modal-info-row">
                        <span class="modal-info-label">Location</span>
                        <span class="modal-info-value" style="font-size:12px;">
                            <a href="${mapBase}${fallbackLocQuery}" target="_blank" style="color:#007bff;text-decoration:none;">
                                📍 ${log.location}
                            </a>
                        </span>
                    </div>` : ''}
                </div>
            </div>`;

        modal.style.display = 'flex';
        modal.classList.add('active');
    };

    // Lightbox
    document.body.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'attendanceImg') {
            const lightbox = document.getElementById('imageLightbox');
            const expandedImg = document.getElementById('expandedImg');
            expandedImg.src = e.target.src;
            lightbox.style.display = 'flex';
            lightbox.classList.add('active');
        }
    });

    // Close modal
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const modal = document.getElementById('dateModal');
            modal.style.display = 'none';
            modal.classList.remove('active');
        };
    }

    const closeLightbox = document.getElementById('closeLightbox');
    if (closeLightbox) {
        closeLightbox.onclick = () => {
            const lightbox = document.getElementById('imageLightbox');
            lightbox.style.display = 'none';
            lightbox.classList.remove('active');
        };
    }

    document.getElementById('dateModal').addEventListener('click', (e) => {
        if (e.target.id === 'dateModal') {
            e.target.style.display = 'none';
            e.target.classList.remove('active');
        }
    });
    document.getElementById('imageLightbox').addEventListener('click', (e) => {
        if (e.target.id === 'imageLightbox') {
            e.target.style.display = 'none';
            e.target.classList.remove('active');
        }
    });

    // --- NAVIGATION CONTROLS --- (mirrors schedule.js prev/next exactly)
    document.getElementById('prevMonth').onclick = () => {
        const available = globalAttendanceLogs
            .map(item => new Date(getNormalizedItemDate(item)))
            .filter(d => (d.getFullYear() < currentYear) ||
                         (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex))
            .sort((a, b) => b - a); // closest previous first

        if (available.length > 0) {
            currentMonthIndex = available[0].getMonth();
            currentYear = available[0].getFullYear();
            updateNavigationAndRender();
        }
    };

    document.getElementById('nextMonth').onclick = () => {
        const available = globalAttendanceLogs
            .map(item => new Date(getNormalizedItemDate(item)))
            .filter(d => (d.getFullYear() > currentYear) ||
                         (d.getFullYear() === currentYear && d.getMonth() > currentMonthIndex))
            .sort((a, b) => a - b); // closest next first

        if (available.length > 0) {
            currentMonthIndex = available[0].getMonth();
            currentYear = available[0].getFullYear();
            updateNavigationAndRender();
        }
    };

    // Initialize
    await loadAttendance();
});