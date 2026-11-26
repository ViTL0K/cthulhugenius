function createPortalRules({ modal, openModal, supabase, escape }) {
  const types = {
    str: 'СИЛ · Сила',
    con: 'СТА · Витривалість',
    siz: 'РОЗ · Розмір',
    dex: 'СПР · Спритність',
    app: 'ПРИ · Привабливість',
    edu: 'ОСВ · Освіченість',
    int: 'ІНТ · Інтелект',
    pow: 'ВОЛ · Воля',
    skill: 'Вміння',
    luck: 'Талан',
    sanity: 'Глузд',
  };
  const defaultExample = { type: 'dex', label: '', value: 60 };
  const close = '<button class="btn" data-action="close-modal">Закрити</button>';
  const back = '<button class="btn" data-rule-action="back">← До карток</button>';
  let cards = [];
  let canEdit = false;
  const sheetAreas = [
    {
      title: 'Дані та портрет',
      note: 'Впиши ім’я, вік, стать, рід занять, місце народження й проживання. Натисни рамку вгорі праворуч, щоб додати портрет.',
      pin: [4.4, 7.5],
      regions: [[5.5, 6, 65, 8.5], [73, 3.2, 19, 17]],
    },
    {
      title: 'Характеристики',
      note: 'Вписуй повне значення в першу клітинку, наприклад СПР 60. Сайт порахує два інші пороги. Натисни скорочення характеристики, щоб кинути перевірку.',
      pin: [4.4, 18],
      regions: [[5.5, 15.8, 41, 14.5]],
    },
    {
      title: 'ОЗ, ОМ, Талан і Глузд',
      note: 'Оновлюй поточні значення після змін у грі. Максимуми ОЗ і ОМ сайт розрахує. Для перевірки натисни «Талан» або «Глузд».',
      pin: [47.6, 16.1],
      regions: [[47, 15.8, 24, 14.5]],
    },
    {
      title: 'Стани дослідника',
      note: 'Познач глибоку рану, непритомність, стан при смерті або божевілля, коли цього вимагають наслідки сцени.',
      pin: [4.4, 33.2],
      regions: [[5.5, 31.5, 90, 3.8]],
    },
    {
      title: 'Уміння',
      note: 'Впиши відсоток у першу клітинку. Число в дужках — базове значення. Натисни назву для кидка. Галочка ліворуч позначає вміння для розвитку після успішного застосування.',
      pin: [4.4, 39.6],
      regions: [[5.5, 36.2, 90.1, 48.3]],
    },
    {
      title: 'Бій і зброя',
      note: 'Для зброї впиши назву, значення вміння, пошкодження, кількість атак, дальність, набої й показник несправності.',
      pin: [4.4, 91.1],
      regions: [[5.5, 85.6, 66.4, 12]],
    },
    {
      title: 'Показники бою та руху',
      note: 'Переміщення, Будова, Ухиляння й бонусні пошкодження відображаються тут. Сайт підставляє їх із характеристик та вмінь.',
      pin: [72.6, 90.4],
      regions: [[72.3, 85.6, 23.2, 12]],
    },
  ];

  function thresholds(value) {
    return [value, Math.floor(value / 2), Math.floor(value / 5)];
  }

  function thresholdLabels(value) {
    const [regular, hard, extreme] = thresholds(value);
    return `<span>Звичайний <b>${regular}</b></span>
      <span>Високий <b>${hard}</b></span>
      <span>Екстремальний <b>${extreme}</b></span>`;
  }

  function renderText(text) {
    if (!text.trim()) return '<p class="muted">Текст правила ще не додано.</p>';
    const html = [];
    let listOpen = false;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        if (!listOpen) html.push('<ul>');
        listOpen = true;
        html.push(`<li>${escape(trimmed.slice(2))}</li>`);
        continue;
      }
      if (listOpen) html.push('</ul>');
      listOpen = false;
      if (trimmed.startsWith('## ')) html.push(`<h3>${escape(trimmed.slice(3))}</h3>`);
      else if (trimmed) html.push(`<p>${escape(trimmed)}</p>`);
    }
    if (listOpen) html.push('</ul>');
    return html.join('');
  }

  async function request(path = '', data) {
    const { data: sessionData, error } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (error || !token) throw new Error('Увійди в портал, щоб відкрити правила.');
    const headers = { Authorization: 'Bearer ' + token };
    const options = { headers, cache: 'no-store' };
    if (data) {
      headers['Content-Type'] = 'application/json';
      options.method = 'PUT';
      options.body = JSON.stringify(data);
    }
    const response = await fetch('/api/portal-rules' + path, options);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error || 'Не вдалося завантажити або зберегти правила.');
    return result;
  }

  function entry(card) {
    const id = escape(card.id);
    const firstLine = card.body.split(/\r?\n/).find(line => line.trim() && !line.trim().startsWith('## '));
    const summary = firstLine?.trim().replace(/^- /, '') || 'Текст правила ще не додано.';
    const edit = canEdit
      ? `<button class="btn rule-tile-edit" type="button" data-rule-action="edit" data-id="${id}"
          aria-label="Редагувати · ${escape(card.title)}">Редагувати</button>`
      : '';
    return `<article class="rule-entry">
      <button class="portal-card rule-tile" type="button" data-rule-action="open" data-id="${id}">
        <span class="card-icon" aria-hidden="true">⌘</span>
        <strong>${escape(card.title)}</strong>
        <span class="rule-tile-summary">${escape(summary)}</span>
      </button>
      ${edit}
    </article>`;
  }

  function renderList(message = '') {
    const publicCards = cards.filter(card => card.visibility === 'all');
    const privateCards = cards.filter(card => card.visibility === 'keeper');
    const status = message ? `<p class="rule-message" role="status">${escape(message)}</p>` : '';
    const create = canEdit ? '<button class="btn primary" data-rule-action="create">＋ Створити</button>' : '';
    const privateSection = canEdit && privateCards.length
      ? `<section class="keeper-rules"><h3>Лише для Вартового</h3>
          <div class="rule-grid">${privateCards.map(entry).join('')}</div></section>`
      : '';
    const publicSection = publicCards.length ? publicCards.map(entry).join('') : '<p class="muted">Карток поки немає.</p>';
    openModal('Правила гри', status + `<div class="rule-grid rule-grid-public">${publicSection}</div>` + privateSection,
      close + create, 'rules');
  }

  async function open() {
    canEdit = false;
    cards = [];
    openModal('Правила гри',
      '<p class="muted" data-rules-loading role="status">Завантажуємо правила…</p>', close, 'rules');
    const loading = modal.querySelector('[data-rules-loading]');
    try {
      const result = await request();
      if (!modal.open || !loading.isConnected) return;
      cards = result.cards;
      canEdit = result.canEdit;
      renderList();
    } catch (error) {
      if (!modal.open || !loading.isConnected) return;
      const retry = '<button class="btn" data-rule-action="retry">Спробувати ще раз</button>';
      openModal('Правила гри', `<p class="rule-message" role="alert">${escape(error.message)}</p>`, retry + close, 'rules');
    }
  }

  function renderExample(example) {
    const name = example.type === 'skill' && example.label ? example.label : types[example.type];
    return `<div class="rule-example">
      <button class="rule-roll-button" data-rule-action="roll" data-value="${example.value}" type="button">
        <span class="rule-roll-heading"><strong>${escape(name)}</strong><span>Кинути 1К100 ↻</span></span>
        <span class="rule-thresholds">${thresholdLabels(example.value)}</span>
      </button>
      <output class="rule-roll-result" aria-live="polite" aria-atomic="true"></output>
    </div>`;
  }

  function renderSheetGuide() {
    const regions = sheetAreas.map(({ regions }, index) =>
      regions.map(([left, top, width, height]) =>
        `<span class="rule-sheet-region" data-guide-region="${index}" aria-hidden="true"
          style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"${index ? '' : ' data-active="true"'}></span>`
      ).join('')
    ).join('');
    const pins = sheetAreas.map(({ title, pin: [left, top] }, index) =>
      `<button type="button" class="rule-sheet-pin" data-rule-action="sheet-area" data-area="${index}"
        aria-pressed="${index === 0}" aria-label="${index + 1}. ${escape(title)}"
        style="left:${left}%;top:${top}%">${index + 1}</button>`
    ).join('');
    const legend = sheetAreas.map(({ title, note }, index) =>
      `<li><button type="button" class="rule-sheet-legend-button" data-rule-action="sheet-area" data-area="${index}"
        aria-pressed="${index === 0}">
        <span class="rule-sheet-number">${index + 1}</span>
        <span><strong>${escape(title)}</strong><span class="rule-sheet-note">${escape(note)}</span></span>
      </button></li>`
    ).join('');
    return `<section class="rule-sheet-guide" aria-labelledby="ruleSheetGuideTitle">
      <h3 id="ruleSheetGuideTitle">Що заповнювати в листі дослідника</h3>
      <p class="muted small">Натисни позначку або пояснення, щоб підсвітити потрібні поля.
        Свій лист можна заповнити в кімнаті через «Лист персонажа».</p>
      <div class="rule-sheet-layout">
        <div class="sheet-pdf-page rule-sheet-image" data-page="1">
          <img class="sheet-pdf-art" src="/assets/investigator-sheet-1.webp"
            alt="Перша сторінка листа дослідника 1920-х років із позначками полів" width="1035" height="1352" loading="lazy">
          ${regions}${pins}
        </div>
        <ol class="rule-sheet-legend">${legend}</ol>
      </div>
    </section>`;
  }

  function highlightSheetArea(button) {
    const guide = button.closest('.rule-sheet-guide');
    const area = button.dataset.area;
    guide.querySelectorAll('[data-rule-action="sheet-area"]').forEach(control => {
      control.setAttribute('aria-pressed', control.dataset.area === area);
    });
    guide.querySelectorAll('[data-guide-region]').forEach(region => {
      region.dataset.active = region.dataset.guideRegion === area;
    });
  }

  function readCard(card) {
    const examples = card.examples;
    const hasResourceCheck = examples.some(example => ['luck', 'sanity'].includes(example.type));
    const resourceHint = hasResourceCheck
      ? '<p class="muted small">Для Талану й Глузду три пороги тут слугують для тренування. У самій грі достатньо кинути не більше за поточне значення.</p>'
      : '';
    const rollSection = examples.length
      ? `<section class="rule-practice"><h3>Інтерактивні приклади</h3>
          <div class="rule-example-grid">${examples.map(renderExample).join('')}</div>${resourceHint}</section>`
      : '';
    const edit = canEdit
      ? `<button class="btn primary" data-rule-action="edit" data-id="${escape(card.id)}">Редагувати</button>`
      : '';
    const access = card.visibility === 'keeper' ? '<p class="eyebrow rule-access">Лише для Вартового</p>' : '';
    const sheetGuide = card.id === 'first-game' ? renderSheetGuide() : '';
    openModal(card.title, access + rollSection + sheetGuide + `<div class="rule-text">${renderText(card.body)}</div>`,
      back + close + edit, 'rules');
  }

  function exampleFields(example = defaultExample) {
    const options = Object.entries(types).map(([type, name]) =>
      `<option value="${type}"${type === example.type ? ' selected' : ''}>${name}</option>`).join('');
    const hidden = example.type === 'skill' ? '' : ' hidden';
    return `<fieldset class="rule-example-fields" aria-label="Налаштування прикладу">
      <label class="field">Перевірка<select name="checkType">${options}</select></label>
      <label class="field rule-skill-name"${hidden}>Назва вміння
        <input name="checkLabel" maxlength="80" value="${escape(example.label)}" placeholder="Наприклад, Археологія">
      </label>
      <label class="field">Значення<input name="checkValue" type="number" min="0" max="100" step="1" required value="${example.value}"></label>
      <button type="button" class="btn rule-remove-example" data-rule-action="remove-example">Прибрати</button>
      <div class="rule-thresholds rule-editor-thresholds">${thresholdLabels(example.value)}</div>
    </fieldset>`;
  }

  function editCard(card) {
    if (!canEdit) return;
    const id = card?.id || crypto.randomUUID();
    const isPrivate = card?.visibility === 'keeper';
    openModal(card ? 'Редагувати картку' : 'Створити картку', `
      <form id="portalRuleForm" data-id="${escape(id)}" data-revision="${card?.revision || 0}">
        <div class="field"><label for="ruleTitle">Назва</label>
          <input id="ruleTitle" name="title" type="text" maxlength="100" required autofocus></div>
        <div class="field"><label for="ruleBody">Текст правила</label>
          <textarea id="ruleBody" name="body" rows="11" maxlength="20000" aria-describedby="ruleFormat"></textarea>
          <small class="muted" id="ruleFormat">Для підзаголовка почни рядок з «## », для пункту списку — з «- ».</small></div>
        <section class="rule-practice">
          <h3>Інтерактивний приклад</h3>
          <div data-rule-examples>${(card?.examples || []).map(exampleFields).join('')}</div>
          <button type="button" class="btn" data-rule-action="add-example">＋ Додати перевірку</button>
        </section>
        <label class="rule-keeper-option"><input name="keeperOnly" type="checkbox" ${isPrivate ? 'checked' : ''}>
          Лише для Вартового</label>
        <p class="rule-form-error" role="alert" hidden></p>
      </form>`,
      back + '<button class="btn primary" type="submit" form="portalRuleForm">Зберегти</button>', 'rules');
    const form = modal.querySelector('#portalRuleForm');
    form.elements.title.value = card?.title || '';
    form.elements.body.value = card?.body || '';
  }

  function rollExample(button) {
    const [regular, hard, extreme] = thresholds(Number(button.dataset.value));
    const roll = Math.floor(Math.random() * 100) + 1;
    const outcome = roll <= extreme ? 'Екстремальний успіх'
      : roll <= hard ? 'Високий успіх'
      : roll <= regular ? 'Звичайний успіх' : 'Провал';
    const result = button.closest('.rule-example').querySelector('output');
    result.textContent = `Випало ${roll} · ${outcome}`;
    result.classList.toggle('rule-roll-failure', roll > regular);
  }

  modal.addEventListener('click', event => {
    const button = event.target.closest('[data-rule-action]');
    if (!button) return;
    const card = cards.find(item => item.id === button.dataset.id);
    switch (button.dataset.ruleAction) {
      case 'open':
        if (card) readCard(card);
        break;
      case 'edit':
        if (card) editCard(card);
        break;
      case 'create':
        editCard();
        break;
      case 'back':
        renderList();
        break;
      case 'retry':
        open();
        break;
      case 'add-example': {
        const list = modal.querySelector('[data-rule-examples]');
        list.insertAdjacentHTML('beforeend', exampleFields());
        list.lastElementChild.querySelector('select').focus();
        break;
      }
      case 'remove-example': {
        button.closest('.rule-example-fields').remove();
        modal.querySelector('[data-rule-action="add-example"]').focus();
        break;
      }
      case 'roll':
        rollExample(button);
        break;
      case 'sheet-area':
        highlightSheetArea(button);
        break;
    }
  });

  modal.addEventListener('change', ({ target }) => {
    if (target.name !== 'checkType') return;
    target.closest('.rule-example-fields').querySelector('.rule-skill-name').hidden = target.value !== 'skill';
  });

  modal.addEventListener('input', ({ target }) => {
    if (target.name !== 'checkValue') return;
    target.closest('.rule-example-fields').querySelector('.rule-editor-thresholds').innerHTML =
      target.validity.valid ? thresholdLabels(target.valueAsNumber) : '';
  });

  modal.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'portalRuleForm') return;
    event.preventDefault();
    const save = modal.querySelector('[form="portalRuleForm"]');
    if (!canEdit || save.disabled) return;
    const errorBox = form.querySelector('.rule-form-error');
    const title = form.elements.title.value.trim();
    if (!title) {
      errorBox.textContent = 'Введи назву картки.';
      errorBox.hidden = false;
      form.elements.title.focus();
      return;
    }
    const examples = [...form.querySelectorAll('.rule-example-fields')].map(row => ({
      type: row.querySelector('[name="checkType"]').value,
      label: row.querySelector('[name="checkLabel"]').value.trim(),
      value: row.querySelector('[name="checkValue"]').valueAsNumber,
    }));
    errorBox.hidden = true;
    save.disabled = true;
    try {
      const { card } = await request('/' + encodeURIComponent(form.dataset.id), {
        title,
        body: form.elements.body.value,
        examples,
        visibility: form.elements.keeperOnly.checked ? 'keeper' : 'all',
        revision: Number(form.dataset.revision),
      });
      if (!modal.open || !form.isConnected) return;
      const index = cards.findIndex(item => item.id === card.id);
      if (index === -1) cards.push(card);
      else cards[index] = card;
      renderList('Картку збережено.');
    } catch (error) {
      if (!form.isConnected) return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      save.disabled = false;
    }
  });

  return { open };
}
