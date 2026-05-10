let accounts = [];
const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
const currentUserRole = userProfile.roles || 'admin'; 

document.addEventListener('DOMContentLoaded', () => {
    const roleFilter = document.getElementById('roleFilter');
    if (roleFilter && currentUserRole === 'admin') {
        const roleFilterWrapper = roleFilter.closest('.dropdown-wrapper');
        if (roleFilterWrapper) {
            roleFilterWrapper.style.display = 'none';
        }
        roleFilter.value = 'medrep';
    }

    loadAccounts();
});

/* ── Helpers ── */
function initials(f, l) {
    return ((f || '').charAt(0) + (l || '').charAt(0)).toUpperCase() || '?';
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function generateNextEmpId(allAccounts) {
    const empNumbers = allAccounts
        .map(a => {
            const idStr = String(a.employee_id || '');
            const match = idStr.match(/\d+/);
            return match ? parseInt(match[0], 10) : null;
        })
        .filter(num => num !== null);
    const maxNum = empNumbers.length > 0 ? Math.max(...empNumbers) : 0;
    return `EMP${String(maxNum + 1).padStart(4, '0')}`;
}

/* ── MODAL HELPERS ── */
function showConfirm(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
    document.getElementById('confirmOkBtn').onclick = function() {
        closeConfirmModal();
        onConfirm();
    };
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

function showAlert(message, onOk) {
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.add('active');
    document.getElementById('alertOkBtn').onclick = function() {
        closeAlertModal();
        if (onOk) onOk();
    };
}

function closeAlertModal() {
    document.getElementById('alertModal').classList.remove('active');
}

/* ── LOAD ACCOUNTS ── */
async function loadAccounts() {
    try {
        const result = await API.fetchAccounts();
        const raw = (result && result.data) ? (Array.isArray(result.data) ? result.data : []) : [];
        const currentUserId = localStorage.getItem('user_id');
        
        if (currentUserRole === 'super_admin') {
            accounts = raw.filter(a => String(a.id) !== String(currentUserId));
        } else {
            accounts = raw.filter(a => (a.roles || '').toLowerCase() === 'medrep' && String(a.id) !== String(currentUserId));
        }

        window.nextGeneratedId = generateNextEmpId(raw);
        renderStats();
        fil();
    } catch (error) {
        console.error('Error fetching accounts:', error);
        accounts = [];
        showToast('Server connection failed');
    }
}

/* ── OPEN EDIT ── */
window.openEdit = function(uuid) {
    const acc = accounts.find(a => String(a.id) === String(uuid));
    if (!acc) return;

    document.getElementById('modalTitle').textContent = 'Edit Account';
    document.getElementById('submitBtn').textContent = 'Save Changes';

    const idField = document.getElementById('accId');
    if (idField) idField.value = acc.id; 

    document.getElementById('empId').value = acc.employee_id || '';
    document.getElementById('fName').value = acc.first_name || '';
    document.getElementById('mName').value = acc.middle_name || '';
    document.getElementById('lName').value = acc.last_name || '';
    document.getElementById('areaInput').value = acc.area || '';
    document.getElementById('districtInput').value = acc.district || '';
    document.getElementById('statusInput').value = acc.status || 'active';
    
    const resetBtnContainer = document.getElementById('resetBtnContainer');
    const resetBtn = document.getElementById('resetPasswordBtn');

    if (resetBtnContainer) {
        resetBtnContainer.style.display = 'block';
        resetBtn.disabled = false;
        resetBtn.style.opacity = '1';
        resetBtn.textContent = 'Reset Password';
    }

    const timeInput = document.getElementById('timeInput');
    if (timeInput) {
        timeInput.value = acc.constant_time || '09:30';
        timeInput.setAttribute('readonly', true);
    }

    const roleGroup = document.getElementById('roleGroup');
    const roleInput = document.getElementById('roleInput');
    
    if (roleInput) {
        roleInput.value = acc.roles || 'medrep';

        if (currentUserRole === 'super_admin') {
            if (roleGroup) roleGroup.style.display = 'block';
            roleInput.disabled = true;
            roleInput.style.opacity = '0.7';
            
            const options = roleInput.querySelectorAll('option');
            options.forEach(opt => opt.style.display = 'block');
        } else {
            if (roleGroup) roleGroup.style.display = 'none';
            roleInput.disabled = true;
            roleInput.style.opacity = '0.7';
        }
    }

    const editableFields = ['fName', 'mName', 'lName', 'areaInput', 'districtInput'];
    if (currentUserRole === 'super_admin') {
        editableFields.forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el) el.removeAttribute('readonly');
        });
        document.getElementById('empId')?.setAttribute('readonly', true);
        document.getElementById('statusInput').disabled = false;
    } else {
        ['fName', 'mName', 'lName', 'empId', 'areaInput', 'districtInput'].forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el) el.setAttribute('readonly', true);
        });
        document.getElementById('statusInput').disabled = true;
    }
    
    document.getElementById('accountModal').classList.add('active');
};

/* ── ADD ACCOUNT ── */
window.addAccount = function() {
    document.getElementById('modalTitle').textContent = 'Add Account';
    document.getElementById('submitBtn').textContent = 'Add';
    document.getElementById('accountForm').reset();
    
    const idField = document.getElementById('accId');
    if (idField) idField.value = '';

    const resetBtnContainer = document.getElementById('resetBtnContainer');
    if (resetBtnContainer) resetBtnContainer.style.display = 'none';

    const empIdField = document.getElementById('empId');
    empIdField.value = window.nextGeneratedId || 'EMP0001';
    // empIdField.setAttribute('readonly', true);

    ['fName', 'mName', 'lName', 'areaInput', 'districtInput'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) el.removeAttribute('readonly');
    });

    const timeInput = document.getElementById('timeInput');
    if (timeInput) {
        timeInput.value = '09:30';
        timeInput.setAttribute('readonly', true);
    }

    const roleInput = document.getElementById('roleInput');
    const roleGroup = document.getElementById('roleGroup');
    if (roleInput) {
        const adminOption = roleInput.querySelector('option[value="admin"]');
        const superAdminOption = roleInput.querySelector('option[value="super_admin"]');

        if (currentUserRole === 'admin') {
            if (roleGroup) roleGroup.style.display = 'none';
            roleInput.value = 'medrep';
            roleInput.disabled = true;
            roleInput.style.opacity = '0.7';

            if (adminOption) adminOption.style.display = 'none';
            if (superAdminOption) superAdminOption.style.display = 'none';
        } 
        else if (currentUserRole === 'super_admin') {
            if (roleGroup) roleGroup.style.display = 'block';
            roleInput.disabled = false;
            roleInput.style.opacity = '1';
            roleInput.value = 'medrep';

            if (adminOption) adminOption.style.display = 'block';
            if (superAdminOption) superAdminOption.style.display = 'block';
        }
    }

    document.getElementById('statusInput').value = 'active';
    document.getElementById('statusInput').disabled = true;
    document.getElementById('accountModal').classList.add('active');
};

window.closeAccountModal = function() {
    document.getElementById('accountModal').classList.remove('active');
};

/* ── FORCE PASSWORD RESET ACTION ── */
window.triggerForceReset = function() {
    const internalUUID = document.getElementById('accId').value;
    if (!internalUUID) return;

    showConfirm("Are you sure you want to reset this account? This will force the user to change their password on their next login.", async () => {
        const resetBtn = document.getElementById('resetPasswordBtn');
        
        try {
            const result = await API.resetAccountStatus(internalUUID);
            console.log("Reset Result:", result);

            if (result && (result.success || !result.error)) {
                showAlert(result.message || "Success! The user will be required to change their password upon next login.", () => {
                    resetBtn.disabled = true;
                    resetBtn.style.opacity = '0.5';
                    resetBtn.textContent = 'Reset Triggered';
                });
            } else {
                showAlert(result?.error || "Error: Failed to reset account.");
            }
        } catch (err) {
            showToast("Server Connection Error");
        }
    });
};

/* ── SAVE ACCOUNT (WITH CONFIRMATION) ── */
window.saveAccount = function(e) {
    e.preventDefault();

    const internalUUID = document.getElementById('accId').value;
    
    const isEditing = !!internalUUID;
    const msg = isEditing 
        ? "Are you sure you want to update this account's information?" 
        : "Are you sure you want to create this new account?";

    showConfirm(msg, async () => {
        const payload = {
            employee_id: document.getElementById('empId').value,
            first_name: document.getElementById('fName').value,
            middle_name: document.getElementById('mName').value,
            last_name: document.getElementById('lName').value,
            area: document.getElementById('areaInput').value,
            district: document.getElementById('districtInput').value,
            constant_time: document.getElementById('timeInput')?.value || null,
            status: document.getElementById('statusInput').value,
            roles: document.getElementById('roleInput')?.value || 'medrep'
        };

        try {
            let result;
            if (internalUUID && internalUUID.trim() !== "") {
                result = await API.updateAccount(internalUUID, payload);
            } else {
                result = await API.createAccount(payload);
            }

            if (result && !result.error) {
                showToast('Account successfully saved!');
                closeAccountModal();
                setTimeout(() => { loadAccounts(); }, 500);
            } else {
                showAlert(result?.error || "Error: Failed to save changes.");
            }
        } catch (err) {
            showToast("Server Connection Error");
        }
    });
};

/* ── STATS & RENDERING ── */
function renderStats() {
    document.getElementById('ct').textContent = accounts.length;
    document.getElementById('ca').textContent = accounts.filter(a => a.status === 'active').length;
    document.getElementById('ci').textContent = accounts.filter(a => a.status === 'inactive').length;
}

window.fil = function() {
    const query = (document.getElementById('srch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const roleFilter = document.getElementById('roleFilter')?.value || 'all';

    const filtered = accounts.filter(a => {
        const name = `${a.first_name} ${a.last_name}`.toLowerCase();
        const matchesSearch = (name.includes(query) || (a.employee_id || '').toLowerCase().includes(query));
        const matchesStatus = (statusFilter === 'all' || a.status === statusFilter);
        const matchesRole = (roleFilter === 'all' || (a.roles || '').toLowerCase() === roleFilter);
        return matchesSearch && matchesStatus && matchesRole;
    });

    document.getElementById('list').innerHTML = filtered.map(a => {
        const color = a.status === 'active' ? '#22c55e' : '#ef4444';
        return `
        <div class="arow">
            <span class="sdot" style="background:${color}"></span>
            <div class="ava">${initials(a.first_name, a.last_name)}</div>
            <div class="ri">
                <div class="rn">${a.first_name}${a.middle_name ? ' ' + a.middle_name : ''} ${a.last_name}</div>
                <div class="rm">${a.employee_id} | <span style="text-transform: uppercase;">${a.roles}</span> | ${a.area}</div>
            </div>
            <button class="ebtn" onclick="openEdit('${a.id}')">Edit</button>
        </div>`;
    }).join('');

    const showCount = document.getElementById('shw');
    if (showCount) {
        showCount.textContent = `Showing ${filtered.length} account${filtered.length !== 1 ? 's' : ''}`;
    }
};