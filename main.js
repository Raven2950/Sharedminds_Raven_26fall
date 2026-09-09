/**
 * fringes — Shared Minds week 1
 * Vanilla canvas only. No p5.js, no libraries.
 *
 * A recording tool: nothing appears except what you type.
 * Type to add a thought on the current branch. Click another
 * thought to continue from there. Unselected branches slowly
 * recede and vanish after about 15 newer thoughts.
 */

const canvas = document.getElementById("thoughtCanvas");
const ctx = canvas.getContext("2d");
const thoughtForm = document.getElementById("thoughtForm");
const thoughtInput = document.getElementById("thoughtInput");
const clearBtn = document.getElementById("clearBtn");
const intro = document.getElementById("intro");
const FONT = '"Gill Sans", "Gill Sans MT", "Trebuchet MS", sans-serif';

let viewWidth = 0;
let viewHeight = 0;

/** Feature 2: each thought-particle lives in this array. */
let thoughts = [];
let selectedId = null;
let nextId = 1;
/** Counts every spawn. Fading thoughts wait for +15 new spawns before removal. */
let spawnCounter = 0;

const GROW_AMOUNT = 5;
const MAX_SIZE = 28;
const MIN_SIZE = 9;
const HIT_PADDING = 12;
const FADE_SPEED = 0.00022;
const SHRINK_SPEED = 0.002;
const LINGER_ALPHA = 0.16;
const REMOVE_AFTER_SPAWNS = 15;
const MAX_THOUGHTS = 40;

// ---------------------------------------------------------------------------
// Thought particle
//   text, x, y, dx, dy, size, alpha  — required by the assignment
// ---------------------------------------------------------------------------
function nextBranchAngle(parentId) {
  const n = thoughts.filter((t) => t.parentId === parentId).length;
  if (n === 0) return Math.PI / 2;
  const k = Math.ceil(n / 2);
  const sign = n % 2 === 1 ? -1 : 1;
  return Math.PI / 2 + sign * k * 0.7;
}

function createThought({ text, x, y, parentId }) {
  spawnCounter += 1;
  const parent = parentId != null ? thoughts.find((t) => t.id === parentId) : null;
  const angle = parent ? nextBranchAngle(parent.id) : 0;
  const dist = 90;
  const px = x != null ? x : parent ? parent.x + Math.cos(angle) * dist : viewWidth / 2;
  const py = y != null ? y : parent ? parent.y + Math.sin(angle) * dist : viewHeight / 2;

  return {
    id: nextId++,
    text: text,
    x: px,
    y: py,
    dx: (Math.random() * 2 - 1) * 0.12,
    dy: (Math.random() * 2 - 1) * 0.12,
    size: 14,
    alpha: 0.95,
    noticed: false,
    parentId: parentId != null ? parentId : null,
    kind: "text",
    branchDist: dist,
    fadeAtSpawn: null,
    spawnIndex: spawnCounter,
    phase: Math.random() * Math.PI * 2,
    bob: 0.006 + Math.random() * 0.004,
  };
}

function addThought(opts) {
  if (thoughts.length >= MAX_THOUGHTS) {
    const gone = thoughts.findIndex(
      (t) => t.fadeAtSpawn != null && spawnCounter - t.fadeAtSpawn >= REMOVE_AFTER_SPAWNS
    );
    if (gone !== -1) thoughts.splice(gone, 1);
    else if (thoughts.length >= MAX_THOUGHTS) return null;
  }
  const thought = createThought(opts);
  thoughts.push(thought);
  intro.classList.add("hidden");
  return thought;
}

function selectedThought() {
  return thoughts.find((t) => t.id === selectedId) || null;
}

function updatePlaceholder() {
  thoughtInput.placeholder = selectedThought()
    ? "continue from this thought…"
    : "type a thought…";
}

// ---------------------------------------------------------------------------
// Canvas size
// ---------------------------------------------------------------------------
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const wrap = canvas.parentElement.getBoundingClientRect();
  viewWidth = wrap.width;
  viewHeight = wrap.height;
  canvas.width = Math.floor(viewWidth * dpr);
  canvas.height = Math.floor(viewHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);

function fontFor(thought) {
  return `${thought.size}px ${FONT}`;
}

function measureThought(thought) {
  ctx.font = fontFor(thought);
  const width = Math.max(24, ctx.measureText(thought.text).width);
  const height = thought.size * 1.35;
  return { width, height };
}

function keepThoughtOnCanvas(thought) {
  const { width, height } = measureThought(thought);
  const halfW = width / 2;
  const halfH = height / 2;

  if (thought.x - halfW < 8) {
    thought.x = 8 + halfW;
    thought.dx = Math.abs(thought.dx);
  } else if (thought.x + halfW > viewWidth - 8) {
    thought.x = viewWidth - 8 - halfW;
    thought.dx = -Math.abs(thought.dx);
  }

  if (thought.y - halfH < 8) {
    thought.y = 8 + halfH;
    thought.dy = Math.abs(thought.dy);
  } else if (thought.y + halfH > viewHeight - 8) {
    thought.y = viewHeight - 8 - halfH;
    thought.dy = -Math.abs(thought.dy);
  }
}

function hitTest(thought, mouseX, mouseY) {
  const { width, height } = measureThought(thought);
  return (
    mouseX >= thought.x - width / 2 - HIT_PADDING &&
    mouseX <= thought.x + width / 2 + HIT_PADDING &&
    mouseY >= thought.y - height / 2 - HIT_PADDING &&
    mouseY <= thought.y + height / 2 + HIT_PADDING
  );
}

// ---------------------------------------------------------------------------
// Click: this fork becomes the stem (grows). Others recede.
// Catching slightly disturbs nearby associations.
// ---------------------------------------------------------------------------
function selectThought(thought) {
  for (const other of thoughts) {
    if (other.id === thought.id) continue;
    other.noticed = false;
    if (other.fadeAtSpawn == null) other.fadeAtSpawn = spawnCounter;
  }

  thought.noticed = true;
  thought.fadeAtSpawn = null;
  thought.alpha = 1;
  thought.size = Math.min(MAX_SIZE, thought.size + GROW_AMOUNT);
  selectedId = thought.id;
  keepThoughtOnCanvas(thought);
  updatePlaceholder();
}

// ---------------------------------------------------------------------------
// Feature 1 — you type, the map records it
// ---------------------------------------------------------------------------
thoughtForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = thoughtInput.value.trim();
  if (!text) return;

  const stem = selectedThought();
  const recorded = addThought({
    text,
    parentId: stem ? stem.id : null,
    x: stem ? undefined : viewWidth / 2,
    y: stem ? undefined : viewHeight / 2,
  });
  if (recorded) selectThought(recorded);

  thoughtInput.value = "";
  thoughtInput.focus();
  updatePlaceholder();
});

// Feature 6 — erase the page
clearBtn.addEventListener("click", () => {
  thoughts = [];
  selectedId = null;
  intro.classList.remove("hidden");
  intro.textContent = "type a thought to begin";
  updatePlaceholder();
  thoughtInput.focus();
});

// Feature 4 — click a thought to continue from that fork
canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  for (let i = thoughts.length - 1; i >= 0; i--) {
    const thought = thoughts[i];
    if (!hitTest(thought, mouseX, mouseY)) continue;
    selectThought(thought);
    thoughtInput.focus();
    break;
  }
});

// ---------------------------------------------------------------------------
// Gentle drift + bounce, so the map feels alive but stays readable
// ---------------------------------------------------------------------------
function applyForces(thought) {
  const parent = thought.parentId != null
    ? thoughts.find((t) => t.id === thought.parentId)
    : null;

  if (parent) {
    const vx = thought.x - parent.x;
    const vy = thought.y - parent.y;
    const dist = Math.hypot(vx, vy) || 1;
    const force = (dist - thought.branchDist) * 0.0012;
    thought.dx -= (vx / dist) * force;
    thought.dy -= (vy / dist) * force;
  }

  // Slow bob — like a thought hovering, not bouncing around
  thought.phase += thought.bob;
  thought.dx += Math.sin(thought.phase) * 0.018;
  thought.dy += Math.cos(thought.phase * 0.9) * 0.014;

  thought.dx *= 0.985;
  thought.dy *= 0.985;

  const maxSpeed = 0.42;
  const speed = Math.hypot(thought.dx, thought.dy);
  if (speed > maxSpeed) {
    thought.dx *= maxSpeed / speed;
    thought.dy *= maxSpeed / speed;
  }
}

function updateThought(thought) {
  applyForces(thought);
  thought.x += thought.dx;
  thought.y += thought.dy;
  keepThoughtOnCanvas(thought);

  // Feature 5: unselected forks recede. They linger until ~15 newer thoughts.
  if (!thought.noticed) {
    const stem = selectedThought();
    const liveCandidate = stem && thought.parentId === stem.id;

    thought.alpha -= liveCandidate ? FADE_SPEED * 0.4 : FADE_SPEED;
    thought.size = Math.max(MIN_SIZE, thought.size - SHRINK_SPEED);

    if (liveCandidate) {
      if (thought.alpha < 0.55) thought.alpha = 0.55;
    } else if (thought.fadeAtSpawn != null) {
      const newer = spawnCounter - thought.fadeAtSpawn;
      if (newer < REMOVE_AFTER_SPAWNS && thought.alpha < LINGER_ALPHA) {
        thought.alpha = LINGER_ALPHA;
      }
    } else if (thought.alpha < LINGER_ALPHA) {
      thought.alpha = LINGER_ALPHA;
    }
  }
}

function drawLinks() {
  for (const thought of thoughts) {
    if (thought.parentId == null) continue;
    const parent = thoughts.find((t) => t.id === thought.parentId);
    if (!parent) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(parent.alpha, thought.alpha) * 0.35;
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(parent.x, parent.y);
    ctx.lineTo(thought.x, thought.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawThought(thought) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, thought.alpha);
  ctx.font = fontFor(thought);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = thought.noticed ? "#111" : "#777";
  ctx.fillText(thought.text, thought.x, thought.y);
  ctx.restore();
}

function animate() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);

  for (const thought of thoughts) updateThought(thought);

  drawLinks();
  const order = thoughts.slice().sort((a, b) => Number(a.noticed) - Number(b.noticed));
  for (const thought of order) drawThought(thought);

  thoughts = thoughts.filter((thought) => thought.alpha > 0);
  if (selectedId && !thoughts.some((t) => t.id === selectedId)) {
    selectedId = null;
    updatePlaceholder();
  }

  requestAnimationFrame(animate);
}

resizeCanvas();
requestAnimationFrame(animate);
thoughtInput.focus();
