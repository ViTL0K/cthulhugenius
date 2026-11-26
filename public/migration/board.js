const viewport = document.getElementById('board-scroll');
const image = document.getElementById('board-map');
const hint = document.getElementById('board-hint');
const input = document.getElementById('board-upload');
const upload = document.getElementById('board-upload-button');
const status = document.getElementById('board-status');
const zoomIn = document.getElementById('board-zoom-in');
const zoomOut = document.getElementById('board-zoom-out');
const fit = document.getElementById('board-fit');
let board;
let zoom = 1;
let dragging;

function resize() {
  if (!image.naturalWidth || viewport.hidden) return;
  const base = Math.min(viewport.clientWidth / image.naturalWidth,
    viewport.clientHeight / image.naturalHeight);
  image.style.width = Math.round(base * zoom * image.naturalWidth) + 'px';
  zoomIn.disabled = zoom >= 4;
  zoomOut.disabled = zoom <= 1;
}

function render(map) {
  hint.hidden = Boolean(map);
  viewport.hidden = !map;
  fit.disabled = !map;
  zoomIn.disabled = !map;
  zoomOut.disabled = !map;
  zoom = 1;
  if (map) image.src = 'data:image/webp;base64,' + map;
  else image.removeAttribute('src');
}

export function activateBoard(room, request) {
  board = {path: '/' + encodeURIComponent(room.id) + '/board', request, version: '', cycle: 0};
  upload.hidden = room.role !== 'keeper';
  status.textContent = '';
  render(null);
}

export async function refreshBoard() {
  if (!board) return;
  const opened = board;
  if (opened.uploading) return;
  const cycle = ++opened.cycle;
  try {
    const result = await opened.request(opened.path + '?known=' + encodeURIComponent(opened.version));
    if (opened !== board || cycle !== opened.cycle) return;
    if ('map' in result) render(result.map);
    opened.version = result.updated ?? '';
    status.textContent = '';
  } catch (error) {
    if (opened === board && cycle === opened.cycle) status.textContent = error.message;
  }
}

upload.addEventListener('click', () => input.click());

input.addEventListener('change', async () => {
  const opened = board;
  const file = input.files[0];
  input.value = '';
  if (!file || !opened || opened.uploading) return;
  opened.uploading = true;
  ++opened.cycle;
  status.textContent = 'Завантажуємо карту…';
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    let encoded;
    do {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      encoded = canvas.toDataURL('image/webp', 0.82).split(',')[1];
      scale *= 0.75;
    } while (encoded.length > 800000);
    if (board !== opened) return;
    const result = await opened.request(opened.path, {method: 'POST',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({map: encoded})});
    if (board !== opened) return;
    render(result.map);
    opened.version = result.updated;
    status.textContent = '';
  } catch (error) {
    if (board === opened) status.textContent = error.message || 'Не вдалося завантажити карту.';
  } finally {
    bitmap?.close();
    opened.uploading = false;
  }
});

image.addEventListener('load', resize);
window.addEventListener('resize', resize);
zoomIn.addEventListener('click', () => { zoom = Math.min(4, zoom * 1.35); resize(); });
zoomOut.addEventListener('click', () => { zoom = Math.max(1, zoom / 1.35); resize(); });
fit.addEventListener('click', () => { zoom = 1; resize(); });
viewport.addEventListener('pointerdown', event => {
  if (event.button !== 0 || zoom <= 1) return;
  dragging = {x: event.clientX + viewport.scrollLeft, y: event.clientY + viewport.scrollTop};
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', event => {
  if (dragging) viewport.scrollTo(dragging.x - event.clientX, dragging.y - event.clientY);
});
viewport.addEventListener('lostpointercapture', () => { dragging = null; });
