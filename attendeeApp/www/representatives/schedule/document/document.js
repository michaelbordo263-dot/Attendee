document.addEventListener('DOMContentLoaded', async () => {

    const params = new URLSearchParams(window.location.search);

    // 🔑 IMPORTANT: now generic identifier (NOT just cds_id)
    const identifier  = params.get('cds_id') || params.get('id');
    const returnDate  = params.get('date');
    const repId       = params.get('user_id');
    const BASE_URL    = "http://26.209.189.89:5000";

    console.log("DEBUG:", { identifier, returnDate, repId });

    // ── BACK BUTTON ─────────────────────────────
    document.getElementById('goBack')?.addEventListener('click', () => {
        if (repId && returnDate) {
            window.location.href =
                `../schedule.html?user_id=${repId}&date=${encodeURIComponent(returnDate)}`;
        } else {
            window.history.back();
        }
    });

    // ── GUARD ───────────────────────────────────
    if (!identifier || identifier === "undefined") {
        showDefaultPanel();
        return;
    }

    // ── FETCH ────────────────────────────────────
    try {
        const url = `${BASE_URL}/api/doctor_details/${identifier}`;
        console.log("FETCH:", url);

        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");

        const data = await res.json();
        console.log("API:", data);

        // ── STRUCTURE (NEW BACKEND) ──────────────
        const cds = data.cds || {};
        const dcp = data.dcp || {};
        const doc = data.document || {};

        // ── LEFT SIDE ─────────────────────────────
        setText('doc-first-name', cds.First_Name);
        setText('doc-last-name', cds.Last_Name);
        setText('doc-mid-name', cds.Middle_Name);
        setText('doc-suffix', cds.Suffix);

        setText('doc-md-code', cds.Doctor_Code);
        setText('doc-md-desc', cds.Specialty_MDs_Description);
        setText('doc-hospital', cds.Hospital_Affiliation_Clinic_Name || cds.Pharmacy_Name);

        setText('doc-bldg', cds.Bldg_Nos_Street_Brgy);
        setText('doc-address', cds.City_Address_Province);

        // ── STATUS ──
        const status = (doc.document_status || doc.status || '').toLowerCase().trim();

        renderVisitLog(status);

        // ── RIGHT PANEL ───────────────────────────
        renderRightPanel(
            {
                ...cds,
                ...doc,
                items: doc.items,
                signature_url: doc.signature_url
            },
            status
        );

    } catch (err) {
        console.error("ERROR:", err);
        showDefaultPanel();
    }

    // ── MODAL ───────────────────────────────────
    const modal = document.getElementById('signature-modal');

    document.getElementById('signatureBtn')?.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    const close = () => modal.style.display = 'none';

    document.getElementById('closeModal')?.addEventListener('click', close);
    document.getElementById('closeModalBtn')?.addEventListener('click', close);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

});


// ── HELPERS ─────────────────────────────────────────────

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ? value : '—';
}


// ── ITEM GRID ───────────────────────────────────────────

function buildItemGrid(containerId, items) {
    const list = document.getElementById(containerId);
    if (!list) return;

    list.innerHTML = '';

    const icons = ['fa-box', 'fa-pills', 'fa-vial'];

    for (let i = 0; i < 6; i++) {
        const itemName = items?.[i] || `Item ${i + 1}`;

        const box = document.createElement('div');
        box.className = 'default-item';

        box.innerHTML = `
            <i class="fas ${icons[i % icons.length]}"></i>
            <span>${itemName}</span>
        `;

        list.appendChild(box);
    }
}


// ── VISIT LOG ───────────────────────────────────────────

function renderVisitLog(status) {
    // Map 'approved' to the 'signed' radio button for UI consistency
    const uiStatus = (status === 'approved' || status === 'signed') ? 'signed' : status;

    const radio = document.querySelector(`input[name="visitStatus"][value="${uiStatus}"]`);
    
    // Reset styles for all labels
    document.querySelectorAll('.radio-label').forEach(label => {
        label.style.color = 'inherit';
        label.style.fontWeight = 'normal';
    });

    if (radio) {
        radio.checked = true;
        const label = radio.closest('.radio-label');
        if (label) {
            label.style.fontWeight = 'bold';
            if (uiStatus === 'signed') label.style.color = '#22c55e'; // Green for Signed
            else if (uiStatus === 'mia') label.style.color = '#eab308'; // Yellow for MIA
            else if (uiStatus === 'rejected') label.style.color = '#ef4444'; // Red for Rejected
        }
    }
}


// ── RIGHT PANEL ─────────────────────────────────────────

function renderRightPanel(data, status) {
    const panelItems   = document.getElementById('panel-items');
    const panelRemarks = document.getElementById('panel-remarks');
    const panelDefault = document.getElementById('panel-default');
    const sigWrapper   = document.getElementById('signature-wrapper');

    panelItems.style.display = 'none';
    panelRemarks.style.display = 'none';
    panelDefault.style.display = 'none';
    if (sigWrapper) sigWrapper.style.display = 'none';

    // SIGNED
    if (status === 'signed' || status === 'approved') {
        panelItems.style.display = 'block';
        const h3 = panelItems.querySelector('.section-title');
        if (h3) h3.textContent = 'ITEMS SELECTED';

        buildItemGrid('product-list', data.items);

        sigWrapper.style.display = 'block';

        if (data.signature_url) {
            const img = document.getElementById('sig-img');
            img.src = data.signature_url;
        }
    }

    // MIA / REJECTED
    else if (status === 'mia' || status === 'rejected') {
        panelRemarks.style.display = 'block';
        const badge = document.getElementById('remarks-badge');
        if (badge) {
            badge.textContent = status.toUpperCase();
            badge.style.backgroundColor = (status === 'mia') ? '#eab308' : '#ef4444';
            badge.style.color = '#fff';
        }
        document.getElementById('doc-remarks').textContent =
            data.remarks || 'No remarks';
    }

    // DEFAULT
    else {
        panelDefault.style.display = 'block';
        const h3 = panelDefault.querySelector('.section-title');
        if (h3) h3.textContent = 'ITEMS';

        buildItemGrid('product-list-default', data.items);
    }
}

// ── DEFAULT PANEL ───────────────────────────────────────

function showDefaultPanel() {
    const panel = document.getElementById('panel-default');
    if (panel) {
        panel.style.display = 'block';
        const h3 = panel.querySelector('.section-title');
        if (h3) h3.textContent = 'ITEMS';
    }
}