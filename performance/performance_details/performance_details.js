/* ============================================================
   performance_details.js — WHOLE NUMBER ROUNDING VERSION (Refactored)
   ============================================================ */

function goBack() {
    history.back();
}

/* ============================================================
   MODULE-LEVEL STATE (used by export)
   ============================================================ */
let _repData    = null;
let _scoreData  = null;
let _doctorData = null;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const now = new Date();

    const urlQ = params.get('q') || params.get('quarter');
    const currentRealQuarter = urlQ ? parseInt(urlQ.replace('Q', '')) : getCurrentQuarter();

    _repData = {
        name:    params.get('name') || 'Medical Representative',
        loc:     params.get('location') || params.get('area') || 'Assignment Area',
        id:      params.get('user_id') || params.get('id'),
        quarter: currentRealQuarter,
        year:    params.get('year') || now.getFullYear().toString()
    };

    document.getElementById('repName').textContent    = _repData.name;
    document.getElementById('repLoc').textContent     = _repData.loc;
    document.getElementById('quarterBadge').textContent = `Q${_repData.quarter} · ${_repData.year}`;

    if (_repData.id) {
        fetchPerformanceData(_repData);
    } else {
        console.error("No User ID provided.");
        document.getElementById('repName').textContent = "User ID Missing";
    }
});

/* ============================================================
   HELPERS
   ============================================================ */
function getCurrentQuarter() {
    const m = new Date().getMonth();
    if (m <= 2) return 1;
    if (m <= 5) return 2;
    if (m <= 8) return 3;
    return 4;
}

/* ============================================================
   FETCH DATA
   ============================================================ */
async function fetchPerformanceData(rep) {
    try {
        const data = await API.fetchMedrepPerformanceDetails(rep.id, `Q${rep.quarter}`, rep.year);

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

/* ============================================================
   UPDATE SCORE UI (ROUNDED TO WHOLE NUMBERS)
   ============================================================ */
function updateScore(s) {
    if (!s) return;

    document.getElementById('cvOnTime').textContent     = `${Math.floor(s.on_time ?? 0)}%`;
    document.getElementById('cvAttendance').textContent = `${Math.floor(s.attendance ?? 0)}%`;
    document.getElementById('cvVisits').textContent     = `${Math.floor(s.visits_done ?? 0)}%`;
    document.getElementById('cvMissing').textContent    = `${Math.floor(s.missed_visits ?? 0)}%`;

    const pct  = Math.floor(s.overall_average || 0);
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

/* ============================================================
   SIGNATURE LEADER (TOP DOCTORS)
   ============================================================ */
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

    const limitedDoctors = doctors.slice(0, 10);

    limitedDoctors.forEach((doc, i) => {
        const rank = i + 1;
        const displayName = doc.name || doc.pharmacy_name || 'Unknown Entity';
        const displayLoc = (doc.location && doc.location !== 'N/A')
            ? doc.location
            : (doc.city_address_province || 'Location N/A');

        const total = doc.total_visits_planned || 0;
        const signed = doc.signed_visits || 0;
        const pct = total > 0 ? Math.floor((signed / total) * 100) : 0;
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
        container.appendChild(el);
    });

    setTimeout(() => {
        container.querySelectorAll('.mvd-bar-fill').forEach(b => {
            b.style.width = b.dataset.target + '%';
        });
    }, 300);
}

/* ============================================================
   EXPORT REPORT — generates an .xlsx file via SheetJS
   ============================================================ */

const exportXlsx = async () => {
  try {
    const response = await fetch(`${window.BASE_URL}/export_xlsx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: _repData.id }),
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        errMsg = err.error || JSON.stringify(err);
      } catch (_) {}
      console.error("Export failed:", errMsg);
      return;
    }

    const disposition = response.headers.get("Content-Disposition");
    console.log("Content-Disposition:", disposition);

    let filename = `${_repData.name}.xlsx`;
    if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
    if (match) {
        filename = match[1].replace(/['"]/g, "").trim();
        if (!filename.endsWith(".xlsx")) filename += ".xlsx";
    }
    }

    const blob = await response.blob();
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Export error:", error);
  }
};