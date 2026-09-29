import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const REPLICATE_PROXY_URL = 'https://itp-ima-replicate-proxy.web.app/api/create_n_get';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = selector => document.querySelector(selector);
const welcomeView = $('#welcome-view');
const comicView = $('#comic-view');
const profileForm = $('#profile-form');
const panelForm = $('#panel-form');
const nameInput = $('#name-input');
const idInput = $('#id-input');
const styleChoices = $('#style-choices');
const stage = $('#comic-stage');
const thoughtInput = $('#thought-input');
const imagePromptInput = $('#image-prompt-input');
const continuityInput = $('#continuity-input');
const showTextToggle = $('#show-text-toggle');
const generateButton = $('#generate-button');
const profileStatus = $('#profile-status');
const workspaceStatus = $('#workspace-status');
const profileLabel = $('#profile-label');
const styleLabel = $('#style-label');
const replicateTokenInput = $('#replicate-token');

const localProfileKey = 'thought-comic-profile';
const localTokenKey = 'thought-comic-replicate-token';
let firebaseUser = null;
let profileId = '';
let profileName = '';
let selectedStyle = 'japanese';
let panels = [];
let dragState = null;
let resizeState = null;
let continuityNotes = '';
let showText = true;

replicateTokenInput.value = localStorage.getItem(localTokenKey) || '';
replicateTokenInput.addEventListener('change', () => localStorage.setItem(localTokenKey, replicateTokenInput.value.trim()));

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.dataset.error = isError ? 'true' : 'false';
}

function makeProfileId(name) {
  const clean = name.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'GUEST';
  return `${clean}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function selectStyle(style) {
  selectedStyle = style;
  document.querySelectorAll('.style-choice').forEach(button => button.classList.toggle('selected', button.dataset.style === style));
  stage.className = `comic-stage style-${style}`;
  styleLabel.textContent = { japanese: 'Japanese dynamic', retro: 'Retro grid', american: 'American comic' }[style];
  renderPanels();
}

styleChoices.addEventListener('click', event => {
  const button = event.target.closest('[data-style]');
  if (button) selectStyle(button.dataset.style);
});

function defaultPosition(index) {
  const positions = {
    japanese: [{ x: 5, y: 8, w: 39, h: 31 }, { x: 46, y: 5, w: 48, h: 37 }, { x: 12, y: 51, w: 38, h: 37 }, { x: 58, y: 59, w: 34, h: 29 }],
    retro: [{ x: 7, y: 8, w: 40, h: 36 }, { x: 53, y: 8, w: 40, h: 36 }, { x: 7, y: 51, w: 40, h: 36 }, { x: 53, y: 51, w: 40, h: 36 }],
    american: [{ x: 7, y: 7, w: 58, h: 43 }, { x: 69, y: 7, w: 24, h: 26 }, { x: 69, y: 38, w: 24, h: 26 }, { x: 7, y: 57, w: 86, h: 31 }]
  };
  return positions[selectedStyle][index % positions[selectedStyle].length];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderPanels() {
  stage.innerHTML = '';
  if (!panels.length) {
    stage.innerHTML = '<div class="empty-stage">Your first thought will become<br />the first frame.</div>';
    return;
  }
  panels.forEach((panel, index) => {
    const position = panel.position || defaultPosition(index);
    panel.position = position;
    const element = document.createElement('article');
    element.className = `comic-panel${showText ? '' : ' hide-copy'}`;
    element.dataset.id = panel.id;
    element.style.left = `${position.x}%`;
    element.style.top = `${position.y}%`;
    element.style.width = `${position.w}%`;
    element.style.height = `${position.h}%`;
    const imageScale = Number(panel.imageScale || 1).toFixed(2);
    element.innerHTML = `<div class="panel-image">${panel.imageUrl ? `<img src="${escapeHtml(panel.imageUrl)}" alt="${escapeHtml(panel.text)}" style="transform:scale(${imageScale})" />` : '<div class="loading-card">text frame</div>'}<div class="image-tools"><label>image zoom <input class="image-zoom" type="range" min="1" max="2.5" step=".05" value="${imageScale}" aria-label="Image zoom" /></label></div></div>${showText ? `<div class="panel-copy"><span class="panel-number">FRAME ${String(index + 1).padStart(2, '0')}</span>${escapeHtml(panel.text)}</div>` : ''}<button class="panel-resize" type="button" aria-label="Resize frame"></button>`;
    element.addEventListener('pointerdown', startDrag);
    element.querySelector('.panel-resize').addEventListener('pointerdown', event => { event.stopPropagation(); startResize(event); });
    element.querySelector('.image-zoom').addEventListener('pointerdown', event => event.stopPropagation());
    element.querySelector('.image-zoom').addEventListener('input', event => {
      panel.imageScale = Number(event.target.value);
      element.querySelector('.panel-image img')?.style.setProperty('transform', `scale(${panel.imageScale})`);
    });
    element.querySelector('.image-zoom').addEventListener('change', () => saveProfile().catch(error => setStatus(workspaceStatus, error.message, true)));
    stage.appendChild(element);
  });
}

function startDrag(event) {
  const element = event.currentTarget;
  const panel = panels.find(item => item.id === element.dataset.id);
  if (!panel) return;
  element.setPointerCapture(event.pointerId);
  element.classList.add('dragging');
  dragState = { event, element, panel, startX: event.clientX, startY: event.clientY, originalX: panel.position.x, originalY: panel.position.y };
  element.addEventListener('pointermove', moveDrag);
  element.addEventListener('pointerup', endDrag, { once: true });
}

function moveDrag(event) {
  if (!dragState) return;
  const rect = stage.getBoundingClientRect();
  dragState.panel.position.x = Math.max(0, Math.min(100 - dragState.panel.position.w, dragState.originalX + ((event.clientX - dragState.startX) / rect.width) * 100));
  dragState.panel.position.y = Math.max(0, Math.min(100 - dragState.panel.position.h, dragState.originalY + ((event.clientY - dragState.startY) / rect.height) * 100));
  dragState.element.style.left = `${dragState.panel.position.x}%`;
  dragState.element.style.top = `${dragState.panel.position.y}%`;
}

function startResize(event) {
  const element = event.currentTarget.closest('.comic-panel');
  const panel = panels.find(item => item.id === element?.dataset.id);
  if (!element || !panel) return;
  const rect = element.getBoundingClientRect();
  element.setPointerCapture(event.pointerId);
  element.classList.add('resizing');
  resizeState = { element, panel, pointerId: event.pointerId, startX: event.clientX, startWidth: rect.width, ratio: rect.width / rect.height };
  element.addEventListener('pointermove', moveResize);
  element.addEventListener('pointerup', endResize, { once: true });
}

function moveResize(event) {
  if (!resizeState) return;
  const stageRect = stage.getBoundingClientRect();
  const minimum = 130;
  const maximum = stageRect.width * .82;
  let width = Math.max(minimum, Math.min(maximum, resizeState.startWidth + event.clientX - resizeState.startX));
  let height = width / resizeState.ratio;
  if (height > stageRect.height * .78) {
    height = stageRect.height * .78;
    width = height * resizeState.ratio;
  }
  resizeState.panel.position.w = (width / stageRect.width) * 100;
  resizeState.panel.position.h = (height / stageRect.height) * 100;
  resizeState.element.style.width = `${resizeState.panel.position.w}%`;
  resizeState.element.style.height = `${resizeState.panel.position.h}%`;
}

function endResize(event) {
  if (!resizeState) return;
  resizeState.element.releasePointerCapture?.(event.pointerId);
  resizeState.element.classList.remove('resizing');
  resizeState.element.removeEventListener('pointermove', moveResize);
  resizeState = null;
  saveProfile().catch(error => setStatus(workspaceStatus, error.message, true));
}

function endDrag(event) {
  if (!dragState) return;
  dragState.element.releasePointerCapture?.(event.pointerId);
  dragState.element.classList.remove('dragging');
  dragState.element.removeEventListener('pointermove', moveDrag);
  dragState = null;
  saveProfile().catch(error => setStatus(workspaceStatus, error.message, true));
}

async function generateImage(prompt) {
  const authToken = replicateTokenInput.value.trim();
  const response = await fetch(REPLICATE_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: JSON.stringify({ model: 'black-forest-labs/flux-schnell', input: { prompt, go_fast: true, num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp', output_quality: 80 } })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.message || `image request failed (${response.status})`);
  const output = Array.isArray(data.output) ? data.output : [data.output];
  const imageUrl = output.find(value => typeof value === 'string' && /^https?:\/\//.test(value));
  if (!imageUrl) throw new Error('image API returned no image');
  return imageUrl;
}

function buildImagePrompt(text, visualPrompt) {
  const previous = panels.slice(-5).map((panel, index) => `Frame ${panels.length - panels.slice(-5).length + index + 1}: ${panel.text}`).join('\n');
  const styleDirection = {
    japanese: 'dynamic shonen manga composition, expressive perspective, asymmetrical panel energy',
    retro: 'quiet vintage comic composition, consistent period illustration, restrained framing',
    american: 'bold American comic composition, consistent inked characters, strong silhouette and action clarity'
  }[selectedStyle];
  return `Create the next sequential comic image for an ongoing story. This is not a new standalone scene. Keep the same recurring characters, faces, body proportions, clothing, colors, setting, lighting, and drawing style from earlier frames. Treat the following continuity notes as fixed visual facts: ${continuityNotes || 'No extra notes. Preserve every recurring detail from the previous frames.'}

Previous frames:
${previous || 'This is the opening frame, establish a clear visual world that can be continued.'}

Current thought: ${text}
Current image direction: ${visualPrompt}
Visual language: ${styleDirection}

Show the next moment in the same story. Keep character identity stable. Do not invent a different protagonist, costume, art style, or location unless the current thought explicitly changes it. No text, speech bubbles, borders, collage, or multiple unrelated scenes. One clear comic image.`;
}

async function saveProfile() {
  if (!firebaseUser || !profileId) return;
  await setDoc(doc(db, 'profiles', profileId), { ownerUid: firebaseUser.uid, name: profileName, style: selectedStyle, panels, continuityNotes, showText, updatedAt: serverTimestamp() }, { merge: true });
}

async function loadProfile(id) {
  const snapshot = await getDoc(doc(db, 'profiles', id));
  if (!snapshot.exists()) throw new Error('no comic found with that ID');
  const data = snapshot.data();
  profileId = id;
  profileName = data.name || nameInput.value.trim();
  selectedStyle = data.style || 'japanese';
  panels = Array.isArray(data.panels) ? data.panels : [];
  continuityNotes = data.continuityNotes || '';
  showText = data.showText !== false;
  continuityInput.value = continuityNotes;
  showTextToggle.checked = showText;
}

function openComic() {
  localStorage.setItem(localProfileKey, JSON.stringify({ id: profileId, name: profileName }));
  profileLabel.textContent = `${profileName} · ${profileId}`;
  selectStyle(selectedStyle);
  welcomeView.classList.add('hidden');
  comicView.classList.remove('hidden');
  renderPanels();
}

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!firebaseUser) { setStatus(profileStatus, 'connecting to Firebase…'); return; }
  profileName = nameInput.value.trim();
  profileStatus.textContent = 'opening…';
  try {
    const existingId = idInput.value.trim().toUpperCase();
    if (existingId) await loadProfile(existingId);
    else { profileId = makeProfileId(profileName); panels = []; await saveProfile(); }
    openComic();
  } catch (error) { setStatus(profileStatus, error.message, true); }
});

panelForm.addEventListener('submit', async event => {
  event.preventDefault();
  const text = thoughtInput.value.trim();
  if (!text) return;
  generateButton.disabled = true;
  generateButton.textContent = 'making frame…';
  setStatus(workspaceStatus, 'generating the next frame…');
  const panelId = `panel-${Date.now()}`;
  try {
    const visualPrompt = imagePromptInput.value.trim() || text;
    continuityNotes = continuityInput.value.trim();
    const imageUrl = await generateImage(buildImagePrompt(text, visualPrompt));
    panels.push({ id: panelId, text, imageUrl, prompt: visualPrompt, position: defaultPosition(panels.length), createdAt: new Date().toISOString() });
    renderPanels();
    await saveProfile();
    thoughtInput.value = '';
    imagePromptInput.value = '';
    setStatus(workspaceStatus, 'saved · drag the new frame anywhere');
  } catch (error) { setStatus(workspaceStatus, error.message, true); }
  finally { generateButton.disabled = false; generateButton.textContent = 'make next frame'; }
});

continuityInput.addEventListener('input', () => { continuityNotes = continuityInput.value; });
showTextToggle.addEventListener('change', () => { showText = showTextToggle.checked; renderPanels(); saveProfile().catch(error => setStatus(workspaceStatus, error.message, true)); });

$('#save-button').addEventListener('click', async () => {
  try { await saveProfile(); setStatus(workspaceStatus, 'saved'); } catch (error) { setStatus(workspaceStatus, error.message, true); }
});

$('#new-button').addEventListener('click', () => {
  comicView.classList.add('hidden');
  welcomeView.classList.remove('hidden');
  idInput.value = '';
  profileStatus.textContent = '';
});

$('#play-button').addEventListener('click', () => {
  const lightbox = $('#lightbox');
  const content = $('#lightbox-content');
  content.innerHTML = panels.length ? panels.map(panel => `<figure><img src="${escapeHtml(panel.imageUrl || '')}" alt="${escapeHtml(panel.text)}" /><p>${escapeHtml(panel.text)}</p></figure>`).join('') : '<p>Make a frame first.</p>';
  lightbox.classList.remove('hidden');
});

$('#close-lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));

onAuthStateChanged(auth, user => {
  firebaseUser = user;
  if (user) setStatus(profileStatus, '');
});

signInAnonymously(auth).catch(error => setStatus(profileStatus, `Firebase connection: ${error.message}`, true));

try {
  const saved = JSON.parse(localStorage.getItem(localProfileKey) || 'null');
  if (saved?.name) nameInput.value = saved.name;
} catch {}
