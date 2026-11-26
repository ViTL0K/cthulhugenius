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
  return { text, term, registerSkills, identify, outcome, formatRoll };
})();
