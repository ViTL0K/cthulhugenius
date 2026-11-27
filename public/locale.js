/* Sheet keys match the existing stored fields. Only the labels are localized. */
window.cthLocale = (() => {
  const skillTranslations = [
    'Антропология|Anthropology','Археология|Archaeology','Драка|Fighting (Brawl)',
    'Ближний бой|Fighting','Свой навык|Custom skill','Бухгалтерия|Accounting',
    'Верховая езда|Ride','Выживание|Survival','Выслеживание|Track',
    'Вождение|Drive Auto','Ловкость рук|Sleight of Hand','Кредитный рейтинг|Credit Rating',
    'Запугивание|Intimidate','История|History','Метание|Throw',
    'Библиотечный поиск|Library Use','Лазание|Climb','Маскировка|Disguise','Медицина|Medicine',
    'Искусство / ремесло|Art / Craft','Свой навык|Custom skill','Мифы Ктулху|Cthulhu Mythos',
    'Иностранный язык|Language (Other)','Свой навык|Custom skill','Свой навык|Custom skill',
    'Родной язык|Language (Own)','Наука|Science','Свой навык|Custom skill',
    'Свой навык|Custom skill','Скрытность|Stealth','Обман|Fast Talk','Оккультизм|Occult',
    'Ориентирование|Navigate','Оценка|Appraise','Убеждение|Persuade','Первая помощь|First Aid',
    'Пилотирование|Pilot','Плавание|Swim','Поиск скрытого|Spot Hidden','Право|Law',
    'Естествознание|Natural World','Психоанализ|Psychoanalysis','Психология|Psychology',
    'Электроремонт|Electrical Repair','Механический ремонт|Mechanical Repair','Слух|Listen',
    'Взлом замков|Locksmith','Прыжок|Jump','Стрельба (винтовка / дробовик)|Firearms (Rifle / Shotgun)',
    'Стрельба (пистолет)|Firearms (Handgun)','Стрельба|Firearms','Свой навык|Custom skill','Свой навык|Custom skill',
    'Уклонение|Dodge','Обаяние|Charm','Свой навык|Custom skill','Свой навык|Custom skill'
  ];
  const statTerms = {
    STR:['СИЛ','СИЛ','STR'], SIZ:['РОЗ','РАЗ','SIZ'], CON:['СТА','ТЕЛ','CON'],
    POW:['ВОЛ','ВОЛ','POW'], DEX:['СПР','ЛОВ','DEX'], APP:['ПРИ','ВНЕ','APP'],
    INT:['ІНТ','ИНТ','INT'], EDU:['ОСВ','ОБР','EDU'],
    CurrentLuck:['Талан','Удача','Luck'], CurrentSanity:['Глузд','Рассудок','Sanity'],
  };
  const aliases = {
    STR:['Сила','Strength'], SIZ:['Розмір','Размер','Size'], CON:['Статура','Телосложение','Constitution'],
    POW:['Воля','Сила воли','Power'], DEX:['СТР','Спритність','Ловкость','Dexterity'],
    APP:['Привабливість','Внешность','Appearance'], INT:['Інтелект','Интеллект','Intelligence'],
    EDU:['Освіта','Образование','Education'], Skill_3:['Бій (рукопашний)','Ближний бой (драка)'],
  };
  const outcomes = {
    critical:['Критичний успіх','Критический успех','Critical success'],
    fumble:['Критичний провал','Критический провал','Fumble'],
    extreme:['Екстремальний успіх','Экстремальный успех','Extreme success'],
    hard:['Важкий успіх','Трудный успех','Hard success'],
    regular:['Успіх','Успех','Success'],
    failure:['Провал','Провал','Failure'],
  };
  const labels = {
    heading:'Лист дослідника · 1920-ті|Лист сыщика · 1920-е|Investigator sheet · 1920s',
    identity:'Дослідник|Сыщик|Investigator', stats:'Характеристики|Характеристики|Characteristics',
    condition:'Стан|Состояние|Condition', skills:'Уміння|Навыки|Skills', combat:'Бій|Бой|Combat',
    biography:'Передісторія|Предыстория|Backstory', gear:'Спорядження і майно|Снаряжение и имущество|Gear and possessions',
    wealth:'Багатство|Богатство|Wealth', fellows:'Супутники|Спутники|Fellow investigators', notes:'Нотатки|Заметки|Notes',
    roll:'Кинути|Бросить|Roll', regular:'Звич.|Обыч.|Regular', hard:'Висок.|Трудн.|Hard', extreme:'Екстр.|Экстр.|Extreme',
    mark:'Позначка розвитку|Отметка развития|Experience check', specialty:'Спеціалізація|Специализация|Specialization',
    language:'Мова листа|Язык листа|Sheet language',
    Investigators_Name:'Ім’я|Имя|Name', Birthplace:'Місце народження|Место рождения|Birthplace',
    Pronouns:'Стать|Пол|Gender', Residence:'Місце проживання|Место жительства|Residence',
    Occupation:'Рід занять|Профессия|Occupation', Age:'Вік|Возраст|Age', Portrait:'Портрет|Портрет|Portrait',
    CurrentHP:'Поточні очки здоров’я|Текущие очки здоровья|Current hit points', StartingHP:'Максимум очок здоров’я|Максимум очков здоровья|Maximum hit points',
    CurrentMagic:'Поточні очки магії|Текущие очки магии|Current magic points', StartingMagic:'Максимум очок магії|Максимум очков магии|Maximum magic points',
    StartingLuck:'Початковий талан|Начальная удача|Starting luck', StartingSanity:'Початковий глузд|Начальный рассудок|Starting sanity',
    InsaneSanity:'Поріг божевілля|Порог безумия|Insanity threshold', MaxSanity:'Макс. глузд|Макс. рассудок|Maximum sanity',
    'Флажок 57':'Тимчасове божевілля|Временное безумие|Temporary insanity',
    'Флажок 58':'Повне божевілля|Неопределённое безумие|Indefinite insanity',
    'Флажок 59':'Глибока рана|Серьёзная рана|Major wound',
    'Флажок 60':'Непритомність|Без сознания|Unconscious',
    'Флажок 61':'При смерті|При смерти|Dying',
    MOV:'Переміщення|Скорость|Move rate', Build:'Будова|Комплекция|Build', DamageBonus:'Бонусні пошкодження|Бонус к урону|Damage bonus',
    weapon:'Зброя|Оружие|Weapon', damage:'Пошкодження|Урон|Damage', attacks:'Кількість атак|Число атак|Attacks',
    range:'Дальність|Дальность|Range', ammo:'Кількість набоїв|Боезапас|Ammo', malfunction:'Несправність|Осечка|Malfunction',
    'Текстовое поле 271':'Опис зовнішності|Внешность|Personal description',
    'Текстовое поле 272':'Риси|Черты характера|Traits',
    'Текстовое поле 273':'Переконання і вірування|Убеждения и верования|Ideology and beliefs',
    'Текстовое поле 274':'Травми та шрами|Травмы и шрамы|Injuries and scars',
    'Текстовое поле 275':'Важливі люди|Значимые люди|Significant people',
    'Текстовое поле 276':'Фобії та манії|Фобии и мании|Phobias and manias',
    'Текстовое поле 277':'Важливі місця|Значимые места|Meaningful locations',
    'Текстовое поле 278':'Фоліанти та заклинання|Фолианты и заклинания|Tomes and spells',
    'Текстовое поле 279':'Цінні речі|Ценные вещи|Treasured possessions',
    'Текстовое поле 280':'Дивні події та зустрічі|Странные события и встречи|Strange encounters',
    'Текстовое поле 281':'Спорядження|Снаряжение|Gear',
    'Текстовое поле 282':'Майно|Имущество|Possessions',
    'Текстовое поле 283':'Спорядження|Снаряжение|Equipment',
    'Текстовое поле 284':'Запаси|Припасы|Supplies',
    'Текстовое поле 285':'У кишені|Наличные|Cash',
    'Текстовое поле 286':'Заощадження|Сбережения|Savings',
    'Текстовое поле 288':'Активи|Активы|Assets',
    'Текстовое поле 301':'Нотатки|Заметки|Notes', 'Текстовое поле 302':'Додаткові нотатки|Дополнительные заметки|Additional notes',
    character:'Персонаж|Персонаж|Character', player:'Гравець|Игрок|Player',
    baseDex:'½ СПР|½ ЛОВ|½ DEX', baseEdu:'ОСВ|ОБР|EDU',
  };
  const position = lang => lang === 'ru' ? 1 : lang === 'en' ? 2 : 0;
  const text = (key,lang) => labels[key]?.split('|')[position(lang)] ?? key;
  const terms = new Map(Object.entries(statTerms));
  const lookup = new Map();
  const normalize = name => name.normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[’‘`]/g,"'").toLowerCase();
  function registerSkills(skills) {
    skills.forEach(([name],index) => {
      const key='Skill_'+(index+1);
      terms.set(key,[name,...skillTranslations[index].split('|')]);
    });
    for (const [key, names] of terms) {
      if(names[0]==='Власне вміння')continue;
      for (const name of names.concat(aliases[key] ?? [])) lookup.set(normalize(name),key);
    }
  }
  const term = (key,lang) => terms.get(key)?.[position(lang)];
  function identify(name) {
    const termId=lookup.get(normalize(name));
    return termId?{termId}:{literal:name};
  }
  const outcome = (id,lang) => Object.hasOwn(outcomes,id)?outcomes[id][position(lang)]:'';
  function formatRoll(roll,lang) {
    if(roll?.check){
      const { termId, literal, target, outcomeId }=roll.check;
      const name=term(termId,lang) ?? literal ?? text('roll',lang);
      const versus=['проти','против','vs.'][position(lang)];
      return `${name}: ${roll.total} ${versus} ${target}% (${text('regular',lang)} ${target}, ${text('hard',lang)} ${Math.floor(target/2)}, ${text('extreme',lang)} ${Math.floor(target/5)}) — ${outcome(outcomeId,lang)}`;
    }
    if(roll?.text)return roll.text;
    if(Array.isArray(roll?.values)&&roll.count&&roll.sides) {
      return `${roll.count}${lang==='en'?'d':'к'}${roll.sides}: ${roll.values.join(' + ')} = ${roll.total}`;
    }
    return '';
  }
  const portalLabels = {
  "Вигляд порталу": [
    "Вигляд порталу",
    "Оформление портала",
    "Portal appearance"
  ],
  "Попередній перегляд": [
    "Попередній перегляд",
    "Предпросмотр",
    "Preview"
  ],
  "Обрані палітра й текстура": [
    "Обрані палітра й текстура",
    "Выбранная палитра и текстура",
    "Selected palette and texture"
  ],
  "Текстури": [
    "Текстури",
    "Текстуры",
    "Textures"
  ],
  "Палітри": [
    "Палітри",
    "Палитры",
    "Palettes"
  ],
  "Скасувати": [
    "Скасувати",
    "Отмена",
    "Cancel"
  ],
  "Застосувати": [
    "Застосувати",
    "Применить",
    "Apply"
  ],
  "Вигляд збережено.": [
    "Вигляд збережено.",
    "Оформление сохранено.",
    "Appearance saved."
  ],
  "Пісочна": [
    "Пісочна",
    "Песочная",
    "Sand"
  ],
  "Темна": [
    "Темна",
    "Тёмная",
    "Dark"
  ],
  "Блакитна": [
    "Блакитна",
    "Голубая",
    "Light blue"
  ],
  "Синя": [
    "Синя",
    "Синяя",
    "Blue"
  ],
  "Багряна печатка": [
    "Багряна печатка",
    "Багряная печать",
    "Crimson Seal"
  ],
  "Горіховий архів": [
    "Горіховий архів",
    "Ореховый архив",
    "Walnut Archive"
  ],
  "Кобальтова безодня": [
    "Кобальтова безодня",
    "Кобальтовая бездна",
    "Cobalt Abyss"
  ],
  "Трояндовий серпанок": [
    "Трояндовий серпанок",
    "Розовая дымка",
    "Rose Haze"
  ],
  "Лісовий мох": [
    "Лісовий мох",
    "Лесной мох",
    "Forest Moss"
  ],
  "Бурштиновий ліхтар": [
    "Бурштиновий ліхтар",
    "Янтарный фонарь",
    "Amber Lantern"
  ],
  "Космічна туманність": [
    "Космічна туманність",
    "Космическая туманность",
    "Cosmic Nebula"
  ],
  "Камінь": [
    "Камінь",
    "Камень",
    "Stone"
  ],
  "Старий папір": [
    "Старий папір",
    "Старая бумага",
    "Aged paper"
  ],
  "Стара штукатурка": [
    "Стара штукатурка",
    "Старая штукатурка",
    "Old plaster"
  ],
  "Цегла": [
    "Цегла",
    "Кирпич",
    "Brick"
  ],
  "Горіхова дошка": [
    "Горіхова дошка",
    "Ореховая доска",
    "Walnut board"
  ],
  "Дубова дошка": [
    "Дубова дошка",
    "Дубовая доска",
    "Oak board"
  ],
  "Вхід зберігається на цьому пристрої. Пароль сайт не записує — якщо погодишся, його може запам’ятати менеджер паролів браузера.": [
    "Вхід зберігається на цьому пристрої. Пароль сайт не записує — якщо погодишся, його може запам’ятати менеджер паролів браузера.",
    "Вход сохраняется на этом устройстве. Браузер сохранит пароль, если вы разрешите это в менеджере паролей.",
    "You stay signed in on this device. Your browser can save your password if you allow it."
  ],
  "Особистий ігровий портал": [
    "Особистий ігровий портал",
    "Личный игровой портал",
    "Personal game portal"
  ],
  "Відкрити ігрову кімнату →": [
    "Відкрити ігрову кімнату →",
    "Открыть игровую комнату →",
    "Open game room →"
  ],
  "Код кімнати": [
    "Код кімнати",
    "Код комнаты",
    "Room code"
  ],
  "Приєднатися до гри": [
    "Приєднатися до гри",
    "Присоединиться к игре",
    "Join game"
  ],
  "Мої пригоди": [
    "Мої пригоди",
    "Мои приключения",
    "My adventures"
  ],
  "Переглянути всі створені кімнати й відкрити потрібну.": [
    "Переглянути всі створені кімнати й відкрити потрібну.",
    "Посмотреть созданные комнаты и открыть нужную.",
    "Browse your game rooms and open one."
  ],
  "Правила гри": [
    "Правила гри",
    "Правила игры",
    "Game rules"
  ],
  "Розділи правил і пам’ятки для гравців та ведучого.": [
    "Розділи правил і пам’ятки для гравців та ведучого.",
    "Разделы правил и памятки для игроков и ведущего.",
    "Rules and reference guides for players and Keepers."
  ],
  "Створити нову гру": [
    "Створити нову гру",
    "Создать новую игру",
    "Create a new game"
  ],
  "Додати пригоду й окрему ігрову кімнату.": [
    "Додати пригоду й окрему ігрову кімнату.",
    "Добавить приключение и отдельную игровую комнату.",
    "Add an adventure with its own game room."
  ],
  "Власні кольори": [
    "Власні кольори",
    "Свои цвета",
    "Custom colors"
  ],
  "Використовувати власну палітру": [
    "Використовувати власну палітру",
    "Использовать свою палитру",
    "Use custom palette"
  ],
  "Основний фон · 60%": [
    "Основний фон · 60%",
    "Основной фон · 60%",
    "Background · 60%"
  ],
  "Панелі та картки · 30%": [
    "Панелі та картки · 30%",
    "Панели и карточки · 30%",
    "Panels and cards · 30%"
  ],
  "Акцент · 10%": [
    "Акцент · 10%",
    "Акцент · 10%",
    "Accent · 10%"
  ],
  "Опівнічний Помаранч": [
    "Опівнічний Помаранч",
    "Полуночный оранжевый",
    "Midnight Orange"
  ],
  "Неоновий Кобальт": [
    "Неоновий Кобальт",
    "Неоновый кобальт",
    "Neon Cobalt"
  ],
  "Оксамитовий Неон": [
    "Оксамитовий Неон",
    "Бархатный неон",
    "Velvet Neon"
  ],
  "Аркхемське Золото": [
    "Аркхемське Золото",
    "Аркхэмское золото",
    "Arkham Gold"
  ],
  "Кривавий Ритуал": [
    "Кривавий Ритуал",
    "Кровавый ритуал",
    "Blood Ritual"
  ],
  "Бірюзова Безодня": [
    "Бірюзова Безодня",
    "Бирюзовая бездна",
    "Turquoise Abyss"
  ],
  "Матеріали гри": [
    "Матеріали гри",
    "Материалы игры",
    "Game materials"
  ],
  "Відкрити": [
    "Відкрити",
    "Открыть",
    "Open"
  ],
  "Живе переливання фону": [
    "Живе переливання фону",
    "Живое переливание фона",
    "Animated background"
  ],
  "Учасники": [
    "Учасники",
    "Участники",
    "Participants"
  ],
  "● Ведучий": [
    "● Ведучий",
    "● Ведущий",
    "● Keeper"
  ],
  "● Дослідник": [
    "● Дослідник",
    "● Сыщик",
    "● Investigator"
  ],
  "● Дослідниця": [
    "● Дослідниця",
    "● Сыщица",
    "● Investigator"
  ],
  "Центральна бібліотека": [
    "Центральна бібліотека",
    "Центральная библиотека",
    "Central Library"
  ],
  "Інструменти": [
    "Інструменти",
    "Инструменты",
    "Tools"
  ],
  "Лист персонажа": [
    "Лист персонажа",
    "Лист персонажа",
    "Character sheet"
  ],
  "Матеріали": [
    "Матеріали",
    "Материалы",
    "Materials"
  ],
  "Кинути": [
    "Кинути",
    "Бросить",
    "Roll"
  ],
  "Спільний чат": [
    "Спільний чат",
    "Общий чат",
    "Public chat"
  ],
  "Слух: 24 — Успіх": [
    "Слух: 24 — Успіх",
    "Слух: 24 — Успех",
    "Listen: 24 — Success"
  ],
  "Написати повідомлення…": [
    "Написати повідомлення…",
    "Написать сообщение…",
    "Write a message…"
  ],
  "Шрифт": [
    "Шрифт",
    "Шрифт",
    "Font"
  ],
  "Шрифт інтерфейсу": [
    "Шрифт інтерфейсу",
    "Шрифт интерфейса",
    "Interface font"
  ],
  "Класичний": [
    "Класичний",
    "Классический",
    "Classic"
  ]
};
  const portalText = (key,lang) => portalLabels[key]?.[position(lang)];
  return { text, term, registerSkills, identify, outcome, formatRoll, portalText };
})();
