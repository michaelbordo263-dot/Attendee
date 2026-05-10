// =====================================
//  DYNAMIC NAME HELPER
// =====================================
function getRepName() {
    const nameElement = document.getElementById('repName') || 
                        document.querySelector('.header-title h2') ||
                        document.querySelector('h2');
                        
    if (nameElement) {
        const rawText = nameElement.innerText.split(/Q\d/)[0].trim();
        return rawText || "Medical Representative";
    }
    return "Medical Representative";
}

// =====================================
//  GET CONTEXT FROM URL
// =====================================
function getRequestContext() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id') || urlParams.get('user_id');
    const quarterParam = urlParams.get('q');
    const yearParam = urlParams.get('year');

    return {
        id: targetId, 
        quarter: quarterParam || "1", 
        year: yearParam || "2026"
    };
}

// =====================================
//  UPDATE BACKEND REQUEST
// =====================================
async function updateGlobalStatus(newStatus, remarks = null) {
    const context = getRequestContext();

    if (!context.id) {
        alert("Error: No ID found in URL parameters.");
        return;
    }

    const payload = {
        id: context.id, 
        quarter: parseInt(context.quarter, 10), 
        year: parseInt(context.year, 10), 
        status: newStatus, // Keep original casing e.g. 'Approved', 'Rejected'
        remarks: remarks // This must be the actual string from the textarea[cite: 10, 13]
    };

    console.log("DEBUG: Sending update to backend with payload:", payload);
    
    try {
        const result = await API.updateGlobalStatus(payload);
        
        if (result && (result.updated_count > 0 || result.status === "Success")) {
            if (newStatus === 'Approved') {
                showToast('Request Approved', 'success', 'Request has been approved successfully.');
            } else {
                showToast('Request Rejected', 'error', 'Request has been rejected.');
            }
            setTimeout(() => window.location.reload(), 1800);
        } else {
            const errorMsg = result?.error || "No matching records found for this period.";
            showToast('Update Failed', 'error', errorMsg);
        }
    } catch (err) {
        console.error("Update Error:", err);
        alert(`Failed to ${newStatus}: ${err.message}`);
    }
}   

// =====================================
//  MODAL HELPERS & EVENT LISTENERS
// =====================================
let acceptModal, rejectModal;

window.closeAcceptModal = () => { 
    const modal = document.getElementById('acceptModal');
    if (modal) modal.style.display = 'none'; 
};

window.closeRejectModal = () => {
    const modal = document.getElementById('rejectModal');
    if (modal) modal.style.display = 'none';
    const input = document.getElementById('rejectRemarks');
    if (input) { input.value = ''; input.style.borderColor = ''; }
};

// Global handler for Reject Confirm button
window.handleRejectConfirm = () => {
    const input = document.getElementById('rejectRemarks');
    const remarks = input ? input.value.trim() : '';
    if (!remarks) {
        if (input) input.style.borderColor = 'red';
        showToast('Please provide a reason for rejection.', 'error');
        return;
    }
    if (input) input.style.borderColor = '';
    updateGlobalStatus('Rejected', remarks);
};

function updateModalText(modalId) {
    const name = getRepName();
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const target = modal.querySelector('.dynamic-rep-name');
    if (target) target.innerText = `${name}'s`;
}

document.addEventListener('DOMContentLoaded', () => {
    acceptModal = document.getElementById('acceptModal');
    rejectModal = document.getElementById('rejectModal');

    const openAcceptBtn = document.getElementById('acceptBtn');
    const openRejectBtn = document.getElementById('rejectBtn');

    if (openAcceptBtn) {
        openAcceptBtn.addEventListener('click', () => {
            updateModalText('acceptModal');
            if (acceptModal) acceptModal.style.display = 'flex';
        });
    }

    if (openRejectBtn) {
        openRejectBtn.addEventListener('click', () => {
            updateModalText('rejectModal');
            if (rejectModal) rejectModal.style.display = 'flex';
        });
    }

    // --- ACCEPT MODAL HANDLERS ---
    const confirmAcceptBtn = document.querySelector('#acceptModal .btn-confirm');
    if (confirmAcceptBtn) {
        confirmAcceptBtn.addEventListener('click', () => updateGlobalStatus('Approved'));
    }

    const reviewBtn = document.querySelector('#acceptModal .btn-review');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', window.closeAcceptModal);
    }

    // --- REJECT MODAL HANDLERS ---
    const cancelRejectBtn = document.querySelector('#rejectModal .btn-cancel-red');
    if (cancelRejectBtn) {
        cancelRejectBtn.addEventListener('click', window.closeRejectModal);
    }

    const confirmRejectBtn = document.querySelector('#rejectModal .btn-confirm-reject');
    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener('click', () => {
            const modal = document.getElementById('rejectModal');
            // Prefer id lookup, fallback to class — works with both modal layouts
            const remarksInput = document.getElementById('rejectRemarks')
                || modal.querySelector('.remarks-input');
            const remarksText = remarksInput ? remarksInput.value.trim() : "";

            if (!remarksText) {
                showToast("Please provide a reason for rejection.", "error");
                if (remarksInput) remarksInput.style.borderColor = 'red';
                return;
            }

            if (remarksInput) remarksInput.style.borderColor = '';
            updateGlobalStatus('Rejected', remarksText);
        });
    }
});

window.switchModal = function(target) {
    if (target === 'reject') {
        window.closeAcceptModal();
        updateModalText('rejectModal');
        if (rejectModal) rejectModal.style.display = 'flex';
    } else {
        window.closeRejectModal();
        updateModalText('acceptModal');
        if (acceptModal) acceptModal.style.display = 'flex';
    }
};

function showToast(message, type = "info", subtitle = "") {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        document.body.appendChild(toast);
    }

    const isSuccess = type === 'success' || type === 'info';
    const icon = isSuccess ? '&#10003;' : '&#10007;';
    const title = isSuccess ? 'Request Approved' : 'Request Rejected';
    const sub = subtitle || message;

    toast.innerHTML = `
        <div class="toast-body ${isSuccess ? 'success' : 'error'}">
            <span class="toast-icon-wrap">${icon}</span>
            <div class="toast-text-wrap">
                <div class="toast-title">${title}</div>
                <div class="toast-subtitle">${sub}</div>
            </div>
            <button class="toast-close-btn" onclick="this.closest('#app-toast').classList.remove('show')">&times;</button>
        </div>
        <div class="toast-progress"></div>
    `;

    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}