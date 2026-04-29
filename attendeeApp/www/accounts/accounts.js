const BASE_URL = 'http://26.209.189.89:5000/api/accounts';

let accounts = [];

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

/* ── LOAD ACCOUNTS ── */
async function loadAccounts() {
    try {
        const response = await fetch(BASE_URL);
        const result = await response.json();

        const raw = result.data || [];
        accounts = raw.filter(a => (a.roles || '').toLowerCase() === 'medrep');

        renderStats();
        fil();

    } catch (error) {
        console.error('Error fetching accounts:', error);
        showToast('Failed to connect to backend');
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
    ['fName', 'lName', 'empId', 'areaInput', 'districtInput'].forEach(id => {
        const el = document.getElementById(id);
        el.setAttribute('readonly', true);
        el.removeAttribute('required');
    });
    document.getElementById('statusInput').disabled = false;

    document.getElementById('accountModal').classList.add('active');
};

/* ── ADD ── */
window.addAccount = function() {
    document.getElementById('modalTitle').textContent = 'Add Account';
    document.getElementById('submitBtn').textContent = 'Add';
    document.getElementById('accountForm').reset();
    document.getElementById('accId').value = '';

    // Unlock all editable fields
    ['fName', 'lName', 'empId', 'areaInput', 'districtInput'].forEach(id => {
        const el = document.getElementById(id);
        el.removeAttribute('readonly');
        el.setAttribute('required', true);
    });

    // Lock status to Active
    const status = document.getElementById('statusInput');
    status.value = 'active';
    status.disabled = true;

    document.getElementById('accountModal').classList.add('active');
};

window.closeAccountModal = function() {
    document.getElementById('accountModal').classList.remove('active');
    // Reset field states for next open
    ['fName', 'lName', 'empId', 'areaInput', 'districtInput'].forEach(id => {
        document.getElementById(id).removeAttribute('readonly');
    });
    document.getElementById('statusInput').disabled = false;
};

/* ── SAVE ── */
window.saveAccount = async function(e) {
    e.preventDefault();

    const id = document.getElementById('accId').value;
    const employee_id = document.getElementById('empId').value;

    // Re-enable status in case it was disabled (Add mode) so value is readable
    const statusEl = document.getElementById('statusInput');
    statusEl.disabled = false;

    const payload = {
        employee_id,
        first_name: document.getElementById('fName').value,
        last_name: document.getElementById('lName').value,
        area: document.getElementById('areaInput').value,
        district: document.getElementById('districtInput').value,
        status: document.getElementById('statusInput').value,
        roles: 'medrep'
    };

    try {
        let url = BASE_URL;
        let method = 'POST';

        if (id) {
            url = `${BASE_URL}/${employee_id}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(id ? 'Account updated!' : 'Account added!');
            closeAccountModal();
            loadAccounts();
        } else {
            const err = await response.json();
            alert(err.error || "Failed to save");
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
    const query = document.getElementById('srch').value.toLowerCase();
    const filter = document.getElementById('statusFilter').value;

    const filtered = accounts.filter(a => {
        const name = `${a.first_name} ${a.last_name}`.toLowerCase();
        return (
            (name.includes(query) || a.employee_id.toLowerCase().includes(query)) &&
            (filter === 'all' || a.status === filter)
        );
    });

    document.getElementById('shw').textContent =
        `Showing ${filtered.length} account${filtered.length !== 1 ? 's' : ''}`;

    document.getElementById('list').innerHTML = filtered.map(a => `
        <div class="arow" onclick="location.href='../representatives/schedule/schedule.html?id=${a.id}'">
            <span class="sdot" style="background:${a.status === 'active' ? '#22c55e' : '#ef4444'}"></span>
            <div class="ava">${initials(a.first_name, a.last_name)}</div>
            <div class="ri">
                <div class="rn">${a.first_name} ${a.last_name}</div>
                <div class="rm">
                    <span>${a.employee_id}</span> |
                    <span>${a.area}</span> |
                    <span>${a.district}</span>
                </div>
            </div>
            <button class="ebtn" onclick="event.stopPropagation(); openEdit('${a.id}')">Edit</button>
        </div>
    `).join('');
};