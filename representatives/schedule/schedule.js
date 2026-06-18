document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. CONFIG & STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    // Accept multiple parameter names to prevent navigation bugs
    const urlRepId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('rep_id');
    let selectedRepId = urlRepId;
    let selectedRepName = urlParams.get('name') || "Medical Representative"; // Global for access in modal and header
    let selectedRepArea = urlParams.get('area') || "Assignment Area"; // Global for access in modal and header
    
    // Check for return date from document page (supports both 'returnDate' and 'date' param keys)
    let returnDateParam = urlParams.get('returnDate') || urlParams.get('date');
    // Fallback: if URL was cleaned, try sessionStorage (active_doc_data)
    if (!returnDateParam) {
        try {
            const docStored = JSON.parse(sessionStorage.getItem('active_doc_data') || '{}');
            if (docStored && docStored.date) returnDateParam = docStored.date;
        } catch (e) {
            console.warn('Could not parse active_doc_data for return date', e);
        }
    }

    // Restore representative state from session storage when the URL does not provide it
    const storedRepJson = sessionStorage.getItem('active_rep_data');
    const storedRep = storedRepJson ? JSON.parse(storedRepJson) : {};
    if (!selectedRepId && storedRep.id) {
        selectedRepId = storedRep.id;
        selectedRepName = storedRep.name || selectedRepName;
        selectedRepArea = storedRep.area || selectedRepArea;
    }

    if (selectedRepId) {
        sessionStorage.setItem('active_rep_data', JSON.stringify({
            id: selectedRepId,
            name: selectedRepName,
            area: selectedRepArea
        }));
    }

    // Clean the URL after reading params so later navigation uses session state
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
        
    let globalScheduleData = []; 
    let currentMonthIndex = 3;    // Initial default
    let currentYear = new Date().getFullYear();
    const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
    
    const calendarGrid = document.querySelector('.calendar-grid');
    const monthDisplay = document.querySelector('.date-label');
    const searchInput = document.querySelector('.search-input-wrapper input');

    // Update UI Header immediately from URL params
    const repNameHeaderInit = document.getElementById('repNameHeader') || document.getElementById('rep-name'); 
    const repAreaHeaderInit = document.getElementById('repAreaHeader') || document.getElementById('rep-location'); 
    if (repNameHeaderInit) repNameHeaderInit.textContent = selectedRepName;
    if (repAreaHeaderInit) repAreaHeaderInit.textContent = selectedRepArea;

    // --- 1.5 BACK BUTTON LOGIC ---
    const backBtn = document.getElementById('goBack') || document.querySelector('.back-btn');
    if (backBtn) {
        // Remove inline onclick if present to avoid dual triggers
        backBtn.onclick = null;
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Let browser history handle the back transition if possible.
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            // Fallback to the representative details page with clean session-backed state.
            window.location.href = `../representative_details/representative_details.html`;
        });
    }

    // --- 2. BACKEND FETCH ---
    async function loadSchedule() {
        if (!selectedRepId) {
            console.error("No Representative ID found in URL.");
            return;
        }

        console.log(`DEBUG: Initializing schedule fetch for Rep ID: ${selectedRepId}`);

        // Fetch representative details first to display their name/area
        try {
            const allRepsResult = await API.fetchMedreps();
            console.log("DEBUG: allRepsResult from fetchMedreps():", allRepsResult);
            if (allRepsResult && (allRepsResult.success || Array.isArray(allRepsResult))) {
                let reps = allRepsResult.data || allRepsResult.medreps || allRepsResult.representatives || allRepsResult;
                if (!Array.isArray(reps)) {
                    reps = Object.keys(allRepsResult)
                        .filter(key => !isNaN(key))
                        .sort((a, b) => Number(a) - Number(b))
                        .map(key => allRepsResult[key]);
                }

                const repsArray = Array.isArray(reps) ? reps : [];
                const foundRep = repsArray.find(rep => 
                    String(rep.uuid || '') === String(selectedRepId) || 
                    String(rep.uui || '') === String(selectedRepId) || 
                    String(rep.employee_id || '') === String(selectedRepId) || 
                    String(rep.user_id || '') === String(selectedRepId) || 
                    String(rep.id || '') === String(selectedRepId)
                );

                if (foundRep) {
                    console.log("DEBUG: Found representative metadata:", foundRep);
                    const f = foundRep.first_name || foundRep.FirstName || '';
                    const l = foundRep.last_name || foundRep.LastName || '';
                    selectedRepName = `${f} ${l}`.trim() || "Medical Representative";
                    selectedRepArea = foundRep.area || 'Assignment Area';
                } else {
                    console.warn(`DEBUG: Rep ID ${selectedRepId} not found in fetchMedreps() list.`);
                }
            }

            // Try both camelCase and kebab-case to ensure UI updates
            const repNameHeader = document.getElementById('repNameHeader') || document.getElementById('rep-name'); 
            const repAreaHeader = document.getElementById('repAreaHeader') || document.getElementById('rep-location'); 
            
            if (repNameHeader) {
                repNameHeader.textContent = selectedRepName;
                console.log("DEBUG: UI Updated repNameHeader to:", selectedRepName);
            }
            if (repAreaHeader) {
                repAreaHeader.textContent = selectedRepArea;
            }
        } catch (err) {
            console.error("Error fetching representative details:", err);
        }

        try {
            const result = await API.fetchScheduleByRep(selectedRepId);
            
            if (result) {
                console.log(`DEBUG: Received schedule for Rep ID: ${selectedRepId}`);
                let rawData = result.data || result;
                const items = Array.isArray(rawData) ? rawData : [];

                // Only display visits that belong to an APPROVED Daily Call Plan (DCP)
                globalScheduleData = items.filter(item => 
                    (item.status || item.dcp_status || '').toLowerCase() === 'approved'
                );
                
                console.log("DEBUG: Full JSON result from schedule API:", result);
                if (Array.isArray(globalScheduleData) && globalScheduleData.length > 0) {
                    const firstItem = globalScheduleData[0];
                    console.log("DEBUG: First data item keys:", Object.keys(firstItem));
                    console.log("DEBUG: First data item sample:", firstItem);

                    const hasTargetId = firstItem.cds_id || (firstItem.cds && firstItem.cds.id) || firstItem.dcp_id;
                    if (!hasTargetId) {
                        console.warn("DEBUG: No Doctor/Pharmacy ID (cds_id or cds.id) detected in schedule items.");
                    }
                    if (!getNormalizedItemDate(firstItem)) {
                        console.error("CRITICAL: No date field found in data items. Calendar rendering will fail!");
                    }
                }

                window._debug = globalScheduleData;

                const monthEl = document.getElementById('monthName');
                const yearEl = document.getElementById('yearNumber');
                const prevBtn = document.getElementById('prevMonth');
                const nextBtn = document.getElementById('nextMonth');

                if (globalScheduleData.length === 0) {
                    // If no approved data, replace month/year with "No Schedule"
                    if (calendarGrid) calendarGrid.style.display = 'none';
                    if (monthEl) monthEl.textContent = "No Schedule";
                    if (yearEl) yearEl.textContent = "";
                    if (prevBtn) prevBtn.disabled = true;
                    if (nextBtn) nextBtn.disabled = true;
                    if (searchInput) {
                        searchInput.disabled = true;
                        searchInput.placeholder = "No schedule available";
                    }
                } else {
                    // 1. Extract all valid dates
                    const validDates = globalScheduleData
                        .map(item => new Date(getNormalizedItemDate(item)))
                        .filter(d => !isNaN(d.getTime()))
                        .sort((a, b) => a - b);

                    if (validDates.length > 0) {
                        if (returnDateParam) {
                            const d = new Date(returnDateParam);
                            currentMonthIndex = d.getMonth();
                            currentYear = d.getFullYear();
                        } else {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            // Land on closest future date, or the latest available record if all are in the past
                            const target = validDates.find(d => d >= today) || validDates[validDates.length - 1];
                            currentMonthIndex = target.getMonth();
                            currentYear = target.getFullYear();
                        }
                        console.log(`🚀 Landing on data for: ${monthNames[currentMonthIndex]} ${currentYear}`);
                    }

                    if (calendarGrid) calendarGrid.style.display = 'grid';
                    if (searchInput) {
                        searchInput.disabled = false;
                        searchInput.placeholder = "Search doctor or pharmacy...";
                    }
                    updateNavigationAndRender();
                }

                if (returnDateParam) {
                    const autoSelectedData = globalScheduleData.filter(item => getNormalizedItemDate(item) === returnDateParam);
                    
                    if (autoSelectedData.length > 0) {
                        requestAnimationFrame(() => {
                            const dateObj = new Date(returnDateParam + 'T00:00:00');
                            const d = dateObj.getDate();
                            const m = dateObj.getMonth();
                            const y = dateObj.getFullYear();
                            openDateModal(d, m, y);

                            // Clean up returnDate/date from URL but keep other params intact
                            const cleanParams = new URLSearchParams(window.location.search);
                            cleanParams.delete('returnDate');
                            cleanParams.delete('date');
                            window.history.replaceState({}, '', window.location.pathname + '?' + cleanParams.toString());
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Schedule Load Error:", err);
        }
    }

    /**
     * Updates navigation button states and renders the calendar.
     * Disables buttons if no approved data exists for the adjacent months.
     */
    function updateNavigationAndRender() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    // Find ANY data that exists before the current month/year
    const hasPrev = globalScheduleData.some(item => {
        const d = new Date(getNormalizedItemDate(item));
        return (d.getFullYear() < currentYear) || 
               (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex);
    });

    // Find ANY data that exists after the current month/year
    const hasNext = globalScheduleData.some(item => {
        const d = new Date(getNormalizedItemDate(item));
        return (d.getFullYear() > currentYear) || 
               (d.getFullYear() === currentYear && d.getMonth() > currentMonthIndex);
    });

    if (prevBtn) prevBtn.disabled = !hasPrev;
    if (nextBtn) nextBtn.disabled = !hasNext;

    renderCalendar(currentMonthIndex, currentYear);
}


    // Helper to extract and normalize date from a record
    function getNormalizedItemDate(item) {
        // Try common date keys
        let raw = item.dcp_date || item.DCP_DATE || item.date || item.Date || 
                  item.visit_date || item.scheduled_date || item.visitDate || item.DCP_Date;
        
        // Fallback: search for any key containing "date"
        if (!raw) {
            const autoKey = Object.keys(item).find(k => k.toLowerCase().includes('date'));
            if (autoKey) {
                raw = item[autoKey];
                console.log(`DEBUG: Auto-detected date key "${autoKey}" with value:`, raw);
            }
        }

        if (!raw) return null;
        
        // Extract YYYY-MM-DD part using regex to handle variations (ISO T, spaces, or timestamps)
        const match = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
    }

    // --- 4. CALENDAR RENDER ---
    function renderCalendar(month, year) {
        if (!calendarGrid) return;
        
        const dayHeaders = Array.from(calendarGrid.querySelectorAll('.day-name'));
        calendarGrid.innerHTML = '';
        dayHeaders.forEach(h => calendarGrid.appendChild(h));

        // Update month/year display
        const monthEl = document.getElementById('monthName');
        const yearEl = document.getElementById('yearNumber');
        if (monthEl) monthEl.textContent = monthNames[month];
        if (yearEl) yearEl.textContent = year;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        today.setHours(0, 0, 0, 0);

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
            
            const currentTargetDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            const visit = (globalScheduleData || []).find(item => {
                const dbDate = getNormalizedItemDate(item);
                return dbDate === currentTargetDate;
            });

            dateDiv.innerHTML = `<span class="date-number">${d}</span>`;

            if (visit) {
                dateDiv.classList.add('has-visit');

                // ── CALENDAR DOT: status → color class ──────────────
                const vStat = (visit.visit_status || '').toLowerCase().trim();

                if (vStat === 'complete' || vStat === 'completed' || vStat === 'signed') {
                    dateDiv.classList.add('dot-complete');
                } else if (vStat === 'advance' || vStat === 'advanced') {
                    dateDiv.classList.add('dot-advance');
                } else if (vStat.includes('make up') || vStat.includes('makeup')) {
                    dateDiv.classList.add('dot-makeup');
                } else if (vStat.includes('missed')) {
                    dateDiv.classList.add('dot-missed');
                } else if (vStat === 'mia') {
                    dateDiv.classList.add('dot-mia');
                } else if (vStat === 'rejected') {
                    dateDiv.classList.add('dot-rejected');
                }
                // null/empty → default grey dot via .has-visit::after in CSS
            }

            // Highlight the day that was last selected (returned from document page)
            if (returnDateParam) {
                const returnD = new Date(returnDateParam + 'T00:00:00');
                if (returnD.getFullYear() === year && returnD.getMonth() === month && returnD.getDate() === d) {
                    dateDiv.classList.add('selected-day');
                }
            }

            dateDiv.onclick = () => openDateModal(d, month, year);
            calendarGrid.appendChild(dateDiv);
        }
    }

    // --- 5. MODAL LOGIC (window attached) ---
    window.openDateModal = (day, month, year) => {
    const modal = document.getElementById('dateModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalDateTitle');
    
    const fullDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const clickedDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    clickedDate.setHours(0, 0, 0, 0);
    
    const isToday = clickedDate.getTime() === today.getTime();
    const isPast = clickedDate < today;
    const isFuture = clickedDate > today;

    // selectedRepName should be defined globally
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = dayNames[new Date(year, month, day).getDay()];
    modalTitle.innerText = `${monthNames[month]} ${day}, ${year} - ${dayName}`;
    modalBody.innerHTML = '';

    const visits = globalScheduleData.filter(item => {
        const dbDate = getNormalizedItemDate(item);
        return dbDate === fullDateString;
    });

    if (visits.length === 0) {
        modalBody.innerHTML = `<p style="text-align:center; padding:20px; color:#666;">No visits scheduled.</p>`;
    } else {
        const sortOrder = {
            'pending':      0,
            'advance':      1,
            'advanced':     1,
            'complete':     2,
            'completed':    2,
            'signed':       2,
            'make up call': 3,
            'makeup call':  3,
            'mia':          4,
            'rejected':     5,
        };

        const sorted = [...visits].sort((a, b) => {
            const getOrder = (item) => {
                const vs = (item.visit_status || '').toLowerCase().trim();
                if (!vs || vs === 'null') return 0; // null/empty = Pending, always top
                if (vs.includes('make up') || vs.includes('makeup')) return 3;
                return sortOrder[vs] ?? 0;
            };
            return getOrder(a) - getOrder(b);
        });

        const currentSearchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

        // Helper: Proper Case (Title Case)
        const toTitleCase = (str) => {
            if (!str || str === 'EMPTY') return '';
            return str.toLowerCase().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };

        sorted.forEach(item => {
            const row = document.createElement('div');
            row.className = 'doctor-row';

            let displayName = '';
            let displaySub = '';
            let initial = '';

            // --- 1. Identify Record Type & Map Fields ---
            const recordType = (item.RecordType || item.record_type || item.type || '').toLowerCase();
            const isPharmacy = recordType === 'pharmacy' || !!item.pharmacy_name;

            if (!isPharmacy) {
                // DOCTOR LOGIC
                let rawDocName = item.doctor_name || item.Doctor_Name || item.name || item.Full_Name || 'Unknown Doctor';
                // Strip "Dr." if it exists so we don't double it up
                const cleanName = toTitleCase(rawDocName.replace(/^dr\.?\s*/i, '')); 
                
                displayName = `Dr. ${cleanName}`;
                initial = cleanName.charAt(0).toUpperCase();

                // --- Updated Specialty/Area Logic to remove "General"[cite: 10] ---
                const rawSpecialty = item.Specs || item.specialty || '';
                const area = item.area || item.Area || item.hospital_name || 'N/A';
                
                if (!rawSpecialty || rawSpecialty.toLowerCase() === 'general' || rawSpecialty === 'EMPTY') {
                    displaySub = area; // Only show area if specialty is General
                } else {
                    displaySub = `${toTitleCase(rawSpecialty)} - ${area}`;
                }

                // If a pharmacy is attached to a doctor visit, append it
                const attachedPhar = item.pharmacy_name || item.Pharmacy_Name;
                if (attachedPhar) {
                    displaySub += ` @ ${toTitleCase(attachedPhar)}`;
                }

            } else {
                // PHARMACY LOGIC
                let rawPharName = item.pharmacy_name || item.Pharmacy_Name || item.name || 'Unknown Pharmacy';
                displayName = toTitleCase(rawPharName);
                initial = displayName.charAt(0).toUpperCase();
                
                // Subtitle for Pharmacies uses City/Address
                displaySub = item.city || item.City_Address_Province || 'N/A';
            }

            // --- 2. Search Highlighting ---
            if (currentSearchQuery) {
                if (displayName.toLowerCase().includes(currentSearchQuery)) {
                    row.classList.add('search-highlight');
                } else {
                    row.classList.add('search-dim');
                }
            }

            // --- 3. Status Button Logic ---
            let statusHtml = '';
            const vStat = (item.visit_status || '').toLowerCase().trim();

            if (vStat === 'complete' || vStat === 'completed' || vStat === 'signed') {
                statusHtml = `<button class="status-btn complete">Complete</button>`;
            } else if (vStat === 'advance' || vStat === 'advanced') {
                statusHtml = `<button class="status-btn advance">Advance</button>`;
            } else if (vStat.includes('make up') || vStat.includes('makeup')) {
                statusHtml = `<button class="status-btn makeup">Make Up Call</button>`;
            } else if (vStat.includes('missed')) {
                statusHtml = `<button class="status-btn missed">Missed Call</button>`;
            } else if (vStat === 'mia') {
                statusHtml = `<button class="status-btn mia">MIA</button>`;
            } else if (vStat === 'rejected') {
                statusHtml = `<button class="status-btn rejected">Rejected</button>`;
            } else {
                statusHtml = `<button class="status-btn pending">Pending</button>`;
            }

            row.innerHTML = `
                <div class="doc-identity">
                    <div class="doc-avatar">${initial}</div>
                    <div class="user-info-stack">
                        <span class="name-label" style="font-size:16px; font-weight:600;">${displayName}</span>
                        <span class="area-label">${displaySub}</span>
                    </div>
                </div>
                <div class="doc-action" style="display:flex; align-items:center; gap:10px;">
                    ${statusHtml}
                    <span class="arrow-icon">▶</span>
                </div>
            `;

            // attach cds id for later programmatic selection/scroll
            try {
                const _cds = item.cds_id || (item.cds && item.cds.id);
                if (_cds) row.dataset.cdsId = _cds;
            } catch (e) {}

            row.onclick = () => {
                const targetId = item.cds_id || (item.cds && item.cds.id);

                if (!targetId) {
                    console.error("Missing unique identifier:", item);
                    alert("Error: Missing Unique Identifier (cds_id) for this visit.");
                    return;
                }

                const dateValue = item.date || item.dcp_date || fullDateString;
                const dcpId = item.dcp_id || item.DCP_ID || '';

                // Save visit/document context to sessionStorage and navigate with a clean URL
                try {
                    sessionStorage.setItem('active_doc_data', JSON.stringify({
                        cds_id: targetId,
                        date: dateValue,
                        dcp_id: dcpId,
                        scrollTop: (typeof modalBody !== 'undefined' && modalBody) ? modalBody.scrollTop : 0
                    }));
                } catch (e) {
                    console.warn('Could not write active_doc_data to sessionStorage', e);
                }

                window.location.href = 'document/document.html';
            };

            modalBody.appendChild(row);
        });
    }
    // If session had an active_doc_data cds_id, highlight and scroll to it
    try {
        const stored = JSON.parse(sessionStorage.getItem('active_doc_data') || '{}');
        if (stored && stored.cds_id) {
            // Wait a frame so the modal content/layout stabilizes before restoring scroll
            requestAnimationFrame(() => {
                try {
                    if (typeof stored.scrollTop !== 'undefined' && stored.scrollTop !== null) {
                        modalBody.scrollTop = stored.scrollTop;
                    }
                    const targetRow = modalBody.querySelector(`[data-cds-id="${stored.cds_id}"]`);
                    if (targetRow) {
                        targetRow.classList.add('selected-visit');
                        // Only scrollIntoView when no explicit scrollTop was saved
                        if (typeof stored.scrollTop === 'undefined' || stored.scrollTop === null) {
                            targetRow.scrollIntoView({ block: 'center', behavior: 'auto' });
                        }
                    }
                } catch (innerErr) {
                    console.warn('Error applying stored scroll/selection', innerErr);
                }
                // Clear the active doc data so it doesn't re-open every time
                try { sessionStorage.removeItem('active_doc_data'); } catch (e) {}
            });
        }
    } catch (e) {
        console.warn('Could not apply active_doc_data selection in modal', e);
    }

    modal.style.display = 'flex';
    modal.classList.add('active');
};

    // UI Listeners
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const modal = document.getElementById('dateModal');
            modal.style.display = 'none';
            modal.classList.remove('active');
        };
    }

    // --- 6. SEARCH FUNCTIONALITY ---

    function applySearchHighlight() {
        if (!searchInput) return;
        const query = searchInput.value.trim().toLowerCase();
        const allDateItems = document.querySelectorAll('.date-item:not(.empty)');

        if (!query) {
            allDateItems.forEach(item => item.classList.remove('search-highlight', 'search-dim'));
            return;
        }

        allDateItems.forEach(item => {
            const dateNum = item.querySelector('.date-number');
            if (!dateNum) return;
            const d = parseInt(dateNum.textContent);
            const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasMatch = globalScheduleData.some(visit => {
                const visitDate = getNormalizedItemDate(visit);
                if (visitDate !== dateStr) return false;

                const recType = (visit.RecordType || visit.record_type || visit.type || '').toLowerCase();

                // Resolve Doctor Name (including first/last name support)
                let dName = (visit.doctor_name || visit.Doctor_Name || visit.doctor || visit.Doctor || visit.Full_Name || '').toLowerCase();
                if (!dName && visit.first_name) {
                    dName = `${visit.first_name} ${visit.last_name || ''}`.trim().toLowerCase();
                }
                if (!dName && recType !== 'pharmacy') {
                    dName = (visit.name || '').toLowerCase();
                }

                // Resolve Pharmacy Name
                const pName = (visit.pharmacy_name || visit.Pharmacy_Name || visit.pharmacy || visit.Pharmacy || 
                              (recType === 'pharmacy' ? (visit.name || '') : '')).toLowerCase();

                const specialty = (visit.Specs || visit.specialty || '').toLowerCase();

                return dName.includes(query) || pName.includes(query) || specialty.includes(query);
            });
            if (hasMatch) {
                item.classList.add('search-highlight');
                item.classList.remove('search-dim');
            } else {
                item.classList.add('search-dim');
                item.classList.remove('search-highlight');
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', applySearchHighlight);
    }

    document.getElementById('prevMonth').onclick = () => {
    const available = globalScheduleData
        .map(item => new Date(getNormalizedItemDate(item)))
        .filter(d => (d.getFullYear() < currentYear) || (d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex))
        .sort((a, b) => b - a); // Get closest previous date

    if (available.length > 0) {
        currentMonthIndex = available[0].getMonth();
        currentYear = available[0].getFullYear();
        updateNavigationAndRender();
        applySearchHighlight();
    }
};

    document.getElementById('nextMonth').onclick = () => {
        const available = globalScheduleData
            .map(item => new Date(getNormalizedItemDate(item)))
            .filter(d => (d.getFullYear() > currentYear) || (d.getFullYear() === currentYear && d.getMonth() > currentMonthIndex))
            .sort((a, b) => a - b); // Get closest future date

        if (available.length > 0) {
            currentMonthIndex = available[0].getMonth();
            currentYear = available[0].getFullYear();
            updateNavigationAndRender();
            applySearchHighlight();
        }
    };

    // Load schedule data and check request alert dot in parallel
    await loadSchedule();
});