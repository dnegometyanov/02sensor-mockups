// ============================================
// SVG GRADIENT DEFS (injected once)
// ============================================
(function injectGradients() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <defs>
      <linearGradient id="gradDetailO2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#30d158"/>
        <stop offset="100%" stop-color="#64d2ff"/>
      </linearGradient>
    </defs>
  `;
  document.body.appendChild(svg);
})();

// ============================================
// PATIENT DATA
// ============================================
const patients = {
  mom: {
    name: 'Mom', age: 72,
    baseSpO2: 96, basePulse: 68,
    currentSpO2: 96, currentPulse: 68,
    color: '#30d158', alertLevel: 'none',
    history: []
  },
  dad: {
    name: 'Dad', age: 75,
    baseSpO2: 93, basePulse: 74,
    currentSpO2: 93, currentPulse: 74,
    color: '#0a84ff', alertLevel: 'warning',
    history: []
  },
  grandma: {
    name: 'Grandma', age: 88,
    baseSpO2: 91, basePulse: 82,
    currentSpO2: 91, currentPulse: 82,
    color: '#bf5af2', alertLevel: 'critical',
    history: []
  },
  aunt: {
    name: 'Aunt Lisa', age: 65,
    baseSpO2: 97, basePulse: 62,
    currentSpO2: 97, currentPulse: 62,
    color: '#ff9f0a', alertLevel: 'none',
    history: []
  }
};

const SPARK_POINTS = 20;
let currentDetailPatient = null;

// ============================================
// INDEPENDENT VITALS UPDATE (2s interval)
// ============================================
function updatePatientVitals() {
  Object.keys(patients).forEach(id => {
    const p = patients[id];

    // Mean-reverting random walk for SpO2
    const o2Drift = (p.baseSpO2 - p.currentSpO2) * 0.1;
    p.currentSpO2 += o2Drift + (Math.random() - 0.48) * 0.8;
    p.currentSpO2 = Math.max(82, Math.min(100, p.currentSpO2));

    // Mean-reverting random walk for pulse
    const pulseDrift = (p.basePulse - p.currentPulse) * 0.1;
    p.currentPulse += pulseDrift + (Math.random() - 0.5) * 2;
    p.currentPulse = Math.max(40, Math.min(140, p.currentPulse));

    // History for sparkline
    p.history.push(p.currentSpO2);
    if (p.history.length > SPARK_POINTS) p.history.shift();

    const spo2 = Math.round(p.currentSpO2);
    const pulse = Math.round(p.currentPulse);

    // Update card UI
    const spo2El = document.getElementById('spo2-' + id);
    const pulseEl = document.getElementById('pulse-' + id);
    const alertEl = document.getElementById('alert-' + id);

    if (spo2El) {
      spo2El.textContent = spo2;
      spo2El.style.color = getHexColor(spo2);
    }
    if (pulseEl) pulseEl.textContent = pulse;

    // Update alert text
    if (alertEl) {
      if (spo2 < 90) {
        alertEl.textContent = 'Critical low O2';
        alertEl.className = 'patient-alert-text alert-active';
        p.alertLevel = 'critical';
      } else if (spo2 < 93) {
        alertEl.textContent = 'Low O2 warning';
        alertEl.className = 'patient-alert-text alert-warning';
        p.alertLevel = 'warning';
      } else {
        alertEl.textContent = 'No alerts';
        alertEl.className = 'patient-alert-text';
        p.alertLevel = 'none';
      }
    }

    // Draw sparkline
    drawSparkline(id);
  });

  // Update emergency banner
  updateEmergencyBanner();

  // Update detail view if open
  if (currentDetailPatient) {
    updateDetailView(currentDetailPatient);
  }
}

// ============================================
// EMERGENCY BANNER
// ============================================
function updateEmergencyBanner() {
  const banner = document.getElementById('emergencyBanner');
  const textEl = document.getElementById('emergencyText');

  let worstId = null;
  let worstSpo2 = 100;

  Object.keys(patients).forEach(id => {
    const spo2 = Math.round(patients[id].currentSpO2);
    if (spo2 < worstSpo2) {
      worstSpo2 = spo2;
      worstId = id;
    }
  });

  if (worstSpo2 < 90 && worstId) {
    banner.classList.add('visible');
    textEl.textContent = `Critical: ${patients[worstId].name} SpO2 at ${worstSpo2}%`;
  } else {
    banner.classList.remove('visible');
  }
}

// ============================================
// SPARKLINE RENDERING
// ============================================
const sparkCanvases = {};
const sparkCtxs = {};

function initSparklines() {
  Object.keys(patients).forEach(id => {
    const canvas = document.getElementById('spark-' + id);
    if (canvas) {
      sparkCanvases[id] = canvas;
      const dpr = window.devicePixelRatio || 2;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      sparkCtxs[id] = ctx;
    }
  });
}

function drawSparkline(id) {
  const canvas = sparkCanvases[id];
  const ctx = sparkCtxs[id];
  const data = patients[id].history;
  if (!canvas || !ctx || data.length < 2) return;

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const isDark = root.getAttribute('data-theme') === 'dark';

  ctx.clearRect(0, 0, w, h);

  const minY = 82, maxY = 100;
  const pad = 2;
  const cW = w - pad * 2;
  const cH = h - pad * 2;

  const points = data.map((val, i) => ({
    x: pad + (i / (SPARK_POINTS - 1)) * cW,
    y: pad + cH * (1 - (Math.max(minY, Math.min(maxY, val)) - minY) / (maxY - minY))
  }));

  // Area fill
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, pad + cH);
  ctx.lineTo(points[0].x, pad + cH);
  ctx.closePath();
  const color = patients[id].color;
  const grad = ctx.createLinearGradient(0, pad, 0, pad + cH);
  grad.addColorStop(0, color + (isDark ? '40' : '30'));
  grad.addColorStop(1, color + '05');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ============================================
// DETAIL VIEW
// ============================================
const DETAIL_RING_CIRCUMFERENCE = 2 * Math.PI * 54; // r=54

function showDetail(patientId) {
  currentDetailPatient = patientId;
  const p = patients[patientId];

  document.getElementById('detailPatientName').textContent = p.name;

  // Switch screens
  document.getElementById('screenMain').classList.remove('active');
  document.getElementById('screenDetail').classList.add('active');

  // Generate chart data for this patient
  generateChartData('D', p.baseSpO2);
  resizeChart();
  drawChart();

  // Immediate update
  updateDetailView(patientId);
}

function updateDetailView(patientId) {
  const p = patients[patientId];
  const spo2 = Math.round(p.currentSpO2);
  const pulse = Math.round(p.currentPulse);

  // Ring
  const o2Pct = Math.max(0, Math.min(1, (spo2 - 80) / 20));
  const o2Dash = o2Pct * DETAIL_RING_CIRCUMFERENCE;
  const ringFill = document.getElementById('detailRingFill');
  ringFill.setAttribute('stroke-dasharray', `${o2Dash} ${DETAIL_RING_CIRCUMFERENCE}`);

  document.getElementById('detailSpo2Value').textContent = spo2;
  document.getElementById('detailPulseValue').textContent = pulse;

  // Status badge
  const statusEl = document.getElementById('detailStatus');
  statusEl.textContent = getStatusText(spo2);
  statusEl.style.background = getStatusBg(spo2);
  statusEl.style.color = getStatusColor(spo2);

  // Detail alert
  const alertDiv = document.getElementById('detailAlert');
  const alertIcon = document.getElementById('detailAlertIcon');
  const alertText = document.getElementById('detailAlertText');

  if (spo2 < 90) {
    alertDiv.className = 'detail-alert alert-red';
    alertIcon.innerHTML = '&#9888;';
    alertText.textContent = `SpO2 critically low at ${spo2}%. Immediate attention needed.`;
  } else if (spo2 < 93) {
    alertDiv.className = 'detail-alert alert-yellow';
    alertIcon.innerHTML = '&#9211;';
    alertText.textContent = `SpO2 slightly low at ${spo2}%. Monitoring recommended.`;
  } else {
    alertDiv.className = 'detail-alert alert-green';
    alertIcon.innerHTML = '&#10003;';
    alertText.textContent = 'All vitals within normal range.';
  }
}

function hideDetail() {
  currentDetailPatient = null;
  document.getElementById('screenDetail').classList.remove('active');
  document.getElementById('screenMain').classList.add('active');
}

// ============================================
// HISTORY CHART
// ============================================
const chartCanvas = document.getElementById('chartCanvas');
const chartCtx = chartCanvas.getContext('2d');
let chartData = [];

function generateChartData(period, baseSpO2) {
  const base = baseSpO2 || 95;
  const counts = { D: 24, W: 7, M: 30, '6M': 26, Y: 12 };
  const n = counts[period] || 24;
  chartData = [];
  for (let i = 0; i < n; i++) {
    const val = base - 1 + Math.random() * 4;
    const dip = Math.random() < 0.15 ? -(Math.random() * 6 + 2) : 0;
    chartData.push(Math.max(82, Math.min(100, val + dip)));
  }
  const avg = chartData.reduce((a, b) => a + b, 0) / chartData.length;
  document.getElementById('statAvg').textContent = Math.round(avg) + '%';
  document.getElementById('statMin').textContent = Math.round(Math.min(...chartData)) + '%';
  document.getElementById('statMax').textContent = Math.round(Math.max(...chartData)) + '%';
}

function resizeChart() {
  chartCanvas.width = chartCanvas.offsetWidth * 2;
  chartCanvas.height = chartCanvas.offsetHeight * 2;
  chartCtx.scale(2, 2);
}

function drawChart() {
  const w = chartCanvas.offsetWidth;
  const h = chartCanvas.offsetHeight;
  const isDark = root.getAttribute('data-theme') === 'dark';

  chartCtx.clearRect(0, 0, w, h);
  if (chartData.length === 0) return;

  const minY = 80, maxY = 100;
  const padL = 0, padR = 0, padT = 4, padB = 4;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Safe zone
  const safeTop = padT + chartH * (1 - (100 - minY) / (maxY - minY));
  const safeBot = padT + chartH * (1 - (90 - minY) / (maxY - minY));
  chartCtx.fillStyle = isDark ? 'rgba(48, 209, 88, 0.08)' : 'rgba(48, 209, 88, 0.1)';
  chartCtx.fillRect(padL, safeTop, chartW, safeBot - safeTop);

  // Warning zone
  const warnBot = padT + chartH * (1 - (82 - minY) / (maxY - minY));
  chartCtx.fillStyle = isDark ? 'rgba(255, 214, 10, 0.04)' : 'rgba(255, 214, 10, 0.06)';
  chartCtx.fillRect(padL, safeBot, chartW, warnBot - safeBot);

  // 90% line
  chartCtx.beginPath();
  chartCtx.setLineDash([4, 4]);
  chartCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  chartCtx.lineWidth = 0.5;
  const y90 = padT + chartH * (1 - (90 - minY) / (maxY - minY));
  chartCtx.moveTo(padL, y90);
  chartCtx.lineTo(padL + chartW, y90);
  chartCtx.stroke();
  chartCtx.setLineDash([]);

  const points = chartData.map((val, i) => ({
    x: padL + (i / (chartData.length - 1)) * chartW,
    y: padT + chartH * (1 - (val - minY) / (maxY - minY))
  }));

  // Area fill
  chartCtx.beginPath();
  chartCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    chartCtx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
  }
  chartCtx.lineTo(points[points.length - 1].x, padT + chartH);
  chartCtx.lineTo(points[0].x, padT + chartH);
  chartCtx.closePath();
  const grad = chartCtx.createLinearGradient(0, padT, 0, padT + chartH);
  if (isDark) {
    grad.addColorStop(0, 'rgba(48, 209, 88, 0.25)');
    grad.addColorStop(0.5, 'rgba(48, 209, 88, 0.08)');
    grad.addColorStop(1, 'rgba(48, 209, 88, 0.01)');
  } else {
    grad.addColorStop(0, 'rgba(48, 209, 88, 0.3)');
    grad.addColorStop(0.5, 'rgba(48, 209, 88, 0.1)');
    grad.addColorStop(1, 'rgba(48, 209, 88, 0.02)');
  }
  chartCtx.fillStyle = grad;
  chartCtx.fill();

  // Line
  chartCtx.beginPath();
  chartCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    chartCtx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
  }
  chartCtx.strokeStyle = isDark ? '#30d158' : '#28a745';
  chartCtx.lineWidth = 2;
  chartCtx.stroke();

  // Dots
  points.forEach((p, i) => {
    const val = chartData[i];
    let color = '#30d158';
    if (val < 82) color = '#ff3b30';
    else if (val < 90) color = '#ffd60a';

    chartCtx.beginPath();
    chartCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    chartCtx.fillStyle = color;
    chartCtx.fill();

    if (val < 90) {
      chartCtx.beginPath();
      chartCtx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      chartCtx.fillStyle = color === '#ff3b30' ? 'rgba(255,59,48,0.2)' : 'rgba(255,214,10,0.2)';
      chartCtx.fill();
    }
  });
}

// ============================================
// PERIOD SELECTOR
// ============================================
const periodLabels = { D: 'Today', W: 'This Week', M: 'This Month', '6M': '6 Months', Y: 'This Year' };
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('chartSubtitle').textContent = periodLabels[btn.dataset.period];
    const base = currentDetailPatient ? patients[currentDetailPatient].baseSpO2 : 95;
    generateChartData(btn.dataset.period, base);
    drawChart();
  });
});

// ============================================
// TAB SWITCHING OVERRIDE
// ============================================
// When tabs switch, hide detail view and go back to grid
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    // If we're in detail view, close it first
    if (currentDetailPatient) {
      currentDetailPatient = null;
      document.getElementById('screenDetail').classList.remove('active');
    }
  });
});

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initSparklines();
  resizeChart();

  // Patient card clicks
  document.querySelectorAll('.patient-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.patient;
      if (id) showDetail(id);
    });
  });

  // Back button
  document.getElementById('detailBackBtn').addEventListener('click', hideDetail);

  // Initial vitals update
  updatePatientVitals();

  // Start independent update loop
  setInterval(updatePatientVitals, 2000);
});

window.addEventListener('themechange', () => {
  drawChart();
  // Redraw all sparklines
  Object.keys(patients).forEach(id => drawSparkline(id));
});

window.addEventListener('resize', () => {
  initSparklines();
  Object.keys(patients).forEach(id => drawSparkline(id));
  resizeChart();
  drawChart();
});
