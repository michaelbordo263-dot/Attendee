/* =========================================================
   📦 STATE
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       🔄 INIT
    ========================================================= */
    // Extract URL parameters to display the name and location in the header
    const urlParams = new URLSearchParams(window.location.search);
    const repId = urlParams.get('id');
    const repName = urlParams.get('name');
    const repArea = urlParams.get('area');

    if (repName) document.getElementById('rep-name').textContent = repName;
    if (repArea) document.getElementById('rep-location').textContent = repArea;

    // --- BACK BUTTON LOGIC ---
    const backBtn = document.getElementById('goBack');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '../representatives.html';
        });
    }

    /* =========================================================
       🎯 EVENTS
    ========================================================= */
    const cardSchedule = document.getElementById('card-schedule');
    if (cardSchedule) {
        cardSchedule.addEventListener('click', () => {
            if (!repId) return;

            const query = new URLSearchParams({
                id: repId,
                name: repName || '',
                area: repArea || ''
            }).toString();

            window.location.href = `../schedule/schedule.html?${query}`;
        });
    }

    const cardAttendance = document.getElementById('card-attendance');
    if (cardAttendance) {
        cardAttendance.addEventListener('click', () => {
            if (!repId) return;

            const query = new URLSearchParams({
                id: repId,
                name: repName || '',
                area: repArea || ''
            }).toString();

            window.location.href = `attendance/attendance.html?${query}`;
        });
    }

    const cardRequest = document.getElementById('card-request');
    if (cardRequest) {
        const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
        // Hide the Request card if the logged-in user is not a super_admin
        if (userProfile.roles !== 'super_admin') {
            cardRequest.style.display = 'none';
        }

        cardRequest.addEventListener('click', () => {
            if (!repId) return;

            const query = new URLSearchParams({
                id: repId,
                name: repName || '',
                area: repArea || ''
            }).toString();

            window.location.href = `../schedule/request/request.html?${query}`;
        });
    }

    const cardUploadSchedule = document.getElementById('card-upload-schedule');
    if (cardUploadSchedule) {
        cardUploadSchedule.addEventListener('click', () => {
            if (!repId) return;

            const query = new URLSearchParams({
                id: repId,
                name: repName || '',
                area: repArea || ''
            }).toString();
            window.location.href = `../schedule/upload/upload.html?${query}`;
        });
    }
});