// ── VISIT DATE STATE ────────────────────────────────────────
let _visitDateRaw = '';
let _visitStatus  = '';

document.addEventListener('DOMContentLoaded', async () => {

    const params = new URLSearchParams(window.location.search);

    const identifier = params.get('cds_id') || params.get('id');
    const dcpId      = params.get('dcp_id');
    const returnDate = params.get('date');
    const repId      = params.get('user_id');

    console.log("🔍 [DEBUG] URL Parameters:", { identifier, returnDate, repId });

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
        console.warn("⚠️ [DEBUG] No identifier found in URL.");
        showDefaultPanel();
        return;
    }

    // ── FETCH ────────────────────────────────────
    try {
        console.log("📡 [DEBUG] Fetching doctor details for ID:", identifier);
        const data = await API.fetchDoctorDetails(identifier, dcpId);

        console.log("📥 [DEBUG] FULL API RESPONSE:", data);

        const cds = data.cds || {};
        const doc = data.document || {};

        // ── DETECT RECORD TYPE ──────────────────────
        const recordType = (
            cds.RecordType || cds.record_type || cds.type ||
            doc.RecordType || doc.record_type || doc.type || ''
        ).toLowerCase().trim();
        const isPharmacy = recordType === 'pharmacy' || (!!cds.Pharmacy_Name && !cds.First_Name);

        console.log("🏥 [DEBUG] Record Type:", recordType, "| isPharmacy:", isPharmacy);

        if (isPharmacy) {
            // ── PHARMACY LAYOUT ──────────────────────
            document.getElementById('layout-doctor').style.display = 'none';
            document.getElementById('layout-pharmacy').style.display = 'block';

            setText('doc-pharmacy-name', cds.Pharmacy_Name || cds.Hospital_Affiliation_Clinic_Name);
            setText('doc-pharmacy-address', cds.City_Address_Province);

            // ── STATUS (pharmacy radio group) ────────
            const status = (doc.document_status || '').toLowerCase().trim();
            console.log("📊 [DEBUG] Document Status:", status);
            renderVisitLog(status, true);

            // ── ITEMS ────────────────────────────────
            let actualItems = [];
            if (status === 'signed' || status === 'approved') {
                actualItems = doc.items || [];
            } else {
                actualItems = (doc.items && doc.items.length > 0) ? doc.items : (data.items || []);
            }

            renderRightPanel({ ...cds, ...doc, items: actualItems, signature_url: doc.signature_url || data.signature_url }, status);

        } else {
            // ── DOCTOR LAYOUT (default) ──────────────
            document.getElementById('layout-doctor').style.display = 'block';
            document.getElementById('layout-pharmacy').style.display = 'none';

            // ── LEFT SIDE (DOCTOR INFO) ─────────────────
            setText('doc-first-name', cds.First_Name);
            setText('doc-last-name', cds.Last_Name);
            setText('doc-mid-name', cds.Middle_Name);
            setText('doc-suffix', cds.Suffix);

            setText('doc-md-code', cds.Doctor_Code);
            setText('doc-md-desc', cds.Specialty_MDs_Description);
            setText('doc-hospital', cds.Hospital_Affiliation_Clinic_Name || cds.Pharmacy_Name);

            setText('doc-address', cds.City_Address_Province);

            // ── STATUS ──
            const status = (doc.document_status || '').toLowerCase().trim();
            console.log("📊 [DEBUG] Document Status:", status);

            renderVisitLog(status, false);

            // ── ITEM LOGIC ─────────────────────────────
            let actualItems = [];
            
            if (status === 'signed' || status === 'approved') {
                console.log("✅ [DEBUG] Visit is Complete. Using Document_Logs items.");
                actualItems = doc.items || [];
            } else {
                console.log("💡 [DEBUG] Visit is Pending. Showing Suggested items (CDS_Products).");
                actualItems = (doc.items && doc.items.length > 0) ? doc.items : (data.items || []);
            }

            console.log("📦 [DEBUG] Final Items for Grid:", actualItems);
            console.log("📏 [DEBUG] Item Count:", actualItems.length);

            renderRightPanel(
                {
                    ...cds,
                    ...doc,
                    items: actualItems,
                    signature_url: doc.signature_url || data.signature_url
                },
                status
            );
        } // end isPharmacy else

    } catch (err) {
        console.error("❌ [DEBUG] Fetch Error:", err);
        showDefaultPanel();
    }

    // ── MODAL LOGIC ─────────────────────────────
    const modal     = document.getElementById('signature-modal');
    const prodModal = document.getElementById('product-preview-modal');

    document.getElementById('signatureBtn')?.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    const close     = () => modal.style.display = 'none';
    const closeProd = () => { if (prodModal) prodModal.style.display = 'none'; };

    document.getElementById('closeSigBtn')?.addEventListener('click', close);
    document.getElementById('closeProdBtn')?.addEventListener('click', closeProd);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    // ── VISIT DATE MODAL CLOSE ───────────────────
    const visitDateModal = document.getElementById('visit-date-modal');

    document.getElementById('closeVisitDateBtn2')?.addEventListener('click', () => {
        visitDateModal.style.display = 'none';
    });
    visitDateModal?.addEventListener('click', (e) => {
        if (e.target === visitDateModal) visitDateModal.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            close();
            closeProd();
            if (visitDateModal) visitDateModal.style.display = 'none';
        }
    });
});

// ── HELPERS ─────────────────────────────────────────────

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ? value : '—';
}

window.openProductPreview = (url, name) => {
    const modal = document.getElementById('product-preview-modal');
    const img   = document.getElementById('preview-img');
    if (!modal || !img) return;
    img.src = url;
    modal.style.display = 'flex';
};

// ── VISIT DATE MODAL ─────────────────────────────────────

function openVisitDateModal() {
    const modal = document.getElementById('visit-date-modal');
    const label = document.getElementById('visit-date-modal-label');
    const value = document.getElementById('visit-date-modal-value');
    const time  = document.getElementById('visit-date-modal-time');

    const labelMap = {
        'signed':   'Signed Time',
        'approved': 'Signed Time',
        'selfie':   'Selfie Time',
        'mia':      'MIA Time',
        'rejected': 'Rejected Time'
    };

    label.textContent = labelMap[_visitStatus] || 'Visit Time';

    if (_visitDateRaw) {
        const d = new Date(_visitDateRaw);
        value.textContent = d.toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        time.textContent = d.toLocaleTimeString('en-PH', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } else {
        value.textContent = 'No date recorded.';
        time.textContent  = '';
    }

    modal.style.display = 'flex';
}

// ── ITEM GRID ───────────────────────────────────────────

function buildItemGrid(containerId, items) {
    const list = document.getElementById(containerId);
    if (!list) return;

    list.innerHTML = '';
    const icons = ['fa-box', 'fa-pills', 'fa-vial'];
    const SUPABASE_BASE = "https://qsqjjswydcucjtuglwai.supabase.co/storage/v1/object/public/Product_Image/product_photos/";

    console.log(`🎨 [DEBUG] Building grid for ${containerId} with ${items?.length || 0} items.`);

    const realItems = (items || []).filter(item =>
        item && (item.product_brand_name || item.product_generic_name)
    );

    if (realItems.length === 0) {
        list.innerHTML = `<p style="color:#93afc4; font-size:13px; text-align:center; padding: 24px 0; grid-column: 1/-1;">No items recorded.</p>`;
        return;
    }

    realItems.forEach((item, i) => {
        const bName = item?.product_brand_name || '';
        const gName = item?.product_generic_name || '';
        const displayName = bName || gName || `Item ${i + 1}`;

        let rawImg = item?.product_image || item?.image_url || '';
        let imgSrc = String(rawImg || '').trim();

        if (imgSrc && imgSrc !== 'null' && imgSrc !== '' && !imgSrc.includes('[object Object]')) {
            imgSrc = imgSrc.replace('qsqjjswyducujtuglwai', 'qsqjjswydcucjtuglwai');
            if (!imgSrc.startsWith('http')) {
                imgSrc = SUPABASE_BASE + imgSrc;
            }
        }

        const displayUrl = (imgSrc && imgSrc.startsWith('http'))
            ? `${imgSrc}${imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}`
            : '';

        const box = document.createElement('div');
        box.className = 'default-item';

        if (displayUrl) {
            box.onclick = () => openProductPreview(displayUrl, displayName);
            box.style.cursor = 'pointer';
        }

        box.innerHTML = `
            <div class="item-img-zone">
                ${displayUrl
                    ? `<img src="${displayUrl}" class="product-img" onerror="this.onerror=null; this.src='assets/default-pill.png';" />`
                    : `<i class="fas ${icons[i % icons.length]}"></i>`
                }
            </div>
            <span class="item-name">${displayName}</span>
        `;

        list.appendChild(box);
    });
}

function renderVisitLog(status, isPharmacy = false) {
    const uiStatus = (status === 'approved' || status === 'signed') ? 'signed'
                   : status === 'selfie' ? 'selfie'
                   : status;
    const radioName = isPharmacy ? 'visitStatusPh' : 'visitStatus';
    const radio = document.querySelector(`input[name="${radioName}"][value="${uiStatus}"]`);

    const scope = isPharmacy ? document.getElementById('layout-pharmacy') : document.getElementById('layout-doctor');
    if (scope) {
        scope.querySelectorAll('.radio-label').forEach(label => {
            label.classList.remove('active-signed', 'active-mia', 'active-rejected', 'active-selfie');
        });
    }

    if (radio) {
        radio.checked = true;
        const label = radio.closest('.radio-label');
        if (label) {
            if (uiStatus === 'signed')   label.classList.add('active-signed');
            else if (uiStatus === 'selfie')   label.classList.add('active-selfie');
            else if (uiStatus === 'mia')      label.classList.add('active-mia');
            else if (uiStatus === 'rejected') label.classList.add('active-rejected');
        }
    }
}

function renderRightPanel(data, status) {
    const panelItems   = document.getElementById('panel-items');
    const panelRemarks = document.getElementById('panel-remarks');
    const panelDefault = document.getElementById('panel-default');
    const sigWrapper   = document.getElementById('signature-wrapper');

    panelItems.style.display   = 'none';
    panelRemarks.style.display = 'none';
    panelDefault.style.display = 'none';
    if (sigWrapper) sigWrapper.style.display = 'none';

    if (status === 'signed' || status === 'approved' || status === 'selfie') {
        panelItems.style.display = 'flex';
        const title = panelItems.querySelector('.section-title');
        if (title) title.textContent = 'ITEMS SELECTED';

        buildItemGrid('product-list', data.items);

        // Store for modal
        _visitDateRaw = data.document_date || '';
        _visitStatus  = status;

        // Visit Date badge
        const visitDateEl = document.getElementById('doc-visit-date');
        if (visitDateEl) {
            const raw = data.document_date;
            if (raw) {
                const d = new Date(raw);
                visitDateEl.textContent = d.toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } else {
                visitDateEl.textContent = '';
            }
        }

        // Additional Remarks
        const remarksEl = document.getElementById('doc-signed-remarks');
        if (remarksEl) {
            remarksEl.textContent = data.document_remarks || 'No remarks provided.';
        }

        // Button label
        const sigBtn = document.getElementById('signatureBtn');
        if (sigBtn) {
            sigBtn.innerHTML = status === 'selfie'
                ? '<i class="fas fa-camera"></i> View Selfie'
                : '<i class="fas fa-signature"></i> View Signature';
        }

        if (sigWrapper) sigWrapper.style.display = 'block';

        const sigImg         = document.getElementById('sig-img');
        const sigPlaceholder = document.getElementById('sig-placeholder');
        const rawSigUrl      = String(data.signature_url || '').trim();

        if (rawSigUrl && rawSigUrl !== 'null' && rawSigUrl !== '' && sigImg) {
            let sigUrl = rawSigUrl.replace('qsqjjswyducujtuglwai', 'qsqjjswydcucjtuglwai');
            sigImg.src = `${sigUrl}${sigUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            sigImg.style.display = 'block';
            if (sigPlaceholder) sigPlaceholder.style.display = 'none';
        } else {
            if (sigImg)         sigImg.style.display         = 'none';
            if (sigPlaceholder) sigPlaceholder.style.display = 'flex';
        }

            if (_visitDateRaw) openVisitDateModal();
    }
    else if (status === 'mia' || status === 'rejected') {
        panelRemarks.style.display = 'block';

        const badge = document.getElementById('remarks-badge');
        if (badge) {
            badge.textContent = status.toUpperCase();
            badge.style.backgroundColor = status === 'mia' ? '#eab308' : '#ef4444';
        }
        document.getElementById('doc-remarks').textContent =
            data.document_remarks || data.remarks || 'No remarks provided.';

        // Hint text
        const hint = document.getElementById('remarks-hint');
        if (hint) {
            hint.textContent = status === 'mia'
                ? 'The representative marked this visit as MIA.'
                : 'The representative marked this visit as Rejected.';
        }

        // Store for modal
        _visitDateRaw = data.document_date || '';
        _visitStatus  = status;

        // Visit Date badge
        const visitDateRemarksEl = document.getElementById('doc-visit-date-remarks');
        if (visitDateRemarksEl) {
            const raw = data.document_date;
            if (raw) {
                const d = new Date(raw);
                visitDateRemarksEl.textContent = d.toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } else {
                visitDateRemarksEl.textContent = '';
            }
        }
        if (_visitDateRaw) openVisitDateModal();
    }
    else {
        panelDefault.style.display = 'flex';
        const title = panelDefault.querySelector('.section-title');
        if (title) title.textContent = 'SUGGESTED ITEMS';
        buildItemGrid('product-list-default', data.items);
    }
}

function showDefaultPanel() {
    const panel = document.getElementById('panel-default');
    if (panel) panel.style.display = 'flex';
}