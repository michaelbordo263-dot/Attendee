document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const empId = params.get('id') || params.get('user_id') || params.get('employee_id');
    const qParam = params.get('quarter') || params.get('q') || "1";
    const quarter = parseInt(qParam.replace('Q', '')) || 1; 
    const year = params.get('year') || "2026";

    let activeDoctor = null;
    let calendarMonthIndex = 0;
    let allDcpList = [];

    const quarterMonths = {
        1: [0, 1, 2], 2: [3, 4, 5], 3: [6, 7, 8], 4: [9, 10, 11]
    };

    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
    const shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                             "Jul","Aug","Sep","Oct","Nov","Dec"];

    window.toggleAccordion = (element, doctorName, dates, recordType) => {
        const item = element.parentElement;
        const isAlreadyActive = item.classList.contains('active');
        document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));

        if (!isAlreadyActive) {
            item.classList.add('active');
            showCalendar(doctorName, dates, recordType);
        } else {
            hideCalendar();
        }
    };

    function showCalendar(name, dates, recordType) {
        activeDoctor = { name, dates: dates.map(d => new Date(d)), recordType };
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

        const prevBtn = document.querySelector('.nav-btn.prev-btn');
        const nextBtn = document.querySelector('.nav-btn.next-btn');
        calendarMonthIndex === 0 ? prevBtn.classList.add('nav-hidden') : prevBtn.classList.remove('nav-hidden');
        calendarMonthIndex === activeDoctor.monthList.length - 1 ? nextBtn.classList.add('nav-hidden') : nextBtn.classList.remove('nav-hidden');

        const scheduledDays = new Set(activeDoctor.dates.filter(d => d.getFullYear() === y && d.getMonth() === m).map(d => d.getDate()));
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const grid = document.getElementById('calendar-days-grid');
        grid.innerHTML = '';

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'date empty-date';
            grid.appendChild(empty);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'date' + (scheduledDays.has(d) ? ' scheduled' : '');
            cell.textContent = d;
            grid.appendChild(cell);
        }
    }

    window.changeMonth = (dir) => {
        if (!activeDoctor) return;
        const newIndex = calendarMonthIndex + dir;
        if (newIndex >= 0 && newIndex < activeDoctor.monthList.length) {
            calendarMonthIndex = newIndex;
            renderCalendar();
        }
    };

    function computePeriodPill(dcpList) {
        const targetLabel = document.getElementById('display-period');
        
        // Define the month range map for each quarter
        const qLabels = {
            1: ["Jan", "Mar"],
            2: ["Apr", "Jun"],
            3: ["Jul", "Sep"],
            4: ["Oct", "Dec"]
        };

        // Use the quarter/year variables defined at the top of your script
        // This ensures the UI ALWAYS matches the URL parameters
        const months = qLabels[quarter] || qLabels[1];
        
        targetLabel.textContent = `Q${quarter} · ${months[0]} – ${months[1]} ${year}`;
    }

    function updateStats(summary, dcpList) {
        // We only target the first number now
        document.getElementById('stat-doctors').innerHTML = `${summary.total_doctors}`;
        document.getElementById('stat-visits').textContent = summary.total_visits || 0;
        document.getElementById('stat-pharmacies').innerHTML = `${summary.total_pharmacies}`;
    }

    function renderBreakdown(dcpList) {
    // Check your Browser Console for these logs
    console.log("Rendering Breakdown with data:", dcpList);

    const container = document.getElementById('accordion-container');
    if (!container) return;

    const doctorMap = {};
    const pharmacyMap = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    dcpList.forEach(entry => {
        // Use the exact casing from the backend
        const isPharma = entry.record_type === 'Pharmacy';
        const name = entry.display_name;
        const id = entry.cds_id;
        
        const map = isPharma ? pharmacyMap : doctorMap;

        if (!map[id]) {
            map[id] = { name: name, dates: [], recordType: entry.record_type };
        }
        if (entry.dcp_date) map[id].dates.push(entry.dcp_date);
    });

    container.innerHTML = '';

    const renderGroup = (map, groupLabel) => {
        const keys = Object.keys(map);
        if (keys.length === 0) return;
        
        const label = document.createElement('p');
        label.className = 'group-label';
        label.textContent = groupLabel;
        container.appendChild(label);

        // Sort alphabetically by name
        keys.sort((a, b) => map[a].name.localeCompare(map[b].name)).forEach(id => {
            const { name, dates, recordType } = map[id];
            const monthBuckets = {};
            
            // Group dates by month
            dates.forEach(raw => {
                const d = new Date(raw);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                if (!monthBuckets[key]) {
                    monthBuckets[key] = { label: monthNames[d.getMonth()], days: new Set() };
                }
                monthBuckets[key].days.add(d.getDate());
            });

            const rowsHtml = Object.keys(monthBuckets).sort().map(key => {
                const { label: mLabel, days } = monthBuckets[key];
                const sortedDays = Array.from(days).sort((a, b) => a - b);
                return `
                    <div class="visit-row">
                        <span class="month">${mLabel}</span>
                        <div class="dates-wrapper">
                            <span class="dates-sublabel">DATES</span>
                            <div class="date-chips">${sortedDays.map(d => `<span class="chip">${d}</span>`).join('')}</div>
                        </div>
                        <span class="freq-label"><b>${sortedDays.length}x</b> visits</span>
                    </div>`;
            }).join('');

            const item = document.createElement('div');
            item.className = 'accordion-item';
            item.innerHTML = `
                <div class="accordion-header" onclick="toggleAccordion(this, '${name.replace(/'/g, "\\'")}', JSON.parse(this.dataset.dates), '${recordType}')" data-dates='${JSON.stringify(dates)}'>
                    <span class="doctor-name">${name}</span>
                    <i class="fa fa-chevron-down"></i>
                </div>
                <div class="accordion-content">
                    <div class="month-rows-container">${rowsHtml}</div>
                    <div class="total-footer">
                        <span>TOTAL VISITS</span>
                        <span class="bold-total">${dates.length} visits</span>
                    </div>
                </div>`;
            container.appendChild(item);
        });
    };

    // Render both sections
    renderGroup(doctorMap, 'DOCTORS');
    renderGroup(pharmacyMap, 'PHARMACIES');
}

    async function initSummary() {
        if (!empId) return;
        try {
            const data = await API.fetchSummary(empId, quarter, year);
            document.getElementById('display-name').innerText = data.medrep?.name || "Unknown Representative";
            document.getElementById('display-location').innerText = data.medrep?.area || "N/A";
            allDcpList = data.dcp_list || [];
            computePeriodPill(allDcpList);
            updateStats(data.summary, allDcpList);
            renderBreakdown(allDcpList);
        } catch (err) {
            console.error("Fetch failed:", err);
        }
    }

    initSummary();
});