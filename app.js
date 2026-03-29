// ============================================================
// Webbies — Screenshot to Scroll Video
// ============================================================

// --- State ---
const state = {
  image: null,
  bgType: 'solid',
  bgColor: '#1a1a2e',
  gradColor1: '#667eea',
  gradColor2: '#764ba2',
  gradAngle: 135,
  blurAmount: 40,
  bgImage: null,
  bgImageFit: 'cover',
  bgPattern: 'none',
  patternOpacity: 20,
  patternSize: 20,
  patternColor: '#ffffff',
  aspectRatio: 2 / 3,
  placeholderSize: 70,
  cornerRadius: 12,
  borderWidth: 0,
  borderColor: '#ffffff',
  borderOpacity: 100,
  shadowStrength: 50,
  shadowBlur: 40,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowColor: '#000000',
  canvasW: 1080,
  canvasH: 1920,
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
};

// --- DOM refs ---
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const imageUpload = document.getElementById('imageUpload');
const bgTabs = document.querySelectorAll('.bg-tab');
const bgSolidOptions = document.getElementById('bgSolidOptions');
const bgGradientOptions = document.getElementById('bgGradientOptions');
const bgBlurOptions = document.getElementById('bgBlurOptions');
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
function resizeCanvas() { canvas.width = state.canvasW; canvas.height = state.canvasH; }
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
  } else if (state.bgType === 'blur' && state.image) {
    if (!blurCanvas || blurCanvas._w !== w || blurCanvas._h !== h || blurCanvas._blur !== state.blurAmount) {
      createBlurBackground(w, h);
    }
    c.drawImage(blurCanvas, 0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(0, 0, w, h);
  } else if (state.bgType === 'image' && state.bgImage) {
    drawBgImage(c, w, h);
  } else {
    c.fillStyle = '#1a1a2e';
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

// FIX #3: Cross-browser blur using iterative downscaling
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
// RENDER
// ============================================================
function renderToContext(c, w, h) {
  drawBackground(c, w, h);
  if (!state.image) return;

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

  // Placeholder dimensions
  const padding = (100 - state.placeholderSize) / 100;
  const maxW = w * (1 - padding), maxH = h * (1 - padding);
  let phW, phH;
  if (maxW / maxH > state.aspectRatio) { phH = maxH; phW = phH * state.aspectRatio; }
  else { phW = maxW; phH = phW / state.aspectRatio; }

  const phX = (w - phW) / 2;
  const phY = (h - phH) / 2;
  const sc = w / 1080;
  const cr = state.cornerRadius * sc;
  const bw = state.borderWidth * sc;

  // Position offsets
  const slideOffsetY = offsetYFrac * h;
  const kfOffsetX = posX * w;
  const kfOffsetY = posY * h;
  const totalOffsetX = kfOffsetX;
  const totalOffsetY = kfOffsetY + slideOffsetY;

  // Shadow: drawn with same transforms as content so it adapts to tilt/rotation/scale
  if (state.shadowStrength > 0 && opacity > 0) {
    const { r, g, b } = hexToRgb(state.shadowColor);
    const shadowAlpha = state.shadowStrength / 100 * 0.8 * opacity;
    const offScreen = w * 3;

    c.save();
    // Apply same transforms as the main content
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

    c.shadowColor = `rgba(${r},${g},${b},${shadowAlpha})`;
    c.shadowBlur = state.shadowBlur * sc;
    c.shadowOffsetX = offScreen + state.shadowOffsetX * sc;
    c.shadowOffsetY = state.shadowOffsetY * sc;
    c.beginPath();
    const drawX = phX + totalOffsetX;
    const drawY = phY + totalOffsetY;
    roundRect(c, drawX - offScreen, drawY, phW, phH, cr);
    c.fillStyle = 'rgba(0,0,0,1)';
    c.fill();
    c.restore();
  }

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

  // Offset drawing to account for position
  const drawX = phX + totalOffsetX;
  const drawY = phY + totalOffsetY;

  // Clip and draw image
  c.save();
  c.beginPath();
  roundRect(c, drawX, drawY, phW, phH, cr);
  c.clip();

  const imgScale = phW / state.image.width;
  const scaledImgH = state.image.height * imgScale;
  const maxScroll = Math.max(0, scaledImgH - phH);
  const scrollY = maxScroll * scrollPct;
  c.drawImage(state.image, 0, 0, state.image.width, state.image.height,
    drawX, drawY - scrollY, phW, scaledImgH);
  c.restore();

  // Border
  if (bw > 0) {
    const { r, g, b } = hexToRgb(state.borderColor);
    c.strokeStyle = `rgba(${r},${g},${b},${state.borderOpacity / 100})`;
    c.lineWidth = bw;
    c.beginPath();
    roundRect(c, drawX - bw / 2, drawY - bw / 2, phW + bw, phH + bw, cr + bw / 2);
    c.stroke();
  }

  c.restore(); // globalAlpha
}

function render() { renderToContext(ctx, state.canvasW, state.canvasH); }

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

function startPlayback() {
  state.playing = true;
  playIcon.classList.add('hidden'); pauseIcon.classList.remove('hidden');
  animStart = performance.now() - state.currentTime * state.duration * 1000;
  tick();
}

function stopPlayback() {
  state.playing = false;
  playIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden');
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
  timelineProgress.style.width = (state.currentTime * 100) + '%';
  scrubber.style.left = (state.currentTime * 100) + '%';
  const sec = state.currentTime * state.duration;
  timeDisplay.textContent = `${formatTime(sec)} / ${formatTime(state.duration)}`;
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
  document.getElementById(inputId).value = value;
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
  document.addEventListener('mousemove', (e) => { if (!dragging) return; state.currentTime = getTime(e); updateTimeline(); render(); });
  document.addEventListener('mouseup', () => { dragging = false; scrubber.classList.remove('dragging'); });
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
    bgBlurOptions.classList.toggle('hidden', state.bgType !== 'blur');
    bgImageOptions.classList.toggle('hidden', state.bgType !== 'image');
    blurCanvas = null;
    render();
  }));

  bindRange('gradAngle', 'gradAngleVal', v => `${v}\u00B0`, v => { state.gradAngle = +v; render(); });
  bindRange('blurAmount', 'blurAmountVal', v => `${v}px`, v => { state.blurAmount = +v; blurCanvas = null; render(); });

  document.getElementById('bgImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const img = new Image(); img.onload = () => { state.bgImage = img; render(); }; img.src = ev.target.result; };
    reader.readAsDataURL(file);
  });
  document.getElementById('bgImageFit').addEventListener('change', (e) => { state.bgImageFit = e.target.value; render(); });

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

  document.getElementById('aspectRatio').addEventListener('change', (e) => { state.aspectRatio = parseFloat(e.target.value); render(); });
  document.getElementById('canvasPreset').addEventListener('change', (e) => {
    const { w, h } = parseCanvasPreset(e.target.value);
    state.canvasW = w; state.canvasH = h;
    resizeCanvas(); blurCanvas = null; noiseCanvas = null;
    canvas.parentElement.style.aspectRatio = `${w}/${h}`;
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
      render();
    });
  });
  document.getElementById('kfEasing').addEventListener('change', (e) => {
    if (state.selectedKf !== null) state.keyframes[state.selectedKf].easing = e.target.value;
  });

  document.getElementById('exportFormat').addEventListener('change', (e) => { state.exportFormat = e.target.value; });
  document.getElementById('exportRes').addEventListener('change', (e) => { state.exportScale = e.target.value === '2x' ? 2 : 1; });
  document.getElementById('exportFps').addEventListener('change', (e) => { state.exportFps = +e.target.value; });
  exportBtn.addEventListener('click', doExport);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playBtn.click(); }
  });
}

function bindRange(id, valId, fmt, cb) {
  const el = document.getElementById(id), val = document.getElementById(valId);
  el.addEventListener('input', (e) => { val.textContent = fmt(e.target.value); cb(e.target.value); });
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
      if (i % 5 === 0) { progressFill.style.width = Math.round((i / totalFrames) * 90) + '%'; progressText.textContent = `Encoding ${i+1}/${totalFrames}...`; await new Promise(r => setTimeout(r, 0)); }
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
      if (i % 5 === 0) { progressFill.style.width = Math.round((i / totalFrames) * 90) + '%'; progressText.textContent = `Encoding ${i+1}/${totalFrames}...`; await new Promise(r => setTimeout(r, 0)); }
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
// INIT
// ============================================================
function init() {
  resizeCanvas();
  initColorSwatches();
  bindControls();
  initScrubber();
  renderKeyframes();
  updateTimeline();
  render();
}

init();
