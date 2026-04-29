// =====================================
//  DYNAMIC NAME HELPER
// =====================================
function getRepName() {
    const nameElement = document.querySelector('.header-title h2') ||
                        document.querySelector('.rep-name-header') ||
                        document.querySelector('h2');
    if (nameElement) {
        // Use regex to grab everything BEFORE the first "Q" (cuts off "Q2 - April...")
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
    const empId = urlParams.get('user_id') || urlParams.get('id');
    const quarterParam = urlParams.get('q');
    const yearParam = urlParams.get('year');

    return {
        empId: empId,
        quarter: quarterParam ? parseInt(quarterParam, 10) : 1, // Ensure integer
        year: yearParam ? parseInt(yearParam, 10) : 2026 // Ensure integer
    };
}

// =====================================
//  UPDATE BACKEND REQUEST
// =====================================
async function updateGlobalStatus(newStatus, remarks = null) {
    const { empId, quarter, year } = getRequestContext();

    if (!empId) {
        alert("Error: No User ID found in URL.");
        return;
    }

    const payload = {
        id: empId, // Changed from employee_id to match UUID column
        quarter: quarter,
        year: year,
        status: newStatus,
        remarks: remarks
    };

    console.log("DEBUG: Sending update to backend with payload:", payload);
    try {
        const result = await API.updateGlobalStatus(payload);
        const response = { ok: result && !result.error };

        if (!response.ok) {
            throw new Error(result.error || result.details || result.message || "Request failed");
        }
        
        // Check if the backend explicitly indicates an update occurred
        if (result.updated_count > 0 || result.message === "Status updated successfully") { // Assuming backend might send a message
            alert(`Request successfully ${newStatus}!`);
            window.location.reload();
        } else {
            // This case handles if response.ok is true, but no rows were affected (e.g., if the record was already in the target status)
            alert(`No matching request found for Employee ID: ${empId}, Quarter: ${quarter}, Year: ${year} to update. It might already be ${newStatus} or does not exist.`);
        }

    } catch (err) {
        alert(`Failed to ${newStatus}: ${err.message}`);
    }
}

// Global references for modals and remarks input
let acceptModal;
let rejectModal;
let remarksInput; // Assuming you have an ID for the remarks textarea in your HTML

// =====================================
//  MODAL HELPERS
// =====================================
function updateModalText(modalId) {
    const name = getRepName();
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const target = modal.querySelector('.dynamic-rep-name');
    if (target) {
        target.innerText = `${name}'s`;
    }
}

window.closeAcceptModal = () => { if (acceptModal) acceptModal.style.display = 'none'; };
window.closeRejectModal = () => {
    if (rejectModal) rejectModal.style.display = 'none';
    if (remarksInput) remarksInput.value = ''; // Clear remarks on close
};

// =====================================
//  EVENT LISTENERS
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal references
    acceptModal = document.getElementById('acceptModal');
    rejectModal = document.getElementById('rejectModal');
    remarksInput = document.getElementById('remarksInput'); // Assuming an ID for the remarks textarea

    // 1. Hook into the Green 'Accept' and Red 'Reject' buttons in your main UI
    const openAcceptBtn = document.querySelector('.btn-accept') || document.getElementById('acceptBtn');
    const openRejectBtn = document.querySelector('.btn-reject') || document.getElementById('rejectBtn');

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

    // 2. Confirm logic inside the modals
    const confirmAcceptBtn = document.getElementById('confirmAcceptBtn');
    const confirmRejectBtn = document.querySelector('.btn-confirm-reject');

    if (confirmAcceptBtn) {
        confirmAcceptBtn.addEventListener('click', () => {
            updateGlobalStatus('Approved');
        });
    }

    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener('click', () => {
            const remarks = remarksInput?.value.trim();
            if (!remarks) {
                alert("Please provide a reason for rejection.");
                return;
            }
            updateGlobalStatus('Rejected', remarks);
        });
    }
});

window.switchModal = function(target) { // This function was duplicated and malformed, now corrected.
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