const sheetForm = document.getElementById('sheet-form');
const sheetList = document.getElementById('sheet-list');
const sheetStatus = document.getElementById('sheet-status');
const stats = document.getElementById('sheet-stats');
const theme = document.getElementById('portal-theme');
const settingsStatus = document.getElementById('settings-status');
const characteristics = {
  str: 'Сила', con: 'Витривалість', siz: 'Розмір', dex: 'Спритність',
  app: 'Привабливість', int: 'Інтелект', pow: 'Воля', edu: 'Освіченість',
};

export function configurePreferences(userId) {
  const key = 'poklik-cloudflare:' + userId + ':';
  let drafts = [];
  let editing = null;

  try {
    theme.value = localStorage.getItem(key + 'theme') === 'paper' ? 'paper' : 'dark';
    const stored = JSON.parse(localStorage.getItem(key + 'sheets') || '[]');
    if (Array.isArray(stored)) drafts = stored;
  } catch {
    sheetStatus.textContent = 'Не вдалося прочитати чернетки з цього браузера.';
  }
  document.documentElement.dataset.theme = theme.value;

  theme.addEventListener('change', () => {
    document.documentElement.dataset.theme = theme.value;
    try {
      localStorage.setItem(key + 'theme', theme.value);
      settingsStatus.textContent = 'Вигляд збережено.';
    } catch {
      settingsStatus.textContent = 'Браузер не дав зберегти налаштування.';
    }
  });

  for (const [name, caption] of Object.entries(characteristics)) {
    const label = document.createElement('label');
    label.textContent = caption;
    const input = document.createElement('input');
    Object.assign(input, {type: 'number', name, min: 0, max: 100, step: 1});
    label.append(input);
    stats.append(label);
  }

  function openSheet(sheet) {
    editing = sheet?.id ?? null;
    sheetForm.reset();
    if (sheet) {
      for (const field of sheetForm.elements) {
        if (field.name) field.value = sheet[field.name] ?? '';
      }
    }
    sheetStatus.textContent = '';
    sheetForm.hidden = false;
    sheetForm.elements.namedItem('name').focus();
  }

  function render() {
    sheetList.replaceChildren();
    for (const sheet of drafts) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = sheet.name;
      button.addEventListener('click', () => openSheet(sheet));
      li.append(button);
      sheetList.append(li);
    }
  }

  const newSheet = document.getElementById('new-sheet');
  newSheet.addEventListener('click', () => openSheet(null));
  document.getElementById('close-sheet').addEventListener('click', () => {
    sheetForm.hidden = true;
    newSheet.focus();
  });

  sheetForm.addEventListener('submit', event => {
    event.preventDefault();
    const draft = Object.fromEntries(new FormData(sheetForm));
    draft.name = draft.name.trim();
    if (!draft.name) {
      sheetStatus.textContent = 'Введи ім’я персонажа.';
      return;
    }
    draft.id = editing ?? crypto.randomUUID();
    const next = editing
      ? drafts.map(sheet => sheet.id === editing ? draft : sheet)
      : [...drafts, draft];
    try {
      localStorage.setItem(key + 'sheets', JSON.stringify(next));
      drafts = next;
      editing = draft.id;
      render();
      sheetStatus.textContent = 'Чернетку збережено в цьому браузері.';
    } catch {
      sheetStatus.textContent = 'Браузер не дав зберегти чернетку.';
    }
  });

  render();
}
