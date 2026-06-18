/* =========================================================
   📦 STATE
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       🔄 INIT & URL CLEANING
    ========================================================= */
    // 1. Get params from URL
    const urlParams = new URLSearchParams(window.location.search);
    let repId = urlParams.get('id');
    let repName = urlParams.get('name');
    let repArea = urlParams.get('area');

    // 2. If we found data in the URL, save it to session storage so we don't lose it on refresh
    if (repId) sessionStorage.setItem('active_rep_data', JSON.stringify({id: repId, name: repName, area: repArea}));
    
    // 3. If no data in URL, try to pull from session storage
    const storedData = JSON.parse(sessionStorage.getItem('active_rep_data') || '{}');
    if (!repId && storedData.id) {
        repId = storedData.id;
        repName = storedData.name;
        repArea = storedData.area;
    }

    // 4. Update UI
    if (repName) document.getElementById('rep-name').textContent = repName;
    if (repArea) document.getElementById('rep-location').textContent = repArea;

    // 5. Clean the URL bar (remove the ?id=... part)
    window.history.replaceState({}, document.title, window.location.pathname);

    // --- BACK BUTTON LOGIC ---
    const backBtn = document.getElementById('goBack');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '../representatives.html';
        });
    }

    /* =========================================================
       🎯 EVENTS (Using stored variables)
    ========================================================= */
    function getQueryString() {
        return new URLSearchParams({
            id: repId || '',
            name: repName || '',
            area: repArea || ''
        }).toString();
    }

    const cardSchedule = document.getElementById('card-schedule');
    if (cardSchedule) {
        cardSchedule.addEventListener('click', () => {
            if (!repId) return;
            window.location.href = `../schedule/schedule.html?${getQueryString()}`;
        });
    }

    const cardAttendance = document.getElementById('card-attendance');
    if (cardAttendance) {
        cardAttendance.addEventListener('click', () => {
            if (!repId) return;
            window.location.href = `attendance/attendance.html?${getQueryString()}`;
        });
    }

    const cardRequest = document.getElementById('card-request');
    if (cardRequest) {
        const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
        if (userProfile.roles !== 'super_admin') {
            cardRequest.style.display = 'none';
        }

        cardRequest.addEventListener('click', () => {
            if (!repId) return;
            window.location.href = `../schedule/request/request.html?${getQueryString()}`;
        });
    }

    const cardUploadSchedule = document.getElementById('card-upload-schedule');
    if (cardUploadSchedule) {
        cardUploadSchedule.addEventListener('click', () => {
            if (!repId) return;
            window.location.href = `../schedule/upload/upload.html?${getQueryString()}`;
        });
    }
});