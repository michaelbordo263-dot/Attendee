/* ============================================================
   performance_details.js — Integer display version
   ============================================================ */

function goBack() {
    history.back();
}

/* MODULE-LEVEL STATE (used by export) */
let _repData    = null;
let _scoreData  = null;
let _doctorData = null;

/* INIT */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const now = new Date();

    _repData = {
        name:  params.get('name') || 'Medical Representative',
        loc:   params.get('location') || params.get('area') || 'Assignment Area',
        id:    params.get('user_id') || params.get('id'),
        month: parseInt(params.get('month')) || (now.getMonth() + 1),
        year:  params.get('year') || now.getFullYear().toString()
    };

    // Restore representative fallback from sessionStorage when missing in URL
    if (!_repData.id) {
        try {
            const stored = sessionStorage.getItem('active_rep_data');
            const rep = stored ? JSON.parse(stored) : {};
            if (rep.id) {
                _repData.id = rep.id;
                _repData.name = _repData.name === 'Medical Representative' ? (rep.name || _repData.name) : _repData.name;
                _repData.loc = _repData.loc === 'Assignment Area' ? (rep.area || _repData.loc) : _repData.loc;
            }
        } catch (e) {
            console.warn('Could not restore active_rep_data', e);
        }
    }

    // Restore view state (month/year) from session storage if URL didn't provide them
    if (!params.has('month') && !params.has('year')) {
        try {
            const viewJson = sessionStorage.getItem('active_performance_view');
            const view = viewJson ? JSON.parse(viewJson) : {};
            if (view.month) _repData.month = view.month;
            if (view.year)  _repData.year  = view.year;
        } catch (e) {
            console.warn('Could not restore active_performance_view', e);
        }
    }

    document.getElementById('repName').textContent    = _repData.name;
    document.getElementById('repLoc').textContent     = _repData.loc;
    const MONTH_NAMES = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    document.getElementById('quarterBadge').textContent = `${MONTH_NAMES[_repData.month - 1]} · ${_repData.year}`;

    if (_repData.id) {
        // persist rep state for other pages
        try {
            sessionStorage.setItem('active_rep_data', JSON.stringify({ id: _repData.id, name: _repData.name, area: _repData.loc }));
        } catch (e) {
            console.warn('Could not save active_rep_data', e);
        }

        // persist view state (month/year)
        try {
            sessionStorage.setItem('active_performance_view', JSON.stringify({ month: _repData.month, year: _repData.year }));
        } catch (e) {
            console.warn('Could not save active_performance_view', e);
        }

        // Clean URL so subsequent back/forward relies on sessionStorage
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        fetchPerformanceData(_repData);
    } else {
        console.error("No User ID provided.");
        document.getElementById('repName').textContent = "User ID Missing";
    }
});

/* HELPERS */
function getCurrentQuarter() {
    const m = new Date().getMonth();
    if (m <= 2) return 1;
    if (m <= 5) return 2;
    if (m <= 8) return 3;
    return 4;
}

/* FETCH DATA */
async function fetchPerformanceData(rep) {
    try {
        const data = await API.fetchMedrepPerformanceDetails(rep.id, rep.month, rep.year);

        if (data.error) {
            console.error("API Error:", data.error);
            return;
        }

        _scoreData  = data.scores;
        _doctorData = data.top_doctors;

        updateScore(_scoreData);
        renderMostVisited(_doctorData);

    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

/* UPDATE SCORE UI (INTEGER DISPLAY) */
function updateScore(s) {
    if (!s) return;

    // ensure integers (backend should also return integer, but coerce here)
    const att = Math.round(Number(s.attendance ?? 0));
    const vis = Math.round(Number(s.visits_done ?? 0));
    const mis = Math.round(Number(s.missed_visits ?? 0));
    const pct = Math.round(Number(s.overall_average ?? 0));

    document.getElementById('cvAttendance').textContent = `${att}%`;
    document.getElementById('cvVisits').textContent     = `${vis}%`;
    document.getElementById('cvMissing').textContent    = `${mis}%`;

    const ring = document.getElementById('ring');
    const circ = 2 * Math.PI * 66;

    document.getElementById('pctLabel').textContent = `${pct}%`;

    const color =
        pct >= 80 ? '#3ecf5a' :
        pct >= 50 ? '#f0a030' :
                    '#e05c5c';

    ring.style.stroke = color;

    requestAnimationFrame(() => {
        ring.style.strokeDashoffset = circ * (1 - pct / 100);
    });
}

/* SIGNATURE LEADER (TOP DOCTORS) */
function renderMostVisited(doctors) {
    const container = document.getElementById('mvdList');
    if (!container) return;

    container.innerHTML = '';

    if (!doctors || doctors.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; opacity:0.6;">
                <p>No signed visits recorded for this quarter.</p>
            </div>`;
        return;
    }

    const limitedDoctors = doctors;

    limitedDoctors.forEach((doc, i) => {
        const rank = i + 1;
        const displayName = doc.name || doc.pharmacy_name || 'Unknown Entity';
        const displayLoc = (doc.location && doc.location !== 'N/A')
            ? doc.location
            : (doc.city_address_province || 'Location N/A');

        const total = Math.round(Number(doc.total_visits_planned || 0));
        const signed = Math.round(Number(doc.signed_visits || 0));
        const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
        const isComplete = signed === total;
        const barColor = isComplete ? '#3ecf5a' : '#1e6fa8';
        const initials = displayName.charAt(0).toUpperCase();

        const el = document.createElement('div');
        el.className = 'mvd-item';
        el.innerHTML = `
            <div class="mvd-rank">#${rank}</div>
            <div class="mvd-av">${initials}</div>
            <div class="mvd-body">
                <div class="mvd-top-row">
                    <div>
                        <div class="mvd-name">${displayName}</div>
                        <div class="mvd-loc">${displayLoc}</div>
                    </div>
                </div>
                <div class="mvd-bar-row">
                    <div class="mvd-bar-bg">
                        <div class="mvd-bar-fill" style="width:0%; background:${barColor}; transition: width 0.8s ease;" data-target="${pct}"></div>
                    </div>
                    <div class="mvd-bar-meta"><b>${signed}/${total}</b></div>
                </div>
            </div>`;
        // attach click handler to persist selection + scroll before navigation
        el.addEventListener('click', () => {
            try {
                const id = doc.id || doc.cds_id || doc.pharmacy_id || doc.uuid || null;
                sessionStorage.setItem('active_perf_data', JSON.stringify({
                    selectedDoctorId: id,
                    scrollTop: container.scrollTop || 0,
                    month: _repData.month,
                    year: _repData.year
                }));
            } catch (e) {
                console.warn('Could not save active_perf_data', e);
            }
        });

        container.appendChild(el);
    });

    setTimeout(() => {
        container.querySelectorAll('.mvd-bar-fill').forEach(b => {
            b.style.width = b.dataset.target + '%';
        });
    }, 300);
}
    
    // Restore selected item and scroll position if any
    try {
        const storedJson = sessionStorage.getItem('active_perf_data');
        const stored = storedJson ? JSON.parse(storedJson) : null;
        if (stored && stored.selectedDoctorId) {
            requestAnimationFrame(() => {
                const items = container.querySelectorAll('.mvd-item');
                let foundEl = null;
                items.forEach(it => {
                    const name = it.querySelector('.mvd-name')?.textContent?.trim() || '';
                    // try to match by dataset if present
                    if (it.dataset && it.dataset.id && String(it.dataset.id) === String(stored.selectedDoctorId)) {
                        foundEl = it;
                    }
                    // fallback: match by name (best-effort)
                    if (!foundEl && name && String(name).includes(String(stored.selectedDoctorId))) {
                        foundEl = it;
                    }
                });

                if (foundEl) {
                    foundEl.classList.add('selected-visit');
                    if (typeof stored.scrollTop === 'number') container.scrollTop = stored.scrollTop;
                    foundEl.scrollIntoView({ block: 'center' });
                }
            });
        }
    } catch (e) {
        console.warn('Could not restore active_perf_data', e);
    }

let _cordovaReady = false;
document.addEventListener('deviceready', () => {
    _cordovaReady = true;
    console.log("deviceready fired. cordova.file:", typeof cordova.file);
}, false);
    
/* EXPORT REPORT — Mobile/PC Compatible & Scope-Safe */
const exportXlsx = async () => {

    const isCordova = _cordovaReady && 
                  typeof window.cordova !== 'undefined' && 
                  typeof window.cordova.file !== 'undefined';
    const isNativeApp = /Android|iPhone|iPad/i.test(navigator.userAgent);
    console.log("Export triggered. isCordova:", isCordova, "| isNativeApp:", isNativeApp);

    try {
        const response = await fetch(`${window.BASE_URL}/export_xlsx`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: _repData.id,
                year: parseInt(_repData.year)
            }),
        });

        if (!response.ok) throw new Error("Server returned " + response.status);

        const blob = await response.blob();
        const fileName = `${_repData.name.replace(/\s+/g, '_')}_${_repData.year}.xlsx`;

        if (isCordova) {
            console.log("Cordova file plugins available, saving to device...");
            const dir = cordova.file.externalDataDirectory;

            blob.arrayBuffer().then(buffer => {
                window.resolveLocalFileSystemURL(dir, (dirEntry) => {
                    dirEntry.getFile(fileName, { create: true, exclusive: false }, (fileEntry) => {
                        fileEntry.createWriter((fileWriter) => {
                            fileWriter.onwriteend = () => {
                                console.log("File written successfully:", fileEntry.toURL());
                                if (window.cordova.plugins && window.cordova.plugins.fileOpener2) {
                                    fileEntry.file(function(file) {
                                        const nativePath = fileEntry.nativeURL;
                                        console.log("Opening native path:", nativePath);
                                        window.cordova.plugins.fileOpener2.showOpenWithDialog(
                                            nativePath,
                                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                            { error: (e) => alert("Open failed: " + JSON.stringify(e)) }
                                        );
                                    });
                                } else {
                                    alert("File saved to: " + fileEntry.nativeURL);
                                }
                            };
                            fileWriter.onerror = (e) => alert("File write failed: " + JSON.stringify(e));
                            fileWriter.write(buffer);
                        });
                    }, (err) => alert("File access error: " + JSON.stringify(err)));
                }, (err) => alert("resolveLocalFileSystemURL failed: " + JSON.stringify(err)));
            }).catch(e => alert("Buffer conversion failed: " + e.message));

        } else if (isNativeApp && typeof LocalFileSystem !== 'undefined') {
            console.log("Native app but cordova.file missing — trying requestFileSystem fallback...");
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, (fs) => {
                fs.root.getFile(fileName, { create: true }, (fileEntry) => {
                    fileEntry.createWriter((writer) => {
                        writer.onwriteend = () => {
                            if (window.plugins && window.plugins.fileOpener2) {
                                window.plugins.fileOpener2.showOpenWithDialog(
                                    fileEntry.toURL(),
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                );
                            } else {
                                const url = URL.createObjectURL(blob);
                                window.open(url, '_system');
                                setTimeout(() => URL.revokeObjectURL(url), 5000);
                            }
                        };
                        writer.write(blob);
                    });
                });
            }, (e) => alert("FileSystem error: " + e.code));

        } else {
            console.log("Desktop detected, starting download...");
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }

    } catch (error) {
        console.error("Export error:", error);
        alert("Export failed: " + error.message);
    }
};