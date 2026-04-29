document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. CONFIG & STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    // Accept multiple parameter names to prevent navigation bugs
    const selectedRepId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('rep_id'); 
    let selectedRepName = urlParams.get('name') || "Medical Representative"; // Global for access in modal and header
    let selectedRepArea = urlParams.get('area') || "Assignment Area"; // Global for access in modal and header
    
    // Check for return date from document page
    const returnDateParam = urlParams.get('returnDate');
        
    let globalScheduleData = []; 
    let currentMonthIndex = 3;    // Initial default
    const currentYear = 2026;
    const monthNames = ["January", "February", "March", "April", "May", "June"];
    
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
            if (!selectedRepId) {
                window.history.back();
                return;
            }
            const query = new URLSearchParams({
                id: selectedRepId,
                name: selectedRepName,
                area: selectedRepArea
            }).toString();
            window.location.href = `../representative_details/representative_details.html?${query}`;
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
                    // Calculate the range of available data
                    const availableMonths = [...new Set(globalScheduleData.map(item => {
                        const d = new Date(getNormalizedItemDate(item));
                        return d.getMonth(); // Using month index for 2026
                    }))].sort((a, b) => a - b);

                    // Set initial view to the first month that actually has data
                    if (availableMonths.length > 0) {
                        currentMonthIndex = availableMonths[0];
                    }

                    if (calendarGrid) calendarGrid.style.display = 'grid';
                    if (searchInput) {
                        searchInput.disabled = false;
                        searchInput.placeholder = "Search doctor or pharmacy...";
                    }
                    updateNavigationAndRender();
                }

                if (returnDateParam) {
                    const autoSelectedData = globalScheduleData.filter(item => item.dcp_date === returnDateParam);
                    
                    if (autoSelectedData.length > 0) {
                        requestAnimationFrame(() => {
                            const dateObj = new Date(returnDateParam);
                            const formattedTitle = dateObj.toLocaleDateString('en-US', { 
                                month: 'long', 
                                day: 'numeric', 
                                year: 'numeric' 
                            });
                            
                            // Use correct function name
                            const d = dateObj.getDate();
                            const m = dateObj.getMonth();
                            const y = dateObj.getFullYear();
                            openDateModal(d, m, y);

                            const newUrl = window.location.pathname + `?id=${selectedRepId}`;
                            window.history.replaceState({}, '', newUrl);
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

        const hasPrev = globalScheduleData.some(item => {
            const d = new Date(getNormalizedItemDate(item));
            return d.getMonth() === currentMonthIndex - 1 && d.getFullYear() === currentYear;
        });

        const hasNext = globalScheduleData.some(item => {
            const d = new Date(getNormalizedItemDate(item));
            return d.getMonth() === currentMonthIndex + 1 && d.getFullYear() === currentYear;
        });

        if (prevBtn) prevBtn.disabled = !hasPrev;
        if (nextBtn) nextBtn.disabled = !hasNext;

        // If the current month index somehow has no data, month display logic 
        // still works but cards will simply not appear in the grid.
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

        if (!raw) {
            return null;
        }
        
        const datePart = String(raw).split('T')[0].trim();
        const parts = datePart.split('-'); // Expecting YYYY-MM-DD
        if (parts.length !== 3) return datePart;
        
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
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

                const vStat = (visit.visit_status || '').toLowerCase().trim();
                let statusClass = 'status-pending'; // Default for null/empty/pending

                if (vStat === 'complete' || vStat === 'completed') {
                    statusClass = 'status-complete';
                } else if (vStat === 'advance') {
                    statusClass = 'status-advance';
                }

                const statusBar = document.createElement('div');
                statusBar.className = `status-bar ${statusClass}`;
                dateDiv.appendChild(statusBar);
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

        modalTitle.innerText = `${monthNames[month]} ${day}, ${year} - ${selectedRepName}`;
        modalBody.innerHTML = '';

        const visits = globalScheduleData.filter(item => {
            const dbDate = getNormalizedItemDate(item);
            const match = dbDate === fullDateString;
            
            // Log a sample of the comparison to see why it might be failing
            if (dbDate && !match && Math.random() < 0.01) { 
                console.log(`DEBUG: Comparison mismatch - DB: "${dbDate}" vs Calendar: "${fullDateString}"`);
            }
            return match;
        });
        console.log(`DEBUG: Total global items: ${globalScheduleData.length}. Visits found for ${fullDateString}:`, visits);

        if (visits.length === 0) {
            modalBody.innerHTML = `<p style="text-align:center; padding:20px; color:#666;">No visits scheduled.</p>`;
        } else {
            const sortOrder = { 'pending': 0, 'complete': 1, 'completed': 1, 'advance': 2 };

            const sorted = [...visits].sort((a, b) => {
                const getOrder = (item) => {
                    if (isFuture) return 0;
                    const vs = (item.visit_status || '').toLowerCase();
                    if (vs === null || vs === '' || vs === 'null') return 0;
                    return sortOrder[vs] ?? 0;
                };
                return getOrder(a) - getOrder(b);
            });

            const currentSearchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

            sorted.forEach(item => {
                console.log("DEBUG: Rendering Visit Item. Full JSON object:", item);
                console.log("DEBUG: Keys available in this visit:", Object.keys(item));

                const row = document.createElement('div');
                row.className = 'doctor-row';

                // --- 1. Robust Name Retrieval (Handles common key variations) ---
                const recordType = (item.RecordType || item.record_type || item.type || '').toLowerCase();
                const pharName = item.Pharmacy_Name || item.pharmacy_name || item.pharmacy || item.Pharmacy || 
                                 (recordType === 'pharmacy' ? item.name : '');
                
                let docName = item.doctor_name || item.Doctor_Name || item.doctor || item.Doctor || item.Full_Name;
                
                // Support first_name / last_name from your sample data
                if (!docName && item.first_name) {
                    docName = `${item.first_name} ${item.last_name || ''}`.trim();
                }
                if (!docName && recordType !== 'pharmacy') {
                    docName = item.name;
                }
                
                const hasDoc = docName && docName.toLowerCase() !== 'unknown' && docName.trim() !== '';
                const hasPhar = pharName && pharName.toLowerCase() !== 'unknown' && pharName.trim() !== '';

                let displayName = '';
                let displaySub = '';
                let initial = '';

                // --- 2. Combined Display Logic ---
                if (hasDoc) {
                    const rawName = docName.trim();
                    displayName = (rawName.toLowerCase().startsWith('dr.') || rawName.toLowerCase().startsWith('dr ')) 
                        ? rawName : `Dr. ${rawName}`;
                    
                    const specialty = item.Specs || item.specialty || 'General';
                    const loc = item.hospital_name || item.hospital || item.area || item.Area || 'N/A';
                    
                    // Display both: Doctor as primary, Pharmacy in the subtitle
                    displaySub = hasPhar ? `${specialty} @ ${pharName}` : `${specialty} - ${loc}`;
                    initial = (displayName.startsWith('Dr. ') ? displayName.substring(4) : displayName).charAt(0).toUpperCase();
                } else if (hasPhar) {
                    displayName = pharName;
                    displaySub = item.City_Address_Province || item.city_address_province || item.city || 'N/A';
                    initial = displayName.charAt(0).toUpperCase();
                } else {
                    console.warn("DEBUG: Found record but could not determine Name. Raw Item:", item);
                    displayName = 'Unknown Entity';
                    displaySub = 'N/A';
                    initial = 'U';
                }

                // --- Highlight matching card if search is active ---
                if (currentSearchQuery) {
                    if (displayName.toLowerCase().includes(currentSearchQuery)) {
                        row.classList.add('search-highlight');
                    } else {
                        row.classList.add('search-dim');
                    }
                }

                let statusHtml = '';
                const vStat = (item.visit_status || '').toLowerCase().trim();

                if (vStat === 'complete' || vStat === 'completed') {
                    statusHtml = `<button class="status-btn completed">Complete</button>`;
                } else if (vStat === 'advance') {
                    statusHtml = `<button class="status-btn advance">Advance</button>`;
                } else {
                    // Default to Pending if NULL, 'null', or empty
                    statusHtml = `<button class="status-btn pending">Pending</button>`;
                }

                row.innerHTML = `
                    <div class="doc-identity">
                        <div class="doc-avatar">${initial}</div>
                        <div class="user-info-stack">
                            <span class="name-label" style="font-size:16px;">${displayName}</span>
                            <span class="area-label">${displaySub}</span>
                        </div>
                    </div>
                    <div class="doc-action" style="display:flex; align-items:center; gap:10px;">
                        ${statusHtml}
                        <span class="arrow-icon">▶</span>
                    </div>
                `;

                row.onclick = () => {
                    // Resolve the target ID using cds_id or nested cds.id as requested
                    const targetId = item.cds_id || (item.cds && item.cds.id) || item.dcp_id || item.uuid;

                    if (!targetId) {
                        console.error("Missing unique identifier (cds_id or cds.id):", item);
                        alert("Error: Missing Unique Identifier for this visit.");
                        return;
                    }

                    const repId = selectedRepId;
                    const dateValue = item.dcp_date || item.date || "";

                    window.location.href =
                        `document/document.html?cds_id=${targetId}&user_id=${repId}&date=${encodeURIComponent(dateValue)}`;
                };
                modalBody.appendChild(row);
            });
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
        if (currentMonthIndex > 0) {
            currentMonthIndex--;
            updateNavigationAndRender();
            applySearchHighlight();
        }
    };

    document.getElementById('nextMonth').onclick = () => {
        if (currentMonthIndex < 11) {
            currentMonthIndex++;
            updateNavigationAndRender();
            applySearchHighlight();
        }
    };

    // Load schedule data and check request alert dot in parallel
    await loadSchedule();
});