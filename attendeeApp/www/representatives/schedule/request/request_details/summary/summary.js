document.addEventListener('DOMContentLoaded', () => {

    const RADMIN_IP = "26.209.189.89";
    const BASE_URL = `http://${RADMIN_IP}:5000/api`;

    const params = new URLSearchParams(window.location.search);
    const empId = params.get('employee_id') || params.get('user_id') || "EMP001";
    const quarter = parseInt(params.get('quarter')) || 1;
    const year = params.get('year') || "2026";

    // Calendar state
    let activeDoctor = null;       // { name, dates: [Date, ...], recordType }
    let calendarMonthIndex = 0;    // index into activeDoctor.monthList
    let allDcpList = [];

    // Quarter month ranges
    const quarterMonths = {
        1: [0, 1, 2],   // Jan, Feb, Mar
        2: [3, 4, 5],   // Apr, May, Jun
        3: [6, 7, 8],   // Jul, Aug, Sep
        4: [9, 10, 11]  // Oct, Nov, Dec
    };

    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
    const shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                             "Jul","Aug","Sep","Oct","Nov","Dec"];

    // ─── Expose toggleAccordion globally ────────────────────────────────────
    window.toggleAccordion = (element, doctorName, dates, recordType) => {
        const item = element.parentElement;
        const isAlreadyActive = item.classList.contains('active');

        document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));

        if (!isAlreadyActive) {
            item.classList.add('active');
        }

        if (!isAlreadyActive && doctorName) {
            showCalendar(doctorName, dates, recordType);
        } else if (isAlreadyActive) {
            hideCalendar();
        }
    };

    // ─── Calendar Functions ──────────────────────────────────────────────────
    function showCalendar(name, dates, recordType) {
        activeDoctor = {
            name,
            dates: dates.map(d => new Date(d)),
            recordType
        };

        // Get unique months that have visits
        const monthSet = new Set(activeDoctor.dates.map(d => `${d.getFullYear()}-${d.getMonth()}`));
        activeDoctor.monthList = Array.from(monthSet)
            .map(key => {
                const [y, m] = key.split('-').map(Number);
                return { year: y, month: m };
            })
            .sort((a, b) => a.year - b.year || a.month - b.month);

        calendarMonthIndex = 0;

        document.getElementById('calendar-empty').classList.add('hidden');
        document.getElementById('calendar-active').classList.remove('hidden');

        renderCalendar();
    }

    function hideCalendar() {
        activeDoctor = null;
        document.getElementById('calendar-empty').classList.remove('hidden');
        document.getElementById('calendar-active').classList.add('hidden');
    }

    function renderCalendar() {
        if (!activeDoctor || !activeDoctor.monthList.length) return;

        const { year: y, month: m } = activeDoctor.monthList[calendarMonthIndex];

        document.getElementById('current-month-display').textContent = `${monthNames[m]} ${y}`;

        // Nav button visibility
        const prevBtn = document.querySelector('.nav-btn.prev-btn');
        const nextBtn = document.querySelector('.nav-btn.next-btn');

        if (calendarMonthIndex === 0) {
            prevBtn.classList.add('nav-hidden');
        } else {
            prevBtn.classList.remove('nav-hidden');
        }

        if (calendarMonthIndex === activeDoctor.monthList.length - 1) {
            nextBtn.classList.add('nav-hidden');
        } else {
            nextBtn.classList.remove('nav-hidden');
        }

        // Get scheduled dates for this month
        const scheduledDays = new Set(
            activeDoctor.dates
                .filter(d => d.getFullYear() === y && d.getMonth() === m)
                .map(d => d.getDate())
        );

        // Build calendar grid
        const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const grid = document.getElementById('calendar-days-grid');
        grid.innerHTML = '';

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'date empty-date';
            grid.appendChild(empty);
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'date';
            if (scheduledDays.has(d)) {
                cell.classList.add('scheduled');
            }
            cell.textContent = d;
            grid.appendChild(cell);
        }
    }

    window.changeMonth = (dir) => {
        if (!activeDoctor) return;
        const newIndex = calendarMonthIndex + dir;
        if (newIndex < 0 || newIndex >= activeDoctor.monthList.length) return;
        calendarMonthIndex = newIndex;
        renderCalendar();
    };

    // ─── Dynamic Period Pill ─────────────────────────────────────────────────
    function computePeriodPill(dcpList) {
        if (!dcpList || dcpList.length === 0) {
            // Fallback to URL params
            const qMonths = quarterMonths[quarter] || [0,1,2];
            const start = shortMonthNames[qMonths[0]];
            const end = shortMonthNames[qMonths[qMonths.length - 1]];
            document.getElementById('display-period').textContent = `Q${quarter} · ${start} – ${end} ${year}`;
            return;
        }

        const dates = dcpList
            .map(d => new Date(d.dcp_date))
            .filter(d => !isNaN(d));

        if (!dates.length) return;

        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        const startMonth = shortMonthNames[minDate.getMonth()];
        const endMonth = shortMonthNames[maxDate.getMonth()];
        const periodYear = minDate.getFullYear();

        // Determine quarter from min date month
        const minMonth = minDate.getMonth(); // 0-based
        const q = Math.floor(minMonth / 3) + 1;

        document.getElementById('display-period').textContent =
            `Q${q} · ${startMonth} – ${endMonth} ${periodYear}`;
    }

    // ─── Stats ───────────────────────────────────────────────────────────────
    function updateStats(summary, dcpList) {
        // Total CDS doctors and pharmacies (denominators)
        const totalCdsDoctors = summary.total_cds_doctors ?? 75;
        const totalCdsPharmacies = summary.total_cds_pharmacies ?? 75;

        // Count unique cds_id in DCP per RecordType that have at least 1 visit
        const visitedDoctorIds = new Set();
        const visitedPharmacyIds = new Set();

        dcpList.forEach(entry => {
            if (entry.cds_id) {
                const rt = (entry.record_type || entry.RecordType || '').toLowerCase();
                if (rt === 'doctor') visitedDoctorIds.add(entry.cds_id);
                else if (rt === 'pharmacy') visitedPharmacyIds.add(entry.cds_id);
            }
        });

        // Fallback: if RecordType not in dcp_list, use summary counts
        const doctorVisited = visitedDoctorIds.size || summary.total_doctors || 0;
        const pharmacyVisited = visitedPharmacyIds.size || summary.total_pharmacies || 0;

        document.getElementById('stat-doctors').innerHTML =
            `${doctorVisited}<span class="total">/${totalCdsDoctors}</span>`;

        document.getElementById('stat-visits').textContent =
            summary.total_visits || dcpList.length || 0;

        document.getElementById('stat-pharmacies').innerHTML =
            `${pharmacyVisited}<span class="total">/${totalCdsPharmacies}</span>`;
    }

    // ─── Breakdown Accordion ─────────────────────────────────────────────────
    function renderBreakdown(dcpList) {
        const container = document.getElementById('accordion-container');
        if (!container) return;

        // Separate doctors and pharmacies
        const doctorMap = {};
        const pharmacyMap = {};

        dcpList.forEach(entry => {
            const rt = (entry.record_type || entry.RecordType || 'doctor').toLowerCase();
            const isPharmacy = rt === 'pharmacy';
            const name = isPharmacy
                ? (entry.pharmacy_name || entry.doctors || 'Unnamed Pharmacy')
                : (entry.doctors || 'Unnamed Doctor');
            const id = entry.cds_id || name;
            const map = isPharmacy ? pharmacyMap : doctorMap;

            if (!map[id]) map[id] = { name, dates: [], recordType: rt };
            if (entry.dcp_date) map[id].dates.push(entry.dcp_date);
        });

        container.innerHTML = '';

        const renderGroup = (map, groupLabel, prefix) => {
            if (Object.keys(map).length === 0) return;

            const label = document.createElement('p');
            label.className = 'group-label';
            label.textContent = groupLabel;
            container.appendChild(label);

            Object.keys(map).sort().forEach(id => {
                const { name, dates, recordType } = map[id];

                // Build month buckets
                const monthBuckets = {};
                dates.forEach(raw => {
                    const d = new Date(raw);
                    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
                    if (!monthBuckets[key]) monthBuckets[key] = { label: monthNames[d.getMonth()], days: new Set() };
                    monthBuckets[key].days.add(d.getDate());
                });

                const sortedMonthKeys = Object.keys(monthBuckets).sort();

                // Quarter badge from first date
                let qBadge = '';
                if (dates.length) {
                    const firstDate = new Date(dates[0]);
                    const q = Math.floor(firstDate.getMonth() / 3) + 1;
                    const qMonths = quarterMonths[q];
                    const start = shortMonthNames[qMonths[0]];
                    const end = shortMonthNames[qMonths[qMonths.length - 1]];
                    qBadge = `Q${q} · ${start} – ${end} ${firstDate.getFullYear()}`;
                }

                const rowsHtml = sortedMonthKeys.map(key => {
                    const { label: mLabel, days } = monthBuckets[key];
                    const sortedDays = Array.from(days).sort((a, b) => a - b);
                    return `
                        <div class="visit-row">
                            <span class="month">${mLabel}</span>
                            <div class="dates-wrapper">
                                <span class="dates-sublabel">DATES</span>
                                <div class="date-chips">
                                    ${sortedDays.map(d => `<span class="chip">${d}</span>`).join('')}
                                </div>
                            </div>
                            <span class="freq-label"><b>${sortedDays.length}x</b> visits</span>
                        </div>
                    `;
                }).join('');

                // Encode dates for inline onclick
                const datesJson = JSON.stringify(dates).replace(/"/g, '&quot;');

                const item = document.createElement('div');
                item.className = 'accordion-item';
                item.innerHTML = `
                    <div class="accordion-header"
                         onclick="toggleAccordion(this, '${name.replace(/'/g,"\\'")}', JSON.parse(this.dataset.dates), '${recordType}')"
                         data-dates="${datesJson}">
                        <span class="doctor-name">${prefix}${name}</span>
                        <i class="fa fa-chevron-down"></i>
                    </div>
                    <div class="accordion-content">
                        <div class="month-rows-container">
                            ${rowsHtml}
                        </div>
                        <div class="total-footer">
                            <span>TOTAL VISITS</span>
                            <span class="bold-total">${dates.length} visits</span>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        };

        renderGroup(doctorMap, 'DOCTORS', '');
        renderGroup(pharmacyMap, 'PHARMACY', '');
    }

    // ─── Init ────────────────────────────────────────────────────────────────
    async function initSummary() {
        const fullUrl = `${BASE_URL}/summary?id=${empId}&quarter=${quarter}&year=${year}`;

        try {
            const response = await fetch(fullUrl);
            if (!response.ok) throw new Error(`Server Error: ${response.status}`);
            const data = await response.json();

            // Medrep info
            let displayName = "Unknown MedRep";
            if (data.medrep) {
                displayName = data.medrep.name && data.medrep.name !== "Unknown"
                    ? data.medrep.name
                    : `${data.medrep.first_name || ''} ${data.medrep.last_name || ''}`.trim();
            }

            document.getElementById('display-name').innerText = displayName;
            document.getElementById('display-location').innerText = data.medrep?.area || "N/A";

            allDcpList = data.dcp_list || [];

            computePeriodPill(allDcpList);
            updateStats(data.summary, allDcpList);
            renderBreakdown(allDcpList);

        } catch (err) {
            console.error("Connection Failed:", err);
            alert("Connection Error!\nCheck Flask server + Radmin IP: " + RADMIN_IP);
        }
    }

    initSummary();
});