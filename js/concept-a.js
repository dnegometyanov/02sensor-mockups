// ============================================
// TAB SWITCHING (inside app)
// ============================================
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ============================================
// PERIOD SELECTOR
// ============================================
const periodLabels = { D: 'Today', W: 'This Week', M: 'This Month', '6M': '6 Months', Y: 'This Year' };
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('chartSubtitle').textContent = periodLabels[btn.dataset.period];
    generateChartData(btn.dataset.period);
    drawChart();
  });
});

// ============================================
// TOGGLE -> INPUT VISIBILITY
// ============================================
document.querySelectorAll('[data-toggle-input]').forEach(toggle => {
  toggle.addEventListener('change', () => {
    const target = document.getElementById(toggle.dataset.toggleInput);
    if (target) target.classList.toggle('visible', toggle.checked);
  });
});

// ============================================
// THRESHOLD SLIDERS
// ============================================
const o2Slider = document.getElementById('o2Slider');
const o2Display = document.getElementById('o2ThresholdDisplay');
const o2Context = document.getElementById('o2Context');
o2Slider.addEventListener('input', () => {
  const v = parseInt(o2Slider.value);
  o2Display.textContent = v + '%';
  if (v >= 95) o2Context.textContent = `Alert when SpO2 drops below ${v}%. Very sensitive \u2014 may trigger often during sleep.`;
  else if (v >= 90) o2Context.textContent = `Alert when SpO2 drops below ${v}%. Recommended for general wellness monitoring.`;
  else if (v >= 85) o2Context.textContent = `Alert when SpO2 drops below ${v}%. Common threshold for sleep apnea monitoring.`;
  else o2Context.textContent = `Alert when SpO2 drops below ${v}%. Clinical threshold \u2014 only alerts on severe desaturation.`;
});

const pulseHighSlider = document.getElementById('pulseHighSlider');
const pulseHighDisplay = document.getElementById('pulseHighDisplay');
pulseHighSlider.addEventListener('input', () => {
  pulseHighDisplay.textContent = pulseHighSlider.value + ' bpm';
});

const pulseLowSlider = document.getElementById('pulseLowSlider');
const pulseLowDisplay = document.getElementById('pulseLowDisplay');
pulseLowSlider.addEventListener('input', () => {
  pulseLowDisplay.textContent = pulseLowSlider.value + ' bpm';
});

// ============================================
// VITALS -> APP UI
// ============================================
vitals.onUpdate((spo2, pulse) => {
  document.getElementById('spo2Value').textContent = spo2;
  document.getElementById('pulseValue').textContent = pulse;

  // Gauge
  const maxArc = 377;
  const fillAmount = ((spo2 - 80) / 20) * maxArc;
  const color = getGaugeColor(spo2);
  const gaugeFill = document.getElementById('gaugeFill');
  const gaugeGlow = document.getElementById('gaugeGlow');
  gaugeFill.setAttribute('stroke-dasharray', `${fillAmount} 502`);
  gaugeFill.setAttribute('stroke', color);
  gaugeFill.style.filter = `drop-shadow(0 0 8px ${getHexColor(spo2)})`;
  gaugeGlow.setAttribute('stroke-dasharray', `${fillAmount} 502`);
  gaugeGlow.setAttribute('stroke', color);

  // Status
  const statusEl = document.getElementById('spo2Status');
  statusEl.textContent = getStatusText(spo2);
  statusEl.style.background = getStatusBg(spo2);
  statusEl.style.color = getStatusColor(spo2);
});

// ============================================
// PPG WAVEFORM (Canvas)
// ============================================
const ppgCanvas = document.getElementById('ppgCanvas');
const ppgCtx = ppgCanvas.getContext('2d');
let ppgOffset = 0;

function resizePPG() {
  ppgCanvas.width = ppgCanvas.offsetWidth * 2;
  ppgCanvas.height = ppgCanvas.offsetHeight * 2;
  ppgCtx.scale(2, 2);
}

function ppgWave(x) {
  const period = 80;
  const t = ((x % period) / period);
  if (t < 0.1) return Math.sin(t / 0.1 * Math.PI) * 0.9;
  if (t < 0.18) return 0.9 - (t - 0.1) / 0.08 * 0.5;
  if (t < 0.25) return 0.4 + Math.sin((t - 0.18) / 0.07 * Math.PI) * 0.15;
  if (t < 0.35) return 0.55 - (t - 0.25) / 0.1 * 0.3;
  return 0.25 * Math.exp(-(t - 0.35) * 4);
}

function drawPPG() {
  const w = ppgCanvas.offsetWidth;
  const h = ppgCanvas.offsetHeight;
  const isDark = root.getAttribute('data-theme') === 'dark';

  ppgCtx.clearRect(0, 0, w, h);

  ppgCtx.beginPath();
  const lineColor = isDark ? '#64d2ff' : '#0a84ff';
  ppgCtx.strokeStyle = lineColor;
  ppgCtx.lineWidth = 1.5;
  ppgCtx.lineJoin = 'round';

  for (let x = 0; x < w; x++) {
    const val = ppgWave(x + ppgOffset);
    const y = h - 8 - val * (h - 16);
    if (x === 0) ppgCtx.moveTo(x, y);
    else ppgCtx.lineTo(x, y);
  }
  ppgCtx.stroke();

  ppgCtx.save();
  ppgCtx.globalAlpha = 0.15;
  ppgCtx.filter = 'blur(4px)';
  ppgCtx.strokeStyle = lineColor;
  ppgCtx.lineWidth = 4;
  ppgCtx.beginPath();
  for (let x = 0; x < w; x++) {
    const val = ppgWave(x + ppgOffset);
    const y = h - 8 - val * (h - 16);
    if (x === 0) ppgCtx.moveTo(x, y);
    else ppgCtx.lineTo(x, y);
  }
  ppgCtx.stroke();
  ppgCtx.restore();

  ppgOffset += 1.2;
  requestAnimationFrame(drawPPG);
}

// ============================================
// HISTORY CHART (Canvas)
// ============================================
const chartCanvas = document.getElementById('chartCanvas');
const chartCtx = chartCanvas.getContext('2d');
let chartData = [];

function generateChartData(period) {
  const counts = { D: 24, W: 7, M: 30, '6M': 26, Y: 12 };
  const n = counts[period] || 24;
  chartData = [];
  for (let i = 0; i < n; i++) {
    const base = 95 + Math.random() * 4;
    const dip = Math.random() < 0.15 ? -(Math.random() * 6 + 2) : 0;
    chartData.push(Math.max(82, Math.min(100, base + dip)));
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

  const safeTop = padT + chartH * (1 - (100 - minY) / (maxY - minY));
  const safeBot = padT + chartH * (1 - (90 - minY) / (maxY - minY));
  chartCtx.fillStyle = isDark ? 'rgba(48, 209, 88, 0.08)' : 'rgba(48, 209, 88, 0.1)';
  chartCtx.fillRect(padL, safeTop, chartW, safeBot - safeTop);

  const warnBot = padT + chartH * (1 - (82 - minY) / (maxY - minY));
  chartCtx.fillStyle = isDark ? 'rgba(255, 214, 10, 0.04)' : 'rgba(255, 214, 10, 0.06)';
  chartCtx.fillRect(padL, safeBot, chartW, warnBot - safeBot);

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
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    chartCtx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
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
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    chartCtx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
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
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  resizePPG();
  resizeChart();
  generateChartData('D');
  drawChart();
  drawPPG();
});

window.addEventListener('themechange', () => drawChart());

window.addEventListener('resize', () => {
  resizePPG();
  resizeChart();
  drawChart();
});

// ============================================
// AUTH MODAL
// ============================================
const authOverlay = document.getElementById('authOverlay');
const userIconBtn = document.getElementById('userIconBtn');
const authClose = document.getElementById('authClose');
let isLoggedIn = false;

userIconBtn.addEventListener('click', () => {
  if (isLoggedIn) {
    // Toggle logged out
    isLoggedIn = false;
    userIconBtn.classList.remove('logged-in');
    return;
  }
  authOverlay.classList.add('visible');
});

authClose.addEventListener('click', () => {
  authOverlay.classList.remove('visible');
});

authOverlay.addEventListener('click', (e) => {
  if (e.target === authOverlay) authOverlay.classList.remove('visible');
});

// Auth tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.auth === 'login' ? 'authLogin' : 'authRegister').classList.add('active');
  });
});

// Simulate sign in / register
document.querySelectorAll('.auth-submit, .auth-social').forEach(btn => {
  btn.addEventListener('click', () => {
    isLoggedIn = true;
    userIconBtn.classList.add('logged-in');
    authOverlay.classList.remove('visible');
  });
});
