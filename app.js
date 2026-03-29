// ============================================================
// ScrollSnap — Screenshot to Scroll Video
// ============================================================

// --- State ---
const state = {
  image: null,           // HTMLImageElement
  bgType: 'solid',
  bgColor: '#1a1a2e',
  gradColor1: '#667eea',
  gradColor2: '#764ba2',
  gradAngle: 135,
  blurAmount: 40,
  aspectRatio: 2 / 3,
  placeholderSize: 70,
  cornerRadius: 12,
  shadowStrength: 50,
  shadowBlur: 40,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowColor: '#000000',
  canvasW: 1080,
  canvasH: 1920,
  duration: 8,
  defaultEasing: 'easeInOut',
  keyframes: [
    { time: 0, scroll: 0, easing: 'easeInOut' },
    { time: 1, scroll: 100, easing: 'easeInOut' },
  ],
  selectedKf: null,
  playing: false,
  currentTime: 0,       // 0..1 normalized
  exportScale: 1,
  exportFps: 30,
};

// --- DOM refs ---
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');

// Controls
const imageUpload = document.getElementById('imageUpload');
const bgTabs = document.querySelectorAll('.bg-tab');
const bgSolidOptions = document.getElementById('bgSolidOptions');
const bgGradientOptions = document.getElementById('bgGradientOptions');
const bgBlurOptions = document.getElementById('bgBlurOptions');

// Timeline
const timelineTrack = document.getElementById('timelineTrack');
const timelineProgress = document.getElementById('timelineProgress');
const scrubber = document.getElementById('scrubber');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const timeDisplay = document.getElementById('timeDisplay');
const addKeyframeBtn = document.getElementById('addKeyframeBtn');
const removeKeyframeBtn = document.getElementById('removeKeyframeBtn');

// Keyframe editor
const keyframeEditor = document.getElementById('keyframeEditor');
const kfIndex = document.getElementById('kfIndex');
const kfScrollPos = document.getElementById('kfScrollPos');
const kfScrollPosVal = document.getElementById('kfScrollPosVal');
const kfEasing = document.getElementById('kfEasing');

// Export
const exportBtn = document.getElementById('exportBtn');
const exportProgress = document.getElementById('exportProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Offscreen canvas for blur background
let blurCanvas = null;

// --- Easing functions ---
const easings = {
  linear: t => t,
  easeIn: t => t * t,
  easeOut: t => t * (2 - t),
  easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
};

// --- Canvas sizing ---
function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const rect = wrapper.getBoundingClientRect();
  // Set canvas to match the output resolution for crisp rendering
  canvas.width = state.canvasW;
  canvas.height = state.canvasH;
  // CSS sizing handled by style
}

function parseCanvasPreset(val) {
  const [w, h] = val.split('x').map(Number);
  return { w, h };
}

// --- Background rendering ---
function drawBackground() {
  const { canvasW: w, canvasH: h } = state;

  if (state.bgType === 'solid') {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);
  } else if (state.bgType === 'gradient') {
    const angle = state.gradAngle * Math.PI / 180;
    const cx = w / 2, cy = h / 2;
    const len = Math.max(w, h);
    const x1 = cx - Math.cos(angle) * len;
    const y1 = cy - Math.sin(angle) * len;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, state.gradColor1);
    grad.addColorStop(1, state.gradColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (state.bgType === 'blur' && state.image) {
    // Draw blurred version of the image as background
    if (!blurCanvas) createBlurBackground();
    ctx.drawImage(blurCanvas, 0, 0, w, h);
    // Add a slight dark overlay for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
  }
}

function createBlurBackground() {
  if (!state.image) return;
  blurCanvas = document.createElement('canvas');
  blurCanvas.width = state.canvasW;
  blurCanvas.height = state.canvasH;
  const bctx = blurCanvas.getContext('2d');

  // Draw image covering full canvas
  const imgAspect = state.image.width / state.image.height;
  const canAspect = state.canvasW / state.canvasH;
  let sw, sh, sx, sy;
  if (imgAspect > canAspect) {
    sh = state.image.height;
    sw = sh * canAspect;
    sx = (state.image.width - sw) / 2;
    sy = 0;
  } else {
    sw = state.image.width;
    sh = sw / canAspect;
    sx = 0;
    sy = 0;
  }

  bctx.filter = `blur(${state.blurAmount}px)`;
  // Draw slightly larger to avoid blur edge artifacts
  const margin = state.blurAmount * 2;
  bctx.drawImage(state.image, sx, sy, sw, sh,
    -margin, -margin,
    state.canvasW + margin * 2, state.canvasH + margin * 2);
  bctx.filter = 'none';
}

// --- Scroll position interpolation ---
function getScrollAtTime(t) {
  const kfs = state.keyframes;
  if (t <= kfs[0].time) return kfs[0].scroll;
  if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].scroll;

  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].time && t <= kfs[i + 1].time) {
      const segT = (t - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
      const eased = easings[kfs[i].easing](segT);
      return kfs[i].scroll + (kfs[i + 1].scroll - kfs[i].scroll) * eased;
    }
  }
  return 0;
}

// --- Main render ---
function render() {
  const { canvasW: w, canvasH: h } = state;

  drawBackground();

  if (!state.image) return;

  // Calculate placeholder dimensions
  const padding = (100 - state.placeholderSize) / 100;
  const maxW = w * (1 - padding);
  const maxH = h * (1 - padding);

  let phW, phH;
  const phAspect = state.aspectRatio;
  if (maxW / maxH > phAspect) {
    phH = maxH;
    phW = phH * phAspect;
  } else {
    phW = maxW;
    phH = phW / phAspect;
  }

  const phX = (w - phW) / 2;
  const phY = (h - phH) / 2;
  const cr = state.cornerRadius * (w / 1080); // Scale corner radius with canvas

  // Shadow
  if (state.shadowStrength > 0) {
    const scale = w / 1080;
    const shadowAlpha = state.shadowStrength / 100 * 0.8;
    const r = parseInt(state.shadowColor.slice(1, 3), 16);
    const g = parseInt(state.shadowColor.slice(3, 5), 16);
    const b = parseInt(state.shadowColor.slice(5, 7), 16);
    ctx.save();
    ctx.shadowColor = `rgba(${r},${g},${b},${shadowAlpha})`;
    ctx.shadowBlur = state.shadowBlur * scale;
    ctx.shadowOffsetX = state.shadowOffsetX * scale;
    ctx.shadowOffsetY = state.shadowOffsetY * scale;
    ctx.beginPath();
    roundRect(ctx, phX, phY, phW, phH, cr);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fill();
    ctx.restore();
  }

  // Clip to placeholder
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, phX, phY, phW, phH, cr);
  ctx.clip();

  // Draw image scrolled
  const imgScale = phW / state.image.width;
  const scaledImgH = state.image.height * imgScale;
  const maxScroll = Math.max(0, scaledImgH - phH);
  const scrollPct = getScrollAtTime(state.currentTime) / 100;
  const scrollY = maxScroll * scrollPct;

  ctx.drawImage(state.image, 0, 0, state.image.width, state.image.height,
    phX, phY - scrollY, phW, scaledImgH);

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Animation loop ---
let animStart = null;
let animFrame = null;

function startPlayback() {
  state.playing = true;
  playIcon.classList.add('hidden');
  pauseIcon.classList.remove('hidden');
  animStart = performance.now() - state.currentTime * state.duration * 1000;
  tick();
}

function stopPlayback() {
  state.playing = false;
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
  if (animFrame) cancelAnimationFrame(animFrame);
}

function tick() {
  if (!state.playing) return;
  const elapsed = (performance.now() - animStart) / 1000;
  state.currentTime = Math.min(elapsed / state.duration, 1);

  if (state.currentTime >= 1) {
    state.currentTime = 0;
    animStart = performance.now();
  }

  updateTimeline();
  render();
  animFrame = requestAnimationFrame(tick);
}

// --- Timeline UI ---
function updateTimeline() {
  const pct = state.currentTime * 100;
  timelineProgress.style.width = pct + '%';
  scrubber.style.left = pct + '%';

  const sec = state.currentTime * state.duration;
  const totalSec = state.duration;
  timeDisplay.textContent = `${formatTime(sec)} / ${formatTime(totalSec)}`;
}

function formatTime(s) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
}

function renderKeyframes() {
  // Remove old markers
  timelineTrack.querySelectorAll('.keyframe-marker').forEach(el => el.remove());

  state.keyframes.forEach((kf, i) => {
    const marker = document.createElement('div');
    marker.className = 'keyframe-marker';
    if (i === 0 || i === state.keyframes.length - 1) marker.classList.add('edge');
    if (i === state.selectedKf) marker.classList.add('selected');
    marker.style.left = (kf.time * 100) + '%';
    marker.dataset.index = i;

    // Click to select
    marker.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectKeyframe(i);

      // Drag (not for first/last)
      if (i === 0 || i === state.keyframes.length - 1) return;

      const trackRect = timelineTrack.getBoundingClientRect();
      const onMove = (e2) => {
        const x = (e2.clientX - trackRect.left) / trackRect.width;
        const prev = state.keyframes[i - 1].time;
        const next = state.keyframes[i + 1].time;
        kf.time = Math.max(prev + 0.01, Math.min(next - 0.01, x));
        renderKeyframes();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
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
    kfScrollPos.value = kf.scroll;
    kfScrollPosVal.textContent = Math.round(kf.scroll) + '%';
    kfEasing.value = kf.easing;
  } else {
    keyframeEditor.classList.add('hidden');
  }
}

// --- Scrubber dragging ---
function initScrubber() {
  let dragging = false;

  const getTime = (e) => {
    const rect = timelineTrack.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  scrubber.addEventListener('mousedown', (e) => {
    dragging = true;
    scrubber.classList.add('dragging');
    stopPlayback();
    e.preventDefault();
  });

  timelineTrack.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('keyframe-marker')) return;
    stopPlayback();
    state.currentTime = getTime(e);
    updateTimeline();
    render();
    dragging = true;
    scrubber.classList.add('dragging');
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.currentTime = getTime(e);
    updateTimeline();
    render();
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    scrubber.classList.remove('dragging');
  });
}

// --- Event bindings ---
function bindControls() {
  // Image upload
  imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadImage(file);
  });

  // Drag and drop
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragover');
  });
  document.addEventListener('dragleave', () => {
    document.body.classList.remove('dragover');
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  });

  // Background type tabs
  bgTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      bgTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.bgType = tab.dataset.bg;
      bgSolidOptions.classList.toggle('hidden', state.bgType !== 'solid');
      bgGradientOptions.classList.toggle('hidden', state.bgType !== 'gradient');
      bgBlurOptions.classList.toggle('hidden', state.bgType !== 'blur');
      if (state.bgType === 'blur') createBlurBackground();
      render();
    });
  });

  // Background controls
  bindInput('bgColor', 'bgColor', v => { state.bgColor = v; render(); });
  bindInput('gradColor1', 'gradColor1', v => { state.gradColor1 = v; render(); });
  bindInput('gradColor2', 'gradColor2', v => { state.gradColor2 = v; render(); });
  bindRange('gradAngle', 'gradAngleVal', v => `${v}°`, v => { state.gradAngle = +v; render(); });
  bindRange('blurAmount', 'blurAmountVal', v => `${v}px`, v => { state.blurAmount = +v; createBlurBackground(); render(); });

  // Placeholder controls
  bindRange('placeholderSize', 'placeholderSizeVal', v => `${v}%`, v => { state.placeholderSize = +v; render(); });
  bindRange('cornerRadius', 'cornerRadiusVal', v => `${v}px`, v => { state.cornerRadius = +v; render(); });
  bindRange('shadowStrength', 'shadowStrengthVal', v => `${v}%`, v => { state.shadowStrength = +v; render(); });
  bindRange('shadowBlur', 'shadowBlurVal', v => `${v}px`, v => { state.shadowBlur = +v; render(); });
  bindRange('shadowOffsetY', 'shadowOffsetYVal', v => `${v}px`, v => { state.shadowOffsetY = +v; render(); });
  bindRange('shadowOffsetX', 'shadowOffsetXVal', v => `${v}px`, v => { state.shadowOffsetX = +v; render(); });
  bindInput('shadowColor', 'shadowColor', v => { state.shadowColor = v; render(); });

  // Aspect ratio
  document.getElementById('aspectRatio').addEventListener('change', (e) => {
    state.aspectRatio = parseFloat(e.target.value);
    render();
  });

  // Canvas preset
  document.getElementById('canvasPreset').addEventListener('change', (e) => {
    const { w, h } = parseCanvasPreset(e.target.value);
    state.canvasW = w;
    state.canvasH = h;
    resizeCanvas();
    if (state.bgType === 'blur') createBlurBackground();
    // Update wrapper aspect ratio
    canvas.parentElement.style.aspectRatio = `${w}/${h}`;
    render();
  });

  // Duration
  bindRange('duration', 'durationVal', v => `${v}s`, v => { state.duration = +v; updateTimeline(); });

  // Default easing
  document.getElementById('defaultEasing').addEventListener('change', (e) => {
    state.defaultEasing = e.target.value;
  });

  // Playback
  playBtn.addEventListener('click', () => {
    if (state.playing) {
      stopPlayback();
    } else {
      if (state.currentTime >= 1) state.currentTime = 0;
      startPlayback();
    }
  });

  // Keyframe controls
  addKeyframeBtn.addEventListener('click', () => {
    const t = state.currentTime;
    // Find insertion point
    let idx = state.keyframes.findIndex(kf => kf.time > t);
    if (idx === -1) idx = state.keyframes.length;
    const scroll = getScrollAtTime(t);
    state.keyframes.splice(idx, 0, {
      time: t,
      scroll: Math.round(scroll),
      easing: state.defaultEasing
    });
    selectKeyframe(idx);
    renderKeyframes();
  });

  removeKeyframeBtn.addEventListener('click', () => {
    if (state.selectedKf === null) return;
    if (state.selectedKf === 0 || state.selectedKf === state.keyframes.length - 1) return;
    state.keyframes.splice(state.selectedKf, 1);
    state.selectedKf = null;
    keyframeEditor.classList.add('hidden');
    renderKeyframes();
    render();
  });

  // Keyframe editor
  kfScrollPos.addEventListener('input', (e) => {
    if (state.selectedKf === null) return;
    state.keyframes[state.selectedKf].scroll = +e.target.value;
    kfScrollPosVal.textContent = e.target.value + '%';
    render();
  });

  kfEasing.addEventListener('change', (e) => {
    if (state.selectedKf === null) return;
    state.keyframes[state.selectedKf].easing = e.target.value;
  });

  // Export
  document.getElementById('exportRes').addEventListener('change', (e) => {
    state.exportScale = e.target.value === '2x' ? 2 : 1;
  });
  document.getElementById('exportFps').addEventListener('change', (e) => {
    state.exportFps = +e.target.value;
  });

  exportBtn.addEventListener('click', exportVideo);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      playBtn.click();
    }
  });
}

function bindInput(id, stateKey, cb) {
  document.getElementById(id).addEventListener('input', (e) => cb(e.target.value));
}

function bindRange(id, valId, fmt, cb) {
  const el = document.getElementById(id);
  const val = document.getElementById(valId);
  el.addEventListener('input', (e) => {
    val.textContent = fmt(e.target.value);
    cb(e.target.value);
  });
}

// --- Image loading ---
function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      emptyState.classList.add('hidden');
      exportBtn.disabled = false;
      blurCanvas = null;
      if (state.bgType === 'blur') createBlurBackground();
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Export to MP4 ---
async function exportVideo() {
  if (!state.image) return;

  stopPlayback();
  exportProgress.classList.remove('hidden');
  exportBtn.disabled = true;
  progressText.textContent = 'Preparing...';
  progressFill.style.width = '0%';

  try {
    const scale = state.exportScale;
    const fps = state.exportFps;
    const totalFrames = Math.ceil(state.duration * fps);
    const w = state.canvasW * scale;
    const h = state.canvasH * scale;

    // Ensure even dimensions (required by H.264)
    const encW = w % 2 === 0 ? w : w + 1;
    const encH = h % 2 === 0 ? h : h + 1;

    // Create offscreen canvas at export resolution
    const expCanvas = document.createElement('canvas');
    expCanvas.width = encW;
    expCanvas.height = encH;
    const expCtx = expCanvas.getContext('2d');

    // Save original state
    const origW = state.canvasW;
    const origH = state.canvasH;

    state.canvasW = encW;
    state.canvasH = encH;
    if (state.bgType === 'blur') createBlurBackground();

    // Set up mp4-muxer
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: encW,
        height: encH,
      },
      fastStart: 'in-memory',
    });

    // Set up VideoEncoder
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error('Encoder error:', e),
    });

    encoder.configure({
      codec: 'avc1.640028',
      width: encW,
      height: encH,
      bitrate: encW * encH > 2100000 ? 20_000_000 : 8_000_000,
      framerate: fps,
    });

    progressText.textContent = 'Rendering & encoding...';

    for (let i = 0; i < totalFrames; i++) {
      state.currentTime = i / (totalFrames - 1);
      renderToContext(expCtx, encW, encH);

      const frame = new VideoFrame(expCanvas, {
        timestamp: (i / fps) * 1_000_000, // microseconds
        duration: (1 / fps) * 1_000_000,
      });

      const isKeyFrame = i % (fps * 2) === 0; // keyframe every 2 seconds
      encoder.encode(frame, { keyFrame: isKeyFrame });
      frame.close();

      if (i % 5 === 0) {
        const pct = Math.round((i / totalFrames) * 90);
        progressFill.style.width = pct + '%';
        progressText.textContent = `Encoding frame ${i + 1}/${totalFrames}...`;
        // Yield to keep UI responsive
        await new Promise(r => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    // Restore state
    state.canvasW = origW;
    state.canvasH = origH;
    state.currentTime = 0;
    if (state.bgType === 'blur') createBlurBackground();

    progressFill.style.width = '95%';
    progressText.textContent = 'Preparing download...';

    const { buffer } = muxer.target;
    const videoBlob = new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(videoBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'scrollsnap-export.mp4';
    a.click();
    URL.revokeObjectURL(url);

    progressFill.style.width = '100%';
    progressText.textContent = 'Done! File downloaded.';

    setTimeout(() => {
      exportProgress.classList.add('hidden');
    }, 3000);

  } catch (err) {
    console.error('Export failed:', err);
    progressText.textContent = `Export failed: ${err.message}`;
  } finally {
    exportBtn.disabled = false;
    render();
  }
}

// Render to a specific context (used for export)
function renderToContext(targetCtx, w, h) {
  // Background
  if (state.bgType === 'solid') {
    targetCtx.fillStyle = state.bgColor;
    targetCtx.fillRect(0, 0, w, h);
  } else if (state.bgType === 'gradient') {
    const angle = state.gradAngle * Math.PI / 180;
    const cx = w / 2, cy = h / 2;
    const len = Math.max(w, h);
    const x1 = cx - Math.cos(angle) * len;
    const y1 = cy - Math.sin(angle) * len;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    const grad = targetCtx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, state.gradColor1);
    grad.addColorStop(1, state.gradColor2);
    targetCtx.fillStyle = grad;
    targetCtx.fillRect(0, 0, w, h);
  } else if (state.bgType === 'blur' && blurCanvas) {
    targetCtx.drawImage(blurCanvas, 0, 0, w, h);
    targetCtx.fillStyle = 'rgba(0,0,0,0.2)';
    targetCtx.fillRect(0, 0, w, h);
  } else {
    targetCtx.fillStyle = '#1a1a2e';
    targetCtx.fillRect(0, 0, w, h);
  }

  if (!state.image) return;

  const padding = (100 - state.placeholderSize) / 100;
  const maxW = w * (1 - padding);
  const maxH = h * (1 - padding);

  let phW, phH;
  const phAspect = state.aspectRatio;
  if (maxW / maxH > phAspect) {
    phH = maxH;
    phW = phH * phAspect;
  } else {
    phW = maxW;
    phH = phW / phAspect;
  }

  const phX = (w - phW) / 2;
  const phY = (h - phH) / 2;
  const cr = state.cornerRadius * (w / 1080);

  // Shadow
  if (state.shadowStrength > 0) {
    const scale = w / 1080;
    const shadowAlpha = state.shadowStrength / 100 * 0.8;
    const r = parseInt(state.shadowColor.slice(1, 3), 16);
    const g = parseInt(state.shadowColor.slice(3, 5), 16);
    const b = parseInt(state.shadowColor.slice(5, 7), 16);
    targetCtx.save();
    targetCtx.shadowColor = `rgba(${r},${g},${b},${shadowAlpha})`;
    targetCtx.shadowBlur = state.shadowBlur * scale;
    targetCtx.shadowOffsetX = state.shadowOffsetX * scale;
    targetCtx.shadowOffsetY = state.shadowOffsetY * scale;
    targetCtx.beginPath();
    roundRect(targetCtx, phX, phY, phW, phH, cr);
    targetCtx.fillStyle = 'rgba(0,0,0,1)';
    targetCtx.fill();
    targetCtx.restore();
  }

  // Clip and draw image
  targetCtx.save();
  targetCtx.beginPath();
  roundRect(targetCtx, phX, phY, phW, phH, cr);
  targetCtx.clip();

  const imgScale = phW / state.image.width;
  const scaledImgH = state.image.height * imgScale;
  const maxScroll = Math.max(0, scaledImgH - phH);
  const scrollPct = getScrollAtTime(state.currentTime) / 100;
  const scrollY = maxScroll * scrollPct;

  targetCtx.drawImage(state.image, 0, 0, state.image.width, state.image.height,
    phX, phY - scrollY, phW, scaledImgH);

  targetCtx.restore();
}

// --- Init ---
function init() {
  resizeCanvas();
  bindControls();
  initScrubber();
  renderKeyframes();
  updateTimeline();
  render();
}

init();
