document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. CONFIG & STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    // Support multiple ID param names to prevent navigation bugs
    const selectedRepId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('rep_id');
    let selectedRepName = urlParams.get('name') || "Medical Representative";
    let selectedRepArea = urlParams.get('area') || "Assignment Area";

    // --- 2. QUARTER-BASED BOUNDARIES ---
    const now = new Date();
    const currentQuarter = parseInt(urlParams.get('quarter') || Math.ceil((now.getMonth() + 1) / 3));
    const currentYear = parseInt(urlParams.get('year') || now.getFullYear());

    let currentMonthIndex = (currentQuarter - 1) * 3;
    let minMonthIndex = currentMonthIndex;
    let maxMonthIndex = currentMonthIndex + 2;
    let globalScheduleData = [];
    let globalAttendanceLogs = [];

    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

    const calendarGrid = document.querySelector('.calendar-grid');

    // Update Header immediately
    const nameEl = document.getElementById('rep-name');
    const areaEl = document.getElementById('rep-location');
    if (nameEl) nameEl.textContent = selectedRepName;
    if (areaEl) areaEl.textContent = selectedRepArea;

    // --- 1.5 BACK BUTTON LOGIC ---
    const backBtn = document.getElementById('goBack') || document.querySelector('.back-btn');
    if (backBtn) {
        // Ensure any inline handlers are cleared
        backBtn.onclick = null; 
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedRepId) {
                window.history.back();
                return;
            }
            const query = new URLSearchParams({
                id: selectedRepId,
                name: selectedRepName,
                area: selectedRepArea
            }).toString();
            window.location.href = `../representative_details.html?${query}`;
        });
    }

    // --- 2. LOAD DATA FROM BACKEND ---
    async function loadAttendance() {
        if (!selectedRepId) {
            console.error("No Representative ID found in URL.");
            return;
        }

        try {
            const BASE_URL = "http://26.209.189.89:5000";
            // Pass quarter/year to the API if supported, or filter the returned list
            const response = await fetch(`${BASE_URL}/api/dcp/schedule/${selectedRepId}?quarter=${currentQuarter}&year=${currentYear}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log("DEBUG: Raw Schedule Data (DCP) from API:", result);
            const rawData = result.data || result;

            globalScheduleData = (Array.isArray(rawData) ? rawData : []).filter(item => 
                (item.status || item.dcp_status || '').toLowerCase() === 'approved'
            );
            console.log("DEBUG: Filtered globalScheduleData (Approved only):", globalScheduleData);

            // Changed from /api/attendance/logs to /api/attendance to resolve the 404 error
            const logsRes = await fetch(`${BASE_URL}/api/attendance?id=${selectedRepId}&year=${currentYear}&quarter=${currentQuarter}`);
            const logsData = logsRes.ok ? await logsRes.json() : null;
            
            console.log("DEBUG: Attendance Logs raw response:", logsData);
            globalAttendanceLogs = Array.isArray(logsData) ? logsData : (logsData?.data || []);

            // Calculate dynamic boundaries based on the actual scheduled dates
            if (globalScheduleData.length > 0) {
                const availableMonths = [...new Set(globalScheduleData.map(item => {
                    const d = new Date(getNormalizedItemDate(item));
                    return d.getMonth();
                }))].sort((a, b) => a - b);

                minMonthIndex = availableMonths[0];
                maxMonthIndex = availableMonths[availableMonths.length - 1];
                currentMonthIndex = minMonthIndex;
            }

            updateNavigationAndRender();

        } catch (err) {
            console.error("Attendance Load Error:", err);
            // If API fails, show empty grid rather than crashing
            renderCalendar(currentMonthIndex, currentYear);
        }
    }

    // --- 3. NAVIGATION ---
    function updateNavigationAndRender() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        // Navigation is locked to months that actually have scheduled visits
        if (prevBtn) prevBtn.disabled = (currentMonthIndex <= minMonthIndex);
        if (nextBtn) nextBtn.disabled = (currentMonthIndex >= maxMonthIndex);

        renderCalendar(currentMonthIndex, currentYear);
    }

    // --- 4. DATE NORMALIZATION (Matching schedule.js logic) ---
    function getNormalizedItemDate(item) {
        let raw = item.dcp_date || item.attendance_date || item.date || item.Date || item.DCP_DATE;
        if (!raw) return null;

        const datePart = String(raw).split('T')[0].trim();
        const parts = datePart.split('-');
        if (parts.length !== 3) return datePart;

        // Ensure YYYY-MM-DD format
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // --- 5. CALENDAR RENDER ---
    function renderCalendar(month, year) {
        if (!calendarGrid) return;

        // Keep day headers (SUN, MON, etc.)
        const dayHeaders = Array.from(calendarGrid.querySelectorAll('.day-name'));
        calendarGrid.innerHTML = '';
        dayHeaders.forEach(h => calendarGrid.appendChild(h));

        const monthEl = document.getElementById('monthName');
        const yearEl  = document.getElementById('yearNumber');
        if (monthEl) monthEl.textContent = monthNames[month];
        if (yearEl)  yearEl.textContent  = year;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Add empty boxes for days before the 1st of the month
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'date-item empty';
            calendarGrid.appendChild(empty);
        }

        // Generate day boxes
        for (let d = 1; d <= daysInMonth; d++) {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'date-item';

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // Check if there were plans vs an actual log for this day
            const dayPlans = globalScheduleData.filter(item => getNormalizedItemDate(item) === dateStr);
            const log = globalAttendanceLogs.find(item => getNormalizedItemDate(item) === dateStr);

            dateDiv.innerHTML = `<span class="date-number">${d}</span>`;

            if (dayPlans.length > 0) {
                // Add the class that triggers the blue dot indicator (::after) from CSS
                dateDiv.classList.add('has-visit');
            }

            dateDiv.onclick = () => openDateModal(d, month, year, dayPlans, log);
            calendarGrid.appendChild(dateDiv);
        }
    }

    // --- 6. MODAL ---
    window.openDateModal = (day, month, year, plans, log) => {
        const modal = document.getElementById('dateModal');
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalDateTitle');

        // Header: "April 3, 2026 — Friday"
        const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const dayOfWeek = dayNames[new Date(year, month, day).getDay()];
        if (modalTitle) modalTitle.textContent = `${monthNames[month]} ${day}, ${year} — ${dayOfWeek}`;

        // Initials from rep name
        const initials = selectedRepName
            .trim().split(/\s+/)
            .map(w => w[0]).filter(Boolean)
            .slice(0, 2).join('').toUpperCase() || '?';

        // Status badge
        const rawStatus = (log?.attendance_status || '').toLowerCase();
        let badgeClass = 'badge-nolog';
        let statusLabel = plans.length > 0 ? 'No Log' : 'N/A';
        if (rawStatus.includes('present') || rawStatus.includes('on time')) {
            badgeClass = 'badge-present'; statusLabel = 'On Time';
        } else if (rawStatus.includes('late')) {
            badgeClass = 'badge-late'; statusLabel = 'Late';
        } else if (rawStatus.includes('absent')) {
            badgeClass = 'badge-absent'; statusLabel = 'Absent';
        } else if (log?.attendance_status) {
            statusLabel = log.attendance_status;
        }

        // Check for daily picture
        const hasPicture = log?.daily_picture && log.daily_picture !== 'null' && log.daily_picture !== '';

        // Two-col layout always
        modalBody.innerHTML = `
            <div class="modal-two-col">

                <!-- LEFT: avatar/image box -->
                <div class="modal-img-box">
                    ${hasPicture ? `<img src="${log.daily_picture}" id="attendanceImg" alt="Daily Attendance Picture" style="cursor: zoom-in;">` : `
                    <div class="modal-img-initials">
                        <div class="initials-badge">${initials}</div>
                        <div class="initials-label">${selectedRepName}</div>
                    </div>`}
                </div>

                <!-- RIGHT: attendance info -->
                <div class="modal-info-col">
                    <div class="modal-name-row">
                        <span class="modal-rep-name">${selectedRepName}</span>
                        <span class="modal-status-badge ${badgeClass}">${statusLabel}</span>
                    </div>
                    <div class="modal-rep-area">${selectedRepArea}</div>
                    <div class="modal-info-divider"></div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Time In</span>
                        <span class="modal-info-value">${log?.time_in || '--:--'}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Time Out</span>
                        <span class="modal-info-value">${log?.time_out || '--:--'}</span>
                    </div>
                    <div class="modal-info-row">
                        <span class="modal-info-label">Tagged Location</span>
                        <span class="modal-info-value" style="font-size:12px;">📍 ${log?.tagged_location || 'N/A'}</span>
                    </div>
                    ${log?.location ? `
                    <div class="modal-info-row">
                        <span class="modal-info-label">Location</span>
                        <span class="modal-info-value" style="font-size:12px;">📍 ${log.location}</span>
                    </div>` : ''}
                </div>

            </div>`;

        modal.style.display = 'flex';
        modal.classList.add('active');
    };

    // Lightbox Logic for Image Expansion
    document.body.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'attendanceImg') {
            const lightbox = document.getElementById('imageLightbox');
            const expandedImg = document.getElementById('expandedImg');
            expandedImg.src = e.target.src;
            lightbox.style.display = 'flex';
            lightbox.classList.add('active');
        }
    });

    // Close Modal Logic
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

    // Close on overlay click (outside card)
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

    // --- 7. NAVIGATION CONTROLS ---
    document.getElementById('prevMonth').onclick = () => {
        if (currentMonthIndex > minMonthIndex) {
            currentMonthIndex--;
            updateNavigationAndRender();
        }
    };
    document.getElementById('nextMonth').onclick = () => {
        if (currentMonthIndex < maxMonthIndex) {
            currentMonthIndex++;
            updateNavigationAndRender();
        }
    };

    // Initialize
    await loadAttendance();
});