document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedRepId =
        urlParams.get('id') ||
        urlParams.get('user_id') ||
        urlParams.get('rep_id');

    let repName = 'Medical Representative';
    let repArea = 'Assignment Area';

    // ============================
    // LOAD REP INFO
    // ============================
    if (selectedRepId) {
        try {
            const allRepsResult = await API.fetchMedreps();

            if (allRepsResult) {
                let reps =
                    allRepsResult.data ||
                    allRepsResult.medreps ||
                    allRepsResult.representatives ||
                    allRepsResult;

                if (!Array.isArray(reps)) {
                    reps = Object.keys(reps).filter(k => !isNaN(k)).map(k => reps[k]);
                }

                const foundRep = reps.find(rep =>
                    String(rep.uuid || '') === String(selectedRepId) ||
                    String(rep.uui || '') === String(selectedRepId) ||
                    String(rep.id || '') === String(selectedRepId) ||
                    String(rep.user_id || '') === String(selectedRepId) ||
                    String(rep.employee_id || '') === String(selectedRepId)
                );

                if (foundRep) {
                    const f = foundRep.first_name || '';
                    const l = foundRep.last_name || '';
                    repName = `${f} ${l}`.trim() || repName;
                    repArea = foundRep.area || repArea;
                }
            }
        } catch (err) {
            console.error('Error fetching rep:', err);
        }
    }

    // Apply to UI
    ['home', 'masterlist', 'callplan'].forEach(screen => {
        const nameEl = document.getElementById(`rep-name-${screen}`);
        const areaEl = document.getElementById(`rep-location-${screen}`);
        if (nameEl) nameEl.textContent = repName;
        if (areaEl) areaEl.textContent = repArea;
    });

    if (selectedRepId) {
        const savedLogs = JSON.parse(localStorage.getItem(`masterlist_logs_${selectedRepId}`) || "[]");
        renderLogList(savedLogs);
    }

    document.getElementById('goBack-home')?.addEventListener('click', () => {
        const query = new URLSearchParams({
            id: selectedRepId,
            name: repName,
            area: repArea
        }).toString();

        window.location.href = `../../representative_details/representative_details.html?${query}`;
    });

    updateWarningCount();

    // Init year selector
    initDCPYear();

    // Init: lock drop zone until quarter is selected
    document.getElementById('dcpDropZone')?.classList.add('locked-zone');

    // Init quarter status buttons
    if (selectedRepId) {
        await initQuarterStatus(selectedRepId, getSelectedYear());
    }

    // ============================
    // DRAG & DROP FILE GUARD
    // ============================
    const dropZone = document.getElementById('dcpDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropZone.classList.contains('locked-zone')) return;

            const file = e.dataTransfer.files[0];
            if (!file) return;

            if (!isValidCSV(file)) {
                showFileTypeError(file.name);
                return;
            }

            // Inject into the file input and trigger selection handler
            const fileInput = document.getElementById('file-callplan');
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            onDCPFileSelected(fileInput);
        });
    }
});


// ============================
// FILE TYPE VALIDATION HELPERS
// ============================

/**
 * Returns true only if the file is a valid CSV.
 * Checks both MIME type and file extension.
 */
function isValidCSV(file) {
    const allowedMimes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
    const hasValidMime = allowedMimes.includes(file.type);
    const hasValidExt  = file.name.toLowerCase().endsWith('.csv');
    return hasValidMime || hasValidExt; // extension is the stronger check
}

function showFileTypeError(fileName) {
    const ext = fileName.includes('.') ? fileName.split('.').pop().toUpperCase() : 'Unknown';
    showStatusModal(
        "Invalid File Type",
        `"${fileName}" is a ${ext} file. Only CSV files are accepted here. Please export your call plan as a CSV and try again.`,
        '🚫'
    );
}


// ============================
// PENDING STATE TRACKERS
// ============================
let _pendingDCPFormData = null;
let _currentErrors = null;


// ============================
// DCP QUARTER STATUS LOGIC
// ============================

// Tracks which quarter is currently selected (for re-upload flow)  
window.currentSelectedQuarter = null;

async function initQuarterStatus(selectedRepId, year) {
    if (!selectedRepId) return;

    try {
        const response = await API.fetchDCPByRep(selectedRepId, year || getSelectedYear());
        console.log("🔍 DEBUG: Quarter Status Data Received:", response);

        const dcpData = Array.isArray(response) ? response : (response.data || []);
        
        const currentUIYear = parseInt(getSelectedYear()); 

        for (let q = 1; q <= 4; q++) {
            const btn = document.getElementById(`quarter-btn-${q}`);
            if (!btn) continue;

            // Reset UI state
            btn.className = 'quarter-status-btn';
            btn.innerHTML = `Q${q}`;
            btn.disabled = false;
            btn.onclick = () => selectQuarter(q);

            // Filter records for this Year and Quarter using dcp_date or explicit fields
            const quarterRecords = dcpData.filter(item => {
                let itemQ = parseInt(item.Quarter || item.quarter);
                let itemY = parseInt(item.Year || item.year || item.dcp_year);

                const dateVal = item.dcp_date || item.DCP_DATE || item.DCP_Date || item.date || item.created_at;
                if (dateVal) {
                    const dateMatch = String(dateVal).match(/^(\d{4})-(\d{2})-(\d{2})/);
                    if (dateMatch) {
                        itemY = parseInt(dateMatch[1], 10);
                        const month = parseInt(dateMatch[2], 10);
                        itemQ = Math.ceil(month / 3);
                    }
                }

                if (isNaN(itemY)) {
                    itemY = currentUIYear;
                }

                if (isNaN(itemQ)) {
                    return false;
                }

                return itemQ === q && itemY === currentUIYear;
            });

            const cleanedStatuses = quarterRecords.map(r => {
                const raw = (r.status || r.visit_status || '').toString().trim().toLowerCase();
                if (!raw || raw === 'na' || raw === 'n/a' || raw === 'none' || raw === 'null' || raw === 'undefined') {
                    return null;
                }
                return raw;
            }).filter(Boolean);

            let finalStatus = 'none';
            if (cleanedStatuses.includes('rejected')) {
                finalStatus = 'rejected';
            } else if (cleanedStatuses.includes('approved')) {
                finalStatus = 'approved';
            } else if (cleanedStatuses.includes('pending')) {
                finalStatus = 'pending';
            }

            if (finalStatus === 'none') {
                btn.disabled = false;
                btn.onclick = () => selectQuarter(q);
                continue;
            }

            // 4. APPLY TO BUTTONS
            if (finalStatus === 'approved') {
                btn.classList.add('q-approved');
                btn.innerHTML = `Q${q}<br><small>Approved</small>`;
                btn.disabled = true;
                btn.onclick = null;
            } else if (finalStatus === 'rejected') {
                btn.classList.add('q-rejected');
                btn.innerHTML = `Q${q}<br><small>Rejected</small>`;
                btn.onclick = () => prepareReupload(q, selectedRepId);
            } else {
                btn.classList.add('q-pending');
                btn.innerHTML = `Q${q}<br><small>Pending</small>`;
                btn.disabled = true;
                btn.onclick = null;
            }
        }
    } catch (err) {
        console.error("❌ Error loading statuses:", err);
    }
}

// Called when user clicks a default (no-status) quarter button
function selectQuarter(quarter) {
    document.querySelectorAll('.quarter-status-btn').forEach(btn => {
        btn.classList.remove('q-selected');
    });

    const btn = document.getElementById(`quarter-btn-${quarter}`);
    btn?.classList.add('q-selected');

    window.currentSelectedQuarter = quarter;

    const dropZone = document.getElementById('dcpDropZone');
    dropZone?.classList.remove('locked-zone');

    const fileInput = document.getElementById('file-callplan');
    if (!fileInput?.files?.length) {
        document.getElementById('dcpUploadWithBtn').disabled = true;
    }
}

// Called when user clicks a Rejected quarter button
function prepareReupload(quarter, repId) {
    document.querySelectorAll('.quarter-status-btn').forEach(btn => {
        btn.classList.remove('q-selected');
    });
    const btn = document.getElementById(`quarter-btn-${quarter}`);
    btn?.classList.add('q-selected');

    window.currentSelectedQuarter = quarter;

    removeDCPFile();
    const dropZone = document.getElementById('dcpDropZone');
    dropZone?.classList.remove('locked-zone');

    console.log(`Ready to re-upload for Quarter ${quarter}`);
}

// Helper: get currently selected quarter
function getSelectedQuarter() {
    if (window.currentSelectedQuarter) return String(window.currentSelectedQuarter);
    return document.getElementById('quarterSelect')?.value || null;
}

function getSelectedYear() {
    if (window.selectedDCPYear) return window.selectedDCPYear;
    const urlParams = new URLSearchParams(window.location.search);
    const yearParam = parseInt(urlParams.get('year'), 10);
    return Number.isInteger(yearParam) ? yearParam : new Date().getFullYear();
}

function setSelectedYear(year) {
    window.selectedDCPYear = year;
    const yearEl = document.getElementById('selectedYear');
    if (yearEl) yearEl.textContent = year;
}

function initDCPYear() {
    const year = getSelectedYear();
    setSelectedYear(year);
}

function changeYear(delta) {
    const currentYear = getSelectedYear();
    const nextYear = currentYear + delta;
    
    // 1. Update the global variable and UI text
    setSelectedYear(nextYear);

    // 2. Clear current selections and files when the year changes
    resetDCPForm();

    // 3. TRIGGER THE REFRESH
    const urlParams = new URLSearchParams(window.location.search);
    const selectedRepId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('rep_id');
    
    if (selectedRepId) {
        console.log(`🔄 Year changed to ${nextYear}. Refreshing data...`);
        initQuarterStatus(selectedRepId, nextYear);
    }
}


// ============================
// STATUS MODAL HELPERS
// ============================
function showStatusModal(title, message, icon = '✅') {
    const modal = document.getElementById('statusModal');
    if (!modal) return;
    document.getElementById('statusTitle').textContent = title;
    document.getElementById('statusMessage').textContent = message;
    document.getElementById('statusIcon').textContent = icon;
    modal.classList.add('active');
}

window.closeStatusModal = function() {
    document.getElementById('statusModal')?.classList.remove('active');
};


// ============================
// SCREEN NAVIGATION
// ============================
function goTo(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}


// ============================
// FILE SELECT HANDLER
// ============================
function showFile(input, infoId) {
    const file = input.files[0];
    if (!file) return;

    // Guard: only CSV allowed for masterlist too
    if (!isValidCSV(file)) {
        input.value = '';
        showFileTypeError(file.name);
        return;
    }



    if (input.id === "file-masterlist") {
        uploadMasterlist();
    }
}

// Called when DCP file is chosen via input
function onDCPFileSelected(input) {
    const file = input.files[0];
    if (!file) return;

    // ── GUARD: CSV only ──
    if (!isValidCSV(file)) {
        input.value = ''; // clear the bad file
        showFileTypeError(file.name);
        return;
    }

    const emptyState = document.getElementById('dcpEmptyState');
    const preview    = document.getElementById('dcpFilePreview');
    const nameEl     = document.getElementById('dcpFileName');
    const metaEl     = document.getElementById('dcpFileMeta');
    const dropZone   = document.getElementById('dcpDropZone');

    nameEl.textContent = file.name;
    metaEl.textContent = `CSV · ${(file.size / 1024).toFixed(1)} KB`;

    emptyState.style.display = 'none';
    preview.style.display    = 'flex';
    dropZone.classList.add('has-file');

    if (getSelectedQuarter()) {
        document.getElementById('dcpUploadWithBtn').disabled = false;
    }
}


// ============================
// STEP FLOW LOGIC
// ============================
function onQuarterChange() {
    const quarter = document.getElementById('quarterSelect')?.value;
    const dropZone = document.getElementById('dcpDropZone');

    if (quarter) {
        window.currentSelectedQuarter = quarter;
        dropZone?.classList.remove('locked-zone');
    } else {
        window.currentSelectedQuarter = null;
        dropZone?.classList.add('locked-zone');
        removeDCPFile();
    }
}

function checkDCPReady() {
    // no-op — kept for legacy references
}

function removeDCPFile(e) {
    if (e) e.preventDefault();
    const input      = document.getElementById('file-callplan');
    const emptyState = document.getElementById('dcpEmptyState');
    const preview    = document.getElementById('dcpFilePreview');
    const dropZone   = document.getElementById('dcpDropZone');

    input.value = '';
    preview.style.display    = 'none';
    emptyState.style.display = 'flex';
    dropZone.classList.remove('has-file');

    document.getElementById('dcpUploadWithBtn').disabled = true;
}


// ============================
// UPLOAD MASTERLIST (CDS)
// ============================
async function uploadMasterlist() {
    const fileInput = document.getElementById("file-masterlist");
    const file = fileInput.files[0];

    if (!file) {
        alert("Select a file first.");
        return;
    }

    const userId = getUserId();
    if (!userId) {
        alert("Error: No representative ID found. Please go back and select a representative.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("id", userId);

    try {
        const res = await API.uploadCDS(formData);

        if (!res.ok) {
            const errorBody = await res.text();
            let cleanMsg = errorBody.length > 100 ? "Server encountered an error (500)" : errorBody;
            throw new Error(cleanMsg);
        }

        const data = await res.json();
        console.log("CDS RESULT:", data);

        // Check if any modifications occurred (Inserted or Updated)
        const hasChanges = (data.inserted_count > 0 || data.updated_count > 0);

        if (hasChanges) {
            showStatusModal("Upload Success", "Masterlist processed successfully.", '✅');
        } else {
            showStatusModal(
                "No New Data",
                "All items already exist and no modifications were found.",
                'ℹ️'
            );
        }

        // Build a detailed log string dynamically
        let logDetails = [];
        if (data.inserted_count >= 0) logDetails.push(`Inserted: ${data.inserted_count}`);
        if (data.updated_count > 0) logDetails.push(`Updated: ${data.updated_count}`);
        if (data.skipped_count >= 0) logDetails.push(`Skipped: ${data.skipped_count}`);

        const detailString = logDetails.length > 0 ? logDetails.join(", ") : "No changes detected";

        addLogEntry(
            file.name,
            hasChanges ? "Success" : "No Changes",
            detailString
        );

    } catch (err) {
        console.error(err);
        showStatusModal("Upload Failed", err.message || "An error occurred during upload.", '❌');
        addLogEntry(file.name, "Error", err.message || "Upload failed");
    }
}


// ============================
// UPLOAD CALL PLAN (DCP)
// ============================
async function uploadCallPlan(forceUpload = false) {
    const fileInput = document.getElementById("file-callplan");
    const file = fileInput.files[0];

    if (!file) {
        alert("Select a file first.");
        return;
    }

    const quarter = getSelectedQuarter();
    const userId = getUserId();

    if (!quarter || !userId) {
        showStatusModal("Required Info Missing", "Please ensure a Representative and Quarter are selected.", "⚠️");
        return;
    }

    const year = getSelectedYear();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("id", userId);
    formData.append("Quarter", quarter);
    formData.append("year", year);
    formData.append("with_checker", forceUpload ? "0" : "1");

    try {
        const res = await API.uploadDCP(formData);

        if (!res.ok) {
            const errorBody = await res.text();
            try {
                const parsedError = JSON.parse(errorBody);
                throw new Error(parsedError.error || "Server Error");
            } catch(e) {
                throw new Error(errorBody || "Server connection failed");
            }
        }

        const data = await res.json();
        console.log("DCP Upload Result:", data);

        if (data.status === "Blocked" || (data.errors && data.errors.length > 0 && !forceUpload)) {
            // Store errors for use in proceedUploadAnyway
            _currentErrors = data.errors;
            displayWarnings(data.errors);
            _pendingDCPFormData = formData;
            document.getElementById('warningActionBtns').style.display = 'flex';
            return;
        }

        document.getElementById('warningActionBtns').style.display = 'none';

        if (data.status === "Success" || data.inserted > 0) {
            const successMsg = forceUpload
                ? "Daily Call Plan forced successfully."
                : "Daily Call Plan successfully uploaded.";

            showStatusModal("Upload Success", successMsg, '✅');
            resetDCPForm();

            if (typeof initQuarterStatus === "function") {
                await initQuarterStatus(userId);
            }
        } else {
            showStatusModal("No Data Inserted", "The file was processed but no records were added.", '📅');
        }

    } catch (err) {
        console.error("DCP Upload Error:", err);
        showStatusModal("Upload Failed", err.message, '❌');
    }
}


// ============================
// CONFIRM / PROCEED UPLOAD ANYWAY
// ============================
function confirmUploadAnyway() {
    document.getElementById('confirmOverlay').classList.add('active');
}

function closeConfirm() {
    document.getElementById('confirmOverlay').classList.remove('active');
}

async function proceedUploadAnyway() {
    if (typeof closeConfirm === "function") closeConfirm();
    document.getElementById('warningActionBtns').style.display = 'none';

    const userId = getUserId();

    // ── STEP 1: Sync unmatched rows to CDS first ──
    const unmatchedRows = (_currentErrors || []).filter(e =>
        e.reason && e.reason.toLowerCase().includes('masterlist')
    );

    if (unmatchedRows.length > 0) {
        try {
            const syncRes = await API.syncUnmatchedToCDS({
                id: userId,
                unmatched_rows: unmatchedRows
            });
            const syncData = await syncRes.json();
            console.log(`✅ Synced ${syncData.count} unmatched records to CDS masterlist`);
        } catch (err) {
            console.warn("⚠️ Sync to CDS failed, proceeding with DCP upload anyway:", err);
        }
    }

    // ── STEP 2: Force-upload the DCP (bypass checker) ──
    const fileInput = document.getElementById("file-callplan");
    const file = fileInput.files[0];
    const quarter = getSelectedQuarter();
    const year = getSelectedYear();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("id", userId);
    formData.append("Quarter", quarter);
    formData.append("year", year);
    formData.append("with_checker", "0");

    try {
        const res = await API.uploadDCP(formData);
        const data = await res.json();

        if (data.status === "Success") {
            console.log("Backend processed rows:", data.inserted);
            showStatusModal(
                "Upload Success",
                `Daily Call Plan uploaded. ${unmatchedRows.length > 0 ? `${unmatchedRows.length} unmatched record(s) were also added to the masterlist.` : ''}`,
                '✅'
            );
            resetDCPForm();
            if (typeof initQuarterStatus === "function") await initQuarterStatus(userId);
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(data.error || "Upload failed");
        }
    } catch (err) {
        console.error("Upload Error:", err);
        showStatusModal("Upload Failed", err.message, '❌');
    }
}


// ============================
// RESET DCP FORM
// ============================
function resetDCPForm() {
    removeDCPFile();
    window.currentSelectedQuarter = null;
    _currentErrors = null;
    _pendingDCPFormData = null;

    document.querySelectorAll('.quarter-status-btn').forEach(btn => {
        btn.classList.remove('q-selected');
    });

    const legacySelect = document.getElementById('quarterSelect');
    if (legacySelect) legacySelect.value = '';

    document.getElementById('dcpDropZone')?.classList.add('locked-zone');
    document.getElementById('warningActionBtns').style.display = 'none';
}

function cancelDCPUpload() {
    resetDCPForm();
    displayWarnings([]);
    document.getElementById('warningFilter').value = 'all';
    document.getElementById('warningsCount').textContent = 'Showing 0 results';
    document.getElementById('warningsList').innerHTML = '<p>No warnings yet</p>';
}


// ============================
// GET USER ID FROM URL
// ============================
function getUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    return (
        urlParams.get('id') ||
        urlParams.get('user_id') ||
        urlParams.get('rep_id')
    );
}


// ============================
// DISPLAY WARNINGS
// ============================
function displayWarnings(errors) {
    const list = document.getElementById("warningsList");
    list.innerHTML = "";

    if (!errors || errors.length === 0) {
        list.innerHTML = `<p>No warnings 🎉</p>`;
        document.getElementById('warningActionBtns').style.display = 'none';
        updateWarningCount();
        return;
    }

    errors.forEach(err => {
        const div = document.createElement("div");
        div.className = "warning-card";

        let name, detail, tagType, tagLabel;

        if (typeof err === 'object' && err !== null) {
            name = err.name || 'Unknown';
            const reason = err.reason || '';
            const row = err.row ? ` · row ${err.row}` : '';
            detail = reason + row;

            if (reason.toLowerCase().includes('masterlist')) {
                tagType = 'masterlist';
                tagLabel = 'No Masterlist Match';
            } else {
                tagType = 'frequency';
                tagLabel = 'Frequency Warning';
            }
        } else {
            const [namePart, detailPart] = String(err).split(":");
            name = namePart || 'Unknown';
            detail = (detailPart || "").replace(/CSV/g, "DCP");
            tagType = 'frequency';
            tagLabel = 'Frequency Warning';
        }

        div.setAttribute("data-type", tagType);
        div.innerHTML = `
            <span class="warning-tag ${tagType}">${tagLabel}</span>
            <p class="warning-name">${name}</p>
            <p class="warning-detail">${detail}</p>
        `;

        list.appendChild(div);
    });

    updateWarningCount();
}


// ============================
// LOG ENTRIES
// ============================
function addLogEntry(fileName, status, details) {
    const userId = getUserId();
    if (!userId) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLog = { fileName, status, details, time };

    const STORAGE_KEY = `masterlist_logs_${userId}`;
    let logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    logs.unshift(newLog);
    logs = logs.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

    renderLogList(logs);
}

function renderLogList(logs) {
    const list = document.getElementById("masterlistLogList");
    const countEl = document.getElementById('logCount');
    if (!list) return;

    if (!logs || logs.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; margin-top: 20px;">Upload a file to see logs</p>';
        if (countEl) countEl.textContent = "No activities yet";
        return;
    }

    list.innerHTML = logs.map(log => `
        <div class="warning-card">
            <span class="warning-tag ${log.status === 'Error' ? 'mismatch' : ''}"
                  style="${log.status === 'Success' ? 'color: #27ae60;' : ''}">${log.status}</span>
            <p class="warning-name">${log.fileName}</p>
            <p class="warning-detail">${log.time} — ${log.details}</p>
        </div>
    `).join('');

    if (countEl) {
        countEl.textContent = `Showing ${logs.length} activit${logs.length === 1 ? 'y' : 'ies'}`;
    }
}


// ============================
// FILTER WARNINGS
// ============================
function filterWarnings() {
    const val = document.getElementById('warningFilter').value;
    const cards = document.querySelectorAll('.warning-card');

    cards.forEach(card => {
        const type = card.getAttribute('data-type');
        if (val === 'all' || type === val) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    updateWarningCount();
}


// ============================
// WARNING COUNT
// ============================
function updateWarningCount() {
    const visible = document.querySelectorAll('.warning-card:not(.hidden)').length;
    const countEl = document.getElementById('warningsCount');

    if (countEl) {
        countEl.textContent = `Showing ${visible} result${visible !== 1 ? 's' : ''}`;
    }
}