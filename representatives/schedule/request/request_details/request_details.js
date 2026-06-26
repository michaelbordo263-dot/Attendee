let allCdsRecords = []; 
let currentRepId = null; // This will hold the ID for the confirm button

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let empId = urlParams.get('user_id') || urlParams.get('id');
    let quarter = parseInt(urlParams.get('q')) || 1;
    let year = urlParams.get('year') || '2026';

    // Restore representative state from session storage when the URL does not provide it
    if (!empId) {
        try {
            const storedRepJson = sessionStorage.getItem('active_rep_data');
            const storedRep = storedRepJson ? JSON.parse(storedRepJson) : {};
            if (storedRep.id) empId = storedRep.id;
        } catch (e) {
            console.warn('Could not restore rep data from sessionStorage', e);
        }
    }

    // Restore view state (quarter/year) from session storage when URL does not provide it
    if (!urlParams.has('q')) {
        try {
            const storedViewState = sessionStorage.getItem('active_request_view');
            if (storedViewState) {
                const viewState = JSON.parse(storedViewState);
                quarter = viewState.quarter || quarter;
                year = viewState.year || year;
            }
        } catch (e) {
            console.warn('Could not restore view state from sessionStorage', e);
        }
    }

    // Save representative state to session storage
    if (empId) {
        try {
            sessionStorage.setItem('active_rep_data', JSON.stringify({
                id: empId,
                name: "",
                area: ""
            }));
        } catch (e) {
            console.warn('Could not save active_rep_data to sessionStorage', e);
        }
    }

    // Save view state (quarter/year) to session storage
    try {
        sessionStorage.setItem('active_request_view', JSON.stringify({
            quarter: quarter,
            year: year
        }));
    } catch (e) {
        console.warn('Could not save view state to sessionStorage', e);
    }

    // Clean the URL after reading params so later navigation uses session state
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!empId) {
        document.getElementById('cdsContainer').innerHTML = 
            `<p style="color:red; text-align:center; padding:20px;">Error: No ID found in URL.</p>`;
        return; 
    }

    initializeRequestUI(quarter, year);
    await fetchRequestDetails(empId, quarter, year);

    // --- 1.5 BACK BUTTON LOGIC ---
    const backBtn = document.getElementById('goBack') || document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Navigate back to the quarter selection (Request) list with clean URL
            window.location.href = `../request.html`;
        });
    }

    document.getElementById('docSearch').addEventListener('input', applyCdsFilters);
    document.getElementById('typeFilter').addEventListener('change', applyCdsFilters);

    document.getElementById('acceptBtn')?.addEventListener('click', openAcceptModal);
    document.getElementById('rejectBtn')?.addEventListener('click', openRejectModal);

    // --- UPDATED VIEW SUMMARY LOGIC ---
    document.querySelector('.btn-summary-outline')?.addEventListener('click', () => {
        const qString = `Q${quarter}`; // Converts 1 to "Q1", 2 to "Q2", etc.
        window.location.href = `summary/summary.html?user_id=${empId}&quarter=${qString}&year=${year}`;
    });

});

async function fetchRequestDetails(empId, q, year) {
    currentRepId = empId; 
    const pendingActions = document.getElementById('pendingActions');

    try {
        const data = await API.fetchRequestDetails(empId, q, year);
        console.log("📥 DEBUG: Raw Backend Data Received ->", data);

        const dcpRows = data.dcp_list || [];
        
        const allApproved = dcpRows.length > 0 && dcpRows.every(row =>
            (row.status || "").toLowerCase() === "approved"
        );
        const allRejected = dcpRows.length > 0 && dcpRows.every(row =>
            (row.status || "").toLowerCase() === "rejected"
        );

        const globalStatus = allApproved ? "approved" : allRejected ? "rejected" : "pending";
        console.log("📊 DEBUG: Derived Global Status ->", globalStatus);

        if (globalStatus === "approved" || globalStatus === "rejected") {
            if (pendingActions) pendingActions.style.display = "none";
            const statusActions = document.querySelector('.status-actions');
            if (statusActions && !statusActions.querySelector('.final-status-badge')) {

                // Add View Remarks button FIRST (before badge) if rejected
                if (globalStatus === "rejected") {
                    const remarks = (dcpRows[0]?.remarks || dcpRows[0]?.reason || "No remarks provided.").trim();
                    const remarksBtn = document.createElement('button');
                    remarksBtn.className = 'btn-summary-outline';
                    remarksBtn.textContent = 'View Remarks';
                    remarksBtn.onclick = () => openRemarksModal(remarks);
                    statusActions.appendChild(remarksBtn);
                }

                // Badge appended LAST so order is: View Summary → View Remarks → ✕ Rejected
                const badge = document.createElement('span');
                badge.className = `final-status-badge ${globalStatus}`;
                badge.textContent = globalStatus === "approved" ? "✓ Approved" : "✕ Rejected";
                statusActions.appendChild(badge);
            }
        }

        document.getElementById('repName').textContent = data.medrep?.name || "---";
        document.getElementById('repArea').textContent = data.medrep?.area || "---";

        if (data.fiscal_range) {
            console.log(`📅 DEBUG: Processing Range ${data.fiscal_range.start} to ${data.fiscal_range.end}`);
        }

        allCdsRecords = data.cds_list || [];
        applyCdsFilters();
        renderDcpTable(dcpRows);

    } catch (err) {
        console.error("Fetch Error:", err);
        const container = document.getElementById('cdsContainer');
        if (container) container.innerHTML = `<p style="text-align:center; color:red;">Failed to load request details.</p>`;
    }
}

function applyCdsFilters() {
    const searchTerm = document.getElementById('docSearch').value.toLowerCase();
    const typeValue = document.getElementById('typeFilter').value; 
    const container = document.getElementById('cdsContainer');
    const filterLabel = document.getElementById('filterStatus');

    const filtered = allCdsRecords.filter(item => {
        const matchesType = (typeValue === 'all') || (item.type?.toLowerCase() === typeValue);
        
        const isPharm = (item.type || item.RecordType || item.record_type || '').toLowerCase() === 'pharmacy';
        const nameToSearch = isPharm ? (item.Pharmacy_Name || item.pharmacy_name || item.name || '') : (item.name || '');

        // Search logic includes Area for Doctors and City_Address_Province for Pharmacies
        const matchesSearch = 
            nameToSearch.toLowerCase().includes(searchTerm) || 
            (item.specialty?.toLowerCase().includes(searchTerm)) ||
            (item.Area?.toLowerCase().includes(searchTerm)) || 
            (item.City_Address_Province || item.city || '').toLowerCase().includes(searchTerm);
            
        return matchesType && matchesSearch;
    });

    let labelText = `Showing (${filtered.length}) `;
    if (searchTerm !== "") {
        labelText += "Results"; 
    } else {
        if (typeValue === 'all') labelText += "Doctor & Pharmacy";
        else if (typeValue === 'doctor') labelText += "Doctors";
        else if (typeValue === 'pharmacy') labelText += "Pharmacies";
    }
    
    filterLabel.textContent = labelText;

    if (filtered.length === 0) {
        container.innerHTML = `<p style="padding:20px; text-align:center; color:#999;">No results found.</p>`;
        return;
    }

    container.innerHTML = filtered.sort((a, b) => {
        const aDcp = a.dcp_upload ? 1 : 0;
        const bDcp = b.dcp_upload ? 1 : 0;
        return bDcp - aDcp || (a.name || '').localeCompare(b.name || '');
    }).map(doc => {
        const isPharmacy = (doc.type || doc.RecordType || doc.record_type || '').toLowerCase() === 'pharmacy';
        const displayName = doc.name || 'Unknown';
        
        /**
         * APPLIED CHANGE:
         * For Pharmacies, we check both City_Address_Province and the fallback 'city' key 
         * provided by the backend to ensure the location displays correctly.
         */
        const displaySub = isPharmacy 
            ? (doc.City_Address_Province || doc.city || '-') 
            : (doc.Area && doc.Area !== 'N/A' ? doc.Area : (doc.specialty && doc.specialty !== 'N/A' ? doc.specialty : '-'));

        return `
        <div class="doctor-item">
            <div class="doc-card-header" onclick="toggleDetails(this)">
                <div class="doc-content-left">
                    <div class="doc-init">${getInitials(displayName)}</div>
                    <div class="doc-info">
                        <span class="doc-name">${displayName}${doc.dcp_upload ? ' <span style="background:#3b82f6; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle;">DCP</span>' : ''}</span>
                        <span class="doc-specialty">${displaySub}</span>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-down toggle-icon"></i>
            </div>
            <div class="doc-details">
                <div class="doc-inner-grid">
                    <div class="detail-item"><label>CODE</label><span>${doc.id || 'N/A'}</span></div>
                    <div class="detail-item"><label>HOSPITAL</label><span>${doc.hospital || 'N/A'}</span></div>
                    <div class="detail-item"><label>TYPE</label><span>${doc.type || 'N/A'}</span></div>
                    <div class="detail-item"><label>ADDRESS</label><span>${doc.City_Address_Province || doc.city || 'N/A'}</span></div>
                </div>
            </div>
        </div>
    `;}).join('');
}

function renderDcpTable(list) {
    const dcpBody = document.getElementById('dcpBody');
    if (!list || list.length === 0) {
        dcpBody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>No schedule found for this fiscal period.</td></tr>";
        return;
    }
    const sortedList = list.sort((a, b) => new Date(a.date) - new Date(b.date));
    dcpBody.innerHTML = sortedList.map(row => `
        <tr class="status-${row.status || 'pending'}">
            <td class="date-cell"><strong>${row.date}</strong></td>
            <td>${row.area || 'N/A'}</td>
            <td>${row.doctors || '---'}</td>
            <td><span class="spec-tag">${row.specs || 'N/A'}</span></td>
            <td>${row.province || 'N/A'}</td>
        </tr>
    `).join('');
}

function getInitials(name) {
    if (!name || typeof name !== 'string') return "D";
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 
        ? parts[0][0].toUpperCase() 
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toggleDetails(headerElement) {
    const card = headerElement.closest('.doctor-item');
    const isActive = card.classList.contains('active');
    document.querySelectorAll('.doctor-item').forEach(item => item.classList.remove('active'));
    if (!isActive) card.classList.add('active');
}

function initializeRequestUI(quarter, year) {
    const quarters = {
        1: { title: "Q1 Request (Jan - Mar)", sub: `Q1 · January – March ${year}` },
        2: { title: "Q2 Request (Apr - Jun)", sub: `Q2 · April – June ${year}` },
        3: { title: "Q3 Request (Jul - Sep)", sub: `Q3 · July – September ${year}` },
        4: { title: "Q4 Request (Oct - Dec)", sub: `Q4 · October – December ${year}` }
    };
    const config = quarters[quarter] || quarters[1];
    document.getElementById('qTitle').textContent = config.title;
    document.getElementById('qSub').textContent = config.sub;
}

async function loadModal(path) {
    try {
        const response = await fetch(path);
        if (response.ok) {
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
        }
    } catch (e) { console.error("Modal load error:", path); }
}

function openRejectModal() {
    const modal = document.getElementById('rejectModal');
    if (modal) {
        const name = document.getElementById('repName').textContent;
        const target = modal.querySelector('.dynamic-rep-name');
        if (target) target.textContent = `${name}'s`;
        modal.style.display = 'flex';
    }
}   

function openAcceptModal() {
    const modal = document.getElementById('acceptModal');
    if (modal) {
        const name = document.getElementById('repName').textContent;
        const target = modal.querySelector('.dynamic-rep-name');
        if (target) target.textContent = `${name}'s`;
        modal.style.display = 'flex';
    }
}

function openRemarksModal(remarks) {
    const repName = document.getElementById('repName').textContent;
    document.getElementById('rrRepName').textContent = repName;
    document.getElementById('rrRemarksText').textContent = remarks;
    document.getElementById('remarksViewModal').style.display = 'flex';
}

function closeRemarksModal() {
    document.getElementById('remarksViewModal').style.display = 'none';
}