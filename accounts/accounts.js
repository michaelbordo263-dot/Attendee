let accounts = [];
const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
const currentUserRole = userProfile.roles || 'admin'; 

let currentRoleFilter = 'all';
document.addEventListener('DOMContentLoaded', () => {
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
        .map(a => a.employee_id || '')
        .filter(id => id.startsWith('EMP'))
        .map(id => parseInt(id.replace('EMP', ''), 10))
        .filter(num => !isNaN(num));

    const maxNum = empNumbers.length > 0 ? Math.max(...empNumbers) : 0;
    return `EMP${String(maxNum + 1).padStart(4, '0')}`;
}

/* ── LOAD ACCOUNTS ── */
async function loadAccounts() {
    try {
        const result = await API.fetchAccounts();
        const raw = (result && result.data) ? (Array.isArray(result.data) ? result.data : []) : [];
        
        if (currentUserRole === 'super_admin') {
            accounts = raw;
        } else {
            accounts = raw.filter(a => (a.roles || '').toLowerCase() === 'medrep');
        }

        window.nextGeneratedId = generateNextEmpId(raw);

        const roleFilterDropdown = document.getElementById('roleFilter');
        if (roleFilterDropdown) {
            if (currentUserRole === 'admin') {
                roleFilterDropdown.value = 'medrep';
                roleFilterDropdown.disabled = true;
            } else {
                roleFilterDropdown.value = 'all';
                roleFilterDropdown.disabled = false;
            }
            currentRoleFilter = roleFilterDropdown.value;
        }
        renderStats();
        fil();
    } catch (error) {
        console.error('Error fetching accounts:', error);
        accounts = [];
        window.nextGeneratedId = 'EMP0001';
        showToast('Account list is empty or server is offline');
    }
}

/* ── OPEN EDIT ── */
window.openEdit = function(id) {
    const acc = accounts.find(a => String(a.id) === String(id));
    if (!acc) return;

    document.getElementById('modalTitle').textContent = 'Edit Account';
    document.getElementById('submitBtn').textContent = 'Save Changes';

    document.getElementById('accId').value = acc.id;
    document.getElementById('empId').value = acc.employee_id;
    document.getElementById('fName').value = acc.first_name;
    document.getElementById('lName').value = acc.last_name;
    document.getElementById('areaInput').value = acc.area;
    document.getElementById('districtInput').value = acc.district || '';
    document.getElementById('statusInput').value = acc.status || 'active';

    // Lock all fields except status
    ['fName', 'lName', 'empId', 'areaInput', 'districtInput', 'timeInput'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        el.setAttribute('readonly', true);
        el.removeAttribute('required');
    });
    document.getElementById('statusInput').disabled = false;

    // Role dropdown — always visible and enabled
    const roleGroup = document.getElementById('roleGroup');
    const roleInput = document.getElementById('roleInput');
    roleGroup.style.display = 'flex';
    roleInput.value = acc.roles || 'medrep';
    roleInput.disabled = false;
    roleInput.removeAttribute('readonly');

    document.getElementById('accountModal').classList.add('active');
};

/* ── ADD ── */
window.addAccount = function() {
    document.getElementById('modalTitle').textContent = 'Add Account';
    document.getElementById('submitBtn').textContent = 'Add';
    document.getElementById('accountForm').reset();
    document.getElementById('accId').value = '';

    const empIdField = document.getElementById('empId');
    empIdField.value = window.nextGeneratedId || 'EMP0001';
    empIdField.setAttribute('readonly', true);

    ['fName', 'lName', 'areaInput', 'districtInput', 'timeInput'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        el.removeAttribute('readonly');
        el.setAttribute('required', true);
    });

    const status = document.getElementById('statusInput');
    status.value = 'active';
    status.disabled = true;

    // Role dropdown — always visible and enabled
    const roleGroup = document.getElementById('roleGroup');
    const roleInput = document.getElementById('roleInput');
    roleGroup.style.display = 'flex';
    roleInput.value = 'medrep';
    roleInput.disabled = false;
    roleInput.removeAttribute('readonly');

    document.getElementById('accountModal').classList.add('active');
};

window.closeAccountModal = function() {
    document.getElementById('accountModal').classList.remove('active');
};

/* ── SAVE ── */
window.saveAccount = async function(e) {
    e.preventDefault();

    const id = document.getElementById('accId').value;
    const employee_id = document.getElementById('empId').value;

    const statusEl = document.getElementById('statusInput');
    statusEl.disabled = false;

    // Always read role from the dropdown — it's always visible now
    const roleInput = document.getElementById('roleInput');
    const roles = roleInput ? roleInput.value : 'medrep';

    const payload = {
        employee_id,
        first_name: document.getElementById('fName').value,
        last_name: document.getElementById('lName').value,
        area: document.getElementById('areaInput').value,
        district: document.getElementById('districtInput').value,
        constant_time: document.getElementById('timeInput')?.value || null,
        status: document.getElementById('statusInput').value,
        roles: roles
    };

    try {
        let result;
        if (id) {
            result = await API.updateAccount(employee_id, payload);
        } else {
            result = await API.createAccount(payload);
        }

        if (result && !result.error) {
            showToast(id ? 'Account updated!' : 'Account added!');
            closeAccountModal();
            loadAccounts();
        } else {
            alert(result?.error || "Failed to save");
        }
    } catch (err) {
        console.error(err);
        showToast("Server error");
    }
};

/* ── STATS ── */
function renderStats() {
    document.getElementById('ct').textContent = accounts.length;
    document.getElementById('ca').textContent = accounts.filter(a => a.status === 'active').length;
    document.getElementById('ci').textContent = accounts.filter(a => a.status === 'inactive').length;
}

/* ── FILTER ── */
window.fil = function() {
    const query = (document.getElementById('srch')?.value || '').toLowerCase();
    const statusFilter = (document.getElementById('statusFilter')?.value || 'all');
    const roleFilter = (document.getElementById('roleFilter')?.value || 'all');

    const filtered = accounts.filter(a => {
        const name = `${a.first_name} ${a.last_name}`.toLowerCase();
        const accountRole = (a.roles || '').toLowerCase();

        const matchesSearch = (name.includes(query) || (a.employee_id || '').toLowerCase().includes(query));
        const matchesStatus = (statusFilter === 'all' || (a.status || '').toLowerCase() === statusFilter);
        const matchesRole = (roleFilter === 'all' || accountRole === roleFilter);

        return matchesSearch && matchesStatus && matchesRole;
    });

    document.getElementById('shw').textContent =
        `Showing ${filtered.length} account${filtered.length !== 1 ? 's' : ''}`;

    document.getElementById('list').innerHTML = filtered.map(a => `
        <div class="arow" onclick="${(a.roles || '').toLowerCase() === 'medrep' ? `location.href='../representatives/schedule/schedule.html?id=${a.id}'` : ''}">
            <span class="sdot" style="background:${a.status === 'active' ? '#22c55e' : '#ef4444'}"></span>
            <div class="ava">${initials(a.first_name, a.last_name)}</div>
            <div class="ri">
                <div class="rn">${a.first_name} ${a.last_name}</div>
                <div class="rm">
                    <span>${a.employee_id}</span> | 
                    <span style="text-transform: uppercase; font-weight: bold; color: #3e627a;">${a.roles || 'medrep'}</span> |
                    <span>${a.area}</span> |
                    <span>${a.district}</span> |
                    <span style="color: #64748b;">🕒 ${a.constant_time || '--:--'}</span>
                </div>
            </div>
            <button class="ebtn" onclick="event.stopPropagation(); openEdit('${a.id}')">Edit</button>
        </div>
    `).join('');
};