const BASE_URL = "http://26.209.189.89:5000";
let allCdsRecords = []; 
let currentRepId = null; // This will hold the ID for the confirm button

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const empId = urlParams.get('user_id') || urlParams.get('id');
    const quarter = parseInt(urlParams.get('q')) || 1;
    const year = urlParams.get('year') || '2026';

    if (!empId) {
        document.getElementById('cdsContainer').innerHTML = 
            `<p style="color:red; text-align:center; padding:20px;">Error: No ID found in URL.</p>`;
        return; 
    }

    initializeRequestUI(quarter);
    await fetchRequestDetails(empId, quarter, year);

    document.getElementById('docSearch').addEventListener('input', applyCdsFilters);
    document.getElementById('typeFilter').addEventListener('change', applyCdsFilters);

    document.getElementById('acceptBtn')?.addEventListener('click', openAcceptModal);
    document.getElementById('rejectBtn')?.addEventListener('click', openRejectModal);
    document.querySelector('.btn-summary-outline')?.addEventListener('click', () => {
        window.location.href = `summary/summary.html?user_id=${empId}`;
    });

    await loadModal('components/accept_modal.html');
    await loadModal('components/reject_modal.html');
});

async function fetchRequestDetails(empId, q, year) {
    currentRepId = empId; 
    const pendingActions = document.getElementById('pendingActions');
    const wrapper = document.getElementById('statusActionsWrapper');

    try {
        const url = `${BASE_URL}/api/requests/details?id=${empId}&quarter=${q}&year=${year}`;
        console.log("🌐 DEBUG: Fetching Request Details URL ->", url);

        const response = await fetch(url);
        const data = await response.json();
        console.log("📥 DEBUG: Raw Backend Data Received ->", data);

        // Derive global status from DCP rows (API has no top-level status field)
        const dcpRows = data.dcp_list || [];
        const allApproved = dcpRows.length > 0 && dcpRows.every(row =>
            (row.status || "").toLowerCase() === "approved"
        );
        const globalStatus = allApproved ? "approved" : "pending";
        console.log("📊 DEBUG: Derived Global Status ->", globalStatus);

        // Show badge and hide buttons if Approved
        if (globalStatus === "approved") {
            if (pendingActions) pendingActions.style.display = "none";
            const statusActions = document.querySelector('.status-actions');
            if (statusActions && !statusActions.querySelector('.final-status-badge')) {
                const badge = document.createElement('span');
                badge.className = 'final-status-badge approved';
                badge.textContent = '✓ Approved';
                statusActions.appendChild(badge);
            }
        }

        // Fill in the headers
        console.log("👤 DEBUG: Medrep Metadata ->", data.medrep);
        document.getElementById('repName').textContent = data.medrep?.name || "---";
        document.getElementById('repArea').textContent = data.medrep?.area || "---";

        allCdsRecords = data.cds_list || [];
        console.log("📋 DEBUG: CDS List count ->", allCdsRecords.length);

        applyCdsFilters();
        renderDcpTable(data.dcp_list);

    } catch (err) {
        console.error("Fetch Error:", err);
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

        // DEEP SEARCH: Checks Name, Specialty and Address
        const matchesSearch = 
            nameToSearch.toLowerCase().includes(searchTerm) || 
            (item.specialty?.toLowerCase().includes(searchTerm)) ||
            (item.City_Address_Province || item.city_address_province || item.city || '').toLowerCase().includes(searchTerm);
            
        return matchesType && matchesSearch;
    });

    // DYNAMIC TEXT LOGIC
    let labelText = `Showing (${filtered.length}) `;
    
    if (searchTerm !== "") {
        labelText += "Results"; // Simplify to "Results" when searching
    } else {
        // Use specific categories if search is empty
        if (typeValue === 'all') labelText += "Doctor & Pharmacy";
        else if (typeValue === 'doctor') labelText += "Doctors";
        else if (typeValue === 'pharmacy') labelText += "Pharmacies";
    }
    
    filterLabel.textContent = labelText;

    if (filtered.length === 0) {
        container.innerHTML = `<p style="padding:20px; text-align:center; color:#999;">No results found.</p>`;
        return;
    }

    container.innerHTML = filtered.map(doc => {
        const isPharmacy = (doc.type || doc.RecordType || doc.record_type || '').toLowerCase() === 'pharmacy';
        const displayName = isPharmacy ? (doc.Pharmacy_Name || doc.pharmacy_name || doc.name || 'Unknown') : (doc.name || 'Unknown');
        const displaySub = isPharmacy ? (doc.City_Address_Province || doc.city_address_province || doc.city || '-') : (doc.specialty || '-');

        return `
        <div class="doctor-item">
            <div class="doc-card-header" onclick="toggleDetails(this)">
                <div class="doc-content-left">
                    <div class="doc-init">${getInitials(displayName)}</div>
                    <div class="doc-info">
                        <span class="doc-name">${displayName}</span>
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
                    <div class="detail-item"><label>ADDRESS</label><span>${doc.City_Address_Province || doc.city_address_province || doc.city || 'N/A'}</span></div>
                </div>
            </div>
        </div>
    `;}).join('');
}

function renderDcpTable(list) {
    const dcpBody = document.getElementById('dcpBody');
    if (!list || list.length === 0) {
        dcpBody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>No schedule found.</td></tr>";
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

function initializeRequestUI(quarter) {
    const quarters = {
        1: { title: "Q1 Request (Jan - Mar)", sub: "Q1 · January – March 2026" },
        2: { title: "Q2 Request (Apr - Jun)", sub: "Q2 · April – June 2026" },
        3: { title: "Q3 Request (Jul - Sep)", sub: "Q3 · July – September 2026" },
        4: { title: "Q4 Request (Oct - Dec)", sub: "Q4 · October – December 2026" }
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
        // Update the text right before showing the modal
        const name = document.getElementById('repName').textContent;
        const target = modal.querySelector('.dynamic-rep-name');
        if (target) target.textContent = `${name}'s`;

        modal.style.display = 'flex';
    }
}   

function openAcceptModal() {
    const modal = document.getElementById('acceptModal');
    if (modal) {
        // Update the text right before showing the modal
        const name = document.getElementById('repName').textContent;
        const target = modal.querySelector('.dynamic-rep-name');
        if (target) target.textContent = `${name}'s`;
        
        modal.style.display = 'flex';
    }
}

async function confirmRequest() {
    if (!currentRepId) return alert("Error: No representative ID found.");

    try {
        const response = await fetch(`${BASE_URL}/api/requests/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentRepId, status: 'Approved' })
        });

        if (response.ok) {
            alert("Request successfully approved!");
            window.location.reload(); 
        } else {
            const errorText = await response.text();
            alert("Failed to accept: " + errorText);
        }
    } catch (err) {
        console.error("Confirmation Error:", err);
    }
}

// Add this to request_details.js
window.updateGlobalStatus = async function(newStatus) {
    const urlParams = new URLSearchParams(window.location.search);
    const empId = urlParams.get('user_id') || urlParams.get('id');
    const quarter = urlParams.get('q') || 1;
    const year = urlParams.get('year') || '2026';

    if (!empId) return alert("Error: No User ID found in URL.");

    try {
        // Use your global status endpoint
        const API_URL = `${BASE_URL}/api/dcp/global-status`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: empId,
                quarter: quarter,
                year: year,
                status: newStatus // This will be 'Approved'
            })
        });

        if (response.ok) {
            alert(`Request successfully ${newStatus}!`);
            window.location.reload(); 
        } else {
            const err = await response.json();
            alert("Failed: " + (err.error || "Unknown error"));
        }
    } catch (err) {
        console.error("Update Error:", err);
        alert("An error occurred while updating status.");
    }
};