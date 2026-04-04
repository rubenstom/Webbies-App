// ============================================================
// Webbies — Screenshot to Scroll Video
// ============================================================

// --- State ---
const state = {
  image: null,
  bgType: 'solid',
  bgColor: '#e0e0e0',
  gradColor1: '#5e5e5e',
  gradColor2: '#000000',
  gradAngle: 135,
  blurAmount: 40,
  bgImage: null,
  bgImageFit: 'cover',
  bgImageBlur: 0,
  bgPattern: 'none',
  patternOpacity: 20,
  patternSize: 20,
  patternColor: '#ffffff',
  aspectRatio: 3 / 2,
  placeholderSize: 70,
  cornerRadius: 12,
  borderWidth: 0,
  borderColor: '#ffffff',
  borderOpacity: 100,
  shadowStrength: 20,
  shadowBlur: 16,
  shadowOffsetX: -8,
  shadowOffsetY: 8,
  shadowColor: '#000000',
  canvasW: 3840,
  canvasH: 2160,
  duration: 8,
  defaultEasing: 'easeInOut',
  loopMode: 'none',
  entryAnim: 'none',
  exitAnim: 'none',
  entryDuration: 10,
  exitDuration: 10,
  keyframes: [
    { time: 0, scroll: 0, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
    { time: 1, scroll: 100, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
  ],
  selectedKf: null,
  playing: false,
  currentTime: 0,
  exportScale: 1,
  exportFps: 30,
  exportFormat: 'mp4',
  borderEnabled: false,
  shadowEnabled: false,
  entryExitEnabled: false,
  browserBarEnabled: false,
  browserBarUrl: 'example.com',
  browserBarColor: '#e8e8e8',
  browserBarPillColor: '#d5d5d5',
};

// --- DOM refs ---
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const imageUpload = document.getElementById('imageUpload');
const bgTabs = document.querySelectorAll('.bg-tab');
const bgSolidOptions = document.getElementById('bgSolidOptions');
const bgGradientOptions = document.getElementById('bgGradientOptions');
const bgImageOptions = document.getElementById('bgImageOptions');
const timelineTrack = document.getElementById('timelineTrack');
const timelineProgress = document.getElementById('timelineProgress');
const scrubber = document.getElementById('scrubber');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const timeDisplay = document.getElementById('timeDisplay');
const addKeyframeBtn = document.getElementById('addKeyframeBtn');
const removeKeyframeBtn = document.getElementById('removeKeyframeBtn');
const keyframeEditor = document.getElementById('keyframeEditor');
const kfIndex = document.getElementById('kfIndex');
const exportBtn = document.getElementById('exportBtn');
const exportProgress = document.getElementById('exportProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

let blurCanvas = null;
let noiseCanvas = null;

// --- Easing functions ---
const easings = {
  linear: t => t,
  easeIn: t => t * t,
  easeOut: t => t * (2 - t),
  easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  bounceOut: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  bounceInOut: t => t < 0.5 ? (1 - easings.bounceOut(1 - 2 * t)) / 2 : (1 + easings.bounceOut(2 * t - 1)) / 2,
  elasticOut: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
  elasticInOut: t => {
    if (t === 0 || t === 1) return t;
    t *= 2;
    if (t < 1) return -0.5 * Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    return 0.5 * Math.pow(2, -10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI) + 1;
  },
};

// --- Helpers ---
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = state.canvasW * dpr;
  canvas.height = state.canvasH * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}
function parseCanvasPreset(v) { const [w, h] = v.split('x').map(Number); return { w, h }; }
function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

// ============================================================
// COLOR PICKER
// ============================================================
const cpOverlay = document.getElementById('cpOverlay');
const cpSVCanvas = document.getElementById('cpSV');
const cpHueCanvas = document.getElementById('cpHue');
const cpPreview = document.getElementById('cpPreview');
const cpHex = document.getElementById('cpHex');
const cpOk = document.getElementById('cpOk');
const cpSVCtx = cpSVCanvas.getContext('2d');
const cpHueCtx = cpHueCanvas.getContext('2d');

let cpState = { h: 0, s: 1, v: 1, callback: null, swatchEl: null };

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h, s = max === 0 ? 0 : d / max, v = max;
  if (max === min) { h = 0; }
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, v };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function cpCurrentHex() {
  const { r, g, b } = hsvToRgb(cpState.h, cpState.s, cpState.v);
  return rgbToHex(r, g, b);
}

function cpDrawSV() {
  const w = cpSVCanvas.width, h = cpSVCanvas.height;
  const { r, g, b } = hsvToRgb(cpState.h, 1, 1);
  // Base hue
  cpSVCtx.fillStyle = `rgb(${r},${g},${b})`;
  cpSVCtx.fillRect(0, 0, w, h);
  // White gradient left to right
  const wGrad = cpSVCtx.createLinearGradient(0, 0, w, 0);
  wGrad.addColorStop(0, 'rgba(255,255,255,1)');
  wGrad.addColorStop(1, 'rgba(255,255,255,0)');
  cpSVCtx.fillStyle = wGrad;
  cpSVCtx.fillRect(0, 0, w, h);
  // Black gradient top to bottom
  const bGrad = cpSVCtx.createLinearGradient(0, 0, 0, h);
  bGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bGrad.addColorStop(1, 'rgba(0,0,0,1)');
  cpSVCtx.fillStyle = bGrad;
  cpSVCtx.fillRect(0, 0, w, h);
  // Crosshair
  const cx = cpState.s * w, cy = (1 - cpState.v) * h;
  cpSVCtx.strokeStyle = '#fff';
  cpSVCtx.lineWidth = 2;
  cpSVCtx.beginPath();
  cpSVCtx.arc(cx, cy, 6, 0, Math.PI * 2);
  cpSVCtx.stroke();
  cpSVCtx.strokeStyle = '#000';
  cpSVCtx.lineWidth = 1;
  cpSVCtx.beginPath();
  cpSVCtx.arc(cx, cy, 7, 0, Math.PI * 2);
  cpSVCtx.stroke();
}

function cpDrawHue() {
  const w = cpHueCanvas.width, h = cpHueCanvas.height;
  for (let y = 0; y < h; y++) {
    const hue = y / h;
    const { r, g, b } = hsvToRgb(hue, 1, 1);
    cpHueCtx.fillStyle = `rgb(${r},${g},${b})`;
    cpHueCtx.fillRect(0, y, w, 1);
  }
  // Indicator
  const iy = cpState.h * h;
  cpHueCtx.strokeStyle = '#fff';
  cpHueCtx.lineWidth = 2;
  cpHueCtx.strokeRect(0, iy - 3, w, 6);
}

function cpUpdate() {
  cpDrawSV();
  cpDrawHue();
  const hex = cpCurrentHex();
  cpPreview.style.background = hex;
  cpHex.value = hex;
}

function openColorPicker(hex, swatchEl, callback) {
  const { r, g, b } = hexToRgb(hex);
  const hsv = rgbToHsv(r, g, b);
  cpState = { h: hsv.h, s: hsv.s, v: hsv.v, callback, swatchEl };
  cpOverlay.classList.remove('hidden');
  cpUpdate();
}

// SV canvas interaction
function cpSVHandler(e) {
  const rect = cpSVCanvas.getBoundingClientRect();
  cpState.s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  cpState.v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
  cpUpdate();
}

cpSVCanvas.addEventListener('mousedown', (e) => {
  cpSVHandler(e);
  const onMove = (e2) => cpSVHandler(e2);
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

// Hue bar interaction
function cpHueHandler(e) {
  const rect = cpHueCanvas.getBoundingClientRect();
  cpState.h = Math.max(0, Math.min(0.999, (e.clientY - rect.top) / rect.height));
  cpUpdate();
}

cpHueCanvas.addEventListener('mousedown', (e) => {
  cpHueHandler(e);
  const onMove = (e2) => cpHueHandler(e2);
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

// Hex input
cpHex.addEventListener('change', () => {
  let hex = cpHex.value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    const { r, g, b } = hexToRgb(hex);
    const hsv = rgbToHsv(r, g, b);
    cpState.h = hsv.h; cpState.s = hsv.s; cpState.v = hsv.v;
    cpUpdate();
  }
});

// OK button
cpOk.addEventListener('click', () => {
  const hex = cpCurrentHex();
  if (cpState.swatchEl) {
    cpState.swatchEl.style.background = hex;
    cpState.swatchEl.dataset.value = hex;
  }
  if (cpState.callback) cpState.callback(hex);
  cpOverlay.classList.add('hidden');
});

// Close on overlay click
cpOverlay.addEventListener('click', (e) => {
  if (e.target === cpOverlay) {
    const hex = cpCurrentHex();
    if (cpState.swatchEl) {
      cpState.swatchEl.style.background = hex;
      cpState.swatchEl.dataset.value = hex;
    }
    if (cpState.callback) cpState.callback(hex);
    cpOverlay.classList.add('hidden');
  }
});

// Init all swatches
function initColorSwatches() {
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.style.background = swatch.dataset.value;
    swatch.addEventListener('click', () => {
      const target = swatch.dataset.target;
      openColorPicker(swatch.dataset.value, swatch, (hex) => {
        state[target] = hex;
        if (target === 'patternColor') noiseCanvas = null;
        render();
      });
    });
  });
}

// ============================================================
// BACKGROUND
// ============================================================
function drawBackground(c, w, h) {
  if (state.bgType === 'solid') {
    c.fillStyle = state.bgColor;
    c.fillRect(0, 0, w, h);
  } else if (state.bgType === 'gradient') {
    const angle = state.gradAngle * Math.PI / 180;
    const cx = w / 2, cy = h / 2, len = Math.max(w, h);
    const grad = c.createLinearGradient(
      cx - Math.cos(angle) * len, cy - Math.sin(angle) * len,
      cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    grad.addColorStop(0, state.gradColor1);
    grad.addColorStop(1, state.gradColor2);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
  } else if (state.bgType === 'image' && state.bgImage) {
    drawBgImage(c, w, h);
    if (state.bgImageBlur > 0) {
      blurCanvasRegion(c, w, h, state.bgImageBlur);
    }
  } else {
    c.fillStyle = state.bgColor;
    c.fillRect(0, 0, w, h);
  }
  if (state.bgPattern !== 'none') drawPattern(c, w, h);
}

function drawBgImage(c, w, h) {
  const img = state.bgImage, fit = state.bgImageFit;
  const imgAsp = img.width / img.height, canAsp = w / h;
  let dx = 0, dy = 0, dw = w, dh = h;
  if (fit === 'cover') {
    if (imgAsp > canAsp) { dw = h * imgAsp; dx = (w - dw) / 2; }
    else { dh = w / imgAsp; dy = (h - dh) / 2; }
  } else if (fit === 'contain') {
    if (imgAsp > canAsp) { dh = w / imgAsp; dy = (h - dh) / 2; }
    else { dw = h * imgAsp; dx = (w - dw) / 2; }
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  }
  c.drawImage(img, dx, dy, dw, dh);
}

function blurCanvasRegion(c, w, h, amount) {
  // Work on a smaller canvas for performance
  const maxDim = 400;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const sw = Math.round(w * scale), sh = Math.round(h * scale);
  const radius = Math.max(1, Math.round(amount * scale));

  const off = document.createElement('canvas');
  off.width = sw; off.height = sh;
  const octx = off.getContext('2d');

  // Box blur on ImageData (3 passes ≈ Gaussian) — works in all browsers
  octx.drawImage(c.canvas, 0, 0, sw, sh);
  const imageData = octx.getImageData(0, 0, sw, sh);
  boxBlur(imageData.data, sw, sh, radius, 3);
  octx.putImageData(imageData, 0, 0);

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(off, 0, 0, c.canvas.width, c.canvas.height);
  c.restore();
}

function boxBlur(data, w, h, radius, passes) {
  const len = data.length;
  const tmp = new Uint8ClampedArray(len);
  for (let p = 0; p < passes; p++) {
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      let ri = 0, gi = 0, bi = 0, ai = 0;
      const size = radius * 2 + 1;
      // Init window
      for (let x = -radius; x <= radius; x++) {
        const ix = Math.min(w - 1, Math.max(0, x));
        const off = (y * w + ix) * 4;
        ri += data[off]; gi += data[off + 1]; bi += data[off + 2]; ai += data[off + 3];
      }
      for (let x = 0; x < w; x++) {
        const off = (y * w + x) * 4;
        tmp[off] = ri / size; tmp[off + 1] = gi / size; tmp[off + 2] = bi / size; tmp[off + 3] = ai / size;
        // Slide window
        const addX = Math.min(w - 1, x + radius + 1);
        const remX = Math.max(0, x - radius);
        const addOff = (y * w + addX) * 4;
        const remOff = (y * w + remX) * 4;
        ri += data[addOff] - data[remOff];
        gi += data[addOff + 1] - data[remOff + 1];
        bi += data[addOff + 2] - data[remOff + 2];
        ai += data[addOff + 3] - data[remOff + 3];
      }
    }
    // Vertical pass
    for (let x = 0; x < w; x++) {
      let ri = 0, gi = 0, bi = 0, ai = 0;
      const size = radius * 2 + 1;
      for (let y = -radius; y <= radius; y++) {
        const iy = Math.min(h - 1, Math.max(0, y));
        const off = (iy * w + x) * 4;
        ri += tmp[off]; gi += tmp[off + 1]; bi += tmp[off + 2]; ai += tmp[off + 3];
      }
      for (let y = 0; y < h; y++) {
        const off = (y * w + x) * 4;
        data[off] = ri / size; data[off + 1] = gi / size; data[off + 2] = bi / size; data[off + 3] = ai / size;
        const addY = Math.min(h - 1, y + radius + 1);
        const remY = Math.max(0, y - radius);
        const addOff = (addY * w + x) * 4;
        const remOff = (remY * w + x) * 4;
        ri += tmp[addOff] - tmp[remOff];
        gi += tmp[addOff + 1] - tmp[remOff + 1];
        bi += tmp[addOff + 2] - tmp[remOff + 2];
        ai += tmp[addOff + 3] - tmp[remOff + 3];
      }
    }
  }
}

function drawPattern(c, w, h) {
  const opacity = state.patternOpacity / 100;
  const size = state.patternSize;
  const { r, g, b } = hexToRgb(state.patternColor);
  c.save();
  c.globalAlpha = opacity;
  if (state.bgPattern === 'dots') {
    c.fillStyle = `rgb(${r},${g},${b})`;
    const dotR = Math.max(1, size * 0.1);
    for (let x = size / 2; x < w; x += size)
      for (let y = size / 2; y < h; y += size) {
        c.beginPath(); c.arc(x, y, dotR, 0, Math.PI * 2); c.fill();
      }
  } else if (state.bgPattern === 'grid') {
    c.strokeStyle = `rgb(${r},${g},${b})`; c.lineWidth = 1;
    for (let x = 0; x <= w; x += size) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += size) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  } else if (state.bgPattern === 'noise') {
    if (!noiseCanvas || noiseCanvas.width !== w || noiseCanvas.height !== h) createNoiseCanvas(w, h);
    c.drawImage(noiseCanvas, 0, 0);
  }
  c.restore();
}

function createNoiseCanvas(w, h) {
  const scale = 2, nw = Math.ceil(w / scale), nh = Math.ceil(h / scale);
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = w; noiseCanvas.height = h;
  const nc = noiseCanvas.getContext('2d');
  const small = document.createElement('canvas'); small.width = nw; small.height = nh;
  const sc = small.getContext('2d');
  const imgData = sc.createImageData(nw, nh);
  const { r, g, b } = hexToRgb(state.patternColor);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = r; imgData.data[i+1] = g; imgData.data[i+2] = b;
    imgData.data[i+3] = Math.random() * 255;
  }
  sc.putImageData(imgData, 0, 0);
  nc.imageSmoothingEnabled = false;
  nc.drawImage(small, 0, 0, w, h);
}



function createBlurBackground(w, h) {
  if (!state.image) return;

  // Step 1: Draw the image to cover the target area
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = w;
  coverCanvas.height = h;
  const coverCtx = coverCanvas.getContext('2d');

  const imgAspect = state.image.width / state.image.height;
  const canAspect = w / h;
  let dx, dy, dw, dh;
  if (imgAspect > canAspect) {
    dh = h; dw = h * imgAspect;
    dx = (w - dw) / 2; dy = 0;
  } else {
    dw = w; dh = w / imgAspect;
    dx = 0; dy = (h - dh) / 2;
  }
  coverCtx.drawImage(state.image, dx, dy, dw, dh);

  // Step 2: Iteratively downscale and upscale to create blur
  const blurPasses = Math.max(1, Math.round(state.blurAmount / 8));
  let src = coverCanvas;

  for (let i = 0; i < blurPasses; i++) {
    const smallW = Math.max(1, Math.ceil(src.width / 2));
    const smallH = Math.max(1, Math.ceil(src.height / 2));
    const small = document.createElement('canvas');
    small.width = smallW;
    small.height = smallH;
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, smallW, smallH);
    src = small;
  }

  // Step 3: Scale back up to full size
  blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  blurCanvas._w = w;
  blurCanvas._h = h;
  blurCanvas._blur = state.blurAmount;
  const bctx = blurCanvas.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(src, 0, 0, w, h);
}

// ============================================================
// INTERPOLATION
// ============================================================
function lerpProp(prop, t) {
  const kfs = state.keyframes;
  if (t <= kfs[0].time) return kfs[0][prop];
  if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1][prop];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].time && t <= kfs[i + 1].time) {
      const segT = (t - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
      const eased = easings[kfs[i].easing](segT);
      return kfs[i][prop] + (kfs[i + 1][prop] - kfs[i][prop]) * eased;
    }
  }
  return kfs[0][prop];
}

function getEffectiveTime() {
  let t = state.currentTime;
  if (state.loopMode === 'pingpong') t = t <= 0.5 ? t * 2 : (1 - t) * 2;
  return t;
}

function getEntryExitModifiers(t) {
  let opacity = 1, offsetYFrac = 0, scaleMod = 1;
  if (!state.entryExitEnabled) return { opacity, offsetYFrac, scaleMod };
  const entryFrac = state.entryDuration / 100;
  const exitFrac = state.exitDuration / 100;
  if (state.entryAnim !== 'none' && t < entryFrac && entryFrac > 0) {
    const ep = easings.easeOut(t / entryFrac);
    if (state.entryAnim === 'fadeIn') opacity = ep;
    else if (state.entryAnim === 'slideUp') offsetYFrac = (1 - ep) * 1.2;
    else if (state.entryAnim === 'scaleIn') { opacity = ep; scaleMod = 0.5 + ep * 0.5; }
  }
  if (state.exitAnim !== 'none' && t > (1 - exitFrac) && exitFrac > 0) {
    const ep = easings.easeIn((t - (1 - exitFrac)) / exitFrac);
    if (state.exitAnim === 'fadeOut') opacity = 1 - ep;
    else if (state.exitAnim === 'slideDown') offsetYFrac = ep * 1.2;
    else if (state.exitAnim === 'scaleOut') { opacity = 1 - ep; scaleMod = 1 - ep * 0.5; }
  }
  return { opacity, offsetYFrac, scaleMod };
}

// ============================================================
// BROWSER BAR
// ============================================================
function getBrowserBarHeight(phW, sc) {
  const barH = Math.max(18, Math.min(32, phW * 0.03)) * sc;
  return barH;
}

function drawBrowserBar(c, x, y, w, barH, crTop, sc) {
  // Bar background
  c.fillStyle = state.browserBarColor;
  c.beginPath();
  c.moveTo(x + crTop, y);
  c.arcTo(x + w, y, x + w, y + barH, crTop);
  c.arcTo(x + w, y + barH, x, y + barH, 0);
  c.lineTo(x, y + barH);
  c.arcTo(x, y, x + w, y, crTop);
  c.closePath();
  c.fill();

  // Three dots
  const dotR = Math.max(2, 3 * sc);
  const dotGap = Math.max(8, 10 * sc);
  const dotY = y + barH / 2;
  const dotStartX = x + Math.max(14, 18 * sc);
  const dotColors = ['#ff5f57', '#febc2e', '#28c840'];
  dotColors.forEach((color, i) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(dotStartX + i * dotGap, dotY, dotR, 0, Math.PI * 2);
    c.fill();
  });

  // URL pill
  const pillH = barH * 0.55;
  const pillW = Math.min(w * 0.5, Math.max(80 * sc, w * 0.3));
  const pillX = x + (w - pillW) / 2;
  const pillY = y + (barH - pillH) / 2;
  const pillR = pillH / 2;
  c.fillStyle = state.browserBarPillColor;
  c.beginPath();
  roundRect(c, pillX, pillY, pillW, pillH, pillR);
  c.fill();

  // URL text
  const fontSize = 8 * sc;
  c.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  c.fillStyle = '#555555';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const maxTextW = pillW - 12 * sc;
  c.fillText(state.browserBarUrl || '', pillX + pillW / 2, pillY + pillH / 2, maxTextW);
  c.textAlign = 'start';
  c.textBaseline = 'alphabetic';
}

// ============================================================
// RENDER
// ============================================================
function renderToContext(c, w, h) {
  drawBackground(c, w, h);

  // Placeholder dimensions
  const padding = (100 - state.placeholderSize) / 100;
  const maxW = w * (1 - padding), maxH = h * (1 - padding);
  let phW, phH;
  if (maxW / maxH > state.aspectRatio) { phH = maxH; phW = phH * state.aspectRatio; }
  else { phW = maxW; phH = phW / state.aspectRatio; }
  const sc = w / 1080;
  const cr = state.cornerRadius * sc;
  const barH = state.browserBarEnabled ? getBrowserBarHeight(phW, sc) : 0;
  const totalH = phH + barH;
  const phX = (w - phW) / 2;
  const unitY = (h - totalH) / 2; // center the full unit (bar + image)
  const barY = unitY;
  const phY = unitY + barH;

  // Draw empty placeholder when no image is loaded
  if (!state.image) {
    c.save();
    if (state.shadowEnabled && state.shadowStrength > 0) {
      const { r, g, b } = hexToRgb(state.shadowColor);
      const shadowAlpha = state.shadowStrength / 100 * 0.8;
      c.shadowColor = `rgba(${r},${g},${b},${shadowAlpha})`;
      c.shadowBlur = state.shadowBlur * sc;
      c.shadowOffsetX = state.shadowOffsetX * sc;
      c.shadowOffsetY = state.shadowOffsetY * sc;
    }
    c.beginPath();
    roundRect(c, phX, unitY, phW, totalH, cr);
    c.fillStyle = '#ffffff';
    c.fill();
    c.restore();
    if (barH > 0) drawBrowserBar(c, phX, barY, phW, barH, cr, sc);
    return;
  }

  const effectiveT = getEffectiveTime();
  const scrollPct = lerpProp('scroll', effectiveT) / 100;
  const scaleKf = lerpProp('scale', effectiveT) / 100;
  const rotation = lerpProp('rotation', effectiveT);
  const tiltX = lerpProp('tiltX', effectiveT);
  const tiltY = lerpProp('tiltY', effectiveT);
  const posX = lerpProp('posX', effectiveT) / 100;
  const posY = lerpProp('posY', effectiveT) / 100;

  const { opacity, offsetYFrac, scaleMod } = getEntryExitModifiers(state.currentTime);
  const finalScale = scaleKf * scaleMod;

  const bw = state.borderWidth * sc;

  // Position offsets
  const slideOffsetY = offsetYFrac * h;
  const kfOffsetX = posX * w;
  const kfOffsetY = posY * h;
  const totalOffsetX = kfOffsetX;
  const totalOffsetY = kfOffsetY + slideOffsetY;

  // Main content with full transforms
  c.save();
  c.globalAlpha = opacity;

  // Translate to center, apply transforms, translate back
  const cx = w / 2 + totalOffsetX;
  const cy = h / 2 + totalOffsetY;
  c.translate(cx, cy);
  c.rotate(rotation * Math.PI / 180);
  c.scale(finalScale, finalScale);

  if (tiltX !== 0 || tiltY !== 0) {
    const skewX = tiltY * Math.PI / 180 * 0.3;
    const skewY = tiltX * Math.PI / 180 * 0.3;
    c.transform(1 - Math.abs(tiltY) * 0.005, skewY, skewX, 1 - Math.abs(tiltX) * 0.005, 0, 0);
  }
  c.translate(-cx, -cy);

  // Shadow: covers the full unit (bar + image)
  if (state.shadowEnabled && state.shadowStrength > 0 && opacity > 0) {
    const { r, g, b } = hexToRgb(state.shadowColor);
    const shadowAlpha = state.shadowStrength / 100 * 0.8 * opacity;
    c.save();
    c.shadowColor = `rgba(${r},${g},${b},${shadowAlpha})`;
    c.shadowBlur = state.shadowBlur * sc;
    c.shadowOffsetX = state.shadowOffsetX * sc;
    c.shadowOffsetY = state.shadowOffsetY * sc;
    c.beginPath();
    roundRect(c, phX + totalOffsetX, unitY + totalOffsetY, phW, totalH, cr);
    c.fillStyle = '#ffffff';
    c.fill();
    c.restore();
  }

  // Offset drawing to account for position
  const drawX = phX + totalOffsetX;
  const drawBarY = barY + totalOffsetY;
  const drawY = phY + totalOffsetY;

  // Clip and draw image (bottom corners only when bar is active)
  c.save();
  c.beginPath();
  if (barH > 0) {
    // Only bottom corners rounded
    c.moveTo(drawX, drawY);
    c.lineTo(drawX + phW, drawY);
    c.arcTo(drawX + phW, drawY + phH, drawX, drawY + phH, cr);
    c.arcTo(drawX, drawY + phH, drawX, drawY, cr);
    c.lineTo(drawX, drawY);
    c.closePath();
  } else {
    roundRect(c, drawX, drawY, phW, phH, cr);
  }
  c.clip();

  const imgScale = phW / state.image.width;
  const scaledImgH = state.image.height * imgScale;
  const maxScroll = Math.max(0, scaledImgH - phH);
  const scrollY = maxScroll * scrollPct;
  c.drawImage(state.image, 0, 0, state.image.width, state.image.height,
    drawX, drawY - scrollY, phW, scaledImgH);
  c.restore();

  // Browser bar
  if (barH > 0) {
    drawBrowserBar(c, drawX, drawBarY, phW, barH, cr, sc);
  }

  // Border (covers full unit)
  if (state.borderEnabled && bw > 0) {
    const { r, g, b } = hexToRgb(state.borderColor);
    c.strokeStyle = `rgba(${r},${g},${b},${state.borderOpacity / 100})`;
    c.lineWidth = bw;
    c.beginPath();
    roundRect(c, drawX - bw / 2, (barH > 0 ? drawBarY : drawY) - bw / 2, phW + bw, totalH + bw, cr + bw / 2);
    c.stroke();
  }

  c.restore(); // globalAlpha
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);
  renderToContext(ctx, state.canvasW, state.canvasH);
  ctx.restore();
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ============================================================
// ANIMATION
// ============================================================
let animStart = null, animFrame = null;

function syncPlayIcons() {
  // Sync both play buttons (toolbar + bottom bar)
  const playing = state.playing;
  playIcon.classList.toggle('hidden', playing);
  pauseIcon.classList.toggle('hidden', !playing);
  document.querySelectorAll('.play-icon2').forEach(el => el.classList.toggle('hidden', playing));
  document.querySelectorAll('.pause-icon2').forEach(el => el.classList.toggle('hidden', !playing));
}

function startPlayback() {
  state.playing = true;
  syncPlayIcons();
  animStart = performance.now() - state.currentTime * state.duration * 1000;
  tick();
}

function stopPlayback() {
  state.playing = false;
  syncPlayIcons();
  if (animFrame) cancelAnimationFrame(animFrame);
}

function tick() {
  if (!state.playing) return;
  state.currentTime = (performance.now() - animStart) / 1000 / state.duration;
  if (state.loopMode === 'none') {
    if (state.currentTime >= 1) { state.currentTime = 1; stopPlayback(); updateTimeline(); render(); return; }
  } else { state.currentTime %= 1; }
  updateTimeline(); render();
  animFrame = requestAnimationFrame(tick);
}

// ============================================================
// TIMELINE
// ============================================================
function updateTimeline() {
  const pct = (state.currentTime * 100) + '%';
  timelineProgress.style.width = pct;
  scrubber.style.left = pct;
  const sec = state.currentTime * state.duration;
  const timeStr = `${formatTime(sec)} / ${formatTime(state.duration)}`;
  timeDisplay.textContent = timeStr;
  // Sync bottom playbar
  const playbarProgress = document.getElementById('playbarProgress');
  const playbarTime = document.getElementById('playbarTime');
  if (playbarProgress) playbarProgress.style.width = pct;
  if (playbarTime) playbarTime.textContent = timeStr;
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
}

function renderKeyframes() {
  timelineTrack.querySelectorAll('.keyframe-marker').forEach(el => el.remove());
  state.keyframes.forEach((kf, i) => {
    const marker = document.createElement('div');
    marker.className = 'keyframe-marker';
    if (i === 0 || i === state.keyframes.length - 1) marker.classList.add('edge');
    if (i === state.selectedKf) marker.classList.add('selected');
    marker.style.left = (kf.time * 100) + '%';
    marker.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectKeyframe(i);
      if (i === 0 || i === state.keyframes.length - 1) return;
      const trackRect = timelineTrack.getBoundingClientRect();
      const onMove = (e2) => {
        kf.time = Math.max(state.keyframes[i - 1].time + 0.01,
          Math.min(state.keyframes[i + 1].time - 0.01,
            (e2.clientX - trackRect.left) / trackRect.width));
        renderKeyframes();
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    timelineTrack.appendChild(marker);
  });
}

function selectKeyframe(i) {
  state.selectedKf = i;
  renderKeyframes();
  if (i !== null) {
    keyframeEditor.classList.remove('hidden');
    const kf = state.keyframes[i];
    kfIndex.textContent = `#${i + 1}`;
    setKfControl('kfScrollPos', 'kfScrollPosVal', kf.scroll, '%');
    setKfControl('kfScale', 'kfScaleVal', kf.scale, '%');
    setKfControl('kfRotation', 'kfRotationVal', kf.rotation, '\u00B0');
    setKfControl('kfTiltX', 'kfTiltXVal', kf.tiltX, '\u00B0');
    setKfControl('kfTiltY', 'kfTiltYVal', kf.tiltY, '\u00B0');
    setKfControl('kfPosX', 'kfPosXVal', kf.posX, '%');
    setKfControl('kfPosY', 'kfPosYVal', kf.posY, '%');
    document.getElementById('kfEasing').value = kf.easing;
  } else {
    keyframeEditor.classList.add('hidden');
  }
}

function setKfControl(inputId, valId, value, suffix) {
  const el = document.getElementById(inputId);
  el.value = value;
  updateRangeTrack(el);
  document.getElementById(valId).textContent = Math.round(value) + suffix;
}

function initScrubber() {
  let dragging = false;
  const getTime = (e) => {
    const rect = timelineTrack.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };
  scrubber.addEventListener('mousedown', (e) => { dragging = true; scrubber.classList.add('dragging'); stopPlayback(); e.preventDefault(); });
  timelineTrack.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('keyframe-marker')) return;
    stopPlayback(); state.currentTime = getTime(e); updateTimeline(); render();
    dragging = true; scrubber.classList.add('dragging');
  });
  timelineTrack.addEventListener('mousemove', (e) => { showTimeTooltip(e, timelineTrack); });
  timelineTrack.addEventListener('mouseleave', hideTimeTooltip);
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.currentTime = getTime(e); updateTimeline(); render();
    showTimeTooltip(e, timelineTrack);
  });
  document.addEventListener('mouseup', () => {
    if (dragging) hideTimeTooltip();
    dragging = false; scrubber.classList.remove('dragging');
  });
}

// ============================================================
// CONTROLS
// ============================================================
function bindControls() {
  imageUpload.addEventListener('change', (e) => { if (e.target.files[0]) loadImage(e.target.files[0]); });

  document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragover'); });
  document.addEventListener('dragleave', () => document.body.classList.remove('dragover'));
  document.addEventListener('drop', (e) => {
    e.preventDefault(); document.body.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  });

  bgTabs.forEach(tab => tab.addEventListener('click', () => {
    bgTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.bgType = tab.dataset.bg;
    bgSolidOptions.classList.toggle('hidden', state.bgType !== 'solid');
    bgGradientOptions.classList.toggle('hidden', state.bgType !== 'gradient');
    bgImageOptions.classList.toggle('hidden', state.bgType !== 'image');
    blurCanvas = null;
    render();
  }));

  bindRange('gradAngle', 'gradAngleVal', v => `${v}\u00B0`, v => { state.gradAngle = +v; render(); });
  document.getElementById('bgImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => { state.bgImage = img; render(); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    // Clear active preset swatch
    document.querySelectorAll('.bg-preset-swatch').forEach(s => s.classList.remove('active'));
  });

  // Preset background image swatches
  document.querySelectorAll('.bg-preset-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const img = new Image();
      img.onload = () => {
        state.bgImage = img;
        document.querySelectorAll('.bg-preset-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        render();
      };
      img.src = swatch.dataset.img;
    });
  });

  document.getElementById('bgImageFit').addEventListener('change', (e) => { state.bgImageFit = e.target.value; render(); });
  bindRange('bgImageBlur', 'bgImageBlurVal', v => `${v}px`, v => { state.bgImageBlur = +v; render(); });

  document.getElementById('bgPattern').addEventListener('change', (e) => {
    state.bgPattern = e.target.value;
    document.getElementById('patternControls').classList.toggle('hidden', state.bgPattern === 'none');
    noiseCanvas = null; render();
  });
  bindRange('patternOpacity', 'patternOpacityVal', v => `${v}%`, v => { state.patternOpacity = +v; noiseCanvas = null; render(); });
  bindRange('patternSize', 'patternSizeVal', v => `${v}px`, v => { state.patternSize = +v; noiseCanvas = null; render(); });

  bindRange('placeholderSize', 'placeholderSizeVal', v => `${v}%`, v => { state.placeholderSize = +v; render(); });
  bindRange('cornerRadius', 'cornerRadiusVal', v => `${v}px`, v => { state.cornerRadius = +v; render(); });

  bindRange('borderWidth', 'borderWidthVal', v => `${v}px`, v => { state.borderWidth = +v; render(); });
  bindRange('borderOpacity', 'borderOpacityVal', v => `${v}%`, v => { state.borderOpacity = +v; render(); });

  bindRange('shadowStrength', 'shadowStrengthVal', v => `${v}%`, v => { state.shadowStrength = +v; render(); });
  bindRange('shadowBlur', 'shadowBlurVal', v => `${v}px`, v => { state.shadowBlur = +v; render(); });
  bindRange('shadowOffsetY', 'shadowOffsetYVal', v => `${v}px`, v => { state.shadowOffsetY = +v; render(); });
  bindRange('shadowOffsetX', 'shadowOffsetXVal', v => `${v}px`, v => { state.shadowOffsetX = +v; render(); });

  document.getElementById('browserBarToggle').addEventListener('change', (e) => {
    state.browserBarEnabled = e.target.checked;
    document.getElementById('browserBarOptions').classList.toggle('hidden', !e.target.checked);
    render();
  });
  document.getElementById('browserBarUrl').addEventListener('input', (e) => {
    state.browserBarUrl = e.target.value;
    render();
  });

  document.getElementById('aspectRatio').addEventListener('change', (e) => { state.aspectRatio = parseFloat(e.target.value); render(); });
  document.getElementById('canvasPreset').addEventListener('change', (e) => {
    const { w, h } = parseCanvasPreset(e.target.value);
    state.canvasW = w; state.canvasH = h;
    resizeCanvas(); blurCanvas = null; noiseCanvas = null;
    zoomLevel = FIT_LEVEL; applyZoom();
    updateExportResOptions();
    render();
  });

  bindRange('duration', 'durationVal', v => `${v}s`, v => { state.duration = +v; updateTimeline(); });
  document.getElementById('defaultEasing').addEventListener('change', (e) => { state.defaultEasing = e.target.value; });
  document.getElementById('loopMode').addEventListener('change', (e) => { state.loopMode = e.target.value; });

  document.getElementById('entryAnim').addEventListener('change', (e) => { state.entryAnim = e.target.value; render(); });
  document.getElementById('exitAnim').addEventListener('change', (e) => { state.exitAnim = e.target.value; render(); });
  bindRange('entryDuration', 'entryDurationVal', v => `${v}%`, v => { state.entryDuration = +v; render(); });
  bindRange('exitDuration', 'exitDurationVal', v => `${v}%`, v => { state.exitDuration = +v; render(); });

  playBtn.addEventListener('click', () => {
    if (state.playing) stopPlayback();
    else { if (state.currentTime >= 1) state.currentTime = 0; startPlayback(); }
  });

  addKeyframeBtn.addEventListener('click', () => {
    const t = state.currentTime;
    let idx = state.keyframes.findIndex(kf => kf.time > t);
    if (idx === -1) idx = state.keyframes.length;
    state.keyframes.splice(idx, 0, {
      time: t, scroll: Math.round(lerpProp('scroll', t)),
      scale: Math.round(lerpProp('scale', t)), rotation: Math.round(lerpProp('rotation', t)),
      tiltX: Math.round(lerpProp('tiltX', t)), tiltY: Math.round(lerpProp('tiltY', t)),
      posX: Math.round(lerpProp('posX', t)), posY: Math.round(lerpProp('posY', t)),
      easing: state.defaultEasing,
    });
    selectKeyframe(idx); renderKeyframes();
  });

  removeKeyframeBtn.addEventListener('click', () => {
    if (state.selectedKf === null || state.selectedKf === 0 || state.selectedKf === state.keyframes.length - 1) return;
    state.keyframes.splice(state.selectedKf, 1);
    state.selectedKf = null;
    keyframeEditor.classList.add('hidden');
    renderKeyframes(); render();
  });

  // Keyframe editor bindings
  const kfProps = [
    ['kfScrollPos', 'kfScrollPosVal', 'scroll', '%'],
    ['kfScale', 'kfScaleVal', 'scale', '%'],
    ['kfRotation', 'kfRotationVal', 'rotation', '\u00B0'],
    ['kfTiltX', 'kfTiltXVal', 'tiltX', '\u00B0'],
    ['kfTiltY', 'kfTiltYVal', 'tiltY', '\u00B0'],
    ['kfPosX', 'kfPosXVal', 'posX', '%'],
    ['kfPosY', 'kfPosYVal', 'posY', '%'],
  ];
  kfProps.forEach(([inputId, valId, prop, suffix]) => {
    document.getElementById(inputId).addEventListener('input', (e) => {
      if (state.selectedKf === null) return;
      state.keyframes[state.selectedKf][prop] = +e.target.value;
      document.getElementById(valId).textContent = e.target.value + suffix;
      updateRangeTrack(e.target);
      render();
    });
  });
  document.getElementById('kfEasing').addEventListener('change', (e) => {
    if (state.selectedKf !== null) state.keyframes[state.selectedKf].easing = e.target.value;
  });

  document.getElementById('borderToggle').addEventListener('change', (e) => {
    state.borderEnabled = e.target.checked;
    document.getElementById('borderOptions').classList.toggle('hidden', !e.target.checked);
    render();
  });
  document.getElementById('shadowToggle').addEventListener('change', (e) => {
    state.shadowEnabled = e.target.checked;
    document.getElementById('shadowOptions').classList.toggle('hidden', !e.target.checked);
    render();
  });
  document.getElementById('entryExitToggle').addEventListener('change', (e) => {
    state.entryExitEnabled = e.target.checked;
    document.getElementById('entryExitOptions').classList.toggle('hidden', !e.target.checked);
    render();
  });

  document.getElementById('exportFormat').addEventListener('change', (e) => { state.exportFormat = e.target.value; });
  document.getElementById('exportRes').addEventListener('change', (e) => { state.exportScale = e.target.value === '2x' ? 2 : 1; });
  document.getElementById('exportFps').addEventListener('change', (e) => { state.exportFps = +e.target.value; });
  updateExportResOptions();
  exportBtn.addEventListener('click', doExport);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playBtn.click(); }
  });
}

function updateRangeTrack(el) {
  const pct = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.background = `linear-gradient(to right, #999 0%, #999 ${pct}%, #e6e6e6 ${pct}%, #e6e6e6 100%)`;
}

function bindRange(id, valId, fmt, cb) {
  const el = document.getElementById(id), val = document.getElementById(valId);
  updateRangeTrack(el);
  el.addEventListener('input', (e) => { val.textContent = fmt(e.target.value); updateRangeTrack(el); cb(e.target.value); });
}

// ============================================================
// IMAGE LOADING
// ============================================================
function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      emptyState.classList.add('hidden');
      exportBtn.disabled = false;
      blurCanvas = null;
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================================
// EXPORT
function updateExportResOptions() {
  const maxDim = Math.max(state.canvasW, state.canvasH);
  const resLabel = document.getElementById('exportResLabel');
  const resSelect = document.getElementById('exportRes');
  if (maxDim * 2 > 4096) {
    resLabel.classList.add('hidden');
    if (state.exportScale === 2) { state.exportScale = 1; resSelect.value = '1x'; }
  } else {
    resLabel.classList.remove('hidden');
  }
}

// ============================================================
async function doExport() {
  if (state.exportFormat === 'mp4') return exportVideoMP4();
  if (state.exportFormat === 'webm') return exportVideoWebM();
  if (state.exportFormat === 'gif') return exportGIF();
}

function prepareExport() {
  stopPlayback();
  exportProgress.classList.remove('hidden');
  exportBtn.disabled = true;
  progressText.textContent = 'Preparing...';
  progressFill.style.width = '0%';
  const scale = state.exportScale, fps = state.exportFps;
  const totalFrames = Math.ceil(state.duration * fps);
  const w = state.canvasW * scale, h = state.canvasH * scale;
  const encW = w % 2 === 0 ? w : w + 1, encH = h % 2 === 0 ? h : h + 1;
  const expCanvas = document.createElement('canvas');
  expCanvas.width = encW; expCanvas.height = encH;
  return { fps, totalFrames, encW, encH, expCanvas, expCtx: expCanvas.getContext('2d') };
}

function saveAndSetExportState(encW, encH) {
  const origW = state.canvasW, origH = state.canvasH;
  state.canvasW = encW; state.canvasH = encH;
  blurCanvas = null; noiseCanvas = null;
  return { origW, origH };
}

function restoreState(origW, origH) {
  state.canvasW = origW; state.canvasH = origH; state.currentTime = 0;
  blurCanvas = null; noiseCanvas = null;
}

function finishExport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  progressFill.style.width = '100%';
  progressText.textContent = 'Done! File downloaded.';
  setTimeout(() => exportProgress.classList.add('hidden'), 3000);
  exportBtn.disabled = false; render();
}

async function exportVideoMP4() {
  const { fps, totalFrames, encW, encH, expCanvas, expCtx } = prepareExport();
  const { origW, origH } = saveAndSetExportState(encW, encH);
  try {
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: encW, height: encH }, fastStart: 'in-memory' });
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: console.error });
    encoder.configure({ codec: 'avc1.640028', width: encW, height: encH, bitrate: encW * encH > 2100000 ? 20_000_000 : 8_000_000, framerate: fps });
    for (let i = 0; i < totalFrames; i++) {
      state.currentTime = i / (totalFrames - 1);
      renderToContext(expCtx, encW, encH);
      const frame = new VideoFrame(expCanvas, { timestamp: (i / fps) * 1e6, duration: (1 / fps) * 1e6 });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); frame.close();
      for (let w = 0; encoder.encodeQueueSize > 5 && w < 100; w++) await new Promise(r => setTimeout(r, 10));
      if (i % 5 === 0) { progressFill.style.width = Math.round((i / totalFrames) * 90) + '%'; progressText.textContent = `Encoding ${i+1}/${totalFrames}...`; }
      await new Promise(r => setTimeout(r, 0));
    }
    await encoder.flush(); encoder.close(); muxer.finalize();
    restoreState(origW, origH);
    finishExport(new Blob([muxer.target.buffer], { type: 'video/mp4' }), 'webbies-export.mp4');
  } catch (err) { console.error(err); progressText.textContent = `Failed: ${err.message}`; restoreState(origW, origH); exportBtn.disabled = false; render(); }
}

async function exportVideoWebM() {
  const { fps, totalFrames, encW, encH, expCanvas, expCtx } = prepareExport();
  const { origW, origH } = saveAndSetExportState(encW, encH);
  try {
    const muxer = new WebMMuxer.Muxer({ target: new WebMMuxer.ArrayBufferTarget(), video: { codec: 'V_VP8', width: encW, height: encH } });
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: console.error });
    encoder.configure({ codec: 'vp8', width: encW, height: encH, bitrate: encW * encH > 2100000 ? 15_000_000 : 6_000_000, framerate: fps });
    for (let i = 0; i < totalFrames; i++) {
      state.currentTime = i / (totalFrames - 1);
      renderToContext(expCtx, encW, encH);
      const frame = new VideoFrame(expCanvas, { timestamp: (i / fps) * 1e6, duration: (1 / fps) * 1e6 });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); frame.close();
      for (let w = 0; encoder.encodeQueueSize > 5 && w < 100; w++) await new Promise(r => setTimeout(r, 10));
      if (i % 5 === 0) { progressFill.style.width = Math.round((i / totalFrames) * 90) + '%'; progressText.textContent = `Encoding ${i+1}/${totalFrames}...`; }
      await new Promise(r => setTimeout(r, 0));
    }
    await encoder.flush(); encoder.close(); muxer.finalize();
    restoreState(origW, origH);
    finishExport(new Blob([muxer.target.buffer], { type: 'video/webm' }), 'webbies-export.webm');
  } catch (err) { console.error(err); progressText.textContent = `Failed: ${err.message}`; restoreState(origW, origH); exportBtn.disabled = false; render(); }
}

async function exportGIF() {
  const { fps: rawFps } = prepareExport();
  const maxDim = 640;
  let gifScale = 1;
  const rawW = state.canvasW * state.exportScale, rawH = state.canvasH * state.exportScale;
  if (rawW > maxDim || rawH > maxDim) gifScale = maxDim / Math.max(rawW, rawH);
  const gifW = Math.round(rawW * gifScale), gifH = Math.round(rawH * gifScale);
  const gifFps = Math.min(rawFps, 20), totalFrames = Math.ceil(state.duration * gifFps);
  const delay = Math.round(1000 / gifFps);
  const expCanvas = document.createElement('canvas'); expCanvas.width = gifW; expCanvas.height = gifH;
  const expCtx = expCanvas.getContext('2d');
  const origW = state.canvasW, origH = state.canvasH;
  state.canvasW = gifW; state.canvasH = gifH; blurCanvas = null; noiseCanvas = null;
  try {
    const frames = [];
    for (let i = 0; i < totalFrames; i++) {
      state.currentTime = i / (totalFrames - 1);
      renderToContext(expCtx, gifW, gifH);
      frames.push(expCtx.getImageData(0, 0, gifW, gifH));
      if (i % 3 === 0) { progressFill.style.width = Math.round((i / totalFrames) * 60) + '%'; progressText.textContent = `Frame ${i+1}/${totalFrames}...`; await new Promise(r => setTimeout(r, 0)); }
    }
    progressText.textContent = 'Encoding GIF...'; progressFill.style.width = '65%';
    await new Promise(r => setTimeout(r, 0));
    restoreState(origW, origH);
    finishExport(new Blob([encodeGIF(frames, gifW, gifH, delay)], { type: 'image/gif' }), 'webbies-export.gif');
  } catch (err) { console.error(err); progressText.textContent = `Failed: ${err.message}`; restoreState(origW, origH); exportBtn.disabled = false; render(); }
}

// --- GIF encoder ---
function encodeGIF(frames, width, height, delay) {
  const buf = [];
  const write = v => buf.push(v);
  const writeU16 = v => { buf.push(v & 0xff, (v >> 8) & 0xff); };
  const writeStr = s => { for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i)); };
  const palette = [];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++)
    palette.push([Math.round(r * 51), Math.round(g * 51), Math.round(b * 51)]);
  for (let i = 0; i < 40; i++) { const v = Math.round(i * 255 / 39); palette.push([v, v, v]); }
  const quantize = (r, g, b) => Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51);
  writeStr('GIF89a'); writeU16(width); writeU16(height);
  write(0xf7); write(0); write(0);
  for (let i = 0; i < 256; i++) { write(palette[i][0]); write(palette[i][1]); write(palette[i][2]); }
  write(0x21); write(0xff); write(0x0b); writeStr('NETSCAPE2.0');
  write(0x03); write(0x01); writeU16(0); write(0x00);
  const delayCs = Math.round(delay / 10);
  for (let f = 0; f < frames.length; f++) {
    const data = frames[f].data;
    write(0x21); write(0xf9); write(0x04); write(0x00); writeU16(delayCs); write(0x00); write(0x00);
    write(0x2c); writeU16(0); writeU16(0); writeU16(width); writeU16(height); write(0x00);
    const minCodeSize = 8; write(minCodeSize);
    const pixels = new Uint8Array(width * height);
    for (let i = 0; i < pixels.length; i++) pixels[i] = quantize(data[i*4], data[i*4+1], data[i*4+2]);
    const lzwData = lzwEncode(pixels, minCodeSize);
    let pos = 0;
    while (pos < lzwData.length) { const chunk = Math.min(255, lzwData.length - pos); write(chunk); for (let i = 0; i < chunk; i++) buf.push(lzwData[pos + i]); pos += chunk; }
    write(0x00);
  }
  write(0x3b);
  return new Uint8Array(buf);
}

function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize, eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1, nextCode = eoiCode + 1;
  let dict = new Map();
  for (let i = 0; i < clearCode; i++) dict.set(String(i), i);
  const output = []; let bits = 0, bitCount = 0;
  const writeBits = (code, size) => { bits |= code << bitCount; bitCount += size; while (bitCount >= 8) { output.push(bits & 0xff); bits >>= 8; bitCount -= 8; } };
  writeBits(clearCode, codeSize);
  let current = String(pixels[0]);
  for (let i = 1; i < pixels.length; i++) {
    const next = current + ',' + pixels[i];
    if (dict.has(next)) { current = next; }
    else {
      writeBits(dict.get(current), codeSize);
      if (nextCode < 4096) { dict.set(next, nextCode++); if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++; }
      else { writeBits(clearCode, codeSize); dict = new Map(); for (let j = 0; j < clearCode; j++) dict.set(String(j), j); nextCode = eoiCode + 1; codeSize = minCodeSize + 1; }
      current = String(pixels[i]);
    }
  }
  writeBits(dict.get(current), codeSize);
  writeBits(eoiCode, codeSize);
  if (bitCount > 0) output.push(bits & 0xff);
  return output;
}

// ============================================================
// ============================================================
// ZOOM
// ============================================================
const ZOOM_STEP = 0.15;
const FIT_LEVEL = -2; // default "fit" is 2 steps zoomed out from full fit
let zoomLevel = FIT_LEVEL;
const canvasWrapper = document.getElementById('canvasWrapper');
const canvasArea = document.querySelector('.canvas-area');

function getCanvasFitSize() {
  const areaRect = canvasArea.getBoundingClientRect();
  const availH = areaRect.height - 48;
  const availW = areaRect.width - 48;
  const aspect = state.canvasW / state.canvasH;
  let fitH = availH;
  let fitW = fitH * aspect;
  if (fitW > availW) { fitW = availW; fitH = fitW / aspect; }
  return { fitW, fitH };
}

function applyZoom() {
  const areaRect = canvasArea.getBoundingClientRect();
  const { fitW, fitH } = getCanvasFitSize();
  const scale = Math.pow(1 + ZOOM_STEP, zoomLevel);
  const newW = fitW * scale;
  const newH = fitH * scale;
  canvasWrapper.style.width = newW + 'px';
  canvasWrapper.style.height = newH + 'px';
  canvasWrapper.style.maxHeight = 'none';
  if (newW > areaRect.width - 16 || newH > areaRect.height - 16) {
    canvasArea.style.overflow = 'auto';
    canvasArea.style.alignItems = newH > areaRect.height ? 'flex-start' : 'center';
  } else {
    canvasArea.style.overflow = 'hidden';
    canvasArea.style.alignItems = 'center';
  }
}

document.getElementById('zoomIn').addEventListener('click', () => {
  zoomLevel = Math.min(zoomLevel + 1, 10);
  applyZoom();
});

document.getElementById('zoomOut').addEventListener('click', () => {
  zoomLevel = Math.max(zoomLevel - 1, -8);
  applyZoom();
});

document.getElementById('zoomFit').addEventListener('click', () => {
  zoomLevel = FIT_LEVEL;
  applyZoom();
});

// ============================================================
// BOTTOM PLAYBAR
// ============================================================
document.getElementById('playBtn2').addEventListener('click', () => {
  if (state.playing) stopPlayback(); else startPlayback();
});

const playbarTrackEl = document.getElementById('playbarTrack');
playbarTrackEl.addEventListener('mousemove', (e) => { showTimeTooltip(e, playbarTrackEl); });
playbarTrackEl.addEventListener('mouseleave', hideTimeTooltip);
playbarTrackEl.addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  state.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (state.playing) animStart = performance.now() - state.currentTime * state.duration * 1000;
  updateTimeline();
  render();
});

// ============================================================
// TIMELINE TOOLTIP
// ============================================================
const timelineTooltip = document.getElementById('timelineTooltip');

function showTimeTooltip(e, trackEl) {
  const rect = trackEl.getBoundingClientRect();
  const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const sec = t * state.duration;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  timelineTooltip.textContent = `${m}:${s.toFixed(1).padStart(4, '0')}`;
  timelineTooltip.style.left = e.clientX + 'px';
  timelineTooltip.style.top = (rect.top - 28) + 'px';
  timelineTooltip.classList.remove('hidden');
}

function hideTimeTooltip() {
  timelineTooltip.classList.add('hidden');
}

// ============================================================
// TEMPLATES & PRESETS
// ============================================================
const TEMPLATES = {
  'smooth-scroll': {
    duration: 8, defaultEasing: 'easeInOut', loopMode: 'none',
    entryAnim: 'none', exitAnim: 'none', entryDuration: 10, exitDuration: 10,
    keyframes: [
      { time: 0, scroll: 0, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
      { time: 1, scroll: 100, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
    ],
  },
  'cinematic-pan': {
    duration: 10, defaultEasing: 'easeInOutCubic', loopMode: 'none',
    entryAnim: 'fadeIn', exitAnim: 'fadeOut', entryDuration: 15, exitDuration: 15,
    keyframes: [
      { time: 0, scroll: 0, scale: 110, rotation: 0, tiltX: 0, tiltY: -5, posX: 0, posY: 0, easing: 'easeInOutCubic' },
      { time: 1, scroll: 80, scale: 100, rotation: 0, tiltX: 0, tiltY: 5, posX: 0, posY: 0, easing: 'easeInOutCubic' },
    ],
  },
  'hero-reveal': {
    duration: 6, defaultEasing: 'easeInOutQuart', loopMode: 'none',
    entryAnim: 'scaleIn', exitAnim: 'none', entryDuration: 25, exitDuration: 10,
    keyframes: [
      { time: 0, scroll: 0, scale: 120, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOutQuart' },
      { time: 0.5, scroll: 0, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
      { time: 1, scroll: 60, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
    ],
  },
  'tilt-showcase': {
    duration: 8, defaultEasing: 'easeInOut', loopMode: 'pingpong',
    entryAnim: 'none', exitAnim: 'none', entryDuration: 10, exitDuration: 10,
    keyframes: [
      { time: 0, scroll: 0, scale: 100, rotation: -3, tiltX: 5, tiltY: -10, posX: -5, posY: 0, easing: 'easeInOut' },
      { time: 0.5, scroll: 50, scale: 105, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
      { time: 1, scroll: 100, scale: 100, rotation: 3, tiltX: -5, tiltY: 10, posX: 5, posY: 0, easing: 'easeInOut' },
    ],
  },
  'bounce-scroll': {
    duration: 6, defaultEasing: 'bounceOut', loopMode: 'none',
    entryAnim: 'slideUp', exitAnim: 'none', entryDuration: 20, exitDuration: 10,
    keyframes: [
      { time: 0, scroll: 0, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'bounceOut' },
      { time: 1, scroll: 100, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'bounceOut' },
    ],
  },
  'dramatic-zoom': {
    duration: 10, defaultEasing: 'easeInOutCubic', loopMode: 'none',
    entryAnim: 'fadeIn', exitAnim: 'fadeOut', entryDuration: 10, exitDuration: 10,
    keyframes: [
      { time: 0, scroll: 30, scale: 150, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: -10, easing: 'easeInOutCubic' },
      { time: 0.4, scroll: 30, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
      { time: 1, scroll: 100, scale: 100, rotation: 0, tiltX: 0, tiltY: 0, posX: 0, posY: 0, easing: 'easeInOut' },
    ],
  },
};

const PRESETS = {
  'minimal-light': {
    bgType: 'solid', bgColor: '#f5f5f5',
    cornerRadius: 12, borderWidth: 0, placeholderSize: 70,
    shadowStrength: 30, shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 8, shadowColor: '#000000',
  },
  'minimal-dark': {
    bgType: 'solid', bgColor: '#1a1a2e',
    cornerRadius: 12, borderWidth: 0, placeholderSize: 70,
    shadowStrength: 40, shadowBlur: 30, shadowOffsetX: 0, shadowOffsetY: 10, shadowColor: '#000000',
  },
  'gradient-purple': {
    bgType: 'gradient', gradColor1: '#667eea', gradColor2: '#764ba2', gradAngle: 135,
    cornerRadius: 16, borderWidth: 0, placeholderSize: 65,
    shadowStrength: 50, shadowBlur: 30, shadowOffsetX: 0, shadowOffsetY: 12, shadowColor: '#000000',
  },
  'gradient-ocean': {
    bgType: 'gradient', gradColor1: '#2193b0', gradColor2: '#6dd5ed', gradAngle: 160,
    cornerRadius: 12, borderWidth: 2, borderColor: '#ffffff', borderOpacity: 60, placeholderSize: 68,
    shadowStrength: 35, shadowBlur: 24, shadowOffsetX: 0, shadowOffsetY: 8, shadowColor: '#000000',
  },
  'bold-shadow': {
    bgType: 'solid', bgColor: '#e8e8e8',
    cornerRadius: 0, borderWidth: 0, placeholderSize: 75,
    shadowStrength: 70, shadowBlur: 4, shadowOffsetX: -12, shadowOffsetY: 12, shadowColor: '#000000',
  },
  'floating-card': {
    bgType: 'solid', bgColor: '#f0f0f0',
    cornerRadius: 24, borderWidth: 0, placeholderSize: 65,
    shadowStrength: 25, shadowBlur: 40, shadowOffsetX: 0, shadowOffsetY: 16, shadowColor: '#000000',
  },
  'retro-canvas': {
    bgType: 'solid', bgColor: '#808080',
    bgPattern: 'grid', patternOpacity: 25, patternSize: 50, patternColor: '#ffffff',
    cornerRadius: 8, placeholderSize: 75,
    borderWidth: 0, borderColor: '#ffffff', borderOpacity: 60,
    shadowStrength: 35, shadowBlur: 0, shadowOffsetX: -20, shadowOffsetY: 20, shadowColor: '#000000',
  },
  'back-blur': {
    bgType: 'image', bgImageSrc: 'img/14.jpg', bgImageFit: 'cover', bgImageBlur: 20,
    bgPattern: 'none', patternOpacity: 10, patternSize: 20, patternColor: '#ffffff',
    cornerRadius: 14, placeholderSize: 75,
    borderWidth: 10, borderColor: '#ffffff', borderOpacity: 50,
    shadowStrength: 50, shadowBlur: 50, shadowOffsetX: 0, shadowOffsetY: 50, shadowColor: '#000000',
  },
  'base-grid': {
    bgType: 'solid', bgColor: '#ffffff',
    bgPattern: 'grid', patternOpacity: 8, patternSize: 60, patternColor: '#000000',
    cornerRadius: 0, placeholderSize: 75,
    borderWidth: 0, borderColor: '#ffffff', borderOpacity: 0,
    shadowStrength: 30, shadowBlur: 20, shadowOffsetX: -10, shadowOffsetY: 10, shadowColor: '#000000',
  },
  'colorful-noise': {
    bgType: 'image', bgImageSrc: 'img/12.jpg', bgImageFit: 'cover', bgImageBlur: 0,
    bgPattern: 'noise', patternOpacity: 49, patternSize: 20, patternColor: '#ffffff',
    cornerRadius: 6, placeholderSize: 65,
    borderWidth: 0, borderColor: '#ffffff', borderOpacity: 0,
    shadowStrength: 50, shadowBlur: 30, shadowOffsetX: 0, shadowOffsetY: 0, shadowColor: '#ffffff',
  },
  'dark-grid': {
    bgType: 'image', bgImageSrc: 'img/13.jpg', bgImageFit: 'cover', bgImageBlur: 0,
    bgPattern: 'dots', patternOpacity: 20, patternSize: 20, patternColor: '#ffffff',
    cornerRadius: 12, placeholderSize: 65,
    borderWidth: 8, borderColor: '#ffffff', borderOpacity: 20,
    shadowStrength: 100, shadowBlur: 30, shadowOffsetX: 0, shadowOffsetY: 30, shadowColor: '#000000',
  },
};

function applyTemplate(id) {
  const t = TEMPLATES[id];
  if (!t) return;
  state.duration = t.duration;
  state.defaultEasing = t.defaultEasing;
  state.loopMode = t.loopMode;
  state.entryAnim = t.entryAnim;
  state.exitAnim = t.exitAnim;
  state.entryDuration = t.entryDuration;
  state.exitDuration = t.exitDuration;
  state.keyframes = JSON.parse(JSON.stringify(t.keyframes));
  state.selectedKf = null;
  state.currentTime = 0;
  // Sync UI controls
  const durEl = document.getElementById('duration');
  durEl.value = state.duration; updateRangeTrack(durEl);
  document.getElementById('durationVal').textContent = state.duration + 's';
  document.getElementById('defaultEasing').value = state.defaultEasing;
  document.getElementById('loopMode').value = state.loopMode;
  document.getElementById('entryAnim').value = state.entryAnim;
  document.getElementById('exitAnim').value = state.exitAnim;
  const entryEl = document.getElementById('entryDuration');
  entryEl.value = state.entryDuration; updateRangeTrack(entryEl);
  document.getElementById('entryDurationVal').textContent = state.entryDuration + '%';
  const exitEl = document.getElementById('exitDuration');
  exitEl.value = state.exitDuration; updateRangeTrack(exitEl);
  document.getElementById('exitDurationVal').textContent = state.exitDuration + '%';
  renderKeyframes();
  updateTimeline();
  render();
}

function applyPreset(id) {
  const p = PRESETS[id];
  if (!p) return;
  Object.keys(p).forEach(k => { state[k] = p[k]; });

  const syncRange = (id, val, fmt) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(id + 'Val');
    if (el) { el.value = val; updateRangeTrack(el); }
    if (valEl) valEl.textContent = fmt(val);
  };

  // Sync bg tab UI (without clicking to avoid side effects)
  document.querySelectorAll('.bg-tab').forEach(t => t.classList.remove('active'));
  const bgTab = document.querySelector(`.bg-tab[data-bg="${state.bgType}"]`);
  if (bgTab) bgTab.classList.add('active');
  bgSolidOptions.classList.toggle('hidden', state.bgType !== 'solid');
  bgGradientOptions.classList.toggle('hidden', state.bgType !== 'gradient');
  bgImageOptions.classList.toggle('hidden', state.bgType !== 'image');

  // Sync color swatches
  document.querySelectorAll('.color-swatch').forEach(sw => {
    const target = sw.dataset.target;
    if (state[target] !== undefined) {
      sw.dataset.value = state[target];
      sw.style.background = state[target];
    }
  });

  // Sync range controls
  syncRange('cornerRadius', state.cornerRadius, v => v + 'px');
  syncRange('borderWidth', state.borderWidth, v => v + 'px');
  syncRange('borderOpacity', state.borderOpacity, v => v + '%');
  syncRange('placeholderSize', state.placeholderSize, v => v + '%');
  syncRange('shadowStrength', state.shadowStrength, v => v + '%');
  syncRange('shadowBlur', state.shadowBlur, v => v + 'px');
  syncRange('shadowOffsetX', state.shadowOffsetX, v => v + 'px');
  syncRange('shadowOffsetY', state.shadowOffsetY, v => v + 'px');
  if (state.bgType === 'gradient') {
    syncRange('gradAngle', state.gradAngle, v => v + '°');
  }

  // Sync toggles based on preset values
  state.borderEnabled = (state.borderWidth > 0);
  document.getElementById('borderToggle').checked = state.borderEnabled;
  document.getElementById('borderOptions').classList.toggle('hidden', !state.borderEnabled);
  state.shadowEnabled = (state.shadowStrength > 0);
  document.getElementById('shadowToggle').checked = state.shadowEnabled;
  document.getElementById('shadowOptions').classList.toggle('hidden', !state.shadowEnabled);

  // Sync pattern controls
  document.getElementById('bgPattern').value = state.bgPattern;
  document.getElementById('patternControls').classList.toggle('hidden', state.bgPattern === 'none');
  if (state.bgPattern !== 'none') {
    syncRange('patternOpacity', state.patternOpacity, v => v + '%');
    syncRange('patternSize', state.patternSize, v => v + 'px');
  }

  // Sync image controls
  if (state.bgType === 'image') {
    document.getElementById('bgImageFit').value = state.bgImageFit || 'cover';
    syncRange('bgImageBlur', state.bgImageBlur || 0, v => v + 'px');
  }

  // Load preset background image if specified
  if (p.bgImageSrc) {
    const img = new Image();
    img.onload = () => {
      state.bgImage = img;
      // Highlight the matching preset swatch
      document.querySelectorAll('.bg-preset-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.img === p.bgImageSrc);
      });
      noiseCanvas = null;
      blurCanvas = null;
      render();
    };
    img.src = p.bgImageSrc;
  } else {
    noiseCanvas = null;
    blurCanvas = null;
    render();
  }
}

function initDropdowns() {
  const templatesBtn = document.getElementById('templatesBtn');
  const presetsBtn = document.getElementById('presetsBtn');
  const templatesPanel = document.getElementById('templatesPanel');
  const presetsPanel = document.getElementById('presetsPanel');

  function positionPanel(btn, panel) {
    const rect = btn.getBoundingClientRect();
    panel.style.top = (rect.bottom + 6) + 'px';
    panel.style.left = Math.max(8, rect.right - 240) + 'px';
  }

  function closeAll() {
    templatesPanel.classList.add('hidden');
    presetsPanel.classList.add('hidden');
  }

  templatesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = !templatesPanel.classList.contains('hidden');
    closeAll();
    if (!wasOpen) { positionPanel(templatesBtn, templatesPanel); templatesPanel.classList.remove('hidden'); }
  });

  presetsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = !presetsPanel.classList.contains('hidden');
    closeAll();
    if (!wasOpen) { positionPanel(presetsBtn, presetsPanel); presetsPanel.classList.remove('hidden'); }
  });

  document.addEventListener('click', closeAll);
  templatesPanel.addEventListener('click', (e) => e.stopPropagation());
  presetsPanel.addEventListener('click', (e) => e.stopPropagation());

  templatesPanel.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => { applyTemplate(item.dataset.template); closeAll(); });
  });

  presetsPanel.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => { applyPreset(item.dataset.preset); closeAll(); });
  });
}

// ============================================================
// INIT
// ============================================================
function init() {
  resizeCanvas();
  initColorSwatches();
  bindControls();
  initScrubber();
  initDropdowns();
  renderKeyframes();
  updateTimeline();
  applyZoom();
  document.querySelectorAll('input[type="range"]').forEach(updateRangeTrack);
  render();
}

init();
