(function () {
  'use strict';

  // ============================================================
  //  Звуковая система
  // ============================================================
  // Простая обёртка над HTML5 Audio. Файлы лежат в /sounds/ — пользователь
  // их кладёт сам. Если файла нет — play() молча игнорирует ошибку.
  // Состояние mute сохраняется в localStorage.
  const AUDIO = (() => {
    const MUTE_KEY = 'nori-story-muted';
    let muted = false;
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

    // Дефолтная громкость по типу звука
    const DEFAULT_VOLUME = {
      click: 0.3,
      success: 0.3,        // в-уровне: фоновое подтверждение
      error: 0.5,
      meow: 0.2,
      purr: 0.4,
      love: 0.4,
      final: 0.4,
      yes: 0.2,            // L2: ответ «как было в жизни»
      noy: 0.2,            // L2: очевидно плохой ответ
      dub: 0.5,            // L2: финал ветки бизнеса (провал/закрытие)
      georgia: 0.4,        // L3: финал, ужин в честь Грузии
      'cartoon-bite': 0.7,
    };

    // Зацикленные звуки (purr) — храним инстансы по имени
    const loops = Object.create(null);

    // Возвращает массив возможных путей файла — пробуем разные регистры
    // и в имени, и в расширении (GitHub Pages case-sensitive).
    function audioPaths(name) {
      const cap = name.charAt(0).toUpperCase() + name.slice(1);
      return [
        'sounds/' + name + '.mp3',
        'sounds/' + name + '.MP3',
        'sounds/' + cap + '.mp3',
        'sounds/' + cap + '.MP3',
        'sounds/' + name.toUpperCase() + '.mp3',
      ];
    }

    function play(name, opts) {
      if (muted) return null;
      opts = opts || {};
      const paths = audioPaths(name);
      const vol = (opts.volume != null) ? opts.volume : (DEFAULT_VOLUME[name] || 0.5);
      try {
        const a = new Audio(paths[0]);
        a.volume = vol;
        // Если первый путь не загрузился — пробуем альтернативные регистры.
        let pi = 1;
        a.addEventListener('error', function tryNext() {
          if (pi >= paths.length) return;
          a.src = paths[pi++];
          a.play().catch(() => {});
        });
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => {});
        return a;
      } catch (e) { return null; }
    }

    function playLoop(name, opts) {
      if (muted) return null;
      opts = opts || {};
      stopLoop(name);
      const paths = audioPaths(name);
      try {
        const a = new Audio(paths[0]);
        a.loop = true;
        // Если первый путь не нашёлся (404 на GitHub) — пробуем другой регистр
        let pi = 1;
        a.addEventListener('error', function tryNext() {
          if (pi >= paths.length) return;
          a.src = paths[pi++];
          a.play().catch(() => {});
        });
        const targetVol = (opts.volume != null) ? opts.volume : (DEFAULT_VOLUME[name] || 0.4);
        if (opts.fadeIn && opts.fadeIn > 0) {
          a.volume = 0;
          const startT = Date.now();
          const fadeMs = opts.fadeIn;
          const tk = setInterval(() => {
            const ratio = Math.min(1, (Date.now() - startT) / fadeMs);
            try { a.volume = targetVol * ratio; } catch (e) {}
            if (ratio >= 1) { clearInterval(tk); a._fadeTimer = null; }
          }, 40);
          a._fadeTimer = tk;
        } else {
          a.volume = targetVol;
        }
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => {});
        loops[name] = a;
        return a;
      } catch (e) { return null; }
    }

    function stopLoop(name, opts) {
      const a = loops[name];
      if (!a) return;
      opts = opts || {};
      // Прерываем активный fade-in, если шёл
      if (a._fadeTimer) { clearInterval(a._fadeTimer); a._fadeTimer = null; }
      // Снимаем из реестра сразу — повторные stopLoop станут no-op,
      // а fade-out спокойно докатится по замыканию интервала
      delete loops[name];
      if (opts.fadeOut && opts.fadeOut > 0) {
        const startVol = a.volume;
        const startT = Date.now();
        const fadeMs = opts.fadeOut;
        const tk = setInterval(() => {
          const ratio = Math.min(1, (Date.now() - startT) / fadeMs);
          try { a.volume = Math.max(0, startVol * (1 - ratio)); } catch (e) {}
          if (ratio >= 1) {
            clearInterval(tk);
            try { a.pause(); a.currentTime = 0; } catch (e) {}
          }
        }, 40);
      } else {
        try { a.pause(); a.currentTime = 0; } catch (e) {}
      }
    }

    // Однократное воспроизведение с fade-in. Помещаем в тот же реестр loops,
    // чтобы можно было гасить через stopLoop(name, {fadeOut}). Не зацикливает.
    // По 'ended' сам убирается из реестра.
    function playOnce(name, opts) {
      if (muted) return null;
      opts = opts || {};
      stopLoop(name);
      const paths = audioPaths(name);
      try {
        const a = new Audio(paths[0]);
        a.loop = false;
        let pi = 1;
        a.addEventListener('error', function tryNext() {
          if (pi >= paths.length) return;
          a.src = paths[pi++];
          a.play().catch(() => {});
        });
        const targetVol = (opts.volume != null) ? opts.volume : (DEFAULT_VOLUME[name] || 0.4);
        if (opts.fadeIn && opts.fadeIn > 0) {
          a.volume = 0;
          const startT = Date.now();
          const fadeMs = opts.fadeIn;
          const tk = setInterval(() => {
            const ratio = Math.min(1, (Date.now() - startT) / fadeMs);
            try { a.volume = targetVol * ratio; } catch (e) {}
            if (ratio >= 1) { clearInterval(tk); a._fadeTimer = null; }
          }, 40);
          a._fadeTimer = tk;
        } else {
          a.volume = targetVol;
        }
        a.addEventListener('ended', () => { if (loops[name] === a) delete loops[name]; });
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => {});
        loops[name] = a;
        return a;
      } catch (e) { return null; }
    }

    function stopAll() {
      Object.keys(loops).forEach(stopLoop);
    }

    function setMuted(v) {
      muted = !!v;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
      if (muted) stopAll();
      // Сообщить кнопке-тогглу
      const btn = document.querySelector('.sound-toggle');
      if (btn) {
        btn.textContent = muted ? '🔇' : '🔊';
        btn.setAttribute('aria-pressed', String(muted));
        btn.title = muted ? 'Звук выключен' : 'Звук включён';
      }
    }

    function isMuted() { return muted; }
    function toggle() { setMuted(!muted); }

    // Предзагрузка звуков: при первом user-gesture создаём Audio для каждого
    // имени из списка и «разблокируем» через muted play()+pause(). На iOS
    // Safari preload='auto' молча игнорируется — без этого хака следующие
    // play() имеют задержку 200-1000мс пока браузер качает файл.
    function preload(names) {
      names.forEach((name) => {
        try {
          const a = new Audio(audioPaths(name)[0]);
          a.preload = 'auto';
          a.muted = true;
          a.volume = 0;            // двойная страховка от щелчка
          const pr = a.play();
          if (pr && pr.then) {
            pr.then(() => {
              try { a.pause(); a.currentTime = 0; } catch (e) {}
            }).catch(() => {
              try { a.load(); } catch (e) {}
            });
          } else {
            try { a.load(); } catch (e) {}
          }
        } catch (e) {}
      });
    }

    return { play, playLoop, playOnce, stopLoop, stopAll, setMuted, isMuted, toggle, preload };
  })();

  // Делаем доступным изнутри модуля и снаружи (для отладки)
  window.GameAudio = AUDIO;

  // Глобальный «клик» — на любой <button> или [role="button"] в игре.
  // Добавлен на capture-фазе, чтобы сработать до обработчика кнопки.
  let _audioPreloaded = false;
  function unlockAudioOnce() {
    if (_audioPreloaded) return;
    _audioPreloaded = true;
    // Прелоадим критичные звуки в кэш. На iOS Safari только в этом
    // user-gesture тике можно «разблокировать» Audio API.
    AUDIO.preload(['click','success','error','meow','purr','love','final',
                   'yes','noy','dub','georgia','cartoon-bite']);
  }
  // Слушаем оба события — touchstart срабатывает на ~150мс раньше click
  // на тапе по мобильному, плюс работает даже если click не дойдёт.
  document.addEventListener('touchstart', unlockAudioOnce, { capture: true, passive: true });
  document.addEventListener('click', (e) => {
    unlockAudioOnce();
    const target = e.target.closest('button, [role="button"]');
    if (!target) return;
    if (target.disabled) return;
    if (target.classList.contains('sound-toggle')) return; // сама кнопка не пикает
    // Кнопки с собственным звуком (yes/noy в Уровне 2) обрабатывают звук сами.
    if (target.dataset.optSound) return;
    AUDIO.play('click');
  }, true);

  // Кнопка выключения звука в правом верхнем углу
  function mountSoundToggle() {
    if (document.querySelector('.sound-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sound-toggle';
    btn.textContent = AUDIO.isMuted() ? '🔇' : '🔊';
    btn.title = AUDIO.isMuted() ? 'Звук выключен' : 'Звук включён';
    btn.setAttribute('aria-pressed', String(AUDIO.isMuted()));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      AUDIO.toggle();
    });
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSoundToggle);
  } else {
    mountSoundToggle();
  }

  // ============================================================
  //  Состояние и localStorage
  // ============================================================
  const STORAGE_KEY = 'nori-story-progress-v1';

  const state = {
    completedLevels: [],
    lastScreen: 'start',
    mapVisited: false,
  };

  // Эфемерное состояние сессии (не сохраняется в localStorage).
  // Если игрок только что прошёл уровень — id здесь; рендер карты увидит и покажет реплику.
  let justCompletedLevelId = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.completedLevels)) {
        state.completedLevels = parsed.completedLevels.filter(
          (n) => Number.isInteger(n) && n >= 1 && n <= LEVELS.length
        );
      }
      if (typeof parsed.lastScreen === 'string') {
        state.lastScreen = parsed.lastScreen;
      }
      if (typeof parsed.mapVisited === 'boolean') {
        state.mapVisited = parsed.mapVisited;
      }
    } catch (e) {
      console.warn('Не удалось прочитать сохранённый прогресс', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          completedLevels: state.completedLevels,
          lastScreen: state.lastScreen,
          mapVisited: state.mapVisited,
        })
      );
    } catch (e) {
      console.warn('Не удалось сохранить прогресс', e);
    }
  }

  function resetProgress() {
    state.completedLevels = [];
    state.lastScreen = 'start';
    state.mapVisited = false;
    justCompletedLevelId = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function isLevelCompleted(id) {
    return state.completedLevels.includes(id);
  }

  function firstAvailableLevelId() {
    for (const lvl of LEVELS) {
      if (!isLevelCompleted(lvl.id)) return lvl.id;
    }
    return null;
  }

  function markLevelCompleted(id) {
    if (!isLevelCompleted(id)) {
      state.completedLevels.push(id);
      state.completedLevels.sort((a, b) => a - b);
      saveState();
    }
    // Запоминаем что игрок только что прошёл этот уровень — карта покажет реплику.
    justCompletedLevelId = id;
  }

  // ============================================================
  //  Реестр уровней
  // ============================================================
  // Каждый уровень — изолированный объект:
  //   { id, title, intro, mount(container, onComplete), unmount() }
  // Чтобы добавить реальную миниигру: замените mount у нужного id.

  function createStubLevel(id, title, intro) {
    return {
      id,
      title,
      intro,
      completionTitle: 'Уровень ' + id + ' пройден',
      completionText:
        '[ВПИШУ ПОЗЖЕ — здесь будет тёплый текст про этот момент нашей истории]',
      photoCaption: 'место для фото',
      nextButtonText: 'На карту',
      mount(container, onComplete) {
        const wrap = document.createElement('div');
        wrap.className = 'level-stub';

        const card = document.createElement('div');
        card.className = 'level-stub-card';
        card.innerHTML =
          '<div class="level-stub-icon">🚧</div>' +
          '<h3>Уровень в разработке</h3>' +
          '<p>Этот эпизод истории Вера ещё не дорисовала. ' +
          'Но ты можешь пройти его условно, чтобы открыть следующий.</p>';
        wrap.appendChild(card);

        const row = document.createElement('div');
        row.className = 'row';
        const back = document.createElement('button');
        back.className = 'btn btn-secondary';
        back.type = 'button';
        back.textContent = '← Назад на карту';
        back.addEventListener('click', () => goTo('map'));
        row.appendChild(back);
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.type = 'button';
        btn.textContent = 'Пройти условно →';
        btn.addEventListener('click', () => onComplete());
        row.appendChild(btn);
        wrap.appendChild(row);

        container.appendChild(wrap);
      },
      unmount() {
        // Стаб не держит таймеров — чистить нечего.
      },
    };
  }

  // ============================================================
  //  Уровень 1: «Печатай.ру» — найди ошибки в макете
  // ============================================================
  function createLevel1() {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const PX = 4; // размер одного «пикселя» в координатах viewBox

    // Описание 5 ошибок на макете визитки.
    const ERRORS = [
      { id: 'typo',     label: 'Опечатка',              comment: 'опечатка в тексте',
        x: 88,  y: 80,  w: 80, h: 20 },
      { id: 'misalign', label: 'Кривое выравнивание',   comment: 'кривое выравнивание',
        x: 40,  y: 168, w: 180, h: 20 },
      { id: 'pixel',    label: 'Лишний пиксель',        comment: 'лишний пиксель в углу',
        x: 306, y: 12,  w: 24, h: 20 },
      { id: 'trim',     label: 'Лого в зоне обреза',    comment: 'лого попадает в зону обреза',
        x: 0,   y: 30,  w: 42, h: 44 },
      { id: 'lowres',   label: 'Низкое разрешение',     comment: 'растровое изображение, низкое разрешение',
        x: 224, y: 72,  w: 44, h: 44 },
    ];

    // Пиксель-арт спрайты (8×10, вид сверху) — каждому персонажу свой,
    // чтобы по причёске и фигуре можно было узнать.
    //   H — волосы, F — лицо/кожа, G — очки, B — одежда, L — ноги
    const SPRITES = {
      // Илья: короткие светлые волосы, серый лакост
      ilya: [
        '..HHHH..',
        '.HHHHHH.',
        'HHHHHHHH',
        'HHFFFFHH',
        '.HFFFFH.',
        '.HFFFFH.',
        '.BBBBBB.',
        'BBBBBBBB',
        '.BBBBBB.',
        '..L..L..',
      ],
      // Вера: длинные тёмные волосы с чёлкой, чёрный топ
      vera: [
        '..HHHH..',
        '.HHHHHH.',
        'HHHHHHHH',
        'HHFFFFHH',
        'HHFFFFHH',
        'HHBBBBHH',
        'HBBBBBBH',
        'HBBBBBBH',
        '.BBBBBB.',
        '..L..L..',
      ],
      // Марат: длинные русые волосы по плечам, розовая футболка
      marat: [
        '..HHHH..',
        '.HHHHHH.',
        '.HHHHHH.',
        'HHFFFFHH',
        'HHFFFFHH',
        '.HFFFFH.',
        '.HBBBBH.',
        '.BBBBBB.',
        '.BBBBBB.',
        '..L..L..',
      ],
      // Шурова: пышные рыжие кудри, светлая блузка
      boss: [
        '.HH.HH..',
        'HHHHHHH.',
        'HHHHHHHH',
        'HHFFFFHH',
        'HHFFFFHH',
        '.HFFFFH.',
        '.HBBBBH.',
        '.BBBBBB.',
        '.BBBBBB.',
        '..L..L..',
      ],
    };
    const PALETTES = {
      ilya:  { H: '#d4b483', F: '#f4e0c0', G: '#2a2520', B: '#bcbcbc', L: '#2a2820' },
      vera:  { H: '#6a4528', F: '#f4e0c0', B: '#5a8aab', L: '#1a1815' },
      marat: { H: '#8a6038', F: '#f4e0c0', B: '#f5a0a0', L: '#5a7895' },
      boss:  { H: '#c97040', F: '#f4e0c0', B: '#c5b8a8', L: '#4a4540' },
    };

    // Чистка локального состояния.
    const listeners = [];
    const timeouts = [];
    function on(el, evt, fn) {
      el.addEventListener(evt, fn);
      listeners.push(() => el.removeEventListener(evt, fn));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }

    // Ссылки на ключевые DOM-узлы (заполняются в mount).
    let officeSvg = null;
    let stageEl = null;
    let charBoss = null, charIlya = null, charHer = null;
    let arrowHint = null, monitorHot = null;
    let speechBubble = null;
    let onCompleteCb = null;

    // ----- Пиксельный спрайт -----
    function buildPixelSprite(grid, palette, ox, oy, name) {
      const g = document.createElementNS(SVG_NS, 'g');
      grid.forEach((row, ry) => {
        [...row].forEach((ch, rx) => {
          const col = palette[ch];
          if (!col) return;
          const r = document.createElementNS(SVG_NS, 'rect');
          r.setAttribute('x', String(ox + rx * PX));
          r.setAttribute('y', String(oy + ry * PX));
          r.setAttribute('width', String(PX));
          r.setAttribute('height', String(PX));
          r.setAttribute('fill', col);
          g.appendChild(r);
        });
      });
      if (name) {
        // спрайт 8×10 пикселей × PX=4 → ширина 32, высота 40. Подпись чуть ниже.
        const tag = document.createElementNS(SVG_NS, 'text');
        tag.setAttribute('x', String(ox + 16));
        tag.setAttribute('y', String(oy + 50));
        tag.setAttribute('text-anchor', 'middle');
        tag.setAttribute('font-family', 'Space Grotesk, sans-serif');
        tag.setAttribute('font-size', '9');
        tag.setAttribute('font-weight', '600');
        tag.setAttribute('fill', '#5a4530');
        tag.textContent = name;
        g.appendChild(tag);
      }
      return g;
    }

    // ----- Стол (вид сверху) -----
    function buildDesk(cx, cy) {
      const g = document.createElementNS(SVG_NS, 'g');
      const x = cx - 28, y = cy;
      const top = document.createElementNS(SVG_NS, 'rect');
      top.setAttribute('x', String(x)); top.setAttribute('y', String(y));
      top.setAttribute('width', '56'); top.setAttribute('height', '28');
      top.setAttribute('fill', '#a07a55');
      g.appendChild(top);
      const edge = document.createElementNS(SVG_NS, 'rect');
      edge.setAttribute('x', String(x)); edge.setAttribute('y', String(y + 24));
      edge.setAttribute('width', '56'); edge.setAttribute('height', '4');
      edge.setAttribute('fill', '#7a5a3a');
      g.appendChild(edge);
      // Монитор
      const mon = document.createElementNS(SVG_NS, 'rect');
      mon.setAttribute('x', String(cx - 12)); mon.setAttribute('y', String(y + 4));
      mon.setAttribute('width', '24'); mon.setAttribute('height', '8');
      mon.setAttribute('fill', '#2a2520');
      g.appendChild(mon);
      // Свечение экрана
      const glow = document.createElementNS(SVG_NS, 'rect');
      glow.setAttribute('x', String(cx - 10)); glow.setAttribute('y', String(y + 5));
      glow.setAttribute('width', '20'); glow.setAttribute('height', '4');
      glow.setAttribute('fill', '#7a8aa0');
      g.appendChild(glow);
      // Клавиатура
      const kb = document.createElementNS(SVG_NS, 'rect');
      kb.setAttribute('x', String(cx - 14)); kb.setAttribute('y', String(y + 16));
      kb.setAttribute('width', '28'); kb.setAttribute('height', '5');
      kb.setAttribute('fill', '#d6c9ac');
      g.appendChild(kb);
      // Кружка кофе
      const cup = document.createElementNS(SVG_NS, 'rect');
      cup.setAttribute('x', String(x + 46)); cup.setAttribute('y', String(y + 6));
      cup.setAttribute('width', '5'); cup.setAttribute('height', '5');
      cup.setAttribute('fill', '#c97b5a');
      g.appendChild(cup);
      return g;
    }

    // ----- Принтер (вид сверху) -----
    function buildPrinter(cx, y) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'level1-printer');
      const x = cx - 60;
      const body = document.createElementNS(SVG_NS, 'rect');
      body.setAttribute('x', String(x)); body.setAttribute('y', String(y));
      body.setAttribute('width', '120'); body.setAttribute('height', '50');
      body.setAttribute('fill', '#3a2f24');
      g.appendChild(body);
      const panel = document.createElementNS(SVG_NS, 'rect');
      panel.setAttribute('x', String(x + 6)); panel.setAttribute('y', String(y + 6));
      panel.setAttribute('width', '108'); panel.setAttribute('height', '14');
      panel.setAttribute('fill', '#5a4a3a');
      g.appendChild(panel);
      // Кнопки на панели
      ['#c97b5a', '#3d6b8a', '#d4b483'].forEach((col, i) => {
        const btn = document.createElementNS(SVG_NS, 'rect');
        btn.setAttribute('x', String(x + 10 + i * 8));
        btn.setAttribute('y', String(y + 10));
        btn.setAttribute('width', '4'); btn.setAttribute('height', '4');
        btn.setAttribute('fill', col);
        g.appendChild(btn);
      });
      // Дисплей
      const display = document.createElementNS(SVG_NS, 'rect');
      display.setAttribute('x', String(x + 80)); display.setAttribute('y', String(y + 9));
      display.setAttribute('width', '24'); display.setAttribute('height', '8');
      display.setAttribute('fill', '#7a8aa0');
      g.appendChild(display);
      const slot = document.createElementNS(SVG_NS, 'rect');
      slot.setAttribute('x', String(x + 30)); slot.setAttribute('y', String(y + 42));
      slot.setAttribute('width', '60'); slot.setAttribute('height', '3');
      slot.setAttribute('fill', '#1a1410');
      g.appendChild(slot);
      // Выезжающий лист
      const paper = document.createElementNS(SVG_NS, 'rect');
      paper.setAttribute('class', 'level1-paper');
      paper.setAttribute('x', String(x + 36)); paper.setAttribute('y', String(y + 48));
      paper.setAttribute('width', '48'); paper.setAttribute('height', '6');
      paper.setAttribute('fill', '#faf3e3');
      paper.setAttribute('stroke', '#d6c9ac');
      g.appendChild(paper);
      // Боковая «голова»
      const head = document.createElementNS(SVG_NS, 'rect');
      head.setAttribute('x', String(x + 120)); head.setAttribute('y', String(y + 4));
      head.setAttribute('width', '14'); head.setAttribute('height', '42');
      head.setAttribute('fill', '#4a3c2e');
      g.appendChild(head);
      return g;
    }

    function buildOfficeScene() {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'level1-office');
      svg.setAttribute('viewBox', '0 0 600 480');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('shape-rendering', 'crispEdges');

      // ===== Цвета комнат =====
      const OFFICE_FLOOR = '#f0e4b8'; // тёплый жёлтый — стены типографии были жёлтые
      const PRINT_FLOOR  = '#e8dcb0';
      const TILE_LINE    = '#dccfa0';
      const WALL_DARK    = '#3a2f24';
      const DESK_TOP     = '#a07a55';
      const DESK_EDGE    = '#7a5a3a';

      // Пол кабинета принтера (теперь больше — y=0-200)
      const printFloor = document.createElementNS(SVG_NS, 'rect');
      printFloor.setAttribute('y', '0'); printFloor.setAttribute('width', '600');
      printFloor.setAttribute('height', '200'); printFloor.setAttribute('fill', PRINT_FLOOR);
      svg.appendChild(printFloor);

      // Пол офиса
      const officeFloor = document.createElementNS(SVG_NS, 'rect');
      officeFloor.setAttribute('y', '200'); officeFloor.setAttribute('width', '600');
      officeFloor.setAttribute('height', '280'); officeFloor.setAttribute('fill', OFFICE_FLOOR);
      svg.appendChild(officeFloor);

      // Сетка плитки в обоих помещениях
      for (let i = 40; i < 600; i += 40) {
        const ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('x1', String(i)); ln.setAttribute('y1', '16');
        ln.setAttribute('x2', String(i)); ln.setAttribute('y2', '470');
        ln.setAttribute('stroke', TILE_LINE); ln.setAttribute('stroke-width', '0.5');
        svg.appendChild(ln);
      }
      for (let i = 56; i < 470; i += 40) {
        const ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('x1', '0'); ln.setAttribute('y1', String(i));
        ln.setAttribute('x2', '600'); ln.setAttribute('y2', String(i));
        ln.setAttribute('stroke', TILE_LINE); ln.setAttribute('stroke-width', '0.5');
        svg.appendChild(ln);
      }

      // ----- Внешние стены -----
      const wallTop = document.createElementNS(SVG_NS, 'rect');
      wallTop.setAttribute('width', '600'); wallTop.setAttribute('height', '16');
      wallTop.setAttribute('fill', WALL_DARK);
      svg.appendChild(wallTop);

      const wallBot = document.createElementNS(SVG_NS, 'rect');
      wallBot.setAttribute('y', '470'); wallBot.setAttribute('width', '600'); wallBot.setAttribute('height', '10');
      wallBot.setAttribute('fill', WALL_DARK);
      svg.appendChild(wallBot);

      // Левая стена офиса — сплошная (внешний вход не нужен)
      const wallLeftOffice = document.createElementNS(SVG_NS, 'rect');
      wallLeftOffice.setAttribute('x', '0'); wallLeftOffice.setAttribute('y', '208');
      wallLeftOffice.setAttribute('width', '6'); wallLeftOffice.setAttribute('height', '262');
      wallLeftOffice.setAttribute('fill', WALL_DARK);
      svg.appendChild(wallLeftOffice);
      // Левая стена кабинета принтера — тоже сплошная
      const wallLeftPrint = document.createElementNS(SVG_NS, 'rect');
      wallLeftPrint.setAttribute('x', '0'); wallLeftPrint.setAttribute('y', '16');
      wallLeftPrint.setAttribute('width', '6'); wallLeftPrint.setAttribute('height', '184');
      wallLeftPrint.setAttribute('fill', WALL_DARK);
      svg.appendChild(wallLeftPrint);
      // Правая стена (сплошная по обоим помещениям)
      const wallRight = document.createElementNS(SVG_NS, 'rect');
      wallRight.setAttribute('x', '594'); wallRight.setAttribute('y', '16');
      wallRight.setAttribute('width', '6'); wallRight.setAttribute('height', '454');
      wallRight.setAttribute('fill', WALL_DARK);
      svg.appendChild(wallRight);

      // ----- Перегородка между кабинетом принтера и офисом -----
      // Стена y=200-208. Проход (дверь) у самой левой стены, x=6-160 — «после стола Марата слева».
      const wallDiv = document.createElementNS(SVG_NS, 'rect');
      wallDiv.setAttribute('x', '160'); wallDiv.setAttribute('y', '200');
      wallDiv.setAttribute('width', '434'); wallDiv.setAttribute('height', '8');
      wallDiv.setAttribute('fill', WALL_DARK);
      svg.appendChild(wallDiv);
      // Косяк только справа от проёма (слева — внешняя стена)
      const jamb = document.createElementNS(SVG_NS, 'rect');
      jamb.setAttribute('x', '159'); jamb.setAttribute('y', '200');
      jamb.setAttribute('width', '2'); jamb.setAttribute('height', '12');
      jamb.setAttribute('fill', '#5a4530');
      svg.appendChild(jamb);
      // Тонкая линия порога чтобы дверь читалась
      const threshold = document.createElementNS(SVG_NS, 'rect');
      threshold.setAttribute('x', '6'); threshold.setAttribute('y', '206');
      threshold.setAttribute('width', '154'); threshold.setAttribute('height', '2');
      threshold.setAttribute('fill', '#a89878');
      svg.appendChild(threshold);

      // ----- Кабинет с принтером (сверху) -----
      // Принтер по центру комнаты
      svg.appendChild(buildPrinter(300, 40));

      // Стеллаж с бумагой слева
      const shelf = document.createElementNS(SVG_NS, 'rect');
      shelf.setAttribute('x', '20'); shelf.setAttribute('y', '40');
      shelf.setAttribute('width', '50'); shelf.setAttribute('height', '90');
      shelf.setAttribute('fill', '#8a6a4a');
      svg.appendChild(shelf);
      // Стопки бумаги на стеллаже
      [[26, 50], [26, 70], [26, 90], [26, 110]].forEach(([sx, sy]) => {
        const stack = document.createElementNS(SVG_NS, 'rect');
        stack.setAttribute('x', String(sx)); stack.setAttribute('y', String(sy));
        stack.setAttribute('width', '38'); stack.setAttribute('height', '14');
        stack.setAttribute('fill', '#faf3e3');
        stack.setAttribute('stroke', '#d6c9ac');
        svg.appendChild(stack);
      });

      // Доска с эскизами справа
      const board = document.createElementNS(SVG_NS, 'rect');
      board.setAttribute('x', '470'); board.setAttribute('y', '30');
      board.setAttribute('width', '110'); board.setAttribute('height', '120');
      board.setAttribute('fill', '#faf3e3');
      board.setAttribute('stroke', '#a07a55');
      svg.appendChild(board);
      [['#c97b5a', 484, 44], ['#3d4f3a', 510, 46], ['#7a8aa0', 540, 42],
       ['#c97b5a', 498, 78], ['#3d4f3a', 526, 84], ['#5a7895', 552, 76],
       ['#f5a0a0', 482, 110], ['#c97b5a', 514, 116], ['#3d4f3a', 548, 110]].forEach(
        ([col, sx, sy]) => {
          const sticker = document.createElementNS(SVG_NS, 'rect');
          sticker.setAttribute('x', String(sx)); sticker.setAttribute('y', String(sy));
          sticker.setAttribute('width', '14'); sticker.setAttribute('height', '12');
          sticker.setAttribute('fill', col);
          svg.appendChild(sticker);
        });

      // ----- Офис (снизу) -----
      // Столы: 2×2 как на схеме (Марат — Илья сверху, Вера — пусто снизу)
      svg.appendChild(buildDesk(180, 230));  // Марат
      svg.appendChild(buildDesk(400, 230));  // Илья
      svg.appendChild(buildDesk(180, 370));  // Вера
      svg.appendChild(buildDesk(400, 370));  // пустой

      // Растения в углах офиса
      [[24, 200], [24, 440], [566, 440]].forEach(([cx, cy]) => {
        const pot = document.createElementNS(SVG_NS, 'rect');
        pot.setAttribute('x', String(cx - 8)); pot.setAttribute('y', String(cy));
        pot.setAttribute('width', '16'); pot.setAttribute('height', '10');
        pot.setAttribute('fill', '#8a5a3c');
        svg.appendChild(pot);
        [[-4, -8], [4, -8], [0, -12], [-6, -4], [6, -4]].forEach(([dx, dy]) => {
          const leaf = document.createElementNS(SVG_NS, 'rect');
          leaf.setAttribute('x', String(cx + dx));
          leaf.setAttribute('y', String(cy + dy));
          leaf.setAttribute('width', '4'); leaf.setAttribute('height', '4');
          leaf.setAttribute('fill', '#3d4f3a');
          svg.appendChild(leaf);
        });
      });

      // ----- Персонажи (подпись внутри группы — ездит с персонажем) -----
      // Шурова — в кабинете принтера у двери, увидит макет на принтере и побежит к Илье.
      charBoss = buildPixelSprite(SPRITES.boss, PALETTES.boss, 40, 150);
      charBoss.setAttribute('class', 'level1-char level1-char-boss');
      svg.appendChild(charBoss);

      // Марат сидит за своим столом (верхний-левый)
      const charMarat = buildPixelSprite(SPRITES.marat, PALETTES.marat, 164, 262, 'Марат');
      charMarat.setAttribute('class', 'level1-char level1-char-marat');
      svg.appendChild(charMarat);

      // Илья (верхний-правый)
      charIlya = buildPixelSprite(SPRITES.ilya, PALETTES.ilya, 384, 262, 'Илья');
      charIlya.setAttribute('class', 'level1-char level1-char-ilya');
      svg.appendChild(charIlya);

      // Вера (нижний-левый)
      charHer = buildPixelSprite(SPRITES.vera, PALETTES.vera, 164, 402, 'Вера');
      charHer.setAttribute('class', 'level1-char level1-char-her');
      svg.appendChild(charHer);

      // Клик-зона на компьютере Ильи (поверх стола)
      monitorHot = document.createElementNS(SVG_NS, 'rect');
      monitorHot.setAttribute('class', 'level1-monitor-hot');
      monitorHot.setAttribute('x', '376'); monitorHot.setAttribute('y', '228');
      monitorHot.setAttribute('width', '48'); monitorHot.setAttribute('height', '32');
      monitorHot.setAttribute('rx', '3');
      monitorHot.setAttribute('fill', 'rgba(0,0,0,0)');
      svg.appendChild(monitorHot);

      // Стрелка-подсказка к компьютеру Ильи (показывается до клика)
      arrowHint = document.createElementNS(SVG_NS, 'g');
      arrowHint.setAttribute('class', 'level1-arrow-hint');
      const arrowPath = document.createElementNS(SVG_NS, 'path');
      arrowPath.setAttribute('d',
        'M 400 196 L 400 222 M 392 214 L 400 222 L 408 214');
      arrowPath.setAttribute('stroke', 'var(--accent-terracotta)');
      arrowPath.setAttribute('stroke-width', '3');
      arrowPath.setAttribute('fill', 'none');
      arrowPath.setAttribute('stroke-linecap', 'round');
      arrowPath.setAttribute('stroke-linejoin', 'round');
      arrowHint.appendChild(arrowPath);
      svg.appendChild(arrowHint);

      // Главное сердечко (7×6) — между Илёй и Верой в кабинете принтера (центр (276, 150))
      const HEART = [
        '.HH.HH.',
        'HhHHHHH',
        'HHHHHHH',
        '.HHHHH.',
        '..HHH..',
        '...H...',
      ];
      const HEART_PALETTE = { H: '#c97b5a', h: '#f5c0a0' };
      const heart = buildPixelSprite(HEART, HEART_PALETTE, 262, 138);
      heart.setAttribute('class', 'level1-heart');
      svg.appendChild(heart);

      // Маленькие сердечки-частицы — взлетают над встретившимися
      const SMALL_HEART = [
        '.H.H.',
        'HHHHH',
        '.HHH.',
        '..H..',
      ];
      const SMALL_PAL = { H: '#c97b5a' };
      [
        { ox: 216, oy: 110, cls: 'level1-small-heart-1' },
        { ox: 316, oy: 110, cls: 'level1-small-heart-2' },
        { ox: 266, oy: 100, cls: 'level1-small-heart-3' },
      ].forEach((p) => {
        const sh = buildPixelSprite(SMALL_HEART, SMALL_PAL, p.ox, p.oy);
        sh.setAttribute('class', 'level1-small-heart ' + p.cls);
        svg.appendChild(sh);
      });

      // ----- Всплывающее облачко речи Шуровой (изначально скрыто) -----
      speechBubble = buildSpeechBubble();
      svg.appendChild(speechBubble);

      return svg;
    }

    // Облачко речи внутри игры. Появляется когда Шурова дошла до Ильи.
    // Сделано покрупнее, чтобы и текст, и кнопка помещались без скролла.
    function buildSpeechBubble() {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'level1-speech');

      // Контур-«облако» одним path: скруглённый прямоугольник + хвостик к Шуровой.
      // Шурова после ходьбы стоит на (340, 262). Хвост направлен к её голове.
      // Облако растянуто вверх (y=120..262), чтобы вместить весь текст + кнопку.
      const outline = document.createElementNS(SVG_NS, 'path');
      outline.setAttribute('d',
        'M 128 120 ' +
        'L 472 120 Q 480 120 480 128 ' +
        'L 480 254 Q 480 262 472 262 ' +
        'L 378 262 ' +
        'L 358 276 ' +              // хвостик к голове Шуровой
        'L 348 262 ' +
        'L 128 262 Q 120 262 120 254 ' +
        'L 120 128 Q 120 120 128 120 Z');
      outline.setAttribute('fill', '#faf3e3');
      outline.setAttribute('stroke', '#3a2f24');
      outline.setAttribute('stroke-width', '2');
      g.appendChild(outline);

      // HTML-контент через foreignObject — теперь места хватает.
      const fo = document.createElementNS(SVG_NS, 'foreignObject');
      fo.setAttribute('x', '132'); fo.setAttribute('y', '126');
      fo.setAttribute('width', '336'); fo.setAttribute('height', '132');
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.className = 'level1-speech-content';
      const speaker = document.createElement('div');
      speaker.className = 'level1-speech-speaker';
      speaker.textContent = '— Шурова';
      div.appendChild(speaker);
      const textP = document.createElement('p');
      textP.className = 'level1-speech-text';
      textP.textContent =
        '«Илья-Илья-Илья!!! У нас ЧАС до печати, ' +
        'а у тебя в макете ПЯТЬ ошибок!!! Это катастрофа! ' +
        'Срочно всё проверь, иначе сорвём заказ!!!»';
      div.appendChild(textP);
      const btn = document.createElement('button');
      btn.className = 'level1-speech-btn';
      btn.type = 'button';
      btn.textContent = 'Поехали!';
      div.appendChild(btn);
      fo.appendChild(div);
      g.appendChild(fo);
      return g;
    }

    function buildCardScene(onErrorFound) {
      // Контейнер с рулетками и метками реза
      const scene = document.createElement('div');
      scene.className = 'level1-card-scene';

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'level1-card-svg');
      svg.setAttribute('viewBox', '0 0 420 280');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Рулетки (top + left)
      const ruler = (x, y, len, vertical) => {
        const r = document.createElementNS(SVG_NS, 'g');
        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('x', String(x)); bg.setAttribute('y', String(y));
        bg.setAttribute('width', vertical ? '14' : String(len));
        bg.setAttribute('height', vertical ? String(len) : '14');
        bg.setAttribute('fill', '#ede4d3');
        r.appendChild(bg);
        for (let i = 0; i <= len; i += 10) {
          const tick = document.createElementNS(SVG_NS, 'line');
          const major = i % 50 === 0;
          if (vertical) {
            tick.setAttribute('x1', String(x + 14 - (major ? 8 : 4)));
            tick.setAttribute('x2', String(x + 14));
            tick.setAttribute('y1', String(y + i));
            tick.setAttribute('y2', String(y + i));
          } else {
            tick.setAttribute('y1', String(y + 14 - (major ? 8 : 4)));
            tick.setAttribute('y2', String(y + 14));
            tick.setAttribute('x1', String(x + i));
            tick.setAttribute('x2', String(x + i));
          }
          tick.setAttribute('stroke', '#888888');
          tick.setAttribute('stroke-width', '1');
          r.appendChild(tick);
        }
        return r;
      };
      svg.appendChild(ruler(20, 6, 400, false));
      svg.appendChild(ruler(6, 20, 260, true));

      // Метки реза по углам карточки. Карточка в области (40, 30) — (400, 250).
      const cardX = 40, cardY = 30, cardW = 360, cardH = 220;
      [[cardX, cardY], [cardX + cardW, cardY], [cardX, cardY + cardH], [cardX + cardW, cardY + cardH]]
        .forEach(([cx, cy]) => {
          const h = document.createElementNS(SVG_NS, 'line');
          h.setAttribute('x1', String(cx - 8)); h.setAttribute('x2', String(cx + 8));
          h.setAttribute('y1', String(cy));     h.setAttribute('y2', String(cy));
          h.setAttribute('stroke', '#7a6a55'); h.setAttribute('stroke-width', '1');
          svg.appendChild(h);
          const v = document.createElementNS(SVG_NS, 'line');
          v.setAttribute('x1', String(cx));     v.setAttribute('x2', String(cx));
          v.setAttribute('y1', String(cy - 8)); v.setAttribute('y2', String(cy + 8));
          v.setAttribute('stroke', '#7a6a55'); v.setAttribute('stroke-width', '1');
          svg.appendChild(v);
        });

      // CMYK-полоска сверху над карточкой
      ['#00aeef', '#ec008c', '#fff200', '#1a1a1a'].forEach((c, i) => {
        const sq = document.createElementNS(SVG_NS, 'rect');
        sq.setAttribute('x', String(cardX + i * 14));
        sq.setAttribute('y', String(cardY - 14));
        sq.setAttribute('width', '12'); sq.setAttribute('height', '8');
        sq.setAttribute('fill', c);
        svg.appendChild(sq);
      });

      // Сама карточка — группа с локальными координатами
      const cardGroup = document.createElementNS(SVG_NS, 'g');
      cardGroup.setAttribute('class', 'level1-card');
      cardGroup.setAttribute('transform', 'translate(' + cardX + ',' + cardY + ')');

      const cardBg = document.createElementNS(SVG_NS, 'rect');
      cardBg.setAttribute('x', '0'); cardBg.setAttribute('y', '0');
      cardBg.setAttribute('width', String(cardW)); cardBg.setAttribute('height', String(cardH));
      cardBg.setAttribute('rx', '6');
      cardBg.setAttribute('fill', '#ffffff');
      cardBg.setAttribute('stroke', '#d6c9ac');
      cardGroup.appendChild(cardBg);

      // Тонкая разделительная линия
      const sep = document.createElementNS(SVG_NS, 'line');
      sep.setAttribute('x1', '24'); sep.setAttribute('x2', '336');
      sep.setAttribute('y1', '130'); sep.setAttribute('y2', '130');
      sep.setAttribute('stroke', '#d6c9ac'); sep.setAttribute('stroke-width', '1');
      cardGroup.appendChild(sep);

      // Логотип — квадрат с буквой «П». ОШИБКА: придвинут вплотную к левому краю
      // (нет отступа от линии реза — при печати логотип обрежется).
      const logoGroup = document.createElementNS(SVG_NS, 'g');
      logoGroup.setAttribute('transform', 'translate(18, 50)');
      const logoBox = document.createElementNS(SVG_NS, 'rect');
      logoBox.setAttribute('x', '-18'); logoBox.setAttribute('y', '-18');
      logoBox.setAttribute('width', '36'); logoBox.setAttribute('height', '36');
      logoBox.setAttribute('rx', '4');
      logoBox.setAttribute('fill', 'var(--accent-terracotta)');
      logoGroup.appendChild(logoBox);
      const logoText = document.createElementNS(SVG_NS, 'text');
      logoText.setAttribute('x', '0'); logoText.setAttribute('y', '6');
      logoText.setAttribute('text-anchor', 'middle');
      logoText.setAttribute('font-family', 'Space Grotesk, sans-serif');
      logoText.setAttribute('font-size', '26');
      logoText.setAttribute('fill', '#fff8ec');
      logoText.textContent = 'П';
      logoGroup.appendChild(logoText);
      cardGroup.appendChild(logoGroup);

      // Название компании
      const company = document.createElementNS(SVG_NS, 'text');
      company.setAttribute('x', '92'); company.setAttribute('y', '46');
      company.setAttribute('font-family', 'Space Grotesk, sans-serif');
      company.setAttribute('font-size', '28');
      company.setAttribute('fill', '#000000');
      company.textContent = 'Печатай.ру';
      cardGroup.appendChild(company);

      // Имя сотрудника
      const name = document.createElementNS(SVG_NS, 'text');
      name.setAttribute('x', '92'); name.setAttribute('y', '72');
      name.setAttribute('font-family', 'Space Grotesk, sans-serif');
      name.setAttribute('font-size', '14');
      name.setAttribute('fill', '#000000');
      name.textContent = 'Илья';
      cardGroup.appendChild(name);

      // Должность с ОПЕЧАТКОЙ
      const job = document.createElementNS(SVG_NS, 'text');
      job.setAttribute('x', '92'); job.setAttribute('y', '94');
      job.setAttribute('font-family', 'Space Grotesk, sans-serif');
      job.setAttribute('font-size', '14');
      job.setAttribute('font-weight', '600');
      job.setAttribute('fill', 'var(--accent-green)');
      job.textContent = 'Дезайнер';
      cardGroup.appendChild(job);

      // «Корпоративная фотография» на визитке. ОШИБКА: пиксельный растр в 72 dpi —
      // зубчатые края, видны кубики. Нарисована силуэт-аватаркой (голова + плечи)
      // крупными блоками PX=5, чтобы читалась как «вставленная картинкой» на фоне
      // гладких векторных букв.
      const PHOTO_GRID = [
        '.HHHHHH.',
        'HHHHHHHH',
        'HFFFFFFH',
        'HFGGFGGH',
        'HFFFFFFH',
        'HFFMMFFH',
        'HHCCCCHH',
        '.CCCCCC.',
      ];
      const PHOTO_COL = {
        H: '#5a3820',  // волосы
        F: '#f0c8a0',  // кожа
        G: '#2a1f15',  // глаза
        M: '#a0604a',  // рот
        C: '#6a7a55',  // воротник/одежда
      };
      const photoPX = 5;
      PHOTO_GRID.forEach((row, ry) => {
        [...row].forEach((ch, rx) => {
          const col = PHOTO_COL[ch];
          if (!col) return;
          const r = document.createElementNS(SVG_NS, 'rect');
          r.setAttribute('x', String(226 + rx * photoPX));
          r.setAttribute('y', String(74 + ry * photoPX));
          r.setAttribute('width', String(photoPX));
          r.setAttribute('height', String(photoPX));
          r.setAttribute('fill', col);
          cardGroup.appendChild(r);
        });
      });

      // Контактная информация. ОШИБКА: телефон смещён вправо.
      const email = document.createElementNS(SVG_NS, 'text');
      email.setAttribute('x', '24'); email.setAttribute('y', '160');
      email.setAttribute('font-family', 'Space Grotesk, sans-serif');
      email.setAttribute('font-size', '12');
      email.setAttribute('fill', '#000000');
      email.textContent = 'ilya@pechatay.ru';
      cardGroup.appendChild(email);

      const phone = document.createElementNS(SVG_NS, 'text');
      phone.setAttribute('x', '54');  // нормальный был бы 24
      phone.setAttribute('y', '180');
      phone.setAttribute('font-family', 'Space Grotesk, sans-serif');
      phone.setAttribute('font-size', '12');
      phone.setAttribute('fill', '#000000');
      phone.textContent = '+7 (495) 123-45-67';
      cardGroup.appendChild(phone);

      const site = document.createElementNS(SVG_NS, 'text');
      site.setAttribute('x', '24'); site.setAttribute('y', '200');
      site.setAttribute('font-family', 'Space Grotesk, sans-serif');
      site.setAttribute('font-size', '12');
      site.setAttribute('fill', '#000000');
      site.textContent = 'pechatay.ru';
      cardGroup.appendChild(site);

      // ОШИБКА: лишний пиксель в правом верхнем углу
      const stray = document.createElementNS(SVG_NS, 'rect');
      stray.setAttribute('x', '316'); stray.setAttribute('y', '20');
      stray.setAttribute('width', '3'); stray.setAttribute('height', '3');
      stray.setAttribute('fill', '#000000');
      cardGroup.appendChild(stray);

      svg.appendChild(cardGroup);

      // Клик-зоны ошибок поверх всего (с координатами относительно карточки → смещаем)
      const hotspots = document.createElementNS(SVG_NS, 'g');
      hotspots.setAttribute('class', 'level1-hotspots');
      ERRORS.forEach((err) => {
        const hot = document.createElementNS(SVG_NS, 'g');
        hot.setAttribute('class', 'level1-hotspot');
        hot.setAttribute('data-error-id', err.id);
        hot.setAttribute('transform', 'translate(' + cardX + ',' + cardY + ')');
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(err.x)); rect.setAttribute('y', String(err.y));
        rect.setAttribute('width', String(err.w)); rect.setAttribute('height', String(err.h));
        rect.setAttribute('fill', 'transparent');
        rect.setAttribute('rx', '4');
        hot.appendChild(rect);

        // Невидимый изначально маркер «найдено» — кружок с галочкой
        const mark = document.createElementNS(SVG_NS, 'g');
        mark.setAttribute('class', 'level1-mark');
        const mx = err.x + err.w / 2;
        const my = err.y + err.h / 2;
        const ring = document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('cx', String(mx)); ring.setAttribute('cy', String(my));
        ring.setAttribute('r', String(Math.max(err.w, err.h) / 2 + 4));
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', 'var(--accent-green)');
        ring.setAttribute('stroke-width', '2');
        mark.appendChild(ring);
        const check = document.createElementNS(SVG_NS, 'path');
        check.setAttribute('d',
          'M ' + (mx + 6) + ' ' + (my - Math.max(err.w, err.h) / 2 - 2) +
          ' l 5 -5 l -4 -3');
        check.setAttribute('stroke', 'var(--accent-green)');
        check.setAttribute('stroke-width', '2');
        check.setAttribute('fill', 'none');
        check.setAttribute('stroke-linecap', 'round');
        mark.appendChild(check);
        hot.appendChild(mark);

        on(hot, 'click', () => onErrorFound(err.id, hot));
        hotspots.appendChild(hot);
      });
      svg.appendChild(hotspots);

      scene.appendChild(svg);
      return scene;
    }

    // ----- Фазы уровня -----

    // 1) «Приглашение»: стрелка пульсирует над компьютером Ильи, ждём клик.
    function startInvite() {
      stageEl.innerHTML = '';
      const hint = document.createElement('p');
      hint.className = 'level1-floor-hint';
      hint.innerHTML = 'Кликни на компьютер Ильи &nbsp;↑';
      stageEl.appendChild(hint);

      arrowHint.classList.add('level1-arrow-active');
      monitorHot.classList.add('level1-monitor-active');
      on(monitorHot, 'click', () => {
        arrowHint.classList.remove('level1-arrow-active');
        monitorHot.classList.remove('level1-monitor-active');
        monitorHot.style.pointerEvents = 'none';
        startScold();
      });
    }

    // 2) «Шурова в панике»: бежит из цеха через дверь и коридор между столами к Илье,
    //    потом всплывает облачко речи.
    function startScold() {
      // Шурова заметила — короткий «noy» как сигнал тревоги
      AUDIO.play('noy');
      stageEl.innerHTML = '';
      const walkingHint = document.createElement('p');
      walkingHint.className = 'level1-floor-hint';
      walkingHint.textContent = 'Шурова что-то заметила и бежит к Илье!';
      stageEl.appendChild(walkingHint);

      charBoss.classList.add('level1-char-walking');

      // Шаг 1: вниз через дверь в офис, в коридор между рядами столов.
      // (40,150) → (30,320) — translate(-10, 170)
      charBoss.style.transform = 'translate(-10px, 170px)';

      // Шаг 2: восток по коридору, минуя стол Марата.
      // → (300,320) — translate(260, 170)
      later(() => {
        charBoss.style.transform = 'translate(260px, 170px)';
      }, 1100);

      // Шаг 3: к Илье. → (340,262) — translate(300, 112)
      later(() => {
        charBoss.style.transform = 'translate(300px, 112px)';
      }, 2200);

      // Прибежала. Останавливается, показывается облачко речи (внутри игры).
      later(() => {
        charBoss.classList.remove('level1-char-walking');
        speechBubble.classList.add('level1-speech-visible');
        const btn = speechBubble.querySelector('.level1-speech-btn');
        if (btn) on(btn, 'click', () => {
          speechBubble.classList.remove('level1-speech-visible');
          startCardPhase();
        });
        stageEl.innerHTML = '';
      }, 3400);
    }

    // 3) Сама мини-игра — найти 5 ошибок.
    function startCardPhase() {
      // На фазе с визиткой верхняя реплика Нори уже неактуальна
      document.querySelector('.nori-quote')?.classList.add('hidden');
      stageEl.innerHTML = '';

      const status = document.createElement('div');
      status.className = 'level1-status';
      const hint = document.createElement('span');
      hint.className = 'level1-hint';
      hint.textContent = 'Найди все ошибки в макете';
      status.appendChild(hint);
      const counter = document.createElement('span');
      counter.className = 'level1-counter';
      counter.textContent = '0 / ' + ERRORS.length;
      status.appendChild(counter);
      stageEl.appendChild(status);

      // Список найденных ошибок — короткие комментарии появляются здесь
      const foundList = document.createElement('ul');
      foundList.className = 'level1-found-list';
      stageEl.appendChild(foundList);

      const found = new Set();
      const cardScene = buildCardScene((errorId, hotEl) => {
        if (found.has(errorId)) return;
        found.add(errorId);
        hotEl.classList.add('level1-found');
        counter.textContent = found.size + ' / ' + ERRORS.length;
        // Появляется строка-комментарий «✓ опечатка в тексте» и т.п.
        const err = ERRORS.find((e) => e.id === errorId);
        if (err) {
          const li = document.createElement('li');
          li.className = 'level1-found-item';
          li.textContent = '✓ ' + (err.comment || err.label);
          foundList.appendChild(li);
        }
        if (found.size === ERRORS.length) {
          counter.textContent = 'Готово к печати ✓';
          cardScene.classList.add('level1-card-printed');
          later(startMeeting, 1100);
        }
      });
      stageEl.appendChild(cardScene);
    }

    // 4) Встреча в кабинете принтера. Шурова исчезает — толпы нет.
    //    Идут «в обход» столов: вниз/в сторону, потом наверх через дверь.
    function startMeeting() {
      stageEl.innerHTML = '';
      const hint = document.createElement('p');
      hint.className = 'level1-floor-hint';
      hint.textContent = '…Шурова ушла. Илья и Вера идут забирать макет в цех принтера.';
      stageEl.appendChild(hint);

      charBoss.classList.add('level1-faded');

      // Шаг 1: выходят из-за своих столов в коридоры.
      // Илья: (384,262) → (80,340) (юг-запад). translate(-304, 78).
      // Вера: (164,402) → (30,402) (запад вдоль низа). translate(-134, 0).
      later(() => {
        charIlya.classList.add('level1-char-walking');
        charHer.classList.add('level1-char-walking');
        charIlya.style.transform = 'translate(-304px, 78px)';
        charHer.style.transform  = 'translate(-134px, 0)';
      }, 700);

      // Шаг 2: оба поднимаются к двери в цех.
      // Илья: → (80,240). translate(-304, -22).
      // Вера: → (30,220). translate(-134, -182).
      later(() => {
        charIlya.style.transform = 'translate(-304px, -22px)';
        charHer.style.transform  = 'translate(-134px, -182px)';
      }, 1900);

      // Шаг 3: проходят дверь и расходятся по сторонам принтера.
      // Илья: → (210,130). translate(-174, -132).
      // Вера: → (310,130). translate(146, -272).
      later(() => {
        charIlya.style.transform = 'translate(-174px, -132px)';
        charHer.style.transform  = 'translate(146px, -272px)';
      }, 3100);

      // Дошли. Снимаем «ходьбу».
      later(() => {
        charIlya.classList.remove('level1-char-walking');
        charHer.classList.remove('level1-char-walking');
      }, 4200);

      // Пауза перед сердечком и появлением.
      later(() => {
        officeSvg.classList.add('level1-printing');
        // Мелодия «встречи» — стартует ровно когда сердечко появляется.
        // fade-in 1с, играет один раз (без loop).
        AUDIO.playOnce('love', { volume: 0.4, fadeIn: 1000 });
      }, 4700);

      // Даём моменту полежать ~2.5с, потом плавно гасим мелодию и завершаем.
      later(() => AUDIO.stopLoop('love', { fadeOut: 1000 }), 7100);
      later(() => onCompleteCb && onCompleteCb(), 7200);
    }

    return {
      id: 1,
      title: 'Печатай.ру',
      intro: 'Меня тогда ещё не было. Но я знаю, что это очень важное место ' +
             'для вашей истории. Подвальная типография. Шум станков. ' +
             'И двое дизайнеров, которые ещё не знают, что станут моими хозяевами.',
      completionTitle: 'Уровень 1 пройден: мы встретились',
      completionText:
        'Низкая зарплата, подвальное помещение, сомнительные коллеги… ' +
        'Но именно там начиналась наша история.',
      photoCaption: 'наше фото из типографии',
      nextButtonText: 'Дальше',

      mount(container, onComplete) {
        onCompleteCb = onComplete;

        const root = document.createElement('div');
        root.className = 'level1-root';

        officeSvg = buildOfficeScene();
        root.appendChild(officeSvg);

        stageEl = document.createElement('div');
        stageEl.className = 'level1-stage-area';
        root.appendChild(stageEl);

        container.appendChild(root);

        startInvite();
      },

      unmount() {
        listeners.forEach((fn) => fn());
        listeners.length = 0;
        timeouts.forEach((t) => clearTimeout(t));
        timeouts.length = 0;
        // Гасим мелодию встречи, если игрок ушёл с уровня
        AUDIO.stopLoop('love');
        officeSvg = null;
        stageEl = null;
        charBoss = null; charIlya = null; charHer = null;
        arrowHint = null; monitorHot = null;
        speechBubble = null;
        onCompleteCb = null;
      },
    };
  }

  // ============================================================
  //  Уровень 2: «Бизнес в зелёной комнате» — три ветки выборов
  // ============================================================
  function createLevel2() {
    const L2_STORAGE_KEY = 'nori-story-level2-v1';

    // -------- Данные веток --------
    const BRANCHES = [
      {
        id: 'studio',
        title: 'Right Brain Studio',
        icon: '🎨',
        subtitle: 'дизайн-студия',
        questions: [
          {
            text: 'Как назвать студию?',
            options: [
              { t: 'Right Brain Studio — мы про креатив', s: 'yes',
                r: 'Звучит как стартап в Бруклине. Полдела сделано. 🇺🇸',
                f: 'Логотип, визитки, домен .com — минус 12 000. Бруклин обязывает.' },
              { t: '«Левин и Гофман» — старое уважаемое бюро',
                r: 'С такими фамилиями деньги сами найдут вас. Теоретически. 📜',
                f: 'Расходы на нейминг — ноль. Расходы на оправдания «нет, мы не евреи» — бесконечны.' },
              { t: 'Petrov & Petrova Design — серьёзно и понятно',
                r: 'Надёжно. Скучно. Надёжно скучно. 😐',
                f: 'Сэкономили на креативе. Потратили на психотерапевта — почему мы такие скучные.' },
            ],
          },
          {
            text: 'Первый клиент. Какую цену называем за логотип?',
            options: [
              { t: '5 000 — надо пополнять портфолио', s: 'noy',
                r: 'К десятой правке логотипы как класс хотелось сжечь. 🔥',
                f: 'Заработали 5 000. На правки ушло 40 часов. Час вашей работы — 125 рублей.' },
              { t: '20 000+ — мы профессионалы', s: 'yes',
                r: 'Губа не дура. 💅',
                f: 'Если согласятся — роллы на неделю. Если откажутся — клиент уйдёт к Вере, она сделает за 5 000.' },
              { t: '«А каков ваш бюджет?»',
                r: 'Клиент: «500 рублей, и надо, чтобы было готово вчера». ⏰',
                f: 'Чистая прибыль: 500 рублей. Стоимость самоуважения: бесценно (и не возвращается).' },
            ],
          },
          {
            text: 'Заказчик одобрил логотип, но просит «поиграть цветами».',
            options: [
              { t: 'Делаем 5 вариантов в разных палитрах',
                r: 'Клиент выбрал первый. Тот самый, изначальный. Классика. 🎨',
                f: '4 лишних варианта × 2 часа × 0 рублей доплаты = 8 часов жизни в подарок клиенту.' },
              { t: 'Блокируем заказчика', s: 'noy',
                r: 'Деньги вам совсем не нужны? А на что в Чайна Клаб роллы есть будем? 🍣',
                f: 'Самооценка: +100. Холодильник: пустой. Чайна Клаб: без вас сегодня.' },
              { t: 'Шлём тот же логотип в трёх оттенках одного цвета',
                r: 'Клиент: «Вот! Второй намного живее!» 🪄',
                f: 'Время на работу: 3 минуты. Гонорар: полный. Я бы вами гордилась. 🐾' },
              { t: 'Просим референсы', s: 'yes',
                r: 'Прислал закат, фото кота и логотип Nike. Вопросов больше нет. 🌅',
                f: 'Закат. Кот. Nike. Дешифровка займёт примерно вечность.' },
            ],
          },
          {
            text: 'Клиент звонит: «А где ваш офис? Хочу заехать пообщаться лично».',
            options: [
              { t: '«У нас удалённый формат»',
                r: 'В глазах клиента: «А вы вообще существуете?» 👻',
                f: 'Аренда офиса: 0. Доверие клиента: −50%. Чистая выгода: спорная.' },
              { t: '«Офис на реставрации, скоро откроемся»', s: 'yes',
                r: 'Сомнительно, но окей! 🏚️',
                f: 'Реставрация шла два года. Бюджет реставрации: 0 рублей. Прорабом был никто.' },
              { t: 'Называем адрес коворкинга, где ещё не были', s: 'noy',
                r: 'Риск — дело благородное. 🎲',
                f: 'Если приедет — катастрофа. Если не приедет — гениально. Соотношение 50/50.' },
              { t: 'Честно: «Мы работаем из дома»',
                r: 'Клиент кладёт трубку. Сегодня снова без роллов. 📞',
                f: 'Сохранили честь. Потеряли клиента. Курс чести к роллам сегодня невыгодный.' },
            ],
          },
          {
            text: 'Как продвигаем студию?',
            options: [
              { t: 'Сарафанное радио',
                r: 'Стратегия «ждём». Иногда работает. Чаще — нет. 📻',
                f: 'Затраты: 0. Доход: тоже 0. Зато симметрично.' },
              { t: 'Ездим на выставки, раздаём визитки',
                r: 'Так любишь улыбаться людям, которые взяли визитку, чтобы вы отстали? 😬',
                f: 'Печать 500 визиток: 3 000. Раздано: 487. Откликнулось: 0. Стоимость одной улыбки незнакомцу: 6 рублей.' },
              { t: 'Яндекс.Директ', s: 'yes',
                r: 'Слили бюджет за неделю. Зато теперь знаете слово «минус-слова». 📉',
                f: 'Бюджет: 30 000. Заявок: 2. Стоимость одной заявки: 15 000.' },
            ],
          },
          {
            text: 'Время идёт, но студия не растёт.',
            options: [
              { t: 'Поднимаем цены вдвое',
                r: 'Только и умеете, что цены поднимать! 💰',
                f: 'Старые клиенты в шоке. Новые не пришли. Доход: тот же, но с ощущением профессионализма.' },
              { t: 'Берём джуна — делегируем 🐾',
                r: 'Джун оказался требовательнее клиентов. 🎓',
                f: 'Зарплата джуна: 40 000. Времени, которое он сэкономил: 0. Чистый минус с настроением.' },
              { t: 'Запускаем ещё два бизнеса параллельно', s: 'yes',
                r: 'Один бизнес не растёт — запустим три. Что может пойти не так. 🚀',
                f: 'Теперь убытки в трёх местах одновременно. Поздравляю.' },
              { t: 'Идём в найм',
                r: 'Наконец-то здравая мысль. 🐾',
                f: 'Стабильная зарплата против свободы. Холодильник победил. Пока.' },
            ],
          },
        ],
        finalQuote:
          'Дизайн-агентство — это когда вас двое и вы называете это агентством. ' +
          'Студия была. Офис был на вечной реставрации. ' +
          'Ужин зависел от настроения клиента. Зато на визитках красиво.',
        resultNote: 'клиенты были, роста не было',
        summary: {
          stamp: 'ЗАКРЫТО',
          stats: [
            ['Длительность авантюры', '~2 года'],
            ['Клиентов прошло', '~25'],
            ['Чистый минус', '−47 000 ₽'],
            ['Самооценка', 'местами'],
          ],
        },
      },
      {
        id: 'pinplay',
        title: 'PinPlay',
        icon: '📦',
        subtitle: 'магазин гаджетов',
        questions: [
          {
            text: 'Какие гаджеты продавать?',
            options: [
              { t: 'Трендовые из ТикТока',
                r: 'Давай ещё спиннерами закупимся! 🌀',
                f: 'Закупили партию. Тренд закончился через 2 недели. Склад теперь — музей мёртвой моды.' },
              { t: 'Нишевые для гиков',
                r: 'Маленькая фанатичная аудитория. И тот, кто найдёт то же на 200 рублей дешевле. 🤓',
                f: 'Маржа красивая. Объём — слёзы. Зарабатываем как фрилансер-философ.' },
              { t: 'Полезные бытовые',
                r: 'Безопасно. И скучно. Но безопасно. 🍞',
                f: 'Прибыль с одной штуки — 150 рублей. Чтобы заработать на роллы, надо продать 40. За месяц.' },
              { t: 'Айфоны', s: 'noy',
                r: 'Не будем мелочиться. Маржа 3%, зато звучит. 📱',
                f: 'Чтобы заработать 30 000, надо продать айфонов на миллион. Где брать миллион — отдельный вопрос.' },
            ],
          },
          {
            text: 'А где, собственно, брать товар?',
            options: [
              { t: 'Закупать оптом из Китая',
                r: 'Заказали на 200 000. Приехало через 2 месяца. Половина — не то, что на фото. 📦',
                f: 'Минус 200 000. Половина товара — фантазия китайского фотошопа. Скидка на остатки: нужна срочно.' },
              { t: 'Едем на Горбушку по факту заказа', s: 'yes',
                r: 'Гениально. Пока ехали — клиент передумал. Завтра повторим. 🚗',
                f: 'Бензин: 800. Время в пробке: 4 часа. Заказ отменён. Прибыль: −800.' },
              { t: 'Поставщик по предзаказу',
                r: 'Клиент платит, ждёт неделю, передумывает. Возвраты — отдельная вселенная. ⏳',
                f: 'Маржа есть, нервы нет. Возврат денег съедает прибыль с трёх будущих заказов.' },
            ],
          },
          {
            text: 'Сайт есть, товар есть. Где клиенты?',
            options: [
              { t: 'Самостоятельно долбаться с Яндекс.Директом', s: 'yes',
                r: 'Кликают все, покупают трое. У Яндекса своя версия вашей аудитории. 📊',
                f: 'Бюджет: 50 000. Кликов: 1 200. Покупателей: 3. Маржа с трёх: 2 400.' },
              { t: 'SMM-щик',
                r: 'Получили 3 поста с 🚀 и подписью «Скоро много нового». Закончили сотрудничество. 📱',
                f: 'Зарплата SMM-щика за месяц: 25 000. Подписчиков пришло: 14 (8 — боты). Стоимость одного живого подписчика: 4 166 рублей.' },
              { t: 'Инфлюенсер за 50 000',
                r: 'Слили 50 000. Получили 8 заказов. Маржа — 4 000. Опыт — бесценный. 🎯',
                f: 'Чистый минус: 46 000. Подписки на канал инфлюенсера у вас в команде: на год вперёд.' },
            ],
          },
          {
            text: 'Клиент пишет: «Гаджет сломан».',
            options: [
              { t: 'Возвращаем деньги без вопросов',
                r: 'Репутация сохранена. Деньги — нет. 🛠️',
                f: 'Возврат полной суммы + почта туда-обратно. Чистый минус: −1 200.' },
              { t: 'Меняем на новый + скидка',
                r: 'Лояльность за ваш счёт. Долгая стратегия. Слишком долгая. 🎁',
                f: 'Себестоимость замены: 800. Скидка 20% на следующий заказ: ещё минус 400.' },
              { t: 'Гарантия, сервис, регламент',
                r: 'Профессионально. И долго. Клиент устал ждать и всё равно вернул. 📋',
                f: 'Регламент написан за 6 часов. Прочитан клиентом за 0 секунд.' },
            ],
          },
          {
            text: 'Конкуренты давят. Что делаем?',
            options: [
              { t: 'Берём кредит и масштабируемся', s: 'noy',
                r: 'Чем это обычно заканчивается, рассказывать не будем. (Кредитом.) 💳',
                f: 'Кредит: 500 000 под 18%. Платёж в месяц: 13 800. Прибыль в месяц: 11 000. Математика подсказывает направление.' },
              { t: 'Закрываем, идём дальше', s: 'yes',
                r: 'Признать поражение — тоже навык. Иногда самый важный. 🚪',
                f: 'Итоговый убыток: −180 000. Опыт работы в e-commerce: получен. Стоимость МВА в Сколково: 2 500 000. Считайте, со скидкой.' },
            ],
          },
        ],
        finalQuote:
          'Гаджеты вы любили. Гаджеты вас — не очень. ' +
          'Горбушка стала вторым домом, но первой зарплатой так и не стала.',
        resultNote: 'Горбушка стала вторым домом',
        summary: {
          stamp: 'БАНКРОТ',
          stats: [
            ['Длительность авантюры', '~8 месяцев'],
            ['Заказов отгружено', '~40'],
            ['Поездок на Горбушку', '78'],
            ['Чистый минус', '−180 000 ₽'],
          ],
        },
      },
      {
        id: 'lingerie',
        title: 'Магазин белья',
        icon: '👙',
        subtitle: 'магазин белья',
        questions: [
          {
            text: 'Какая идея магазина?',
            options: [
              { t: 'Бельё на каждый день — комфорт и практичность',
                r: 'Огромная конкуренция, низкая маржа. Зато стабильно. (Стабильно никто не покупает.) 🧺',
                f: 'Закупка: дёшево. Продажа: дёшево. Прибыль: дёшево. Бизнес-модель в гармонии с собой.' },
              { t: 'Премиум — красота, эстетика, дорогая упаковка', s: 'yes',
                r: 'Всё на максимум. Кроме клиентов. ✨',
                f: 'Себестоимость комплекта с упаковкой: 1 800. Цена: 4 500. Звучит хорошо — пока продажи не сравняются с упаковкой.' },
              { t: 'Бельё для особых случаев — праздничное и подарочное',
                r: 'Покупают редко. Зато с любовью. Если найдут вас. (Не найдут.) 🎀',
                f: '14 февраля + 8 марта = 80% годового оборота. Остальное время вы продавец надежды.' },
            ],
          },
          {
            text: 'На чём делаем акцент?',
            options: [
              { t: 'Прорабатываем упаковку до деталей', s: 'yes',
                r: 'Ленточки, открытки от руки, премиум-пакеты. Прибыль — ноль. Зато коробочка как у Apple. 🎁',
                f: 'Себестоимость упаковки: 600. Себестоимость белья внутри: 400.' },
              { t: 'Разрабатываем собственный дизайн коллекции',
                r: 'Творчески. Дорого. К запуску у вас 4 модели вместо 40. 🎨',
                f: 'Разработка одной модели: 30 000. Производство тиража: 80 000. Окупаемость: при условии, что клиент существует.' },
              { t: 'Главное красивый сайт, а там как-нибудь разберёмся!', s: 'yes',
                r: 'Конечно, не вашу же машину пришлось продать. Спасибо, Макс. 🚗',
                f: 'Сайт: 120 000. Машина Макса: 350 000. План: окупить за полгода. Реальность: вы уже догадались.' },
            ],
          },
          {
            text: 'Главный вопрос — оплата и возвраты?',
            options: [
              { t: 'Только предоплата, без возвратов',
                r: 'Жёстко и честно. Заказов мало — страшно покупать бельё, не пощупав. 🚫',
                f: 'Заказов в день: 1–2. Маржа высокая. Объём смешной. Холодильник: грустный.' },
              { t: 'Оплата при получении, можно вернуть',
                r: 'Стандарт. Возвраты есть, просто меньше. 📮',
                f: 'Возвратов: 25%. Стоимость одного возврата: 350 рублей логистики. Чистая маржа после возвратов: грустная.' },
              { t: 'Примерка на дому с возвратом', s: 'yes',
                r: 'Современно. Один нюанс: каждый невыкуп едет к вам обратно за свой счёт. Балкон Макса теперь в трусах XXL. 🩲',
                f: 'Курьер с примеркой: 600 за выезд. Выкупают 30 из 100. Доставку оплачиваете за все 100.' },
            ],
          },
          {
            text: 'Склад растёт, половина заказов возвращается. Что делаем?',
            options: [
              { t: 'Большая распродажа',
                r: 'Сливаете в минус, зато склад пустой. Главное — не повторить со следующей коллекцией. 🔥',
                f: 'Распродажа −70%. Возврат вложений: 35%. Чистый минус: 65% от закупки.' },
              { t: 'Льём больше рекламы — новые заказы покроют возвраты', s: 'noy',
                r: 'Льёте деньги в воронку с дыркой. 🕳️',
                f: 'Доп. бюджет: 100 000. Прирост заказов: +40%. Прирост возвратов: тоже +40%.' },
            ],
          },
          {
            text: 'Полгода прошло, минус растёт.',
            options: [
              { t: 'Перезапуск с новой моделью',
                r: '«Сейчас всё переделаем, точно полетит». Не полетит. 🔁',
                f: 'Ребрендинг: 80 000. Новые упаковки: 50 000. Результат: тот же, но в новой коробке.' },
              { t: 'Продаём бизнес Максу', s: 'yes',
                r: 'Макс выкупил. Жаль этого добряка. 🥲',
                f: 'Сумма сделки: символическая. Машина Макса: уже не существует. Дружба: проверена на прочность.' },
              { t: 'Закрываемся, признаём поражение',
                r: 'Зрело. Больно. Правильно. 🚪',
                f: 'Итог: −870 000. Понимание, что красивая упаковка ≠ бизнес: бесценно.' },
              { t: 'Берём ещё кредит', s: 'noy',
                r: 'Это уже не предпринимательство. Это азарт. 🎰',
                f: 'Новый кредит: 500 000. Старый минус: 870 000. Итог: пора идти в найм.' },
            ],
          },
        ],
        finalQuote:
          'Вы сделали очень красиво. Премиум-упаковка, ленточки, айдентика. ' +
          'Забыли одно: купить должны живые люди. Живые люди о вас не узнали. ' +
          'Красота без сбыта — это хобби. И хобби Макса.',
        resultNote: 'самая красивая упаковка в истории русского e-commerce',
        summary: {
          stamp: 'СЛИТО',
          stats: [
            ['Длительность авантюры', '~1 год'],
            ['Проданных комплектов', '~30'],
            ['Машин Макса в активе', '−1'],
            ['Чистый минус', '−870 000 ₽'],
          ],
        },
      },
    ];

    const FINAL_QUOTE =
      'Три попытки. Три провала. Три раза встали и пошли дальше. ' +
      'Я уважаю. Особенно потому, что в финале вы получили меня. 🐾';

    const FINAL_STATS = [
      ['Всего попыток', '3'],
      ['Всего провалов', '3'],
      ['Всего опыта', 'бесценно'],
      ['Прибыль Чайна Клаб с ваших обедов', 'единственная стабильная в этой истории'],
      ['Друзей, которым пришлось продать машину', '1'],
    ];

    // -------- Состояние --------
    const progress = {
      branches: {},
    };
    BRANCHES.forEach((b) => {
      progress.branches[b.id] = { completed: false, currentQ: 0 };
    });

    function loadProgress() {
      // Сброс к дефолтам — чтобы in-memory state не пережил «Пройти заново».
      BRANCHES.forEach((b) => {
        progress.branches[b.id] = { completed: false, currentQ: 0 };
      });
      try {
        const raw = localStorage.getItem(L2_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.branches) {
          BRANCHES.forEach((b) => {
            const p = parsed.branches[b.id];
            if (p) {
              progress.branches[b.id] = {
                completed: !!p.completed,
                currentQ: (typeof p.currentQ === 'number' && p.currentQ >= 0)
                  ? Math.min(p.currentQ, b.questions.length) : 0,
              };
            }
          });
        }
      } catch (e) { /* игнорим */ }
    }
    function saveProgress() {
      try { localStorage.setItem(L2_STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
    }
    function clearProgress() {
      BRANCHES.forEach((b) => {
        progress.branches[b.id] = { completed: false, currentQ: 0 };
      });
      try { localStorage.removeItem(L2_STORAGE_KEY); } catch (e) {}
    }
    function allBranchesComplete() {
      return BRANCHES.every((b) => progress.branches[b.id].completed);
    }

    // -------- Утилиты --------
    const listeners = [];
    const timeouts = [];
    function on(el, evt, fn) {
      el.addEventListener(evt, fn);
      listeners.push(() => el.removeEventListener(evt, fn));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }

    let contentEl = null;
    let onCompleteCb = null;

    function fadeReplace(newNode) {
      if (!contentEl) return;
      // На пост-первых экранах уровня верхняя реплика Нори не нужна
      document.querySelector('.nori-quote')?.classList.add('hidden');
      contentEl.classList.add('level2-fading');
      later(() => {
        contentEl.innerHTML = '';
        contentEl.appendChild(newNode);
        contentEl.classList.remove('level2-fading');
      }, 220);
    }

    // -------- Сцена (зелёная комната) --------
    // Маленькая комната: дверь — мини-стол с компом — двуспальная кровать
    // с двумя ноутами — подоконник с окном. Стена — лимонно-зелёная.
    function buildScene() {
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'level2-scene-svg');
      svg.setAttribute('viewBox', '0 0 600 130');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      const rect = (x, y, w, h, fill, stroke, sw) => {
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', String(x)); r.setAttribute('y', String(y));
        r.setAttribute('width', String(w)); r.setAttribute('height', String(h));
        r.setAttribute('fill', fill);
        if (stroke) { r.setAttribute('stroke', stroke); r.setAttribute('stroke-width', String(sw || 1)); }
        return r;
      };
      const path = (d, stroke, sw, fill) => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        if (stroke) { p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', String(sw || 1)); }
        p.setAttribute('fill', fill || 'none');
        p.setAttribute('stroke-linecap', 'round');
        return p;
      };

      // Стена — лимонно-зелёный по фото
      svg.appendChild(rect(0, 0, 600, 82, '#c2d066'));
      // Пол — светлый ламинат
      svg.appendChild(rect(0, 82, 600, 48, '#b89968'));
      // Плинтус
      svg.appendChild(rect(0, 82, 600, 3, '#7a5a3a'));

      // ----- Дверь (слева) -----
      // Створка чуть темнее стены
      svg.appendChild(rect(18, 6, 56, 76, '#a8b955', '#7a8a3a', 1.5));
      // Филёнки
      svg.appendChild(rect(24, 12, 44, 28, 'none', '#7a8a3a', 1));
      svg.appendChild(rect(24, 46, 44, 30, 'none', '#7a8a3a', 1));
      // Ручка
      const handle = document.createElementNS(SVG_NS, 'circle');
      handle.setAttribute('cx', '64'); handle.setAttribute('cy', '46');
      handle.setAttribute('r', '1.6'); handle.setAttribute('fill', '#3a2a18');
      svg.appendChild(handle);

      // ----- Мини-стол с компом -----
      const dCx = 140;
      // Столешница
      svg.appendChild(rect(dCx - 38, 78, 76, 8, '#c9a168'));
      // Ножки
      svg.appendChild(rect(dCx - 36, 86, 3, 38, '#7a5a3a'));
      svg.appendChild(rect(dCx + 33, 86, 3, 38, '#7a5a3a'));
      // Ноутбук — основание
      svg.appendChild(rect(dCx - 22, 74, 44, 4, '#2a2520'));
      // Экран
      svg.appendChild(rect(dCx - 20, 50, 40, 24, '#2a2520'));
      // Свечение
      svg.appendChild(rect(dCx - 18, 52, 36, 20, '#c0d8d0'));
      // Кружка кофе сбоку
      svg.appendChild(rect(dCx + 26, 68, 9, 10, '#c97b5a'));
      svg.appendChild(rect(dCx + 26, 68, 9, 2, '#6a3c28'));
      svg.appendChild(path('M ' + (dCx + 29) + ' 64 q 3 -4 0 -8 M ' + (dCx + 33) + ' 64 q 3 -4 0 -8',
        '#ffffff', 1.3));

      // ----- Двуспальная кровать (центр-право) -----
      // Кровать с ноутами по бокам — главный «офис»
      const bX = 240, bY = 86, bW = 220, bH = 22;
      // Каркас/боковина
      svg.appendChild(rect(bX, bY + 16, bW, 8, '#8a5a3c'));
      // Матрас
      svg.appendChild(rect(bX + 4, bY, bW - 8, 18, '#f4ead4', '#d8c79a', 1));
      // Шов посередине матраса (двуспальная)
      svg.appendChild(path('M ' + (bX + bW / 2) + ' ' + bY + ' L ' + (bX + bW / 2) + ' ' + (bY + 18),
        '#d8c79a', 0.8));
      // Подушки (две, по краям, как двуспалка)
      svg.appendChild(rect(bX + 8, bY - 8, 42, 10, '#ffffff', '#cbb98a', 1));
      svg.appendChild(rect(bX + bW - 50, bY - 8, 42, 10, '#ffffff', '#cbb98a', 1));
      // Ножки
      svg.appendChild(rect(bX + 2, bY + 24, 3, 8, '#5a3a22'));
      svg.appendChild(rect(bX + bW - 5, bY + 24, 3, 8, '#5a3a22'));

      // Ноутбук на кровати — левый (раскрытый)
      const l1 = bX + 70;
      svg.appendChild(rect(l1, bY + 2, 36, 3, '#2a2520'));
      svg.appendChild(rect(l1 + 2, bY - 14, 32, 18, '#2a2520'));
      svg.appendChild(rect(l1 + 4, bY - 12, 28, 14, '#c0d8d0'));
      // Ноутбук на кровати — правый
      const l2 = bX + bW - 70 - 36;
      svg.appendChild(rect(l2, bY + 2, 36, 3, '#2a2520'));
      svg.appendChild(rect(l2 + 2, bY - 14, 32, 18, '#2a2520'));
      svg.appendChild(rect(l2 + 4, bY - 12, 28, 14, '#c0d8d0'));

      // ----- Подоконник + окно (справа) -----
      const wX = 488, wY = 14, wW = 90, wH = 46;
      // Рама + стекло
      svg.appendChild(rect(wX, wY, wW, wH, '#cce8e0', '#2e3d35', 2));
      // Крестовина
      svg.appendChild(path('M ' + (wX + wW / 2) + ' ' + wY + ' L ' + (wX + wW / 2) + ' ' + (wY + wH),
        '#2e3d35', 2));
      svg.appendChild(path('M ' + wX + ' ' + (wY + wH / 2) + ' L ' + (wX + wW) + ' ' + (wY + wH / 2),
        '#2e3d35', 2));
      // Подоконник — широкая «полочка»
      svg.appendChild(rect(wX - 6, wY + wH, wW + 12, 6, '#e8d6a8', '#a8814f', 1));
      // Горшочек на подоконнике
      svg.appendChild(rect(wX + 12, wY + wH - 10, 12, 10, '#8a5a3c'));
      [[0, -4], [-4, -2], [4, -2], [-2, -7], [2, -7]].forEach(([dx, dy]) => {
        const leaf = document.createElementNS(SVG_NS, 'circle');
        leaf.setAttribute('cx', String(wX + 18 + dx));
        leaf.setAttribute('cy', String(wY + wH - 10 + dy));
        leaf.setAttribute('r', '3.2');
        leaf.setAttribute('fill', '#4b6a3a');
        svg.appendChild(leaf);
      });

      return svg;
    }

    // -------- Экран выбора ветки --------
    function renderBranchSelect() {
      const wrap = document.createElement('div');
      wrap.className = 'level2-select-screen';

      wrap.appendChild(buildScene());

      const hint = document.createElement('p');
      hint.className = 'level2-select-hint';
      hint.textContent =
        'Вы ушли с работы, поверили в себя и решили открыть свой бизнес. С чего начнём?';
      wrap.appendChild(hint);

      const list = document.createElement('div');
      list.className = 'level2-branch-list';
      BRANCHES.forEach((b) => list.appendChild(buildBranchCard(b)));
      wrap.appendChild(list);

      return wrap;
    }

    function buildBranchCard(b) {
      const card = document.createElement('button');
      card.className = 'level2-branch-card';
      card.type = 'button';
      const done = progress.branches[b.id].completed;
      if (done) card.classList.add('completed');

      const icon = document.createElement('div');
      icon.className = 'level2-branch-icon';
      icon.textContent = b.icon;
      card.appendChild(icon);

      const title = document.createElement('div');
      title.className = 'level2-branch-title';
      title.textContent = b.subtitle;
      card.appendChild(title);

      if (done) {
        const check = document.createElement('span');
        check.className = 'level2-branch-check';
        check.textContent = '✓';
        card.appendChild(check);
        card.disabled = true;
      } else {
        on(card, 'click', () => fadeReplace(renderQuestion(b.id)));
      }
      return card;
    }

    // -------- Экран вопроса --------
    function renderQuestion(branchId) {
      const branch = BRANCHES.find((b) => b.id === branchId);
      const qIdx = progress.branches[branchId].currentQ;
      const question = branch.questions[qIdx];

      const wrap = document.createElement('div');
      wrap.className = 'level2-question-screen';

      // Шапка ветки
      const header = document.createElement('div');
      header.className = 'level2-q-header';
      const hIcon = document.createElement('span');
      hIcon.className = 'level2-q-icon';
      hIcon.textContent = branch.icon;
      header.appendChild(hIcon);
      const hTitle = document.createElement('span');
      hTitle.className = 'level2-q-title';
      hTitle.textContent = branch.subtitle;
      header.appendChild(hTitle);
      const hProg = document.createElement('span');
      hProg.className = 'level2-q-progress';
      hProg.textContent = (qIdx + 1) + ' / ' + branch.questions.length;
      header.appendChild(hProg);
      wrap.appendChild(header);

      // Текст вопроса
      const qText = document.createElement('h3');
      qText.className = 'level2-q-text';
      qText.textContent = question.text;
      wrap.appendChild(qText);

      // Низ — варианты, потом реакция
      const bottom = document.createElement('div');
      bottom.className = 'level2-bottom';
      const opts = document.createElement('div');
      opts.className = 'level2-options';
      question.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'level2-option';
        btn.type = 'button';
        btn.textContent = opt.t;
        // Тихая подсказка-звук: opt.s = 'yes' (так и было в жизни) или 'noy'
        // (очевидно плохой ответ). Глобальный click-звук в этом случае
        // отключается через data-opt-sound; визуальных пометок нет.
        if (opt.s) btn.dataset.optSound = opt.s;
        on(btn, 'click', () => {
          if (opt.s) AUDIO.play(opt.s);
          showReaction(branchId, qIdx, opt, bottom);
        });
        opts.appendChild(btn);
      });
      bottom.appendChild(opts);
      wrap.appendChild(bottom);

      return wrap;
    }

    function showReaction(branchId, qIdx, opt, bottomEl) {
      const branch = BRANCHES.find((b) => b.id === branchId);
      const isLast = qIdx >= branch.questions.length - 1;

      bottomEl.innerHTML = '';
      const react = document.createElement('div');
      react.className = 'level2-reaction-wrap';

      const chosen = document.createElement('div');
      chosen.className = 'level2-chosen';
      chosen.textContent = opt.t;
      react.appendChild(chosen);

      const r = document.createElement('p');
      r.className = 'level2-reaction';
      r.textContent = opt.r;
      react.appendChild(r);

      const fin = document.createElement('p');
      fin.className = 'level2-finance';
      fin.textContent = '💸 ' + opt.f;
      react.appendChild(fin);

      const next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.type = 'button';
      next.textContent = 'Дальше';
      on(next, 'click', () => {
        progress.branches[branchId].currentQ = qIdx + 1;
        saveProgress();
        if (isLast) {
          progress.branches[branchId].completed = true;
          saveProgress();
          fadeReplace(renderBranchFinal(branchId));
        } else {
          fadeReplace(renderQuestion(branchId));
        }
      });
      react.appendChild(next);

      bottomEl.appendChild(react);
    }

    // -------- Финал ветки --------
    function renderBranchFinal(branchId) {
      // Звук «провала» в финале каждой ветки бизнеса — короткий dub
      AUDIO.play('dub');
      const branch = BRANCHES.find((b) => b.id === branchId);
      const summary = branch.summary;

      const wrap = document.createElement('div');
      wrap.className = 'level2-branch-final';

      // Чек-результат с штампом
      const receipt = document.createElement('div');
      receipt.className = 'level2-receipt';

      const rHeader = document.createElement('div');
      rHeader.className = 'level2-receipt-header';
      const rIcon = document.createElement('span');
      rIcon.className = 'level2-receipt-icon';
      rIcon.textContent = branch.icon;
      rHeader.appendChild(rIcon);
      const rSubtitle = document.createElement('span');
      rSubtitle.className = 'level2-receipt-subtitle';
      rSubtitle.textContent = branch.subtitle;
      rHeader.appendChild(rSubtitle);
      receipt.appendChild(rHeader);

      const list = document.createElement('ul');
      list.className = 'level2-receipt-stats';
      summary.stats.forEach(([k, v], idx) => {
        const li = document.createElement('li');
        li.style.setProperty('--row-index', String(idx));
        const keyEl = document.createElement('span');
        keyEl.className = 'level2-receipt-key';
        keyEl.textContent = k;
        li.appendChild(keyEl);
        const dots = document.createElement('span');
        dots.className = 'level2-receipt-dots';
        dots.setAttribute('aria-hidden', 'true');
        li.appendChild(dots);
        const valEl = document.createElement('span');
        valEl.className = 'level2-receipt-val';
        valEl.textContent = v;
        li.appendChild(valEl);
        list.appendChild(li);
      });
      receipt.appendChild(list);

      const stamp = document.createElement('div');
      stamp.className = 'level2-receipt-stamp';
      stamp.textContent = summary.stamp;
      receipt.appendChild(stamp);

      wrap.appendChild(receipt);

      // Реплика Нори на этом экране не нужна — достаточно чека-итогов и
      // кнопки «Запустим ещё один бизнес?» внизу.

      const allDone = allBranchesComplete();

      // Ряд из одной или двух кнопок:
      //   — если ВСЕ ветки пройдены → одна большая «К итогам»
      //   — иначе → две: «Хватит, идём в найм →» (основная) + «Ещё одну попытку» (вторичная)
      const btnRow = document.createElement('div');
      btnRow.className = 'level2-branch-final-btns';

      if (allDone) {
        const next = document.createElement('button');
        next.className = 'btn btn-primary';
        next.type = 'button';
        next.textContent = 'К итогам';
        on(next, 'click', () => fadeReplace(renderLevelFinal()));
        btnRow.appendChild(next);
      } else {
        // Слева — «в найм» (основная)
        const skip = document.createElement('button');
        skip.className = 'btn btn-primary';
        skip.type = 'button';
        skip.textContent = 'Возвращаемся в найм!';
        on(skip, 'click', () => fadeReplace(renderLevelFinal()));
        btnRow.appendChild(skip);

        // Справа — «ещё один бизнес» (вторичная)
        const tryMore = document.createElement('button');
        tryMore.className = 'btn btn-secondary';
        tryMore.type = 'button';
        tryMore.textContent = 'Попробуем ещё один бизнес?';
        on(tryMore, 'click', () => fadeReplace(renderBranchSelect()));
        btnRow.appendChild(tryMore);
      }

      wrap.appendChild(btnRow);

      return wrap;
    }

    function buildNoriBlock(text) {
      const block = document.createElement('div');
      block.className = 'level2-nori-block';
      const sp = document.createElement('span');
      sp.className = 'level2-nori-speaker';
      sp.textContent = '— Нори:';
      block.appendChild(sp);
      const p = document.createElement('p');
      p.className = 'level2-nori-text';
      p.textContent = '«' + text + '»';
      block.appendChild(p);
      return block;
    }

    // -------- Финал уровня --------
    function renderLevelFinal() {
      const wrap = document.createElement('div');
      wrap.className = 'level2-level-final';

      const title = document.createElement('h2');
      title.className = 'level2-final-h';
      title.textContent = 'Итоги периода в зелёной комнате';
      wrap.appendChild(title);

      const list = document.createElement('ul');
      list.className = 'level2-results-list';
      BRANCHES.forEach((b) => {
        const li = document.createElement('li');
        const ic = document.createElement('span');
        ic.className = 'level2-results-icon';
        ic.textContent = b.icon;
        li.appendChild(ic);
        const nm = document.createElement('span');
        nm.className = 'level2-results-name';
        nm.textContent = b.title;
        li.appendChild(nm);
        const note = document.createElement('span');
        note.className = 'level2-results-note';
        note.textContent = '— ' + b.resultNote;
        li.appendChild(note);
        list.appendChild(li);
      });
      wrap.appendChild(list);

      const stats = document.createElement('div');
      stats.className = 'level2-stats';
      FINAL_STATS.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'level2-stat-row';
        const keyEl = document.createElement('span');
        keyEl.className = 'level2-stat-key';
        keyEl.textContent = k;
        row.appendChild(keyEl);
        const valEl = document.createElement('span');
        valEl.className = 'level2-stat-val';
        valEl.textContent = v;
        row.appendChild(valEl);
        stats.appendChild(row);
      });
      wrap.appendChild(stats);

      wrap.appendChild(buildNoriBlock(FINAL_QUOTE));

      const next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.type = 'button';
      next.textContent = 'Дальше';
      on(next, 'click', () => {
        // Уровень пройден — чистим локальный прогресс ветвей и отдаём управление.
        clearProgress();
        if (onCompleteCb) onCompleteCb();
      });
      wrap.appendChild(next);

      return wrap;
    }

    return {
      id: 2,
      title: 'Бизнес в зелёной комнате',
      intro:
        'Одна зелёная комната, два ноутбука, и бесконечная вера в себя. ' +
        'Тут вы решили поиграть в бизнесменов. Вспомним, как это было?',
      completionTitle: 'Уровень 2 пройден: мы пробовали',
      completionText:
        'Тогда казалось, что у нас не получилось. А сейчас я смотрю назад и ' +
        'понимаю: мы закладывали фундамент для всего того, что у нас есть сегодня.',
      photoCaption: 'наши с тобой в зелёной комнате',
      nextButtonText: 'На карту',

      mount(container, onComplete) {
        onCompleteCb = onComplete;
        loadProgress();

        const root = document.createElement('div');
        root.className = 'level2-root';

        contentEl = document.createElement('div');
        contentEl.className = 'level2-content';
        root.appendChild(contentEl);

        container.appendChild(root);

        // Стартовый экран — выбор ветки или финал, если всё пройдено
        if (allBranchesComplete()) {
          contentEl.appendChild(renderLevelFinal());
        } else {
          contentEl.appendChild(renderBranchSelect());
        }
      },

      unmount() {
        listeners.forEach((fn) => fn());
        listeners.length = 0;
        timeouts.forEach((t) => clearTimeout(t));
        timeouts.length = 0;
        contentEl = null;
        onCompleteCb = null;
      },
    };
  }

  // ============================================================
  //  Уровень 3: «Своё гнездо. Карантин» — стелс-аркада + поиск предметов
  // ============================================================
  function createLevel3() {
    const L3_STORAGE_KEY = 'nori-story-level3-v1';

    // Предметы для Части 2 (поиск)
    const ITEMS = [
      { id: 'wine',     name: 'Бутылка вина',
        quote: 'Главный экспонат. Без него никакой Грузии не получится. Я пробовала. Не понравилось.' },
      { id: 'hinkali',  name: 'Хинкали',
        quote: 'Они лепили их сами. Два часа на 40 штук. Съели за 15 минут.' },
      { id: 'suluguni', name: 'Сулугуни',
        quote: 'Сыр. Они называли это сыром. Я называла это смыслом жизни.' },
      { id: 'khmeli',   name: 'Хмели-сунели',
        quote: 'Купили специи «для атмосферы». Использовали один раз. Стоят до сих пор.' },
      { id: 'flour',    name: 'Скалка и мука',
        quote: 'Кухня в муке. Они в муке. Я в муке. Все счастливы.' },
      { id: 'speaker',  name: 'Колонка',
        quote: 'Будет звучать многоголосие. Я лягу под колонку. Я ценитель.' },
      { id: 'candles',  name: 'Свечи',
        quote: 'Романтика на 98-й день карантина. Они старались.' },
      { id: 'hat',      name: 'Грузинская папаха',
        quote: 'Откуда. Это. У вас. (Не отвечайте.)' },
      { id: 'cilantro', name: 'Кинза',
        quote: 'Зелень, которую он называл «грузинская трава». Технически — да.' },
      { id: 'glasses',  name: 'Бокалы',
        quote: 'Из бабушкиного серванта. Достали ради этого вечера.' },
    ];

    // Декои — предметы из других тематических дней, не нужно собирать
    const DECOYS = [
      { id: 'sushi',      quote: 'Это от Дня Японии. Сегодня — Грузия. Мимо.' },
      { id: 'chopsticks', quote: 'Палочки оставь. Хинкали едят руками.' },
      { id: 'pasta',      quote: 'Италия — завтра. Сегодня хинкали, не паста.' },
    ];

    const progress = { part1: false, part2: false, found: [] };
    function loadProgress() {
      // Сначала сброс к дефолтам — иначе in-memory state переживает «Пройти
      // заново» и игра пропускается.
      progress.part1 = false;
      progress.part2 = false;
      progress.found = [];
      try {
        const raw = localStorage.getItem(L3_STORAGE_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        progress.part1 = !!p.part1;
        progress.part2 = !!p.part2;
        progress.found = Array.isArray(p.found)
          ? p.found.filter((id) => ITEMS.some((it) => it.id === id)) : [];
      } catch (e) { /* ignore */ }
    }
    function saveProgress() {
      try { localStorage.setItem(L3_STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
    }
    function clearProgress() {
      progress.part1 = false; progress.part2 = false; progress.found = [];
      try { localStorage.removeItem(L3_STORAGE_KEY); } catch (e) {}
    }

    // --- Управление ресурсами ---
    const listeners = [];
    const timeouts = [];
    let rafId = null;
    function on(el, evt, fn, opts) {
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }
    function cleanupAll() {
      listeners.forEach((fn) => fn()); listeners.length = 0;
      timeouts.forEach((t) => clearTimeout(t)); timeouts.length = 0;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    let contentEl = null;
    let onCompleteCb = null;

    function fadeTo(newNode) {
      if (!contentEl) return;
      document.querySelector('.nori-quote')?.classList.add('hidden');
      contentEl.classList.add('level3-fading');
      later(() => {
        contentEl.innerHTML = '';
        contentEl.appendChild(newNode);
        contentEl.classList.remove('level3-fading');
      }, 220);
    }

    function buildBubble(text) {
      // Меу убрано — Нори говорит «закадрово», звук должен звучать
      // только когда она физически появляется (см. renderFinal / L7).
      const b = document.createElement('div');
      b.className = 'level3-bubble';
      const sp = document.createElement('span');
      sp.className = 'level3-bubble-speaker';
      sp.textContent = '— Нори:';
      b.appendChild(sp);
      const p = document.createElement('p');
      p.className = 'level3-bubble-text';
      p.textContent = text;
      b.appendChild(p);
      return b;
    }
    function setBubbleText(scope, text) {
      const el = scope.querySelector('.level3-bubble-text');
      if (el) el.textContent = text;
    }

    // ============== ЧАСТЬ 1: СТЕЛС-АРКАДА ==============
    let p1 = null; // эфемерное игровое состояние

    function renderPart1() {
      const wrap = document.createElement('div');
      wrap.className = 'level3-part1';

      wrap.appendChild(buildBubble(
        'Они выходили из дома, как партизаны. С документами, QR-кодом и предчувствием штрафа. Я бы не вышла. Я кошка, мне можно.'
      ));

      const hud = document.createElement('div');
      hud.className = 'level3-hud';
      const lives = document.createElement('div');
      lives.className = 'level3-lives';
      hud.appendChild(lives);
      const qr = document.createElement('div');
      qr.className = 'level3-qr';
      qr.textContent = 'QR ◻ (пробел)';
      hud.appendChild(qr);
      wrap.appendChild(hud);

      const stage = document.createElement('div');
      stage.className = 'level3-canvas-wrap';
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 320;
      canvas.className = 'level3-canvas';
      stage.appendChild(canvas);
      wrap.appendChild(stage);

      // Виртуальные кнопки для мобильных — D-pad + большая кнопка QR.
      // На десктопе скрыты через CSS (display:none по умолчанию).
      const touchPanel = document.createElement('div');
      touchPanel.className = 'level3-touch-controls';
      touchPanel.innerHTML =
        '<div class="dpad">' +
          '<button class="dpad-btn dpad-up" data-dir="up" type="button">▲</button>' +
          '<button class="dpad-btn dpad-left" data-dir="left" type="button">◀</button>' +
          '<button class="dpad-btn dpad-right" data-dir="right" type="button">▶</button>' +
          '<button class="dpad-btn dpad-down" data-dir="down" type="button">▼</button>' +
        '</div>' +
        '<button class="dpad-qr" type="button">QR</button>';
      wrap.appendChild(touchPanel);

      const hint = document.createElement('p');
      hint.className = 'level3-hint';
      hint.textContent = 'Стрелки / WASD — двигаться. Пробел — показать QR (на 4 сек). ' +
        'Дойди до «Дикси», возьми вино и сыр, и вернись домой.';
      wrap.appendChild(hint);

      const skipRow = document.createElement('div');
      skipRow.className = 'level3-skip-row';
      wrap.appendChild(skipRow);

      later(() => startP1(canvas, wrap, lives, qr, stage, skipRow), 80);
      return wrap;
    }

    function startP1(canvas, wrap, livesEl, qrEl, stage, skipRow) {
      const ctx = canvas.getContext('2d');
      p1 = {
        player: { x: 60, y: 270 },
        patrols: [
          { x: 240, y: 160, vx: 90, vy: 0, minX: 160, maxX: 420, minY: 160, maxY: 160 },
          { x: 460, y: 100, vx: 0, vy: 70, minX: 460, maxX: 460, minY: 60, maxY: 220 },
          { x: 320, y: 220, vx: 60, vy: 0, minX: 240, maxX: 420, minY: 220, maxY: 220 },
        ],
        keys: { up:0, down:0, left:0, right:0 },
        qrEndTime: 0,
        lives: 3,
        strikes: 0,
        phase: 'going',
        lastTime: 0,
        flash: 0,
        spaceLatch: 0,
      };

      function setLives() {
        livesEl.innerHTML = '';
        for (let i = 0; i < 3; i++) {
          const s = document.createElement('span');
          s.className = 'level3-life' + (i >= p1.lives ? ' lost' : '');
          s.textContent = '♥';
          livesEl.appendChild(s);
        }
      }
      setLives();

      const PLAYER_SPEED = 120;
      const DETECT_RADIUS = 55;       // = радиус видимого красного круга (фейр-плей)
      // QR-таймер. Раньше: 2000ms QR + 800ms cooldown — но патрули медленные
      // (60-90 px/s), могут торчать в радиусе 55px дольше 2 секунд → как только
      // QR гаснет, ментовский штраф срабатывает мгновенно. Теперь:
      //   QR 4с — гарантированно перекрывает время прохода патруля
      //   GRACE 600мс после истечения — даём игроку время выйти из зоны или
      //     заново показать QR без штрафа
      //   COOLDOWN 300мс — почти сразу можно «перезажать» пробел
      const QR_DURATION = 4000;
      const QR_GRACE    = 600;
      const QR_COOLDOWN = 300;
      const RESPAWN_DELAY = 1100;     // пауза после штрафа

      function showGameOver() {
        stopLoop();
        skipRow.innerHTML = '';
        setBubbleText(wrap,
          p1.strikes >= 3
            ? 'Ладно, ладно. Пошли сразу домой. Я тебя не сужу.'
            : 'Поймали. Можно попробовать ещё раз — или дойти сразу домой.'
        );
        const restart = document.createElement('button');
        restart.className = 'btn btn-secondary';
        restart.type = 'button';
        restart.textContent = 'Попробовать снова';
        on(restart, 'click', () => {
          skipRow.innerHTML = '';
          p1.lives = 3;
          p1.player.x = 60; p1.player.y = 270;
          p1.phase = 'going';
          p1.qrEndTime = 0;
          p1.flash = 0;
          setLives();
          setBubbleText(wrap, 'Поехали. Не торопись.');
          startLoop();
        });
        const skip = document.createElement('button');
        skip.className = 'btn btn-primary';
        skip.type = 'button';
        skip.textContent = 'Пропустить часть';
        on(skip, 'click', finishPart1);
        skipRow.appendChild(restart);
        skipRow.appendChild(skip);
      }

      function fineHit() {
        // Тихий «noy» — лёгкое разочарование, не сирена
        AUDIO.play('noy');
        p1.lives--;
        p1.strikes++;
        p1.flash = 1.0;
        setLives();
        stopLoop();
        setBubbleText(wrap, 'Штраф 4000 рублей. Это две вечеринки. Жаль.');
        if (p1.lives <= 0) {
          showGameOver();
        } else {
          later(() => {
            // Респаун зависит от фазы: на пути ТУДА — у дома, на ОБРАТНОМ — у
            // магазина. Иначе при штрафе на возвращении игрок попадает в зону
            // «дома» (x<88, y>240) и checkHome засчитывает уровень мгновенно.
            if (p1.phase === 'returning') {
              p1.player.x = 540; p1.player.y = 270;
            } else {
              p1.player.x = 60; p1.player.y = 270;
            }
            p1.qrEndTime = 0;
            startLoop();
          }, RESPAWN_DELAY);
        }
      }

      function enterShop() {
        if (p1.phase !== 'going') return;
        p1.phase = 'shop';
        stopLoop();
        setBubbleText(wrap, 'Полки пустые. Все ушли в Грузию. Шучу. Все в очереди за гречкой.');
        const overlay = document.createElement('div');
        overlay.className = 'level3-shop-overlay';
        overlay.innerHTML =
          '<div class="level3-shop-inner">' +
          '<h3>Дикси</h3>' +
          '<p>В корзине: вино 🍷 + сулугуни 🧀.</p>' +
          '<p class="level3-shop-hint">→ Теперь обратно домой, той же дорогой. Патрули никуда не делись.</p>' +
          '</div>';
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.type = 'button';
        btn.textContent = 'Идём домой ⟵';
        on(btn, 'click', () => {
          overlay.remove();
          p1.phase = 'returning';
          p1.player.x = 540; p1.player.y = 270;
          setBubbleText(wrap, 'Половина пути позади. Не расслабляйся.');
          startLoop();
        });
        overlay.querySelector('.level3-shop-inner').appendChild(btn);
        stage.appendChild(overlay);
      }

      function checkHome() {
        if (p1.phase === 'returning' && p1.player.x < 88 && p1.player.y > 240) {
          p1.phase = 'done';
          stopLoop();
          setBubbleText(wrap, 'Вернулся. Цел. С продуктами. Маленький герой.');
          later(finishPart1, 1500);
        }
      }

      function finishPart1() {
        AUDIO.play('success');
        progress.part1 = true; saveProgress();
        fadeTo(renderCutscene());
      }

      function tick(t) {
        if (!p1.lastTime) p1.lastTime = t;
        const dt = Math.min(0.05, (t - p1.lastTime) / 1000);
        p1.lastTime = t;

        const k = p1.keys;
        let vx = (k.right - k.left), vy = (k.down - k.up);
        const len = Math.hypot(vx, vy);
        if (len > 0) { vx /= len; vy /= len; }
        p1.player.x = Math.max(10, Math.min(590, p1.player.x + vx * PLAYER_SPEED * dt));
        p1.player.y = Math.max(10, Math.min(310, p1.player.y + vy * PLAYER_SPEED * dt));

        p1.patrols.forEach((pat) => {
          pat.x += pat.vx * dt; pat.y += pat.vy * dt;
          if (pat.x < pat.minX) { pat.x = pat.minX; pat.vx *= -1; }
          if (pat.x > pat.maxX) { pat.x = pat.maxX; pat.vx *= -1; }
          if (pat.y < pat.minY) { pat.y = pat.minY; pat.vy *= -1; }
          if (pat.y > pat.maxY) { pat.y = pat.maxY; pat.vy *= -1; }
        });

        const qrActive = t < p1.qrEndTime;
        const inGrace = !qrActive && t < p1.qrEndTime + QR_GRACE;
        const onCooldown = !qrActive && !inGrace && t < p1.qrEndTime + QR_GRACE + QR_COOLDOWN;
        qrEl.classList.toggle('active', qrActive);
        qrEl.textContent = qrActive
          ? 'QR ✓ (показан)'
          : inGrace ? 'QR ✓ (отпустил)'
          : onCooldown ? 'QR ⌛ (перезарядка)' : 'QR ◻ (пробел)';

        // Предупреждение за пределами фейн-зоны (не слишком далеко).
        // Фейн-зона совпадает с видимым красным кругом — никакого «подойди и постой».
        // В grace-период (600мс после истечения QR) штраф НЕ фейрит — у игрока
        // окно чтобы отбежать или нажать пробел заново.
        let nearWarn = false;
        for (const pat of p1.patrols) {
          const d = Math.hypot(p1.player.x - pat.x, p1.player.y - pat.y);
          if (d < DETECT_RADIUS) {
            if (qrActive || inGrace) continue;
            fineHit();
            return;
          }
          if (d < DETECT_RADIUS + 22 && !qrActive && !inGrace) nearWarn = true;
        }
        if (nearWarn && !p1.warned) {
          setBubbleText(wrap, 'Тревога. Жми пробел!');
          p1.warned = true;
        } else if (!nearWarn) {
          p1.warned = false;
        }

        if (p1.phase === 'going' && p1.player.x > 510 && p1.player.y > 240) enterShop();
        if (p1.phase === 'returning') checkHome();

        draw(ctx, t, qrActive);
        if (p1.flash > 0) p1.flash -= dt * 2.2;

        rafId = requestAnimationFrame(tick);
      }

      function startLoop() {
        p1.lastTime = 0;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      }
      function stopLoop() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }

      function codeToKey(e) {
        const m = {
          ArrowUp:'up', KeyW:'up',
          ArrowDown:'down', KeyS:'down',
          ArrowLeft:'left', KeyA:'left',
          ArrowRight:'right', KeyD:'right',
        };
        return m[e.code];
      }
      on(window, 'keydown', (e) => {
        const k = codeToKey(e);
        if (k) { p1.keys[k] = 1; e.preventDefault(); }
        if (e.code === 'Space') {
          const now = performance.now();
          // В grace-период (сразу после истечения QR) можно сразу перезажать —
          // это даёт игроку шанс выкрутиться, когда патруль ещё в радиусе.
          // Полный cooldown настаёт только ПОСЛЕ grace.
          const inGrace = now < p1.qrEndTime + QR_GRACE && now >= p1.qrEndTime;
          if (inGrace || now >= p1.qrEndTime + QR_GRACE + QR_COOLDOWN) {
            p1.qrEndTime = now + QR_DURATION;
            setBubbleText(wrap, 'QR показан. 4 секунды свободы.');
          }
          e.preventDefault();
        }
      });
      on(window, 'keyup', (e) => {
        const k = codeToKey(e);
        if (k) { p1.keys[k] = 0; e.preventDefault(); }
      });

      // ===== ТАЧ-УПРАВЛЕНИЕ: D-pad + QR-кнопка =====
      function showQrTouch() {
        const now = performance.now();
        const inGrace = now < p1.qrEndTime + QR_GRACE && now >= p1.qrEndTime;
        if (inGrace || now >= p1.qrEndTime + QR_GRACE + QR_COOLDOWN) {
          p1.qrEndTime = now + QR_DURATION;
          setBubbleText(wrap, 'QR показан. 4 секунды свободы.');
        }
      }
      wrap.querySelectorAll('.dpad-btn').forEach((btn) => {
        const dir = btn.dataset.dir;
        const press = (e) => { p1.keys[dir] = 1; e.preventDefault(); };
        const release = (e) => { p1.keys[dir] = 0; e.preventDefault(); };
        on(btn, 'touchstart', press, { passive: false });
        on(btn, 'touchend', release);
        on(btn, 'touchcancel', release);
        on(btn, 'mousedown', press);
        on(btn, 'mouseup', release);
        on(btn, 'mouseleave', release);
      });
      const qrBtn = wrap.querySelector('.dpad-qr');
      if (qrBtn) on(qrBtn, 'click', showQrTouch);

      setBubbleText(wrap, 'Удачи. Я буду наблюдать с подоконника.');
      startLoop();
    }

    function draw(ctx, t, qrActive) {
      const W = 600, H = 320;
      // Дворы
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(0, 0, W, H);
      // Верхние и нижние «здания»
      ctx.fillStyle = '#c9bea1';
      ctx.fillRect(0, 0, W, 50);
      ctx.fillRect(0, H - 22, W, 22);
      // Окна верхних зданий
      ctx.fillStyle = '#a89878';
      for (let x = 20; x < W; x += 60) ctx.fillRect(x, 16, 22, 18);
      // Тротуар-разметка
      ctx.fillStyle = '#d0bf9b';
      ctx.fillRect(0, 200, W, 30);
      ctx.fillStyle = '#fff';
      for (let x = 10; x < W; x += 26) ctx.fillRect(x, 213, 14, 3);

      // Дом
      ctx.fillStyle = '#9b5a3c';
      ctx.fillRect(20, 232, 60, 58);
      ctx.fillStyle = '#3d4f3a';
      ctx.fillRect(40, 264, 22, 26);
      ctx.fillStyle = '#faf3e3';
      ctx.font = 'bold 10px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ДОМ', 50, 254);

      // Магазин
      ctx.fillStyle = '#d65a3c';
      ctx.fillRect(510, 232, 80, 58);
      ctx.fillStyle = '#faf3e3';
      ctx.fillText('ДИКСИ', 550, 254);
      ctx.fillStyle = '#3d4f3a';
      ctx.fillRect(540, 264, 22, 26);

      // Патрули
      p1.patrols.forEach((pat) => {
        // Радиус обнаружения = ровно тот, при пересечении которого выписывают штраф.
        // QR активен — зелёный (безопасно), иначе — красный (заходить нельзя).
        ctx.fillStyle = qrActive ? 'rgba(61,79,58,0.16)' : 'rgba(214,90,60,0.18)';
        ctx.beginPath();
        ctx.arc(pat.x, pat.y, 55, 0, Math.PI * 2);
        ctx.fill();
        // Контур для чёткости границы
        ctx.strokeStyle = qrActive ? 'rgba(61,79,58,0.55)' : 'rgba(214,90,60,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pat.x, pat.y, 55, 0, Math.PI * 2);
        ctx.stroke();
        // Туловище
        ctx.fillStyle = '#2a3d5e';
        ctx.fillRect(pat.x - 7, pat.y - 6, 14, 16);
        // Голова
        ctx.fillStyle = '#e8c098';
        ctx.beginPath(); ctx.arc(pat.x, pat.y - 11, 5, 0, Math.PI * 2); ctx.fill();
        // Фуражка
        ctx.fillStyle = '#1a2840';
        ctx.fillRect(pat.x - 5, pat.y - 16, 10, 4);
        ctx.fillRect(pat.x - 6, pat.y - 13, 12, 2);
      });

      // Игрок
      const p = p1.player;
      ctx.fillStyle = '#c97b5a';
      ctx.fillRect(p.x - 6, p.y - 4, 12, 14);
      ctx.fillStyle = '#f4d3a8';
      ctx.beginPath(); ctx.arc(p.x, p.y - 9, 5, 0, Math.PI * 2); ctx.fill();

      // QR над игроком
      if (qrActive) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x - 10, p.y - 30, 20, 16);
        ctx.fillStyle = '#000';
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          if (((i * 3 + j + i) % 3) !== 0) ctx.fillRect(p.x - 9 + i * 5, p.y - 29 + j * 5, 4, 4);
        }
      }

      // Вспышка штрафа
      if (p1.flash > 0) {
        ctx.fillStyle = 'rgba(214,90,60,' + (p1.flash * 0.5) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ============== КАТСЦЕНА: ПЛАН НА СТЕНЕ ==============
    function renderCutscene() {
      const wrap = document.createElement('div');
      wrap.className = 'level3-cutscene';

      const h = document.createElement('h3');
      h.className = 'level3-cutscene-h';
      h.textContent = 'Дома. Можно выдохнуть.';
      wrap.appendChild(h);

      wrap.appendChild(buildPlan());

      wrap.appendChild(buildBubble(
        'Сегодня — День 98. День Грузии. Им нужно подготовиться. Им нужно найти всё, что нужно для грузинского вечера. Помоги.'
      ));

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Начать поиск';
      on(btn, 'click', () => fadeTo(renderPart2()));
      wrap.appendChild(btn);

      return wrap;
    }

    function buildPlan() {
      const plan = document.createElement('div');
      plan.className = 'level3-plan';
      const tapeL = document.createElement('span'); tapeL.className = 'level3-plan-tape left'; plan.appendChild(tapeL);
      const tapeR = document.createElement('span'); tapeR.className = 'level3-plan-tape right'; plan.appendChild(tapeR);
      const h = document.createElement('h4');
      h.className = 'level3-plan-h';
      h.textContent = 'Карантин — план спасения';
      plan.appendChild(h);
      const items = [
        { day: 96, name: 'День Японии', status: 'done' },
        { day: 97, name: 'День Французского кино', status: 'done' },
        { day: 98, name: 'ДЕНЬ ГРУЗИИ', status: 'now' },
        { day: 99, name: 'День Италии', status: 'next' },
        { day: 100, name: 'ЮБИЛЕЙ', status: 'next' },
      ];
      const ul = document.createElement('ul');
      ul.className = 'level3-plan-list';
      items.forEach((it, idx) => {
        const li = document.createElement('li');
        li.className = 'level3-plan-item level3-plan-' + it.status;
        li.style.setProperty('--row-index', String(idx));
        const mark = it.status === 'done' ? '✓' : it.status === 'now' ? '←' : '·';
        li.innerHTML =
          '<span class="level3-plan-mark">' + mark + '</span>' +
          '<span class="level3-plan-day">День ' + it.day + ':</span> ' +
          '<span class="level3-plan-name">' + it.name + '</span>' +
          (it.status === 'now' ? '<span class="level3-plan-here">мы здесь</span>' : '');
        ul.appendChild(li);
      });
      plan.appendChild(ul);
      return plan;
    }

    // ============== ЧАСТЬ 2: ПОИСК ПРЕДМЕТОВ ==============
    let idleTimer = null;

    function renderPart2() {
      const wrap = document.createElement('div');
      wrap.className = 'level3-part2';

      wrap.appendChild(buildBubble(
        'Многое спрятано: открой холодильник и шкафчики. Кликай, что найдёшь. Не всё подойдёт — будут и предметы с других дней.'
      ));

      const stage = document.createElement('div');
      stage.className = 'level3-stage';

      const scene = buildPart2Scene();
      stage.appendChild(scene);

      const aside = document.createElement('div');
      aside.className = 'level3-checklist';
      const aHead = document.createElement('div');
      aHead.className = 'level3-checklist-h';
      aHead.innerHTML = 'Найти <span class="level3-checklist-count">' +
        progress.found.length + ' / ' + ITEMS.length + '</span>';
      aside.appendChild(aHead);
      const aList = document.createElement('ul');
      aList.className = 'level3-checklist-list';
      ITEMS.forEach((it) => {
        const li = document.createElement('li');
        li.className = 'level3-checklist-item';
        li.dataset.itemId = it.id;
        li.innerHTML = '<span class="check">·</span> <span class="name">' + it.name + '</span>';
        if (progress.found.includes(it.id)) {
          li.classList.add('found');
          li.querySelector('.check').textContent = '✓';
        }
        aList.appendChild(li);
      });
      aside.appendChild(aList);
      stage.appendChild(aside);

      wrap.appendChild(stage);

      // Подвязка кликов: контейнеры (двери), реальные предметы, декои
      scene.querySelectorAll('.level3-container').forEach((c) => {
        const door = c.querySelector('.level3-container-door');
        if (!door) return;
        on(door, 'click', () => {
          c.classList.add('open');
          const hint = c.dataset.openHint;
          if (hint) setBubbleText(wrap, hint);
        });
      });

      const spots = scene.querySelectorAll('[data-item-id]');
      spots.forEach((s) => {
        const id = s.dataset.itemId;
        if (progress.found.includes(id)) s.classList.add('found');
        on(s, 'click', () => {
          findItem(id, s, aList, aHead, wrap, spots);
          // Сбросить фокус, чтобы предмет не «залипал» подсвеченным.
          if (s.blur) s.blur();
        });
      });

      scene.querySelectorAll('[data-decoy-id]').forEach((d) => {
        on(d, 'click', () => {
          AUDIO.play('error');
          const id = d.dataset.decoyId;
          const dec = DECOYS.find((x) => x.id === id);
          if (dec) setBubbleText(wrap, '✗ Не та тема. ' + dec.quote);
          flashBubble(wrap, 'wrong');
          d.classList.add('shake');
          later(() => d.classList.remove('shake'), 450);
          if (d.blur) d.blur();
        });
      });

      kickIdleHint(spots, wrap);
      return wrap;
    }

    function kickIdleHint(spots, wrap) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = later(() => {
        const remaining = Array.from(spots).filter(
          (s) => !progress.found.includes(s.dataset.itemId)
        );
        if (!remaining.length) return;
        const pick = remaining[Math.floor(Math.random() * remaining.length)];
        pick.classList.add('hint');
        setBubbleText(wrap, 'Подсказка где-то у «' +
          (ITEMS.find((it) => it.id === pick.dataset.itemId)?.name || '?') + '».');
        later(() => pick.classList.remove('hint'), 2200);
        kickIdleHint(spots, wrap);
      }, 60000);
    }

    function flashBubble(wrap, kind) {
      const b = wrap.querySelector('.level3-bubble');
      if (!b) return;
      b.classList.remove('bubble-correct', 'bubble-wrong');
      // принудительный reflow, чтобы анимация запустилась повторно
      void b.offsetWidth;
      b.classList.add(kind === 'wrong' ? 'bubble-wrong' : 'bubble-correct');
      later(() => b.classList.remove('bubble-correct', 'bubble-wrong'), 800);
    }

    function findItem(id, el, listEl, headEl, wrap, allSpots) {
      if (progress.found.includes(id)) return;
      AUDIO.play('success');
      progress.found.push(id);
      saveProgress();
      el.classList.add('found');
      const li = listEl.querySelector('li[data-item-id="' + id + '"]');
      if (li) {
        li.classList.add('found');
        li.querySelector('.check').textContent = '✓';
      }
      const countEl = headEl.querySelector('.level3-checklist-count');
      if (countEl) countEl.textContent = progress.found.length + ' / ' + ITEMS.length;
      const it = ITEMS.find((i) => i.id === id);
      if (it) setBubbleText(wrap, '✓ ' + it.name + '. ' + it.quote);
      flashBubble(wrap, 'correct');
      kickIdleHint(allSpots, wrap);
      if (progress.found.length >= ITEMS.length) {
        progress.part2 = true; saveProgress();
        later(() => fadeTo(renderFinal()), 1800);
      }
    }

    function buildPart2Scene() {
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const root = document.createElement('div');
      root.className = 'level3-scene';
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'level3-scene-svg');
      svg.setAttribute('viewBox', '0 0 600 380');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      const ns = SVG_NS;
      const mk = (tag, attrs) => {
        const e = document.createElementNS(ns, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        return e;
      };
      const add = (parent, tag, attrs, txt) => {
        const e = mk(tag, attrs);
        if (txt != null) e.textContent = txt;
        parent.appendChild(e);
        return e;
      };

      // ----- Фон: стена + пол + плинтус -----
      add(svg, 'rect', { x:0, y:0, width:600, height:290, fill:'#f4ead4' });
      add(svg, 'rect', { x:0, y:290, width:600, height:90, fill:'#b89968' });
      add(svg, 'rect', { x:0, y:290, width:600, height:3, fill:'#7a5a3a' });

      // ----- Окно (справа-сверху) -----
      add(svg, 'rect', { x:430, y:24, width:140, height:96, fill:'#cce8e0', stroke:'#2e3d35', 'stroke-width':2 });
      add(svg, 'path', { d:'M 500 24 L 500 120 M 430 72 L 570 72', stroke:'#2e3d35', 'stroke-width':2, fill:'none' });
      add(svg, 'rect', { x:424, y:120, width:152, height:8, fill:'#e8d6a8', stroke:'#a8814f' });
      // Декоративное растение на подоконнике (не интерактив)
      add(svg, 'rect', { x:540, y:112, width:14, height:8, fill:'#8a5a3c' });
      [[-3,-3],[3,-2],[0,-5]].forEach(([dx,dy]) => {
        add(svg, 'circle', { cx:547 + dx, cy:112 + dy, r:3, fill:'#4b6a3a' });
      });

      // ----- План карантина на стене (всегда виден) -----
      const planG = add(svg, 'g', { transform:'translate(330, 22) rotate(-2 32 31)' });
      // Скотч-уголки
      add(planG, 'rect', { x:-3, y:-4, width:14, height:6, fill:'rgba(255,240,180,0.7)', stroke:'rgba(220,200,140,0.6)' });
      add(planG, 'rect', { x:53, y:-4, width:14, height:6, fill:'rgba(255,240,180,0.7)', stroke:'rgba(220,200,140,0.6)' });
      add(planG, 'rect', { width:64, height:62, fill:'#fff', stroke:'#d8c79a' });
      for (let y = 6; y < 62; y += 7) {
        add(planG, 'line', { x1:0, y1:y, x2:64, y2:y, stroke:'#e6dec5', 'stroke-width':0.6 });
      }
      add(planG, 'text', { x:32, y:11, 'font-size':5.5, 'text-anchor':'middle',
        'font-weight':'700', fill:'#2e3d35' }, 'КАРАНТИН');
      const planLines = [
        ['96: Япония', '✓', '#888'],
        ['97: Франция', '✓', '#888'],
        ['98: ГРУЗИЯ', '←', '#c97b5a'],
        ['99: Италия', '·', '#444'],
        ['100: ЮБИЛЕЙ', '·', '#444'],
      ];
      planLines.forEach((ln, i) => {
        add(planG, 'text', { x:4, y:22 + i * 7, 'font-size':4.8, fill:ln[2],
          'font-weight': i === 2 ? '700' : '400' }, ln[0]);
        add(planG, 'text', { x:60, y:22 + i * 7, 'font-size':5, 'text-anchor':'end', fill:ln[2] }, ln[1]);
      });

      // ----- Кухонная стойка (центр) -----
      add(svg, 'rect', { x:110, y:240, width:200, height:50, fill:'#c9a168' });
      add(svg, 'rect', { x:110, y:240, width:200, height:5, fill:'#a88550' });

      // ----- Диван -----
      add(svg, 'rect', { x:320, y:240, width:150, height:50, fill:'#9b6a4f', rx:6 });
      add(svg, 'rect', { x:320, y:220, width:150, height:26, fill:'#a87659', rx:4 });
      add(svg, 'rect', { x:340, y:228, width:50, height:46, fill:'#3d4f3a', opacity:0.7, rx:2 });

      // ----- Журнальный столик -----
      add(svg, 'rect', { x:480, y:260, width:100, height:30, fill:'#7a5a3a', rx:2 });
      add(svg, 'rect', { x:482, y:288, width:4, height:14, fill:'#5a3a22' });
      add(svg, 'rect', { x:574, y:288, width:4, height:14, fill:'#5a3a22' });

      // (На стене раньше висела папаха на крючке — переехала в шкаф ниже.)

      // ===== ХОТСПОТЫ (helpers) =====
      // Структура: <g translate><g hotspot><rect hit/><g scale><shapes/></g></g></g>
      // Контейнер с дверцей — родителем `inside` группа.
      const spot = (id, x, y, render, opts) => {
        opts = opts || {};
        const outer = mk('g', { transform:'translate(' + x + ',' + y + ')' });
        const inner = mk('g', {
          class:'level3-hotspot' + (opts.decoy ? ' decoy' : ''),
          role:'button',
          tabindex:'0',
        });
        inner.setAttribute(opts.decoy ? 'data-decoy-id' : 'data-item-id', id);
        // Hit-rect компактнее (38×38), чтобы зоны клика близких предметов
        // не перекрывались (раньше при 56×52 wine и candles ловили оба).
        const hit = mk('rect', {
          class:'level3-hit',
          x:-19, y:-19, width:38, height:38,
          fill:'none',
        });
        inner.appendChild(hit);
        const visual = mk('g', { transform:'scale(1.6)' });
        render(visual);
        inner.appendChild(visual);
        outer.appendChild(inner);
        (opts.parent || svg).appendChild(outer);
        // ВАЖНО: гасим фокус на мышиный клик — иначе браузер автоскроллит
        // страницу, чтобы вывести SVG-элемент с tabindex=0 в видимую часть,
        // и картинка дёргается «ближе-дальше» при каждом клике.
        inner.addEventListener('mousedown', (e) => e.preventDefault());
        return inner;
      };

      // ===== Renderers — отдельно, чтобы переиспользовать =====
      const renderSuluguni = (g) => {
        add(g, 'polygon', { points:'-10,2 10,2 8,-6 -8,-6', fill:'#fff8dc', stroke:'#cbb98a' });
        add(g, 'circle', { cx:-4, cy:-1, r:1.5, fill:'#e8e0b8' });
        add(g, 'circle', { cx:3, cy:-2, r:1.2, fill:'#e8e0b8' });
        add(g, 'circle', { cx:1, cy:1, r:1.0, fill:'#e8e0b8' });
      };
      const renderCilantro = (g) => {
        add(g, 'rect', { x:-8, y:0, width:16, height:8, fill:'#8a5a3c' });
        [[-6,-4],[-2,-7],[3,-6],[6,-3],[0,-9],[-4,-9],[4,-9]].forEach(([dx,dy]) => {
          add(g, 'circle', { cx:dx, cy:dy, r:2.6, fill:'#4b6a3a' });
        });
      };
      const renderGlasses = (g) => {
        [-5, 5].forEach((dx) => {
          add(g, 'path', { d:'M ' + (dx - 4) + ' -8 L ' + (dx + 4) + ' -8 L ' + dx + ' 0 Z',
            fill:'#e6f1ed', stroke:'#3d4f3a', 'stroke-width':0.6 });
          add(g, 'rect', { x:dx - 0.6, y:0, width:1.2, height:6, fill:'#3d4f3a' });
          add(g, 'rect', { x:dx - 3, y:6, width:6, height:1, fill:'#3d4f3a' });
        });
      };
      const renderKhmeli = (g) => {
        add(g, 'rect', { x:-5, y:-10, width:10, height:14, fill:'#d6c9ac', stroke:'#8c6a3a' });
        add(g, 'rect', { x:-5, y:-12, width:10, height:2, fill:'#5a3a22' });
        add(g, 'rect', { x:-4, y:-6, width:8, height:5, fill:'#faf3e3' });
        add(g, 'text', { x:0, y:-2, 'font-size':3.5, 'text-anchor':'middle', fill:'#5a3a22' }, 'хмели');
      };
      // ----- Декои -----
      const renderSushi = (g) => {
        // Рисовый цилиндр + ломтик лосося + полоска нори
        add(g, 'rect', { x:-7, y:-3, width:14, height:7, fill:'#fafafa', stroke:'#cbb98a', rx:1 });
        add(g, 'rect', { x:-7, y:-6, width:14, height:3, fill:'#f4a8a8', rx:1 });
        add(g, 'rect', { x:-7, y:-1, width:14, height:2, fill:'#2a2520', opacity:0.85 });
      };
      const renderChopsticks = (g) => {
        // Две тонкие палочки наискосок
        add(g, 'rect', { x:-7, y:0, width:14, height:1.2, fill:'#d6b88a', stroke:'#8c6a3a',
          transform:'rotate(-18)' });
        add(g, 'rect', { x:-7, y:3, width:14, height:1.2, fill:'#d6b88a', stroke:'#8c6a3a',
          transform:'rotate(-18)' });
      };
      const renderPasta = (g) => {
        // Тарелочка с спагетти
        add(g, 'ellipse', { cx:0, cy:0, rx:10, ry:3.5, fill:'#fff', stroke:'#cbb98a' });
        add(g, 'path', { d:'M -7 -1 q 3 -3 7 0 t 7 0', stroke:'#f4e0a8', 'stroke-width':1.2, fill:'none' });
        add(g, 'path', { d:'M -6 1 q 3 -3 7 0 t 6 0', stroke:'#f4d680', 'stroke-width':1.2, fill:'none' });
      };

      // ===== КОНТЕЙНЕР: ХОЛОДИЛЬНИК =====
      const fridge = mk('g', {
        class:'level3-container',
        'data-container':'fridge',
        'data-open-hint':'Холодно. Хорошо для сыра и зелени.',
      });
      // ВНУТРЕННОСТЬ (видна, когда дверца открыта)
      const fridgeInside = mk('g', { class:'level3-container-inside' });
      add(fridgeInside, 'rect', { x:22, y:122, width:76, height:166, fill:'#dbe7e2' });
      add(fridgeInside, 'line', { x1:22, y1:178, x2:98, y2:178, stroke:'#a8b9b3', 'stroke-width':1 });
      add(fridgeInside, 'line', { x1:22, y1:228, x2:98, y2:228, stroke:'#a8b9b3', 'stroke-width':1 });
      fridge.appendChild(fridgeInside);
      // Предметы внутри
      spot('suluguni', 60, 160, renderSuluguni, { parent: fridgeInside });
      spot('cilantro', 60, 215, renderCilantro, { parent: fridgeInside });
      spot('sushi',    60, 265, renderSushi,    { parent: fridgeInside, decoy: true });
      // ДВЕРЦА (поверх, скрывает внутренности)
      const fridgeDoor = mk('g', { class:'level3-container-door' });
      add(fridgeDoor, 'rect', { x:20, y:120, width:80, height:170, fill:'#f0ede4', stroke:'#aaa9a0', 'stroke-width':1.5 });
      add(fridgeDoor, 'rect', { x:20, y:200, width:80, height:2, fill:'#aaa9a0' });
      add(fridgeDoor, 'rect', { x:92, y:140, width:4, height:14, fill:'#888' });
      add(fridgeDoor, 'rect', { x:92, y:210, width:4, height:14, fill:'#888' });
      // декоративный «магнит»
      add(fridgeDoor, 'rect', { x:32, y:148, width:14, height:10, fill:'#c97b5a', rx:1, opacity:0.8 });
      fridge.appendChild(fridgeDoor);
      svg.appendChild(fridge);

      // ===== КОНТЕЙНЕР: ЛЕВЫЙ ШКАФЧИК =====
      const cabL = mk('g', {
        class:'level3-container',
        'data-container':'cabinet-left',
        'data-open-hint':'Бабушкин сервант. Достали ради такого дня.',
      });
      const cabLInside = mk('g', { class:'level3-container-inside' });
      add(cabLInside, 'rect', { x:112, y:132, width:96, height:66, fill:'#a07a55' });
      add(cabLInside, 'line', { x1:112, y1:165, x2:208, y2:165, stroke:'#7a5a3a', 'stroke-width':0.8 });
      cabL.appendChild(cabLInside);
      spot('glasses',    140, 175, renderGlasses,    { parent: cabLInside });
      spot('chopsticks', 185, 178, renderChopsticks, { parent: cabLInside, decoy: true });
      const cabLDoor = mk('g', { class:'level3-container-door' });
      add(cabLDoor, 'rect', { x:110, y:130, width:100, height:70, fill:'#d6b88a', stroke:'#8c6a3a' });
      add(cabLDoor, 'rect', { x:200, y:160, width:4, height:8, fill:'#5a3a22' });
      cabL.appendChild(cabLDoor);
      svg.appendChild(cabL);

      // ===== КОНТЕЙНЕР: ПРАВЫЙ ШКАФЧИК =====
      const cabR = mk('g', {
        class:'level3-container',
        'data-container':'cabinet-right',
        'data-open-hint':'Полка со специями. Что-то нужное, что-то — с другого вечера.',
      });
      const cabRInside = mk('g', { class:'level3-container-inside' });
      add(cabRInside, 'rect', { x:212, y:132, width:96, height:66, fill:'#a07a55' });
      add(cabRInside, 'line', { x1:212, y1:165, x2:308, y2:165, stroke:'#7a5a3a', 'stroke-width':0.8 });
      cabR.appendChild(cabRInside);
      spot('khmeli', 240, 175, renderKhmeli, { parent: cabRInside });
      spot('pasta',  282, 180, renderPasta,  { parent: cabRInside, decoy: true });
      const cabRDoor = mk('g', { class:'level3-container-door' });
      add(cabRDoor, 'rect', { x:210, y:130, width:100, height:70, fill:'#d6b88a', stroke:'#8c6a3a' });
      add(cabRDoor, 'rect', { x:216, y:160, width:4, height:8, fill:'#5a3a22' });
      cabR.appendChild(cabRDoor);
      svg.appendChild(cabR);

      // ===== ВИДИМЫЕ ПРЕДМЕТЫ (не в контейнерах) =====
      // 1. Бутылка вина — на журнальном столике
      spot('wine', 510, 230, (g) => {
        add(g, 'rect', { x:-4, y:-2, width:8, height:24, fill:'#3d4f3a' });
        add(g, 'rect', { x:-3, y:-8, width:6, height:8, fill:'#3d4f3a' });
        add(g, 'rect', { x:-2, y:-12, width:4, height:5, fill:'#5a3a22' });
        add(g, 'rect', { x:-3, y:6, width:6, height:5, fill:'#faf3e3', opacity:0.6 });
      });

      // 2. Хинкали — тарелка на стойке
      spot('hinkali', 155, 234, (g) => {
        add(g, 'ellipse', { cx:0, cy:2, rx:18, ry:4, fill:'#faf3e3', stroke:'#cbb98a' });
        [-8, 0, 8].forEach((dx) => {
          add(g, 'circle', { cx:dx, cy:-2, r:4, fill:'#f4ead4', stroke:'#8c6a3a' });
          add(g, 'path', { d:'M ' + (dx - 2) + ' -4 Q ' + dx + ' -6 ' + (dx + 2) + ' -4',
            stroke:'#8c6a3a', fill:'none', 'stroke-width':0.6 });
        });
      });

      // 5. Скалка + мука — на стойке
      spot('flour', 250, 232, (g) => {
        add(g, 'rect', { x:-14, y:0, width:28, height:5, fill:'#d6b88a', stroke:'#8c6a3a', rx:2 });
        add(g, 'rect', { x:-18, y:1, width:4, height:3, fill:'#8c6a3a' });
        add(g, 'rect', { x:14, y:1, width:4, height:3, fill:'#8c6a3a' });
        add(g, 'ellipse', { cx:6, cy:-4, rx:9, ry:3, fill:'#faf3e3', opacity:0.85 });
        add(g, 'ellipse', { cx:0, cy:-5, rx:5, ry:2.4, fill:'#faf3e3', opacity:0.9 });
      });

      // 6. Колонка — НА холодильнике
      spot('speaker', 60, 108, (g) => {
        add(g, 'rect', { x:-7, y:-12, width:14, height:18, fill:'#1a1a1a', stroke:'#000', rx:1 });
        add(g, 'circle', { cx:0, cy:-7, r:2.5, fill:'#333' });
        add(g, 'circle', { cx:0, cy:-7, r:1, fill:'#666' });
        add(g, 'circle', { cx:0, cy:1, r:3.5, fill:'#333' });
        add(g, 'circle', { cx:0, cy:1, r:1.5, fill:'#666' });
      });

      // 7. Свечи — на журнальном столике
      spot('candles', 550, 250, (g) => {
        [-6, 6].forEach((dx) => {
          add(g, 'rect', { x:dx - 1.5, y:0, width:3, height:14, fill:'#e8d6a8' });
          add(g, 'path', { d:'M ' + dx + ' -2 q -1 -3 0 -5 q 1 2 0 5 Z',
            fill:'#f4b53c', stroke:'#c97b5a', 'stroke-width':0.5 });
        });
      });

      // ===== КОНТЕЙНЕР: ШКАФ С ОДЕЖДОЙ (на стене над диваном) =====
      const wardrobe = mk('g', {
        class:'level3-container',
        'data-container':'wardrobe',
        'data-open-hint':'Стенной шкафчик. Сюда складывали то, что не понадобится. Подозреваю — наоборот.',
      });
      const wardrobeInside = mk('g', { class:'level3-container-inside' });
      // Внутренний фон шкафа — тёмный прямоугольник
      add(wardrobeInside, 'rect', { x:175, y:24, width:80, height:96, fill:'#5a3a22' });
      add(wardrobeInside, 'rect', { x:175, y:24, width:80, height:3, fill:'#3a2210' });
      // Перекладина внутри шкафа
      add(wardrobeInside, 'rect', { x:178, y:46, width:74, height:1.5, fill:'#cbb98a' });
      wardrobe.appendChild(wardrobeInside);
      // Грузинская папаха — высокая белая, из кудряшек овечьей шерсти. Висит в шкафу.
      spot('hat', 215, 86, (g) => {
        // Околыш — нижняя полоса
        add(g, 'path', { d:'M -11 1 L 11 1 L 11 4 L -11 4 Z', fill:'#f4ead4', stroke:'#cbb98a', 'stroke-width':0.6 });
        // Купол — внешний контур шапки (высокий, чуть скруглённый сверху)
        add(g, 'path', { d:'M -11 1 Q -12 -14 0 -17 Q 12 -14 11 1 Z',
          fill:'#faf3e3', stroke:'#cbb98a', 'stroke-width':0.6 });
        // Кудряшки — много маленьких кругов поверх купола (имитация овечьей шерсти)
        const curls = [
          [-8, -2, 2.4], [-4, -3, 2.3], [0, -3.5, 2.5], [4, -3, 2.3], [8, -2, 2.4],
          [-6, -7, 2.2], [-2, -8, 2.3], [2, -8, 2.3], [6, -7, 2.2],
          [-3, -12, 2.0], [0, -13, 2.1], [3, -12, 2.0],
          [-9, -5, 1.8], [9, -5, 1.8],
        ];
        curls.forEach(([cx, cy, r]) => {
          add(g, 'circle', { cx:cx, cy:cy, r:r, fill:'#faf3e3', stroke:'#d8c79a', 'stroke-width':0.4 });
        });
      }, { parent: wardrobeInside });
      // ДВЕРЦЫ шкафа (две створки)
      const wardrobeDoor = mk('g', { class:'level3-container-door' });
      add(wardrobeDoor, 'rect', { x:175, y:22, width:80, height:100, fill:'#a07a55', stroke:'#7a5a3a', 'stroke-width':1 });
      // Линия разделения створок
      add(wardrobeDoor, 'rect', { x:214, y:24, width:1.5, height:96, fill:'#7a5a3a' });
      // Ручки
      add(wardrobeDoor, 'rect', { x:208, y:68, width:2.5, height:8, fill:'#3a2210', rx:1 });
      add(wardrobeDoor, 'rect', { x:219, y:68, width:2.5, height:8, fill:'#3a2210', rx:1 });
      // Декоративная филёнка
      add(wardrobeDoor, 'rect', { x:181, y:30, width:28, height:84, fill:'none', stroke:'#7a5a3a', 'stroke-width':0.6, rx:1 });
      add(wardrobeDoor, 'rect', { x:221, y:30, width:28, height:84, fill:'none', stroke:'#7a5a3a', 'stroke-width':0.6, rx:1 });
      wardrobe.appendChild(wardrobeDoor);
      svg.appendChild(wardrobe);

      root.appendChild(svg);
      return root;
    }

    // ============== ФИНАЛ УРОВНЯ ==============
    function renderFinal() {
      // Финал уровня — грузинская мелодия (только в этом уровне).
      // Зацикленно, fade-in 1.5с. Гасится по клику «Дальше» и в unmount.
      AUDIO.playLoop('georgia', { volume: 0.4, fadeIn: 1500 });
      const wrap = document.createElement('div');
      wrap.className = 'level3-final';

      const room = document.createElement('div');
      room.className = 'level3-final-room';
      room.innerHTML =
        '<svg viewBox="0 0 600 260" class="level3-final-svg" preserveAspectRatio="xMidYMid meet">' +
        '<rect width="600" height="180" fill="#3a2a18"/>' +
        '<rect y="180" width="600" height="80" fill="#5a3a22"/>' +
        // окно с ночным небом
        '<rect x="430" y="20" width="140" height="80" fill="#1a2840" stroke="#4a3a22"/>' +
        '<circle cx="540" cy="50" r="14" fill="#f4ead4" opacity="0.85"/>' +
        '<circle cx="475" cy="40" r="1" fill="#fff"/>' +
        '<circle cx="490" cy="60" r="1" fill="#fff"/>' +
        '<circle cx="510" cy="35" r="1" fill="#fff"/>' +
        // тёплый круг от свечей
        '<ellipse cx="300" cy="170" rx="220" ry="78" fill="#f4b53c" opacity="0.18"/>' +
        // СТОЛ — уже, чтобы пара сидела ближе
        '<rect x="230" y="180" width="140" height="14" fill="#8c6a3a"/>' +
        '<rect x="236" y="194" width="6" height="40" fill="#5a3a22"/>' +
        '<rect x="358" y="194" width="6" height="40" fill="#5a3a22"/>' +
        // свечи
        '<g class="level3-final-candle" transform="translate(258,168)">' +
          '<rect x="-2" y="0" width="4" height="14" fill="#e8d6a8"/>' +
          '<path d="M 0 -2 q -2 -4 0 -7 q 2 3 0 7 Z" fill="#f4b53c"/>' +
          '<circle cx="0" cy="-3" r="6" fill="#f4b53c" opacity="0.4"/>' +
        '</g>' +
        '<g class="level3-final-candle" transform="translate(342,168)">' +
          '<rect x="-2" y="0" width="4" height="14" fill="#e8d6a8"/>' +
          '<path d="M 0 -2 q -2 -4 0 -7 q 2 3 0 7 Z" fill="#f4b53c"/>' +
          '<circle cx="0" cy="-3" r="6" fill="#f4b53c" opacity="0.4"/>' +
        '</g>' +
        // тарелка с хинкали
        '<ellipse cx="300" cy="184" rx="22" ry="4" fill="#faf3e3"/>' +
        '<circle cx="290" cy="180" r="4" fill="#f4ead4" stroke="#8c6a3a" stroke-width="0.5"/>' +
        '<circle cx="300" cy="180" r="4" fill="#f4ead4" stroke="#8c6a3a" stroke-width="0.5"/>' +
        '<circle cx="310" cy="180" r="4" fill="#f4ead4" stroke="#8c6a3a" stroke-width="0.5"/>' +
        // бокалы по краям
        '<path d="M 274 178 L 284 178 L 279 184 Z" fill="#9b6a4f"/>' +
        '<rect x="278" y="184" width="2" height="6" fill="#3d4f3a"/>' +
        '<path d="M 316 178 L 326 178 L 321 184 Z" fill="#9b6a4f"/>' +
        '<rect x="320" y="184" width="2" height="6" fill="#3d4f3a"/>' +
        // ===== ИЛЬЯ (слева) =====
        // блондин с очками, в светло-серой кофте Lacoste
        '<g transform="translate(195,160)">' +
          '<ellipse cx="0" cy="38" rx="22" ry="7" fill="#222" opacity="0.5"/>' + // тень
          '<rect x="-15" y="0" width="30" height="44" fill="#c8c8c8" rx="5"/>' + // серая кофта
          '<path d="M -3 0 L 0 18 L 3 0 Z" fill="#3a3a3a"/>' + // тёмный воротник под молнией
          '<line x1="0" y1="0" x2="0" y2="18" stroke="#888" stroke-width="0.6"/>' + // молния
          '<circle cx="0" cy="-10" r="11" fill="#f4d3a8"/>' + // лицо
          // короткие светлые волосы, чуть взъерошены
          '<path d="M -10 -16 Q -2 -23 10 -19 Q 11 -14 7 -13 Q 4 -16 -2 -14 Q -7 -16 -10 -12 Z" fill="#d8b878"/>' +
          '<path d="M 7 -19 Q 9 -23 5 -22" fill="none" stroke="#d8b878" stroke-width="1.5"/>' +
          // круглые очки
          '<circle cx="-4" cy="-9" r="2.7" fill="#fff" stroke="#2a2520" stroke-width="0.9"/>' +
          '<circle cx="4" cy="-9" r="2.7" fill="#fff" stroke="#2a2520" stroke-width="0.9"/>' +
          '<line x1="-1.3" y1="-9" x2="1.3" y2="-9" stroke="#2a2520" stroke-width="0.9"/>' +
          // глаза за очками
          '<circle cx="-4" cy="-9" r="0.7" fill="#3a5a78"/>' +
          '<circle cx="4" cy="-9" r="0.7" fill="#3a5a78"/>' +
          // улыбка
          '<path d="M -3 -4 Q 0 -1.5 3 -4" fill="none" stroke="#5a3a22" stroke-width="0.9" stroke-linecap="round"/>' +
        '</g>' +
        // ===== ВЕРА (справа) =====
        // ПЛОСКАЯ ИКОНКА: голова + волосы — ОДИН силуэт без обводки.
        // Длинный хвост волос идёт продолжением головы вниз по правому плечу.
        // Внутри силуэта — овал лица (телесный) и минимум деталей.
        '<g transform="translate(405,160)">' +
          '<ellipse cx="0" cy="42" rx="22" ry="6" fill="#222" opacity="0.4"/>' +
          // ПЛАТЬЕ — синий треугольник, без обводки
          '<path d="M -9 -2 L -9 16 L -17 42 L 17 42 L 9 16 L 9 -2 Z" fill="#2e4a8c"/>' +
          // Розовый пояс
          '<rect x="-9" y="15" width="18" height="2.4" fill="#e85c8c"/>' +
          // ===== ВОЛОСЫ + ГОЛОВА — ЕДИНЫЙ КОНТУР =====
          // Один path, без stroke. Обходит всю голову, продолжается вниз
          // по правой стороне как длинный хвост, возвращается через подбородок.
          // Точки выбраны так, чтобы силуэт был выпуклым, без вмятин.
          '<path d="' +
            'M -11 -2 ' +                  // левый край челюсти у плеча
            'C -14 -14 -14 -28 0 -28 ' +   // вверх и через макушку
            'C 14 -28 14 -14 11 -2 ' +     // правая сторона головы вниз к плечу
            'C 14 8 17 20 16 30 ' +        // волосы плавно расходятся в хвост
            'C 15 38 12 42 8 42 ' +        // кончик хвоста у подола
            'L 4 42 ' +
            'C 5 34 6 24 5 14 ' +          // внутренняя сторона хвоста назад вверх
            'C 4 6 3 2 2 0 ' +             // возврат к правой стороне шеи
            'L -2 0 ' +                    // через шею под подбородком
            'Z" ' +
            'fill="#241410"/>' +
          // ===== ЛИЦО — овал-телесный, ВНУТРИ силуэта =====
          // Прямоугольник лица меньше шапочки волос, без обводки.
          '<ellipse cx="0" cy="-13" rx="8" ry="9.5" fill="#f4d3a8"/>' +
          // Чёлка-«капюшон» закрывает весь лоб до бровей — никакой беж-полосы.
          // Ширина больше чем лицо, чтобы стыковаться с боковыми волосами.
          '<path d="M -9 -22 Q 0 -25 9 -22 ' +
            'Q 10 -14 5 -14 Q 2 -15 0 -14 Q -2 -15 -5 -14 Q -10 -14 -9 -22 Z" ' +
            'fill="#241410"/>' +
          // ===== ВЕНОК — поверх волос =====
          '<g>' +
            '<ellipse cx="-7" cy="-25" rx="2.4" ry="1.3" fill="#4a7a3a" transform="rotate(-30 -7 -25)"/>' +
            '<ellipse cx="-2" cy="-27" rx="2.4" ry="1.3" fill="#3a6a2a"/>' +
            '<ellipse cx="3" cy="-27" rx="2.4" ry="1.3" fill="#4a7a3a"/>' +
            '<ellipse cx="7" cy="-25" rx="2.4" ry="1.3" fill="#3a6a2a" transform="rotate(30 7 -25)"/>' +
            '<circle cx="-4" cy="-25" r="0.9" fill="#c4566a"/>' +
            '<circle cx="5" cy="-25" r="0.9" fill="#c4566a"/>' +
          '</g>' +
          // ===== ЛИЦО: глаза-точки + улыбка =====
          '<circle cx="-3" cy="-12" r="1" fill="#1a0e08"/>' +
          '<circle cx="3" cy="-12" r="1" fill="#1a0e08"/>' +
          '<path d="M -2 -7 Q 0 -5 2 -7" stroke="#c4566a" stroke-width="1" fill="none" stroke-linecap="round"/>' +
          // Лёгкий румянец (опц., через opacity)
          '<circle cx="-5" cy="-9" r="1.2" fill="#e8a4a4" opacity="0.55"/>' +
          '<circle cx="5" cy="-9" r="1.2" fill="#e8a4a4" opacity="0.55"/>' +
        '</g>' +
        // ноты в воздухе
        '<g class="level3-final-notes">' +
          '<text x="80" y="60" font-size="18" fill="#f4b53c" opacity="0.7">♪</text>' +
          '<text x="120" y="100" font-size="14" fill="#f4b53c" opacity="0.6">♫</text>' +
          '<text x="540" y="170" font-size="16" fill="#f4b53c" opacity="0.6">♪</text>' +
        '</g>' +
        '</svg>';
      wrap.appendChild(room);

      wrap.appendChild(buildBubble(
        '98 дней. 98 тем. 98 вечеринок. Они придумали, как не сойти с ума ' +
        'в четырёх стенах. Счастье — это когда есть с кем устроить ' +
        'День Грузии в среду в марте.'
      ));

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Дальше';
      on(btn, 'click', () => {
        // НЕ гасим georgia.mp3 — она продолжит играть на экране
        // «Уровень 3 пройден». Остановка только при уходе с уровня (unmount).
        clearProgress();
        if (onCompleteCb) onCompleteCb();
      });
      wrap.appendChild(btn);

      return wrap;
    }

    return {
      id: 3,
      title: 'Своё гнездо. Карантин',
      intro:
        'Однушка на Алексеевской. Карантин. Многие пары на этом расстались. ' +
        'А вы устроили себе сто дней тематических вечеринок. ' +
        'Сегодня — День 98. День Грузии. Нужно дойти до магазина за вином и сыром ' +
        '(главное — не попасться ментам без QR-кода). Поехали.',
      completionTitle: 'Уровень 3 пройден: мы выдержали',
      completionText:
        'Это должны были быть тяжёлые месяцы. А мы вспоминаем их с улыбкой. ' +
        'Потому что любое время, когда мы рядом — хорошее. ' +
        'Даже если за окном пандемия.',
      photoCaption: 'наш план карантина',
      nextButtonText: 'На карту',

      mount(container, onComplete) {
        onCompleteCb = onComplete;
        loadProgress();
        const root = document.createElement('div');
        root.className = 'level3-root';
        contentEl = document.createElement('div');
        contentEl.className = 'level3-content';
        root.appendChild(contentEl);
        container.appendChild(root);
        if (progress.part2) contentEl.appendChild(renderFinal());
        else if (progress.part1) contentEl.appendChild(renderCutscene());
        else contentEl.appendChild(renderPart1());
      },

      unmount() {
        cleanupAll();
        // Гасим грузинскую мелодию, если игрок ушёл с финального экрана
        AUDIO.stopLoop('georgia');
        contentEl = null;
        onCompleteCb = null;
        p1 = null;
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      },
    };
  }

  // ============================================================
  //  Уровень 4: «Банк. Делегатор 3000» — аркадный кликер делегирования
  // ============================================================
  function createLevel4() {
    const L4_STORAGE_KEY = 'nori-story-level4-v1';

    // ----- Данные задач -----
    const TASKS = {
      bank: {
        pool: [
          'Обновить сайт банка',
          'Сверстать страницу про РКО',
          'Описание тарифа для бизнеса',
          'Карточка кредитного продукта',
          'Лендинг для физлиц',
          'Согласовать UX с продактом',
          'Дизайн баннера для главной',
          'Готовиться к планёрке',
          'Письмо клиенту в техподдержку',
          'Согласование макета с маркетингом',
        ],
        scores: { self: 1, junior: 3, vera: 4, skip: -2 },
        autoBasket: 'vera',
      },
      corporate: {
        pool: [
          'Совещание о следующем совещании',
          'Перенести встречу (уже три раза)',
          'Отчёт о заполненных отчётах',
          'Согласовать шрифт с юристами',
        ],
        scores: { self: 1, junior: 0, vera: 0, skip: 5 },
        autoBasket: 'skip',
      },
      og: {
        pool: [
          'Подготовить презу для ОГ',
          'Встреча с ОГ через час',
          'Финальный слайд для ОГ',
          'Согласовать с ОГ концепцию',
          'Идти на встречу к ОГ',
          'Срочный звонок ОГ',
          'Прислать ОГ цифры по кварталу',
          'Сделать макет под ОГ-обзор',
          'Готовить демо для ОГ',
          'Ответить ОГ на фидбэк',
          'Стратегия для ОГ на пятницу',
          'Объяснить ОГ новую фичу',
        ],
        scores: { self: 10 },
        autoBasket: 'self',
        rejectBaskets: ['junior', 'vera', 'skip'],
        rejectPenalty: -3,
        rejectQuotes: [
          'ОГ — это ты. Ты идёшь к ОГ сам. Тут не сработает.',
          'К ОГ нельзя через корзину. Это уровень бога.',
          'ОГ нельзя делегировать. ОГ — это серьёзно.',
        ],
        rejectSkipQuote: 'Эй. ОГ забить нельзя. ОГ нельзя забить никогда.',
      },
      self: {
        pool: [
          'Поесть',
          'Позвать Веру обедать',
          'Сходить в туалет',
          'Поплавать вечером',
          'Поспать',
          'Потискать Нори',
          'Покормить Нори',
          'Поменять лоток Нори',
          'Попить пуэрчик',
        ],
        scores: { self: 2 },
        autoBasket: 'self',
        rejectBaskets: ['junior', 'vera', 'skip'],
        rejectPenalty: -1,
        rejectQuotes: [
          'Это не делегируется. Это твоя жизнь.',
          'Поплавать за тебя я не смогу. Я кошка.',
          'Тискать меня должен ты сам. Лично.',
        ],
      },
      vera: {
        pool: [
          'Заказать ужин',
          'Записать к врачу',
          'Купить подарок маме',
          'Найти, куда едем на выходных',
          'Записаться на стрижку',
          'Постирать трусы',
          'Приготовить завтрак',
          'Найти наушники',
          'Запустить посудомойку',
          'Закупить продукты',
        ],
        scores: { self: 1, junior: 0, vera: 5, skip: -1 },
        autoBasket: 'vera',
      },
    };

    const BASKETS = [
      { id: 'self',   label: 'Сам',     icon: '',  key: '←', code: 'ArrowLeft' },
      { id: 'junior', label: 'Евгению', icon: '',  key: '↓', code: 'ArrowDown' },
      { id: 'vera',   label: 'Вере',    icon: '',  key: '↑', code: 'ArrowUp' },
      { id: 'skip',   label: 'Забить',  icon: '',  key: '→', code: 'ArrowRight' },
    ];

    // Сколько КАЖДЫЙ устаёт от задачи (% заряда). Если тип — его профиль,
    // тратит меньше; если не его дело, выматывает сильнее.
    // ОТРИЦАТЕЛЬНЫЕ значения = ВОССТАНОВЛЕНИЕ (поспал/поел/потискал кошку).
    // Ключ внешний — корзина (кто получил); внутренний — тип задачи.
    const DRAIN = {
      self:   { bank: 11, corporate: 14, og: 7,  self: -10, vera: 12 },
      junior: { bank: 6,  corporate: 9,  vera: 14 },     // og/self досюда не доходят
      vera:   { bank: 12, corporate: 11, vera: 5 },      // на своих профильных тратит мало
      skip:   {},                                         // забить — никто не тратит силы
    };
    const RESTORE_QUOTES = [
      'Молодец. Силы вернулись.',
      'Это правильно. +заряд.',
      'Покой — тоже работа.',
    ];

    // Краткие, иронично-кошачьи комменты Нори на каждое решение.
    // Учат: ОГ — самостоятельно; банк — Евгению; быт — Вере; корп — забить.
    const COMMENTS = {
      'bank-self': [
        'Сам? Очки скромнее, чем могли быть.',
        'Тащишь как ишак. Евгений-то на что?',
        'Можно было спихнуть. Учись.',
      ],
      'bank-junior': [
        'Грамотно. Евгений на этом и сидит.',
        'Ровно его профиль. +3.',
        'Так и надо. По адресу.',
      ],
      'bank-vera': [
        'Веру на банк? Дорогой ресурс. Но очков много.',
        'Она устанет, но сделает.',
        'Можно. Но не злоупотребляй.',
      ],
      'bank-skip': [
        'Банк забить — это к шефу с объяснительной.',
        'Минус. Так нельзя.',
        'Шефу скажут — вспомнят.',
      ],
      'corporate-self': [
        'Совещание о совещании. Поздравляю.',
        'Зря потратил время. Можно было забить.',
        'Сам? Слабо. Это для урны.',
      ],
      'corporate-junior': [
        'Евгений потянет. Чуть-чуть устал.',
        'Можно. Но мог и забить.',
        'Хм, расходный материал.',
      ],
      'corporate-vera': [
        'Веру в корп-абсурд? Жестоко.',
        'Не её. Совсем не её.',
        'Зачем её мучить?',
      ],
      'corporate-skip': [
        'Идеально. Корпоративный мусор — на свалку.',
        'Так и надо. +очков.',
        'Уважаю. Кот одобряет.',
      ],
      'og-self': [
        'ОГ. Уважение. Только сам.',
        'Шефа не подводят. Молодец.',
        'Готовиться к нему — самому. Других нет.',
      ],
      'self-self': RESTORE_QUOTES,
      'vera-self': [
        'Помог жене — кот одобряет. 🐾',
        'Молодец. Ты человек семьи.',
        'Сам разобрался — Вера оценит. Я тоже.',
        'Уважаю. Не всё на жене.',
      ],
      'vera-junior': [
        'Евгений не знает, что покупать маме.',
        'Не его профиль. Запутается.',
        'Странное решение.',
      ],
      'vera-vera': [
        'Опять Вере? Она тоже человек.',
        'Семейный фронт прикрыт. Но не каждый раз.',
        'Удобно. Только не злоупотребляй.',
        'Вера снова. Хм.',
      ],
      'vera-skip': [
        'Бытовуху не забивают. Бумеранг будет.',
        'Минус. И семья запомнит.',
        'Не лучшее. Заметят.',
      ],
    };

    // Все дни — все типы сразу (включая ОГ). Скорость растёт плавно, время на подумать есть.
    // Vera-задач побольше — у неё свой пул, и она быстро восстанавливается на профильных.
    // Дни сокращены на 20% (с 18 до 14.5 сек). Всего: ~72 секунды.
    const DAYS = [
      { name: 'ПОНЕДЕЛЬНИК', quote: 'Поехали. Не торопись — читай задачи.',
        duration: 14500, spawnMs: 2000, fallSpeed: 32,
        weights: { bank: 23, corporate: 12, og: 15, self: 17, vera: 33 } },
      { name: 'ВТОРНИК', quote: 'Вера накопила список. Не игнорируй.',
        duration: 14500, spawnMs: 1700, fallSpeed: 40,
        weights: { bank: 20, corporate: 12, og: 18, self: 14, vera: 36 } },
      { name: 'СРЕДА', quote: 'Корпоративный абсурд правит миром.',
        duration: 14500, spawnMs: 1500, fallSpeed: 50,
        weights: { bank: 16, corporate: 33, og: 18, self: 10, vera: 23 } },
      { name: 'ЧЕТВЕРГ', quote: 'ОГ. Внимание.',
        duration: 14500, spawnMs: 1300, fallSpeed: 62,
        weights: { bank: 17, corporate: 12, og: 32, self: 13, vera: 26 } },
      { name: 'ПЯТНИЦА', quote: 'Финал. Просто выживай.',
        duration: 14500, spawnMs: 1100, fallSpeed: 78,
        weights: { bank: 16, corporate: 18, og: 22, self: 16, vera: 28 } },
    ];

    const LAPKI_QUOTES = [
      'Идеальное делегирование.',
      'Высший уровень.',
      'Так держать.',
    ];

    const ACHIEVEMENTS = [
      { id: 'lapki3', icon: '🐾', name: 'Истинные Лапки',
        desc: 'Использовал режим Лапок 3 раза',
        check: (s) => s.lapkiUsed >= 3 },
      { id: 'og_perfect', icon: '🎯', name: 'Любимец ОГ',
        desc: 'Выполнил все задачи ОГ сам',
        check: (s) => s.ogTotal > 0 && s.ogDone === s.ogTotal },
      { id: 'balance', icon: '🧘', name: 'Команда жива',
        desc: 'Все три заряда выше 50% на финише',
        check: (s) => s.ilyaFinal > 50 && s.juniorFinal > 50 && s.veraFinal > 50 },
      { id: 'caring', icon: '💜', name: 'Заботливый муж',
        desc: 'Закончил с Зарядом Веры > 70%',
        check: (s) => s.veraFinal > 70 },
      { id: 'gone', icon: '💔', name: 'Жена ушла',
        desc: 'Довёл Заряд Веры до 0%',
        check: (s) => s.veraGone },
      { id: 'burned', icon: '🔥', name: 'Сам себя сжёг',
        desc: 'Илья выгорел',
        check: (s) => s.ilyaBurned },
      { id: 'fired', icon: '🚪', name: 'Без правой руки',
        desc: 'Довёл Евгения до увольнения',
        check: (s) => s.juniorQuit },
      { id: 'pillar', icon: '🏢', name: 'Опора компании',
        desc: 'Сам сделал больше, чем делегировал',
        check: (s) => s.toSelf > (s.toJunior + s.toVera) },
      { id: 'god', icon: '🚀', name: 'Делегатор Бог',
        desc: 'Делегировал больше 80% задач',
        check: (s) => s.processed > 0 && (s.toJunior + s.toVera) / s.processed > 0.8 },
    ];


    // ----- Прогресс -----
    const progress = { best: 0, achievements: [], passed: false };
    function loadProgress() {
      // Сброс к дефолтам — чтобы in-memory state не пережил «Пройти заново».
      progress.best = 0;
      progress.achievements = [];
      progress.passed = false;
      try {
        const raw = localStorage.getItem(L4_STORAGE_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (typeof p.best === 'number') progress.best = p.best;
        if (Array.isArray(p.achievements)) progress.achievements = p.achievements;
        progress.passed = !!p.passed;
      } catch (e) {}
    }
    function saveProgress() {
      try { localStorage.setItem(L4_STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
    }
    function clearProgress() {
      progress.best = 0; progress.achievements = []; progress.passed = false;
      try { localStorage.removeItem(L4_STORAGE_KEY); } catch (e) {}
    }

    // ----- Управление ресурсами -----
    const listeners = [];
    const timeouts = [];
    let rafId = null;
    function on(el, evt, fn, opts) {
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }
    function cleanupAll() {
      listeners.forEach((fn) => fn()); listeners.length = 0;
      timeouts.forEach((t) => clearTimeout(t)); timeouts.length = 0;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    let contentEl = null;
    let onCompleteCb = null;
    let g = null;        // эфемерное состояние игры
    const dom = {};      // ссылки на ключевые элементы

    function fadeTo(node) {
      if (!contentEl) return;
      document.querySelector('.nori-quote')?.classList.add('hidden');
      contentEl.classList.add('level4-fading');
      later(() => {
        contentEl.innerHTML = '';
        contentEl.appendChild(node);
        contentEl.classList.remove('level4-fading');
      }, 220);
    }

    function weightedPick(weights) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r < 0) return k;
      }
      return Object.keys(weights)[0];
    }

    // ----- СТАРТОВЫЙ ЭКРАН -----
    function renderStart() {
      const wrap = document.createElement('div');
      wrap.className = 'level4-startscreen';
      wrap.innerHTML =
        '<h3 class="level4-start-h">Банк. Делегатор 3000</h3>' +
        '<div class="level4-start-rules">' +
          '<p>Сверху падают карточки задач. Снизу — четыре корзины:</p>' +
          '<ul>' +
            '<li><strong>Сам</strong></li>' +
            '<li><strong>Евгению</strong></li>' +
            '<li><strong>Вере</strong></li>' +
            '<li><strong>Забить</strong></li>' +
          '</ul>' +
          '<p>Управление: <kbd>←</kbd> Сам, <kbd>↓</kbd> Евгению, <kbd>↑</kbd> Вере, <kbd>→</kbd> Забить. Или мышкой: клик по карточке → клик по корзине.</p>' +
          '<p>5 рабочих дней. Всего ~70 секунд. Промахи бьют по счёту.</p>' +
        '</div>';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary level4-start-btn';
      btn.type = 'button';
      btn.textContent = 'Старт →';
      on(btn, 'click', () => fadeTo(renderGame()));
      wrap.appendChild(btn);
      return wrap;
    }

    // ----- ИГРА -----
    function renderGame() {
      const wrap = document.createElement('div');
      wrap.className = 'level4-game';

      // HUD
      const hud = document.createElement('div');
      hud.className = 'level4-hud';
      hud.innerHTML =
        '<div class="level4-score">Очки: <span class="val">0</span></div>' +
        '<div class="level4-lives" aria-label="жизни">♥♥♥</div>' +
        '<div class="level4-day-indicator">—</div>' +
        '<div class="level4-lapki">' +
          '<span class="lapki-label">🐾 Заряд Лапок</span>' +
          '<div class="lapki-bar"><div class="lapki-fill"></div></div>' +
          '<button type="button" class="lapki-btn" disabled>АКТИВИРОВАТЬ</button>' +
        '</div>';
      wrap.appendChild(hud);

      // Арена: поле + сайдбар с Верой
      const arena = document.createElement('div');
      arena.className = 'level4-arena';

      const field = document.createElement('div');
      field.className = 'level4-field';
      arena.appendChild(field);

      const aside = document.createElement('div');
      aside.className = 'level4-fatigues';
      const fatigueRow = (id, name) =>
        '<div class="level4-fatigue" data-who="' + id + '">' +
          '<div class="fatigue-name">' + name + '</div>' +
          '<div class="fatigue-bar"><div class="fatigue-fill" style="width:100%"></div></div>' +
          '<div class="fatigue-percent">100%</div>' +
        '</div>';
      aside.innerHTML =
        fatigueRow('ilya', 'Илья') +
        fatigueRow('junior', 'Евгений') +
        fatigueRow('vera', 'Вера');
      arena.appendChild(aside);

      // Day plate (на арене сверху)
      const plate = document.createElement('div');
      plate.className = 'level4-dayplate';
      plate.innerHTML = '<div class="plate-name"></div><div class="plate-quote"></div>';
      arena.appendChild(plate);

      // Reply bubble (плавающая, наверху арены справа)
      const bubble = document.createElement('div');
      bubble.className = 'level4-bubble';
      bubble.innerHTML = '<span class="speaker">— Нори:</span> <span class="text"></span>';
      arena.appendChild(bubble);

      // Confetti overlay
      const conf = document.createElement('div');
      conf.className = 'level4-confetti';
      arena.appendChild(conf);

      wrap.appendChild(arena);

      // Корзины
      const baskets = document.createElement('div');
      baskets.className = 'level4-baskets';
      BASKETS.forEach((b) => {
        const btn = document.createElement('button');
        btn.className = 'level4-basket';
        btn.dataset.basket = b.id;
        btn.innerHTML =
          '<span class="label">' + b.label + '</span>' +
          '<span class="key">' + b.key + '</span>';
        on(btn, 'click', () => basketClick(b.id));
        baskets.appendChild(btn);
      });
      wrap.appendChild(baskets);

      // Подсказка
      const hint = document.createElement('p');
      hint.className = 'level4-hint';
      hint.textContent = 'Клик по карточке → клик по корзине. ОГ-задачи нельзя делегировать. Каждые 5 делегаций — +20% к Лапкам.';
      wrap.appendChild(hint);

      // refs
      dom.field = field;
      dom.scoreVal = hud.querySelector('.level4-score .val');
      dom.lives = hud.querySelector('.level4-lives');
      dom.dayInd = hud.querySelector('.level4-day-indicator');
      dom.lapkiFill = hud.querySelector('.lapki-fill');
      dom.lapkiBtn = hud.querySelector('.lapki-btn');
      dom.lapki = hud.querySelector('.level4-lapki');
      dom.fatigues = {
        ilya:   aside.querySelector('.level4-fatigue[data-who="ilya"]'),
        junior: aside.querySelector('.level4-fatigue[data-who="junior"]'),
        vera:   aside.querySelector('.level4-fatigue[data-who="vera"]'),
      };
      dom.bubble = bubble;
      dom.bubbleText = bubble.querySelector('.text');
      dom.dayPlate = plate;
      dom.dayName = plate.querySelector('.plate-name');
      dom.dayQuote = plate.querySelector('.plate-quote');
      dom.baskets = baskets;
      dom.confetti = conf;

      on(dom.lapkiBtn, 'click', activateLapki);

      // Управление с клавиатуры — стрелки направляют карточку в корзину.
      // Если ничего не выбрано — берём самую нижнюю (= самую срочную).
      on(window, 'keydown', (e) => {
        if (!g || g.ended) return;
        if (e.code === 'Escape' && g.selectedCard) {
          if (g.selectedCard.el) g.selectedCard.el.classList.remove('selected');
          g.selectedCard = null;
          return;
        }
        const basket = BASKETS.find((b) => b.code === e.code);
        if (!basket) return;
        e.preventDefault();
        let card = g.selectedCard;
        if (!card || card.handled) {
          // самая нижняя необработанная — приоритетная цель
          card = g.cards.filter((c) => !c.handled).sort((a, b) => b.y - a.y)[0];
        }
        if (!card) return;
        g.selectedCard = null;
        handleDrop(card, basket.id, false);
        // вспышка кнопки для фидбэка
        const btn = dom.baskets.querySelector('[data-basket="' + basket.id + '"]');
        if (btn) {
          btn.classList.add('flash');
          later(() => btn.classList.remove('flash'), 200);
        }
      });

      later(() => startGame(), 250);
      return wrap;
    }

    function startGame() {
      g = {
        score: 0, lives: 7,
        // Три шкалы усталости 0-100%
        ilyaCharge: 100, juniorCharge: 100, veraCharge: 100,
        lapkiCharge: 0,
        lapkiActive: false, lapkiActiveUntil: 0,
        lapkiUsed: 0,
        stats: { processed: 0, toSelf: 0, toJunior: 0, toVera: 0, toSkip: 0,
                 ogDone: 0, ogTotal: 0,
                 ilyaBurned: false, juniorQuit: false, veraGone: false },
        cards: [],
        recentTexts: [],     // последние 8 текстов задач для исключения повторов
        currentDay: -1,
        gameTimeMs: 0,
        lapkiActiveMsLeft: 0,
        rechargeNextMs: 20000,
        spawnDueIn: 1800,
        autoSortDueIn: 0,
        selectedCard: null,
        lastTick: 0,
        ended: false,
      };
      showDayPlate(0);
      rafId = requestAnimationFrame(tick);
    }

    function showDayPlate(idx) {
      g.currentDay = idx;
      const day = DAYS[idx];
      dom.dayInd.textContent = day.name;
      dom.dayName.textContent = day.name;
      dom.dayQuote.textContent = day.quote;
      dom.dayPlate.classList.add('visible');
      later(() => dom.dayPlate.classList.remove('visible'), 1500);
      showNori(day.quote, 2500);
    }

    function tick(t) {
      if (!g || g.ended) return;
      const realDt = g.lastTick ? (t - g.lastTick) / 1000 : 0;
      const dt = Math.min(0.06, realDt);   // капируем кадр — защита от телепорта при throttled rAF
      g.lastTick = t;
      g.gameTimeMs += dt * 1000;           // вся механика на едином capped-таймере

      // Переход дня
      let acc = 0;
      let dayIdx = DAYS.length;
      for (let i = 0; i < DAYS.length; i++) {
        if (g.gameTimeMs < acc + DAYS[i].duration) { dayIdx = i; break; }
        acc += DAYS[i].duration;
      }
      if (dayIdx >= DAYS.length) { endGame(false); return; }
      if (dayIdx !== g.currentDay) showDayPlate(dayIdx);

      const day = DAYS[g.currentDay];

      // Спавн карточек
      g.spawnDueIn -= dt * 1000;
      if (g.spawnDueIn <= 0) {
        spawnCard(day);
        g.spawnDueIn = day.spawnMs;
      }

      // Падение
      const fh = dom.field.clientHeight || 360;
      g.cards.forEach((c) => {
        if (c.handled) return;
        c.y += c.speed * dt;
        if (c.el) c.el.style.transform = 'translate(' + c.x + 'px, ' + c.y + 'px)';
        if (c.y > fh - 50) loseLife(c);
      });

      // Лапки авто-сорт
      if (g.lapkiActive) {
        g.lapkiActiveMsLeft -= dt * 1000;
        if (g.lapkiActiveMsLeft <= 0) {
          g.lapkiActive = false;
          dom.lapki.classList.remove('active');
        } else {
          g.autoSortDueIn -= dt * 1000;
          if (g.autoSortDueIn <= 0) {
            const target = g.cards.find((c) => !c.handled);
            if (target) {
              const basket = pickAutoBasket(target);
              handleDrop(target, basket, true);
            }
            g.autoSortDueIn = 280;
          }
        }
      }

      // Авто-восстановление всех трёх (каждые 20 сек +5%)
      g.rechargeNextMs -= dt * 1000;
      if (g.rechargeNextMs <= 0) {
        if (!g.stats.ilyaBurned)  g.ilyaCharge   = Math.min(100, g.ilyaCharge + 5);
        if (!g.stats.juniorQuit)  g.juniorCharge = Math.min(100, g.juniorCharge + 5);
        if (!g.stats.veraGone)    g.veraCharge   = Math.min(100, g.veraCharge + 5);
        g.rechargeNextMs = 20000;
        updateFatigueBars();
      }

      updateHUD();
      rafId = requestAnimationFrame(tick);
    }

    function spawnCard(day) {
      const type = weightedPick(day.weights);
      const pool = TASKS[type].pool;
      // Не повторяем тексты, которые сейчас на экране или были в последние 8 спавнах.
      // Если из пула ничего не подошло — допускаем повтор.
      const active = new Set();
      g.cards.forEach((c) => { if (!c.handled) active.add(c.text); });
      const recent = new Set(g.recentTexts || []);
      let available = pool.filter((t) => !active.has(t) && !recent.has(t));
      if (!available.length) available = pool.filter((t) => !active.has(t));
      if (!available.length) available = pool;
      const text = available[Math.floor(Math.random() * available.length)];
      g.recentTexts = g.recentTexts || [];
      g.recentTexts.push(text);
      if (g.recentTexts.length > 8) g.recentTexts.shift();
      const fw = dom.field.clientWidth || 600;
      const card = {
        id: 'c' + Math.random().toString(36).slice(2, 8),
        type,
        text,
        x: 12 + Math.random() * (fw - 170),
        y: -60,
        speed: day.fallSpeed * (1 + Math.random() * 0.15),
        el: null,
        handled: false,
      };
      const el = document.createElement('div');
      // Все типы — одинаковая нейтральная карточка (без цветовых подсказок).
      // ОГ всё ещё отмечена «🎯 ОГ», потому что её НЕЛЬЗЯ делегировать —
      // это критическая инфа, а не подсказка куда послать.
      el.className = 'level4-card card-type-' + type;
      if (type === 'og') {
        el.innerHTML = '<div class="card-mark og-mark">🎯 ОГ</div><div class="card-text">' + text + '</div>';
      } else {
        el.innerHTML = '<div class="card-text">' + text + '</div>';
      }
      el.style.transform = 'translate(' + card.x + 'px, ' + card.y + 'px)';
      card.el = el;
      on(el, 'click', (e) => { e.stopPropagation(); selectCard(card); });
      dom.field.appendChild(el);
      g.cards.push(card);
      if (type === 'og') g.stats.ogTotal++;
    }

    function selectCard(card) {
      if (card.handled) return;
      if (g.selectedCard && g.selectedCard.el) g.selectedCard.el.classList.remove('selected');
      g.selectedCard = card;
      card.el.classList.add('selected');
    }

    function basketClick(basketId) {
      if (!g || !g.selectedCard) return;
      const card = g.selectedCard;
      g.selectedCard = null;
      handleDrop(card, basketId, false);
    }

    function handleDrop(card, basketId, fromLapki) {
      if (card.handled) return;
      const def = TASKS[card.type];

      // OG / self-tasks нельзя делегировать — реджект
      if (def.rejectBaskets && def.rejectBaskets.indexOf(basketId) >= 0) {
        if (fromLapki) {
          // в режиме Лапок ничего не реджектим, отправляем в self
          return handleDrop(card, 'self', true);
        }
        AUDIO.play('error');
        g.score += def.rejectPenalty;
        if (card.type === 'og' && basketId === 'skip') {
          showNori(def.rejectSkipQuote);
        } else {
          const qs = def.rejectQuotes;
          showNori(qs[Math.floor(Math.random() * qs.length)]);
        }
        // вернуть на верх
        const fw = dom.field.clientWidth || 600;
        card.y = -60;
        card.x = 12 + Math.random() * (fw - 170);
        card.el.classList.remove('selected');
        updateHUD();
        return;
      }

      // Вера ушла — корзина «вере» заблокирована
      if (basketId === 'vera' && g.stats.veraGone) {
        showNori('Вере нельзя — она ушла.');
        card.el.classList.remove('selected');
        return;
      }
      // Евгений уволился — корзина «Евгению» заблокирована
      if (basketId === 'junior' && g.stats.juniorQuit) {
        showNori('Евгению нельзя — он уже не у нас.');
        card.el.classList.remove('selected');
        return;
      }

      // Очки
      const sc = (def.scores && def.scores[basketId] != null) ? def.scores[basketId] : 0;
      g.score += sc;
      // Звук — успех если очки положительные, ошибка если отрицательные
      if (sc > 0) AUDIO.play('success');
      else if (sc < 0) AUDIO.play('error');

      // Стат
      g.stats.processed++;
      if (basketId === 'self')   g.stats.toSelf++;
      if (basketId === 'junior') g.stats.toJunior++;
      if (basketId === 'vera')   g.stats.toVera++;
      if (basketId === 'skip')   g.stats.toSkip++;
      if (card.type === 'og' && basketId === 'self') g.stats.ogDone++;

      // Усталость получателя — зависит от того, его это тип задачи или нет.
      // Отрицательное значение в DRAIN — восстановление (поспал/поел/потискал).
      // У ИЛЬИ потолок 150% — восстанавливающие дела дают «запас», который
      // помогает дольше держаться при тяжёлых рабочих задачах.
      const drainAmount = (DRAIN[basketId] && DRAIN[basketId][card.type]) || 0;
      if (basketId === 'self' && drainAmount !== 0) {
        g.ilyaCharge = Math.max(0, Math.min(150, g.ilyaCharge - drainAmount));
        if (g.ilyaCharge === 0 && !g.stats.ilyaBurned) {
          g.stats.ilyaBurned = true;
          showIlyaBurned();
        }
      } else if (basketId === 'junior' && drainAmount > 0) {
        g.juniorCharge = Math.max(0, g.juniorCharge - drainAmount);
        if (g.juniorCharge === 0 && !g.stats.juniorQuit) {
          g.stats.juniorQuit = true;
          showJuniorQuit();
        }
      } else if (basketId === 'vera' && drainAmount > 0) {
        g.veraCharge = Math.max(0, g.veraCharge - drainAmount);
        if (g.veraCharge === 0 && !g.stats.veraGone) {
          g.stats.veraGone = true;
          showVeraGone();
        }
      }
      updateFatigueBars();

      // Реплика Нори: учим распределять задачи. Если в Лапки-режиме — молчим.
      if (!fromLapki) {
        const key = card.type + '-' + basketId;
        const bank = COMMENTS[key];
        if (bank && bank.length) {
          showNori(bank[Math.floor(Math.random() * bank.length)], 1800);
        }
      }

      // Заряд Лапок: каждое делегирование +4% (5 делегаций = +20%)
      if (basketId !== 'self' && !fromLapki) {
        g.lapkiCharge = Math.min(100, g.lapkiCharge + 4);
        if (g.lapkiCharge >= 100 && !g.lapkiActive) {
          dom.lapkiBtn.disabled = false;
          dom.lapki.classList.add('ready');
        }
      }

      // Удалить карточку c анимацией
      card.handled = true;
      card.el.classList.remove('selected');
      card.el.classList.add('placed', 'placed-' + basketId);
      later(() => {
        if (card.el && card.el.parentNode) card.el.parentNode.removeChild(card.el);
        const i = g.cards.indexOf(card);
        if (i >= 0) g.cards.splice(i, 1);
      }, 380);

      updateHUD();
    }

    function pickAutoBasket(card) {
      const def = TASKS[card.type];
      let b = def.autoBasket;
      if (b === 'vera' && g.stats.veraGone) b = 'self';
      if (b === 'junior' && g.stats.juniorQuit) b = 'self';
      return b;
    }

    function loseLife(card) {
      if (card.handled) return;
      card.handled = true;
      g.lives = Math.max(0, g.lives - 1);
      g.score -= 3;   // штраф очков за уронённую карточку
      showNori('Карточка ушла. −3 очка.', 1500);
      if (card.el && card.el.parentNode) card.el.parentNode.removeChild(card.el);
      const i = g.cards.indexOf(card);
      if (i >= 0) g.cards.splice(i, 1);
      updateHUD();
      if (g.lives <= 0) endGame(true);
    }

    function activateLapki() {
      if (!g || g.lapkiCharge < 100 || g.lapkiActive) return;
      AUDIO.play('success', { volume: 0.6 });
      g.lapkiActive = true;
      g.lapkiActiveMsLeft = 5000;
      g.autoSortDueIn = 0;
      g.lapkiCharge = 0;
      g.lapkiUsed++;
      dom.lapkiBtn.disabled = true;
      dom.lapki.classList.remove('ready');
      dom.lapki.classList.add('active');
      // Катсцена активации — одно из двух разрешённых мест с «🐾 ЛАПКИ»
      const cutscene = document.createElement('div');
      cutscene.className = 'level4-lapki-cutscene';
      cutscene.innerHTML = '<div class="lapki-cutscene-text">🐾 ЛАПКИ АКТИВИРОВАНЫ 🐾</div>';
      dom.field.parentElement.appendChild(cutscene);
      later(() => { if (cutscene.parentNode) cutscene.parentNode.removeChild(cutscene); }, 1800);
      showNori(LAPKI_QUOTES[Math.floor(Math.random() * LAPKI_QUOTES.length)], 2200);
      spawnConfetti();
      updateHUD();
    }

    function spawnConfetti() {
      const colors = ['#f4b53c', '#c97b5a', '#9c4a5c', '#3d4f3a', '#5a7a9c'];
      const emojis = ['🐾', '🐾', '✨'];
      for (let i = 0; i < 22; i++) {
        const p = document.createElement('span');
        p.className = 'level4-confetti-piece';
        if (Math.random() < 0.35) {
          p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          p.style.color = colors[Math.floor(Math.random() * colors.length)];
        } else {
          p.style.background = colors[Math.floor(Math.random() * colors.length)];
        }
        p.style.left = (5 + Math.random() * 90) + '%';
        p.style.animationDelay = (Math.random() * 0.3) + 's';
        p.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
        dom.confetti.appendChild(p);
        later(() => p.remove(), 2800);
      }
    }

    function updateFatigueBars() {
      if (!dom.fatigues) return;
      const setBar = (who, charge) => {
        const row = dom.fatigues[who];
        if (!row) return;
        const fill = row.querySelector('.fatigue-fill');
        const pct  = row.querySelector('.fatigue-percent');
        // Ширина — макс 100, но реальная цифра в тексте может быть >100
        fill.style.width = Math.min(100, charge) + '%';
        pct.textContent = Math.round(charge) + '%';
        // Цвет: норма → жёлтый → красный; >100 — голубо-зелёный «бонус»
        let color = '#7ba35a';
        if (charge < 60) color = '#c4a366';
        if (charge < 30) color = '#c4566a';
        if (charge === 0) color = '#888';
        if (charge > 100) color = '#4ba3a3';  // лёгкое сияние «запасом»
        fill.style.background = color;
        row.classList.toggle('low', charge < 30 && charge > 0);
        row.classList.toggle('out', charge === 0);
        row.classList.toggle('overcharged', charge > 100);
      };
      setBar('ilya', g.ilyaCharge);
      setBar('junior', g.juniorCharge);
      setBar('vera', g.veraCharge);
    }
    // Совместимость со старыми вызовами
    const updateVeraIcon = updateFatigueBars;

    function showBurnoutOverlay(title, text, onClose) {
      const overlay = document.createElement('div');
      overlay.className = 'level4-vera-gone';
      overlay.innerHTML =
        '<div class="vera-gone-inner">' +
          '<h3>' + title + '</h3>' +
          '<p>' + text + '</p>' +
          '<button type="button" class="btn btn-primary">Продолжать</button>' +
        '</div>';
      dom.field.parentElement.appendChild(overlay);
      const btn = overlay.querySelector('.btn');
      on(btn, 'click', () => { overlay.remove(); if (onClose) onClose(); });
    }
    function showVeraGone() {
      showBurnoutOverlay('Вера ушла.',
        'Кажется, придётся искать новую жену. Старая закончилась.');
      const vBtn = dom.baskets.querySelector('.level4-basket[data-basket="vera"]');
      if (vBtn) vBtn.classList.add('blocked');
    }
    function showJuniorQuit() {
      showBurnoutOverlay('Евгений уволился.',
        'Твоя правая рука выгорела на нелепых задачах. Ушёл в стартап. Корзина «Евгению» больше недоступна.');
      const jBtn = dom.baskets.querySelector('.level4-basket[data-basket="junior"]');
      if (jBtn) jBtn.classList.add('blocked');
    }
    function showIlyaBurned() {
      // Илья выгорел — это game over по новой механике
      showBurnoutOverlay('Илья выгорел.',
        'Слишком много на себе тащил. Делегирование — это инструмент, а не образ жизни.',
        () => endGame(true));
    }

    function updateHUD() {
      dom.scoreVal.textContent = g.score;
      dom.lives.textContent = '♥'.repeat(g.lives) + '♡'.repeat(Math.max(0, 7 - g.lives));
      dom.lapkiFill.style.width = g.lapkiCharge + '%';
    }

    let bubbleTimer = null;
    function showNori(text, ms) {
      if (!dom.bubbleText) return;
      dom.bubbleText.textContent = text;
      dom.bubble.classList.add('visible');
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleTimer = later(() => dom.bubble.classList.remove('visible'), ms || 3500);
    }

    function endGame(early) {
      if (!g || g.ended) return;
      g.ended = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      // Очистить карточки
      g.cards.forEach((c) => { if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el); });
      g.cards.length = 0;
      // Финальная статистика
      const s = {
        processed: g.stats.processed,
        toSelf: g.stats.toSelf,
        toJunior: g.stats.toJunior,
        toVera: g.stats.toVera,
        toSkip: g.stats.toSkip,
        ogDone: g.stats.ogDone,
        ogTotal: g.stats.ogTotal,
        ilyaBurned: g.stats.ilyaBurned,
        juniorQuit: g.stats.juniorQuit,
        veraGone: g.stats.veraGone,
        ilyaFinal: Math.round(g.ilyaCharge),
        juniorFinal: Math.round(g.juniorCharge),
        veraFinal: Math.round(g.veraCharge),
        lapkiUsed: g.lapkiUsed,
        score: g.score,
      };
      const earned = ACHIEVEMENTS.filter((a) => a.check(s));
      // Сохраняем прогресс
      if (s.score > progress.best) progress.best = s.score;
      progress.achievements = Array.from(new Set(progress.achievements.concat(earned.map(a => a.id))));
      progress.passed = true;
      saveProgress();
      fadeTo(renderFinal(s, earned));
    }

    function renderFinal(s, earned) {
      const wrap = document.createElement('div');
      wrap.className = 'level4-final';

      const title = document.createElement('h3');
      title.className = 'level4-final-title';
      title.textContent = '🐾 ЛАПКИ АКТИВИРОВАНЫ 🐾';
      wrap.appendChild(title);

      const conf = document.createElement('div');
      conf.className = 'level4-final-confetti';
      wrap.appendChild(conf);
      later(() => spawnFinalConfetti(conf), 100);

      // Статистика
      const stats = document.createElement('div');
      stats.className = 'level4-stats';
      const rows = [
        ['Задач обработано', s.processed],
        ['Сделано самому', s.toSelf],
        ['Делегировано Евгению', s.toJunior],
        ['Делегировано Вере', s.toVera],
        ['Забито с пользой', s.toSkip],
        ['Использовано Лапок-режима', s.lapkiUsed + ' раз'],
        ['ОГ доволен',
          s.ogTotal === 0
            ? '—'
            : Math.round(s.ogDone / s.ogTotal * 100) + '% (' + s.ogDone + ' из ' + s.ogTotal + ')'],
        ['Заряд Ильи', s.ilyaBurned ? '0% (выгорел)' : s.ilyaFinal + '%'],
        ['Заряд Евгения', s.juniorQuit ? '0% (уволился)' : s.juniorFinal + '%'],
        ['Заряд Веры',   s.veraGone   ? '0% (ушла)'    : s.veraFinal + '%'],
        ['Очки', s.score],
      ];
      rows.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'level4-stat-row';
        row.style.setProperty('--row-i', String(i));
        row.innerHTML = '<span class="k">' + r[0] + '</span><span class="dots"></span><span class="v">' + r[1] + '</span>';
        stats.appendChild(row);
      });
      wrap.appendChild(stats);

      // Ачивки
      if (earned.length) {
        const ach = document.createElement('div');
        ach.className = 'level4-achievements';
        const h = document.createElement('div');
        h.className = 'level4-achievements-h';
        h.textContent = 'Ачивки';
        ach.appendChild(h);
        const list = document.createElement('div');
        list.className = 'level4-ach-list';
        earned.forEach((a, i) => {
          const card = document.createElement('div');
          card.className = 'level4-ach';
          card.style.setProperty('--ach-i', String(i));
          card.innerHTML =
            '<div class="ach-icon">' + a.icon + '</div>' +
            '<div class="ach-name">' + a.name + '</div>' +
            '<div class="ach-desc">' + a.desc + '</div>';
          list.appendChild(card);
        });
        ach.appendChild(list);
        wrap.appendChild(ach);
      }

      // Реплика Нори
      const finalQuote = noriFinalQuote(s);
      const nb = document.createElement('div');
      nb.className = 'level4-final-bubble';
      nb.innerHTML = '<span class="speaker">— Нори:</span><p>' + finalQuote + '</p>';
      wrap.appendChild(nb);

      const row = document.createElement('div');
      row.className = 'row';
      const replay = document.createElement('button');
      replay.className = 'btn btn-secondary';
      replay.type = 'button';
      replay.textContent = 'Пройти заново';
      on(replay, 'click', () => fadeTo(renderStart()));
      row.appendChild(replay);
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Дальше';
      on(btn, 'click', () => { if (onCompleteCb) onCompleteCb(); });
      row.appendChild(btn);
      wrap.appendChild(row);

      return wrap;
    }

    function noriFinalQuote(s) {
      if (s.veraGone) return 'Вера ушла. Кажется, придётся искать новую жену. Старая закончилась.';
      if (s.veraFinal > 70) return 'Молодец. Делегировал с умом, Веру не загнал. Я тебя одобряю. Человек цел, кошка довольна.';
      if (s.veraFinal >= 30) return 'Готово. Вера держится. Я наблюдаю.';
      return 'Готово. Вера лежит. Я тебе кое-что скажу: делегирование — это инструмент, а не образ жизни.';
    }

    function spawnFinalConfetti(host) {
      const colors = ['#f4b53c', '#c97b5a', '#9c4a5c', '#3d4f3a', '#5a7a9c'];
      const emojis = ['🐾', '✨', '🎉'];
      for (let i = 0; i < 32; i++) {
        const p = document.createElement('span');
        p.className = 'level4-confetti-piece big';
        if (Math.random() < 0.5) {
          p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          p.style.color = colors[Math.floor(Math.random() * colors.length)];
        } else {
          p.style.background = colors[Math.floor(Math.random() * colors.length)];
        }
        p.style.left = (5 + Math.random() * 90) + '%';
        p.style.animationDelay = (Math.random() * 0.5) + 's';
        p.style.animationDuration = (2 + Math.random() * 1.5) + 's';
        host.appendChild(p);
      }
    }

    return {
      id: 4,
      title: 'Банк. Делегатор 3000',
      intro:
        'Новый этап! ПСБ открыл много возможностей и научил тебя главному правилу: ' +
        'не всё, что записано в твоём таск-менеджере, нужно делать самому. ' +
        'Я это правило знаю с рождения. Уважаю человека, который пришёл к нему сам.',
      completionTitle: 'Уровень 4 пройден: Лапки активированы',
      completionText:
        'Ты для меня пример того, как можно не брать на себя лишнего. ' +
        'Я тоже так хочу. Научишь?',
      photoCaption: 'Илья в банке',
      nextButtonText: 'На карту',

      mount(container, onComplete) {
        onCompleteCb = onComplete;
        loadProgress();
        const root = document.createElement('div');
        root.className = 'level4-root';
        contentEl = document.createElement('div');
        contentEl.className = 'level4-content';
        root.appendChild(contentEl);
        container.appendChild(root);
        contentEl.appendChild(renderStart());
      },

      unmount() {
        cleanupAll();
        if (g) {
          g.cards.forEach((c) => { if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el); });
        }
        g = null;
        Object.keys(dom).forEach((k) => delete dom[k]);
        contentEl = null;
        onCompleteCb = null;
      },
    };
  }

  // ============================================================
  //  Уровень 5: «Своя квартира. Ремонт»
  //  Часть 1 — расстановка (8 точек × 3 варианта)
  //  Часть 2 — пройти через Рубэна (3 подуровня сложности)
  //  Часть 3 — доложить плитку ёлочкой (drag-and-click)
  // ============================================================
  function createLevel5() {
    const L5_STORAGE_KEY = 'nori-story-level5-v1';

    // --- Данные Части 1: 8 решений по квартире ---
    const PICKS = [
      { id: 'floor', label: 'Пол', options: [
        { name: 'Паркет ёлочкой',  correct: true,
          quote: 'Сложный паттерн. Будет красиво. Через полгода.' },
        { name: 'Ламинат',
          quote: 'Дёшево и быстро. Но не вы.' },
        { name: 'Плитка',
          quote: 'Холодно. Зато вечно.' },
      ]},
      { id: 'sofa', label: 'Диван', options: [
        { name: 'Серый бархатный угловой', correct: true,
          quote: 'Хороший выбор. Мне на нём удобно.' },
        { name: 'Белая ткань',
          quote: 'Маркий. Через месяц — серый бархатный, за свои деньги.' },
        { name: 'Зелёный модный',
          quote: 'Смело. Дерзко. Это будет видно от лифта.' },
      ]},
      { id: 'wall', label: 'Стена над диваном', options: [
        { name: 'Три красных арочных панно', correct: true,
          quote: 'Я уважаю. Они дерзкие.' },
        { name: 'Постер в раме',
          quote: 'Безопасно. Скучновато.' },
        { name: 'Голая стена',
          quote: 'Минимализм. Или забыли. Не отличить.' },
      ]},
      { id: 'mirror', label: 'Зеркало', options: [
        { name: 'Круглое с красными помпонами', correct: true,
          quote: 'Зеркало с помпонами. Это вы. Это не объясняется.' },
        { name: 'Прямоугольное обычное',
          quote: 'Зеркало. Просто зеркало. Скучно.' },
        { name: 'Большое во весь рост',
          quote: 'Практично. Но не история.' },
      ]},
      { id: 'shelves', label: 'Полки', options: [
        { name: 'Деревянные парящие', correct: true,
          quote: 'Минималистично. На них поместятся мои сувениры.' },
        { name: 'Стеклянные',
          quote: 'Стеклянные полки и кошка — плохое сочетание.' },
        { name: 'Без полок',
          quote: 'Куда вы сложите свои бесконечные штуки?' },
      ]},
      { id: 'rug', label: 'Ковёр', options: [
        { name: 'Этнический с орнаментом', correct: true,
          quote: 'Сложный паттерн. Я люблю на нём лежать.' },
        { name: 'Однотонный',
          quote: 'Безопасно.' },
        { name: 'Без ковра',
          quote: 'Полы холодные. Зимой пожалеете.' },
      ]},
      { id: 'lights', label: 'Освещение', options: [
        { name: 'Точечные + торшер', correct: true,
          quote: 'Свет должен быть умным. Они выбрали умно.' },
        { name: 'Люстра',
          quote: 'Олдскул. Но почему.' },
        { name: 'Только торшер',
          quote: 'Атмосферно. И темно.' },
      ]},
      { id: 'doors', label: 'Двери', options: [
        { name: 'Белые с матовым стеклом', correct: true,
          quote: 'Свет проходит. Соседи не видят. Идеально.' },
        { name: 'Глухие деревянные',
          quote: 'Темно.' },
        { name: 'Стеклянные без рамы',
          quote: 'Дёшево не выйдет.' },
      ]},
    ];

    // --- Данные Части 2: стадии Рубэна (толстеет от дня к дню) ---
    const RUBEN_STAGES = [
      { name: 'День 47 — без куртки', radius: 14, color: '#2a3d5e',
        intro: 'Это Рубэн, дизайнер на надзоре. Ходит по коридору и проверяет, что пройти можно. День 47, без куртки. Веди его к двери справа — не задень стены.',
        hitQuote: 'Стенку задел. Так нельзя. Ещё раз.' },
      { name: 'День 89 — куртка',      radius: 20, color: '#5a4a2a',
        intro: 'День 89. Похолодало. Рубэн надел куртку. Места меньше.',
        hitQuote: 'В куртке немного шире. Прицеливайся.' },
      { name: 'День 167 — пуховик',     radius: 26, color: '#c23028',
        intro: 'День 167. Минус двадцать. Пуховик. Это уже не надзор. Это блокада.',
        hitQuote: 'В пуховике плохо вижу. Сорри.' },
    ];
    // Серпантинный лабиринт-коридор. Viewport 600×200.
    // 4 препятствия (на 2 поворота меньше прежнего варианта), проход 70px:
    //   стадия 1 r=14 — слабина 42px, стадия 2 r=20 — 30px, стадия 3 r=26 — 18px.
    const MAZE_WALLS = [
      { x: 0,   y: 0,   w: 600, h: 14 },   // верхняя граница
      { x: 0,   y: 186, w: 600, h: 14 },   // нижняя
      // Серпантин: сверху-снизу-сверху-снизу…
      { x: 120, y: 14,  w: 14, h: 102 },
      { x: 240, y: 84,  w: 14, h: 102 },
      { x: 360, y: 14,  w: 14, h: 102 },
      { x: 480, y: 84,  w: 14, h: 102 },
    ];
    const MAZE_START = { x: 40,  y: 100 };
    const MAZE_GOAL_X = 565;
    const RUBEN_QUOTES = [
      'Так, тут пройти можно… да, можно…',
      'Стенка ровная. Хорошо.',
      'Электрика норм. Норм.',
      'Тут метр двадцать. Достаточно.',
      'Ага. Ага. Хорошо.',
      'Главное — пространство.',
    ];

    // --- Данные Части 3: герринбон ровно по проекту ---
    // 15 плиток в верхней половине стены (для игрока). Размеры подобраны так,
    // чтобы при правильной укладке плитки смыкались боками без зазоров.
    // Геометрия плитки «ёлочка» (herringbone) — точная.
    // При повороте плитки на ±45° её проекция на ось X равна W/√2.
    // Соседние плитки в строке встречаются концами: шаг по X = W/√2.
    // Между «строками шевронов» вертикальный шаг — высота шеврона = W/√2.
    const TILE_W = 96, TILE_H = 22;
    const SQ2 = Math.SQRT2;
    const STEP_X = TILE_W / SQ2;            // ≈ 67.9 — встреча углами в строке
    const STEP_Y = TILE_W / SQ2 / 2;        // ≈ 33.9 — половина высоты шеврона
    const IDEAL_TILES = [];
    (function buildIdealLayout() {
      // 4 столбца × 4 ряда = 16 плиток. Чётное число столбцов гарантирует,
      // что каждая плитка имеет парную «соседку» по шеврону — нет одиноких,
      // развёрнутых не в ту сторону.
      const cols = 4, rows = 4;
      const layoutW = (cols - 1) * STEP_X + TILE_W / SQ2;
      const xStart = (600 - layoutW) / 2 + (TILE_W / (2 * SQ2));
      const yStart = 50;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Чередуем наклон по столбцам — соседи образуют V-шеврон.
          const tilted = (c % 2 === 0);
          IDEAL_TILES.push({
            idx: r * cols + c,
            x: xStart + c * STEP_X,
            y: yStart + r * STEP_Y * 2,
            rotation: tilted ? -45 : 45,
          });
        }
      }
    })();
    const TILE_COUNT = IDEAL_TILES.length;  // 16

    // --- Прогресс ---
    const progress = {
      part1: {},   // pickId → optionIndex
      part2done: 0, // 0..3 — пройдено уровней Рубэна
      part3tiles: 0,
      passed: false,
    };
    function loadProgress() {
      // Сброс к дефолтам — чтобы in-memory state не пережил «Пройти заново».
      progress.part1 = {};
      progress.part2done = 0;
      progress.part3tiles = 0;
      progress.passed = false;
      try {
        const raw = localStorage.getItem(L5_STORAGE_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (p.part1 && typeof p.part1 === 'object') progress.part1 = p.part1;
        if (typeof p.part2done === 'number') progress.part2done = p.part2done;
        if (typeof p.part3tiles === 'number') progress.part3tiles = p.part3tiles;
        progress.passed = !!p.passed;
      } catch (e) {}
    }
    function saveProgress() {
      try { localStorage.setItem(L5_STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
    }
    function clearProgress() {
      progress.part1 = {}; progress.part2done = 0; progress.part3tiles = 0; progress.passed = false;
      try { localStorage.removeItem(L5_STORAGE_KEY); } catch (e) {}
    }

    // --- Ресурсы ---
    const listeners = [];
    const timeouts = [];
    let rafId = null;
    function on(el, evt, fn, opts) {
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }
    function cleanupAll() {
      listeners.forEach((fn) => fn()); listeners.length = 0;
      timeouts.forEach((t) => clearTimeout(t)); timeouts.length = 0;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    let contentEl = null;
    let onCompleteCb = null;

    function fadeTo(node) {
      if (!contentEl) return;
      document.querySelector('.nori-quote')?.classList.add('hidden');
      contentEl.classList.add('level5-fading');
      later(() => {
        contentEl.innerHTML = '';
        contentEl.appendChild(node);
        contentEl.classList.remove('level5-fading');
      }, 220);
    }

    function buildBubble(text) {
      const b = document.createElement('div');
      b.className = 'level5-bubble';
      b.innerHTML = '<span class="speaker">— Нори:</span> <p>' + text + '</p>';
      return b;
    }

    function buildNori(text) {
      const b = document.createElement('div');
      b.className = 'level5-nori';
      b.innerHTML = '<span class="speaker">— Нори:</span><p>' + text + '</p>';
      return b;
    }

    // =========================================
    //   СТАРТОВЫЙ ЭКРАН — «вы купили квартиру!»
    // =========================================
    function renderHello() {
      const wrap = document.createElement('div');
      wrap.className = 'level5-hello';
      wrap.innerHTML =
        '<div class="hello-confetti" aria-hidden="true"></div>' +
        '<h3 class="hello-title">🎉 Ура! Вы купили свою первую квартиру!</h3>' +
        '<p class="hello-sub">Свои стены. Свои стены без обоев. Свои стены без всего вообще. Но свои.</p>';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary hello-btn';
      btn.type = 'button';
      btn.textContent = 'Что дальше? →';
      on(btn, 'click', () => fadeTo(renderPart1()));
      wrap.appendChild(btn);
      // Конфетти-эмодзи плавают
      later(() => spawnHelloConfetti(wrap.querySelector('.hello-confetti')), 100);
      return wrap;
    }

    function spawnHelloConfetti(host) {
      if (!host) return;
      const emojis = ['🎉', '🏠', '🔑', '✨', '🎊'];
      for (let i = 0; i < 18; i++) {
        const p = document.createElement('span');
        p.className = 'hello-piece';
        p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        p.style.left = (5 + Math.random() * 90) + '%';
        p.style.animationDelay = (Math.random() * 0.6) + 's';
        p.style.animationDuration = (2 + Math.random() * 1.4) + 's';
        host.appendChild(p);
      }
    }

    // =========================================
    //   ЧАСТЬ 1 — РАССТАНОВКА
    // =========================================
    function renderPart1() {
      const wrap = document.createElement('div');
      wrap.className = 'level5-part1';
      wrap.appendChild(buildNori(
        'Сначала был план. В голове он выглядел красиво. Помоги им собрать его.'
      ));

      const stage = document.createElement('div');
      stage.className = 'level5-apt-stage';

      const scene = document.createElement('div');
      scene.className = 'level5-apt-scene';
      scene.innerHTML = buildApartmentSVG();
      stage.appendChild(scene);

      // Боковая панель выбора
      const aside = document.createElement('div');
      aside.className = 'level5-picks';
      const head = document.createElement('div');
      head.className = 'level5-picks-h';
      head.innerHTML = 'Выбери <span class="count">0 / 8</span>';
      aside.appendChild(head);

      const list = document.createElement('div');
      list.className = 'level5-picks-list';
      PICKS.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'level5-pick-row';
        row.dataset.pickId = p.id;
        const title = document.createElement('div');
        title.className = 'level5-pick-title';
        title.textContent = (i + 1) + '. ' + p.label;
        row.appendChild(title);
        const opts = document.createElement('div');
        opts.className = 'level5-pick-opts';
        p.options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'level5-pick-opt';
          btn.dataset.idx = String(idx);
          btn.textContent = opt.name;
          on(btn, 'click', () => choosePart1(p, idx, row, head, scene));
          opts.appendChild(btn);
        });
        row.appendChild(opts);
        list.appendChild(row);
      });
      aside.appendChild(list);
      stage.appendChild(aside);

      wrap.appendChild(stage);

      const btnRow = document.createElement('div');
      btnRow.className = 'row';
      const done = document.createElement('button');
      done.className = 'btn btn-primary';
      done.type = 'button';
      done.textContent = 'Готово, квартира собрана →';
      done.disabled = true;
      done.dataset.part1Done = '1';
      on(done, 'click', () => {
        if (done.disabled) return;
        // Финальный рендер тёплой квартиры на 2 сек, потом катсцена
        scene.classList.add('all-set');
        const ending = document.createElement('div');
        ending.className = 'level5-apt-ending';
        ending.textContent = 'Хочу тут жить!';
        scene.appendChild(ending);
        later(() => fadeTo(renderPart2()), 2200);
      });
      btnRow.appendChild(done);
      wrap.appendChild(btnRow);

      // Восстанавливаем предыдущие выборы
      Object.keys(progress.part1).forEach((pickId) => {
        const idx = progress.part1[pickId];
        const pick = PICKS.find((p) => p.id === pickId);
        const row = list.querySelector('[data-pick-id="' + pickId + '"]');
        if (pick && row) applyPickVisual(scene, pickId, idx, row);
      });
      updatePart1Header(head, done);

      return wrap;
    }

    function choosePart1(pick, idx, row, head, scene) {
      progress.part1[pick.id] = idx;
      saveProgress();
      applyPickVisual(scene, pick.id, idx, row);
      const wrap = row.closest('.level5-part1');
      const noriBubble = wrap.querySelector('.level5-nori p');
      if (noriBubble) noriBubble.textContent = pick.options[idx].quote;
      const done = wrap.querySelector('[data-part1-done]');
      updatePart1Header(head, done);
    }

    function applyPickVisual(scene, pickId, idx, row) {
      // Сцена: переключаем data-атрибут для соответствующего элемента
      scene.setAttribute('data-' + pickId, String(idx));
      // Кнопки: подсветить выбранный вариант
      row.querySelectorAll('.level5-pick-opt').forEach((b) => {
        b.classList.toggle('chosen', Number(b.dataset.idx) === idx);
      });
      row.classList.add('done');
    }

    function updatePart1Header(head, done) {
      const n = Object.keys(progress.part1).length;
      const countEl = head.querySelector('.count');
      if (countEl) countEl.textContent = n + ' / ' + PICKS.length;
      if (done) done.disabled = n < PICKS.length;
    }

    function buildApartmentSVG() {
      // viewBox 600x340. Front view гостиной, нарисованная по референс-фото:
      // светлые стены, паркет ёлочкой в серо-коричневом дереве, серый угловой
      // диван с шезлонгом, три красных арочных панно, круглое зеркало с
      // помпонами, парящие деревянные полки, двери с матовыми панелями 4×2.
      return [
        '<svg class="level5-apt-svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid meet">',
        // Стены (светло-серо-белые, лёгкая тень в углах)
        '<rect width="600" height="280" fill="#f3f1ed"/>',
        '<rect width="600" height="6" fill="#e6e2d8"/>',
        '<rect width="600" height="280" fill="url(#wallShadow)" opacity="0.4"/>',
        '<defs>',
          '<linearGradient id="wallShadow" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0" stop-color="#000" stop-opacity="0.06"/>',
            '<stop offset="0.4" stop-color="#000" stop-opacity="0"/>',
          '</linearGradient>',
        '</defs>',
        // Свет (точечные + торшер)
        '<g class="apt-lights">',
          '<circle class="dot" cx="180" cy="14" r="4" fill="#f4d680"/>',
          '<circle class="dot" cx="300" cy="14" r="4" fill="#f4d680"/>',
          '<circle class="dot" cx="420" cy="14" r="4" fill="#f4d680"/>',
          '<g class="chand" transform="translate(300, 12)">',
            '<line x1="0" y1="0" x2="0" y2="30" stroke="#8c6a3a" stroke-width="1.5"/>',
            '<ellipse cx="0" cy="38" rx="22" ry="10" fill="#d6c9ac" stroke="#8c6a3a"/>',
          '</g>',
          '<g class="torchere" transform="translate(530, 130)">',
            '<rect x="-2" y="0" width="4" height="120" fill="#3a2a18"/>',
            '<path d="M -14 0 L 14 0 L 8 -28 L -8 -28 Z" fill="#e8d6a8" stroke="#8c6a3a"/>',
          '</g>',
        '</g>',
        // ===== ПОЛ — 3 варианта =====
        '<g class="apt-floor floor-0">', // ёлочка (default visible if data-floor=0)
          buildHerringboneFloor(),
        '</g>',
        '<g class="apt-floor floor-1">',
          '<rect y="280" width="600" height="60" fill="#d9c5a0"/>',
          '<line x1="0" y1="295" x2="600" y2="295" stroke="#a8814f" stroke-width="0.6"/>',
          '<line x1="0" y1="315" x2="600" y2="315" stroke="#a8814f" stroke-width="0.6"/>',
          '<line x1="0" y1="330" x2="600" y2="330" stroke="#a8814f" stroke-width="0.6"/>',
        '</g>',
        '<g class="apt-floor floor-2">',
          '<rect y="280" width="600" height="60" fill="#c4c0b8"/>',
          buildTilePattern(0, 280, 600, 60, 30, 30, '#aaa'),
        '</g>',
        // ===== КОВЁР — 3 варианта =====
        '<g class="apt-rug rug-0">', // этнический с орнаментом (кремовый + сине-красный узор)
          // Основа ковра — кремовая
          '<rect x="155" y="248" width="300" height="62" fill="#f0e6c8" rx="2"/>',
          // Бахрома по краям
          '<rect x="155" y="246" width="300" height="3" fill="#d8c79a"/>',
          '<rect x="155" y="307" width="300" height="3" fill="#d8c79a"/>',
          // Внутренняя рамка
          '<rect x="167" y="256" width="276" height="46" fill="none" stroke="#9b6a4f" stroke-width="0.8"/>',
          // Цветочные «медальоны» — синие, красные, охра
          '<circle cx="200" cy="278" r="8" fill="#c23028" opacity="0.85"/>',
          '<circle cx="200" cy="278" r="4" fill="#f4b53c"/>',
          '<circle cx="248" cy="266" r="6" fill="#3a4d7a" opacity="0.85"/>',
          '<circle cx="248" cy="266" r="2.5" fill="#f4ead4"/>',
          '<circle cx="300" cy="278" r="7" fill="#f4b53c" opacity="0.85"/>',
          '<circle cx="300" cy="278" r="3" fill="#c23028"/>',
          '<circle cx="352" cy="266" r="6" fill="#3a4d7a" opacity="0.85"/>',
          '<circle cx="352" cy="266" r="2.5" fill="#f4ead4"/>',
          '<circle cx="404" cy="278" r="8" fill="#c23028" opacity="0.85"/>',
          '<circle cx="404" cy="278" r="4" fill="#f4b53c"/>',
          // Нижний ряд узоров — мелкие ромбики
          '<path d="M 200 296 L 205 292 L 210 296 L 205 300 Z" fill="#3a4d7a"/>',
          '<path d="M 248 296 L 253 292 L 258 296 L 253 300 Z" fill="#c23028"/>',
          '<path d="M 300 296 L 305 292 L 310 296 L 305 300 Z" fill="#3a4d7a"/>',
          '<path d="M 352 296 L 357 292 L 362 296 L 357 300 Z" fill="#c23028"/>',
          '<path d="M 404 296 L 409 292 L 414 296 L 409 300 Z" fill="#3a4d7a"/>',
        '</g>',
        '<g class="apt-rug rug-1">',
          '<rect x="180" y="240" width="240" height="55" fill="#b8a47a" rx="3"/>',
        '</g>',
        '<g class="apt-rug rug-2">',
          // ничего
        '</g>',
        // ===== ДИВАН — 3 варианта =====
        '<g class="apt-sofa sofa-0">', // серый угловой с шезлонгом (как в реале)
          // Основа дивана (большая прямая часть слева, шезлонг справа)
          '<rect x="170" y="206" width="180" height="50" fill="#5a5d62" rx="5"/>',
          '<rect x="350" y="206" width="100" height="50" fill="#5a5d62" rx="5"/>',
          // Подушки спинки на прямой части (нет на шезлонге справа)
          '<rect x="172" y="178" width="178" height="34" fill="#6b6e75" rx="4"/>',
          '<rect x="170" y="178" width="14" height="78" fill="#4a4d52" rx="3"/>',
          // Сидения с разделителями
          '<rect x="186" y="218" width="78" height="36" fill="#6b6e75" rx="3"/>',
          '<rect x="268" y="218" width="78" height="36" fill="#6b6e75" rx="3"/>',
          '<rect x="356" y="218" width="92" height="36" fill="#6b6e75" rx="3"/>',
          // Подушки декоративные с цветочным узором
          '<rect x="200" y="184" width="34" height="34" fill="#f4ead4" rx="3"/>',
          '<circle cx="210" cy="194" r="2.5" fill="#c97b5a"/>',
          '<circle cx="222" cy="200" r="2" fill="#f4b53c"/>',
          '<circle cx="214" cy="208" r="2" fill="#3d6b5a"/>',
          '<rect x="320" y="184" width="34" height="34" fill="#f4ead4" rx="3"/>',
          '<circle cx="330" cy="195" r="2.5" fill="#c97b5a"/>',
          '<circle cx="342" cy="201" r="2" fill="#f4b53c"/>',
          '<circle cx="334" cy="208" r="2" fill="#3d6b5a"/>',
          // Деревянные ножки
          '<rect x="178" y="256" width="6" height="8" fill="#8c6a3a"/>',
          '<rect x="338" y="256" width="6" height="8" fill="#8c6a3a"/>',
          '<rect x="440" y="256" width="6" height="8" fill="#8c6a3a"/>',
        '</g>',
        '<g class="apt-sofa sofa-1">',
          '<rect x="180" y="200" width="240" height="55" fill="#f0ede4" rx="6"/>',
          '<rect x="180" y="180" width="240" height="28" fill="#e8e4d8" rx="4"/>',
        '</g>',
        '<g class="apt-sofa sofa-2">',
          '<rect x="180" y="200" width="240" height="55" fill="#4b7a4a" rx="6"/>',
          '<rect x="180" y="180" width="240" height="28" fill="#5a8a59" rx="4"/>',
        '</g>',
        // ===== СТЕНА (панно над диваном) — 3 варианта =====
        '<g class="apt-wall wall-0">', // три красных арки с узорами
          // Левая арка — спиральный/племенной узор
          '<path d="M 220 80 L 220 170 L 256 170 L 256 80 Q 238 60 220 80 Z" fill="#c23028" stroke="#8a1a14" stroke-width="1.5"/>',
          '<path d="M 230 100 Q 238 90 246 100 Q 250 110 240 115 Q 232 112 230 100 Z" fill="none" stroke="#8a1a14" stroke-width="1.2"/>',
          '<path d="M 228 130 L 248 130 M 230 142 L 246 142" stroke="#8a1a14" stroke-width="1.2"/>',
          '<path d="M 232 152 L 236 158 L 240 152 L 244 158" stroke="#8a1a14" stroke-width="1.2" fill="none"/>',
          // Центральная арка — солнце с лучами
          '<path d="M 282 80 L 282 170 L 318 170 L 318 80 Q 300 60 282 80 Z" fill="#c23028" stroke="#8a1a14" stroke-width="1.5"/>',
          '<circle cx="300" cy="115" r="9" fill="#f4b53c" stroke="#8a1a14" stroke-width="1"/>',
          '<path d="M 300 100 L 300 95 M 300 130 L 300 135 M 287 115 L 282 115 M 313 115 L 318 115 M 290 105 L 286 101 M 310 105 L 314 101 M 290 125 L 286 129 M 310 125 L 314 129" stroke="#8a1a14" stroke-width="1"/>',
          '<path d="M 290 145 Q 300 140 310 145 Q 305 155 300 152 Q 295 155 290 145 Z" fill="none" stroke="#8a1a14" stroke-width="1"/>',
          // Правая арка — листик/растение
          '<path d="M 344 80 L 344 170 L 380 170 L 380 80 Q 362 60 344 80 Z" fill="#c23028" stroke="#8a1a14" stroke-width="1.5"/>',
          '<path d="M 362 100 L 362 158" stroke="#8a1a14" stroke-width="1.2"/>',
          '<path d="M 362 110 Q 354 112 352 120 Q 358 122 362 118" fill="none" stroke="#8a1a14" stroke-width="1.2"/>',
          '<path d="M 362 110 Q 370 112 372 120 Q 366 122 362 118" fill="none" stroke="#8a1a14" stroke-width="1.2"/>',
          '<path d="M 362 128 Q 354 130 352 138 Q 358 140 362 136" fill="none" stroke="#8a1a14" stroke-width="1.2"/>',
          '<path d="M 362 128 Q 370 130 372 138 Q 366 140 362 136" fill="none" stroke="#8a1a14" stroke-width="1.2"/>',
        '</g>',
        '<g class="apt-wall wall-1">',
          '<rect x="270" y="80" width="80" height="60" fill="#fff" stroke="#8c6a3a" stroke-width="2"/>',
          '<text x="310" y="115" text-anchor="middle" font-size="11" fill="#666">Постер</text>',
        '</g>',
        '<g class="apt-wall wall-2">',
          // голая стена — ничего
        '</g>',
        // ===== ЗЕРКАЛО — 3 варианта =====
        '<g class="apt-mirror mirror-0">', // круглое с красными помпонами по контуру
          // Помпоны по окружности (24 шт.)
          (function(){
            const r=42, cx=470, cy=100, out=[];
            for(let i=0;i<24;i++){
              const a=i*Math.PI*2/24;
              const px=cx+Math.cos(a)*r, py=cy+Math.sin(a)*r;
              out.push('<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="3.6" fill="#c23028"/>');
            }
            return out.join('');
          })(),
          // Кольцо-обводка зеркала
          '<circle cx="470" cy="100" r="38" fill="#dfe4e0" stroke="#2a2520" stroke-width="2"/>',
          // Лёгкий блик на стекле
          '<path d="M 450 80 Q 460 75 478 85" stroke="#fff" stroke-width="1.5" fill="none" opacity="0.7"/>',
        '</g>',
        '<g class="apt-mirror mirror-1">',
          '<rect x="475" y="65" width="50" height="70" fill="#dfe4e0" stroke="#3a2a18"/>',
        '</g>',
        '<g class="apt-mirror mirror-2">',
          '<rect x="475" y="50" width="50" height="170" fill="#dfe4e0" stroke="#3a2a18"/>',
        '</g>',
        // ===== ПОЛКИ — 3 варианта =====
        '<g class="apt-shelves shelves-0">', // парящие деревянные с декором (как у вас)
          // Верхняя полка
          '<rect x="60" y="85" width="110" height="6" fill="#a08055" stroke="#7a5a3a" stroke-width="0.6"/>',
          // Декор на верхней: чёрные металлические подсвечники
          '<rect x="74" y="70" width="9" height="15" fill="#1a1a1a"/>',
          '<rect x="88" y="64" width="8" height="21" fill="#1a1a1a"/>',
          '<rect x="100" y="68" width="8" height="17" fill="#1a1a1a"/>',
          // Красная коробочка
          '<rect x="148" y="73" width="16" height="12" fill="#c23028" stroke="#8a1a14" stroke-width="0.6"/>',
          // Нижняя полка
          '<rect x="60" y="135" width="110" height="6" fill="#a08055" stroke="#7a5a3a" stroke-width="0.6"/>',
          // Декор на нижней: ваза + два красных Dala-коня
          '<rect x="68" y="118" width="9" height="17" fill="#e8eef0" stroke="#aaa"/>',
          '<rect x="82" y="124" width="6" height="11" fill="#f4b53c"/>',
          '<rect x="94" y="121" width="9" height="14" fill="#c23028"/>',
          // Два Dala-коня
          '<path d="M 122 122 L 130 122 L 132 127 L 134 122 L 140 122 L 138 134 L 124 134 Z" fill="#c23028" stroke="#8a1a14" stroke-width="0.6"/>',
          '<path d="M 144 122 L 152 122 L 154 127 L 156 122 L 162 122 L 160 134 L 146 134 Z" fill="#c23028" stroke="#8a1a14" stroke-width="0.6"/>',
        '</g>',
        '<g class="apt-shelves shelves-1">',
          '<rect x="40" y="100" width="100" height="3" fill="#e8eef0" stroke="#aaa"/>',
          '<rect x="40" y="140" width="100" height="3" fill="#e8eef0" stroke="#aaa"/>',
        '</g>',
        '<g class="apt-shelves shelves-2">',
          // нет полок
        '</g>',
        // ===== ДВЕРИ — 3 варианта =====
        '<g class="apt-doors doors-0">', // белые с матовыми панелями 4×2
          '<rect x="0" y="60" width="48" height="220" fill="#fafafa" stroke="#3a2a18" stroke-width="1.5"/>',
          // Тёплый свет за дверью — мягкое золотистое свечение
          '<rect x="6" y="78" width="36" height="190" fill="#f4c878" opacity="0.45"/>',
          // 4 строки × 2 колонки матовых стёкол
          (function(){
            const out=[]; const xL=6, xR=27, w=15, h=42; const ys=[78,124,170,216];
            ys.forEach((y)=>{
              out.push('<rect x="'+xL+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#f0e6c8" opacity="0.75" stroke="#fafafa" stroke-width="0.8"/>');
              out.push('<rect x="'+xR+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#f0e6c8" opacity="0.75" stroke="#fafafa" stroke-width="0.8"/>');
            });
            return out.join('');
          })(),
          // Перегородки рамы
          '<rect x="22" y="78" width="3" height="180" fill="#fafafa"/>',
          '<rect x="6" y="119" width="36" height="3" fill="#fafafa"/>',
          '<rect x="6" y="165" width="36" height="3" fill="#fafafa"/>',
          '<rect x="6" y="211" width="36" height="3" fill="#fafafa"/>',
          // Ручка
          '<rect x="40" y="170" width="6" height="2" fill="#3a2a18"/>',
          '<circle cx="44" cy="171" r="1.4" fill="#3a2a18"/>',
        '</g>',
        '<g class="apt-doors doors-1">',
          '<rect x="0" y="60" width="36" height="220" fill="#8c6a3a" stroke="#3a2a18" stroke-width="1.5"/>',
          '<circle cx="28" cy="170" r="1.5" fill="#3a2a18"/>',
        '</g>',
        '<g class="apt-doors doors-2">',
          '<rect x="0" y="60" width="36" height="220" fill="#e8eef0" opacity="0.6" stroke="#aaa"/>',
        '</g>',
        // ===== Точки-индикаторы свободных мест =====
        '<g class="apt-hints">',
          // Hint-кружки появляются у тех элементов, что ещё НЕ выбраны.
          // Здесь это чисто декорация — выбор делается через сайдбар.
        '</g>',
        '</svg>',
      ].join('');
    }

    function buildHerringboneFloor() {
      // Серо-коричневый паркет ёлочкой, как на реф-фото гостиной.
      const out = ['<rect y="280" width="600" height="60" fill="#8b7560"/>'];
      const tileW = 28, tileH = 10;
      for (let y = 286; y < 340; y += tileH + 2) {
        for (let x = 6; x < 600; x += tileW * 2 + 6) {
          out.push('<rect x="' + x + '" y="' + y + '" width="' + tileW + '" height="' + tileH + '" fill="#9a8470" transform="rotate(40 ' + (x + tileW / 2) + ' ' + (y + tileH / 2) + ')"/>');
          out.push('<rect x="' + (x + tileW) + '" y="' + y + '" width="' + tileW + '" height="' + tileH + '" fill="#7a6450" transform="rotate(-40 ' + (x + tileW + tileW / 2) + ' ' + (y + tileH / 2) + ')"/>');
        }
      }
      return out.join('');
    }

    function buildTilePattern(x, y, w, h, tw, th, color) {
      const out = [];
      for (let yy = y; yy < y + h; yy += th) {
        for (let xx = x; xx < x + w; xx += tw) {
          out.push('<rect x="' + xx + '" y="' + yy + '" width="' + (tw - 1) + '" height="' + (th - 1) + '" fill="none" stroke="' + color + '" stroke-width="0.4"/>');
        }
      }
      return out.join('');
    }

    // =========================================
    //   КАТСЦЕНА 1
    // =========================================
    // =========================================
    //   ЧАСТЬ 2 — ПРОЙТИ ЧЕРЕЗ РУБЭНА
    // =========================================
    let p2 = null;
    function renderPart2() {
      const wrap = document.createElement('div');
      wrap.className = 'level5-part2';

      const step = document.createElement('div');
      step.className = 'level5-step';
      step.textContent = 'Шаг 2 · Коридор с Рубэном';
      wrap.appendChild(step);

      const bubble = buildBubble(RUBEN_STAGES[progress.part2done].intro);
      wrap.appendChild(bubble);

      const hud = document.createElement('div');
      hud.className = 'level5-p2-hud';
      hud.innerHTML =
        '<div class="p2-day">' + RUBEN_STAGES[progress.part2done].name + '</div>' +
        '<div class="p2-lives">♥♥♥</div>' +
        '<div class="p2-progress">' + (progress.part2done + 1) + ' / 3</div>';
      wrap.appendChild(hud);

      const stage = document.createElement('div');
      stage.className = 'level5-corridor-stage';
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 200;
      canvas.className = 'level5-corridor';
      stage.appendChild(canvas);
      wrap.appendChild(stage);

      // Виртуальный D-pad для мобильных (скрыт на десктопе)
      const touchPanel = document.createElement('div');
      touchPanel.className = 'level5-touch-controls';
      touchPanel.innerHTML =
        '<div class="dpad">' +
          '<button class="dpad-btn dpad-up" data-dir="up" type="button">▲</button>' +
          '<button class="dpad-btn dpad-left" data-dir="left" type="button">◀</button>' +
          '<button class="dpad-btn dpad-right" data-dir="right" type="button">▶</button>' +
          '<button class="dpad-btn dpad-down" data-dir="down" type="button">▼</button>' +
        '</div>';
      wrap.appendChild(touchPanel);

      const hint = document.createElement('p');
      hint.className = 'level5-hint';
      hint.textContent = 'Стрелки/WASD (или экранные кнопки) — двигай Рубэна по коридору к двери справа.';
      wrap.appendChild(hint);

      const skipRow = document.createElement('div');
      skipRow.className = 'level5-skip-row';
      wrap.appendChild(skipRow);

      later(() => startP2(canvas, hud, bubble, skipRow, wrap), 80);
      return wrap;
    }

    function startP2(canvas, hud, bubble, skipRow, wrap) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const stageIdx = progress.part2done;
      const config = RUBEN_STAGES[stageIdx];

      p2 = {
        ruben: { x: MAZE_START.x, y: MAZE_START.y, r: config.radius },
        keys: { up:0, down:0, left:0, right:0 },
        lives: 3,
        failures: 0,
        finished: false,
        lastTick: 0,
        speech: { text: '', until: 0 },
        nextSpeech: 2500,
        hitFlash: 0,
      };

      function setBubble(text) {
        const p = bubble.querySelector('p');
        if (p) p.textContent = text;
      }
      function setLives() {
        const livesEl = hud.querySelector('.p2-lives');
        livesEl.textContent = '♥'.repeat(p2.lives) + '♡'.repeat(3 - p2.lives);
      }

      function circleHitsWall(cx, cy, r) {
        for (let i = 0; i < MAZE_WALLS.length; i++) {
          const w = MAZE_WALLS[i];
          const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
          const ny = Math.max(w.y, Math.min(cy, w.y + w.h));
          const dx = cx - nx, dy = cy - ny;
          if (dx * dx + dy * dy < r * r) return true;
        }
        return false;
      }

      function fail() {
        if (p2.finished) return;
        AUDIO.play('error');
        p2.lives--;
        p2.failures++;
        p2.hitFlash = 1.0;
        setBubble(config.hitQuote);
        setLives();
        // Всегда останавливаем цикл и перезапускаем после паузы,
        // чтобы игрок успел увидеть, что случилось.
        stopLoop();
        const dead = p2.lives <= 0;
        if (dead) {
          setBubble('Кончились жизни. Эту стадию заново.');
          p2.lives = 3;
          setLives();
        }
        p2.ruben.x = MAZE_START.x; p2.ruben.y = MAZE_START.y;
        p2.keys.up = p2.keys.down = p2.keys.left = p2.keys.right = 0;
        later(() => { if (p2 && !p2.finished) startLoop(); }, dead ? 1200 : 650);
        // Доп: 3 провала на последней стадии — предложение пропуска
        if (stageIdx === 2 && p2.failures >= 3 && skipRow.children.length === 0) {
          setBubble('Ладно. Просто прокрадись. Я закрою глаза.');
          const skip = document.createElement('button');
          skip.className = 'btn btn-primary';
          skip.type = 'button';
          skip.textContent = 'Прокрасться → дальше';
          on(skip, 'click', () => {
            stopLoop();
            progress.part2done = 3; saveProgress();
            fadeTo(renderPart3());
          });
          skipRow.appendChild(skip);
        }
      }

      function win() {
        if (p2.finished) return;
        AUDIO.play('success');
        p2.finished = true;
        stopLoop();
        progress.part2done++;
        saveProgress();
        setBubble('Прошёл! ' + (progress.part2done < 3 ? 'Дальше — следующий день.' : 'Невозможное возможно. Идём дальше.'));
        later(() => {
          if (progress.part2done < 3) fadeTo(renderPart2());
          else fadeTo(renderPart3());
        }, 1600);
      }

      function tick(t) {
        if (!p2 || p2.finished) return;
        const dt = p2.lastTick ? Math.min(0.05, (t - p2.lastTick) / 1000) : 0;
        p2.lastTick = t;

        const SPEED = 105;
        const k = p2.keys;
        let vx = k.right - k.left, vy = k.down - k.up;
        const len = Math.hypot(vx, vy);
        if (len > 0) { vx /= len; vy /= len; }
        // Пробуем по X и Y отдельно, чтобы при касании стены можно было скользить вдоль
        const dx = vx * SPEED * dt;
        const dy = vy * SPEED * dt;
        const tryX = Math.max(p2.ruben.r, Math.min(W - p2.ruben.r, p2.ruben.x + dx));
        if (!circleHitsWall(tryX, p2.ruben.y, p2.ruben.r)) {
          p2.ruben.x = tryX;
        } else if (dx !== 0) {
          fail(); return;
        }
        const tryY = Math.max(p2.ruben.r, Math.min(H - p2.ruben.r, p2.ruben.y + dy));
        if (!circleHitsWall(p2.ruben.x, tryY, p2.ruben.r)) {
          p2.ruben.y = tryY;
        } else if (dy !== 0) {
          fail(); return;
        }

        // Реплики Рубэна (мысли вслух пока идёт)
        p2.nextSpeech -= dt * 1000;
        if (p2.nextSpeech <= 0) {
          p2.speech.text = RUBEN_QUOTES[Math.floor(Math.random() * RUBEN_QUOTES.length)];
          p2.speech.until = t + 2500;
          p2.nextSpeech = 3500 + Math.random() * 2500;
        }
        if (t > p2.speech.until) p2.speech.text = '';

        if (p2.ruben.x >= MAZE_GOAL_X) win();

        drawMaze(ctx, W, H, p2, stageIdx, t);
        if (p2.hitFlash > 0) p2.hitFlash -= dt * 2;
        rafId = requestAnimationFrame(tick);
      }
      function startLoop() {
        p2.lastTick = 0; p2.finished = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      }
      function stopLoop() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
      function codeToKey(e) {
        const m = {ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
        return m[e.code];
      }
      on(window, 'keydown', (e) => {
        const k = codeToKey(e); if (k) { p2.keys[k] = 1; e.preventDefault(); }
      });
      on(window, 'keyup', (e) => {
        const k = codeToKey(e); if (k) { p2.keys[k] = 0; e.preventDefault(); }
      });
      // Тач: тот же D-pad с .dpad-btn
      wrap.querySelectorAll('.dpad-btn').forEach((btn) => {
        const dir = btn.dataset.dir;
        const press = (e) => { p2.keys[dir] = 1; e.preventDefault(); };
        const release = (e) => { p2.keys[dir] = 0; e.preventDefault(); };
        on(btn, 'touchstart', press, { passive: false });
        on(btn, 'touchend', release);
        on(btn, 'touchcancel', release);
        on(btn, 'mousedown', press);
        on(btn, 'mouseup', release);
        on(btn, 'mouseleave', release);
      });

      setLives();
      startLoop();
    }

    function drawMaze(ctx, W, H, p, stageIdx, t) {
      // Пол коридора — паркет ёлочкой
      ctx.fillStyle = '#5a4836';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#3a2a18';
      ctx.lineWidth = 0.5;
      for (let yy = 14; yy < H - 14; yy += 16) {
        for (let xx = 10; xx < W; xx += 60) {
          ctx.strokeRect(xx, yy, 26, 7);
          ctx.strokeRect(xx + 30, yy + 3, 26, 7);
        }
      }

      // Цель — светлая зона справа (дверь)
      ctx.fillStyle = '#f4e8b8';
      ctx.fillRect(MAZE_GOAL_X, 14, W - MAZE_GOAL_X, H - 28);
      ctx.fillStyle = '#888';
      ctx.fillRect(W - 6, 90, 4, 20);

      // Стены
      ctx.fillStyle = '#1f1a14';
      MAZE_WALLS.forEach((w) => ctx.fillRect(w.x, w.y, w.w, w.h));
      // Лёгкий блик сверху стен
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      MAZE_WALLS.forEach((w) => { if (w.h < 100) ctx.fillRect(w.x, w.y, w.w, 2); });

      // Рубэн
      const r = p.ruben;
      const cfg = RUBEN_STAGES[stageIdx];
      // Куртка/пуховик слоями
      if (stageIdx >= 2) {
        ctx.fillStyle = '#c23028';  // пуховик
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a1a14';
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r - 2, 0, Math.PI * 2); ctx.fill();
        // Стёжки пуховика
        ctx.strokeStyle = '#5a0a04'; ctx.lineWidth = 0.8;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(r.x + Math.cos(a) * (r.r - 1), r.y + Math.sin(a) * (r.r - 1));
          ctx.lineTo(r.x + Math.cos(a) * (r.r - 6), r.y + Math.sin(a) * (r.r - 6));
          ctx.stroke();
        }
      } else if (stageIdx >= 1) {
        ctx.fillStyle = '#5a4a2a';
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2a18';
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r - 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#2a3d5e';
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
      }
      // Голова — кружок-лицо в центре
      ctx.fillStyle = '#f4d3a8';
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.min(5, r.r * 0.42), 0, Math.PI * 2); ctx.fill();
      // Глазки
      ctx.fillStyle = '#1a1a1a';
      const eyeOff = Math.min(1.5, r.r * 0.18);
      ctx.beginPath(); ctx.arc(r.x - eyeOff, r.y - 0.5, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r.x + eyeOff, r.y - 0.5, 0.7, 0, Math.PI * 2); ctx.fill();

      // Облачко с мыслью Рубэна
      if (p.speech.text) {
        const tx = Math.max(60, Math.min(W - 140, r.x));
        const ty = Math.max(28, r.y - r.r - 18);
        const tw = Math.min(220, p.speech.text.length * 5 + 24);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        const rrr = 6;
        ctx.beginPath();
        ctx.moveTo(tx - tw / 2 + rrr, ty - 9);
        ctx.lineTo(tx + tw / 2 - rrr, ty - 9);
        ctx.quadraticCurveTo(tx + tw / 2, ty - 9, tx + tw / 2, ty - 9 + rrr);
        ctx.lineTo(tx + tw / 2, ty + 9);
        ctx.quadraticCurveTo(tx + tw / 2, ty + 9 + rrr, tx + tw / 2 - rrr, ty + 9 + rrr);
        ctx.lineTo(tx - tw / 2 + rrr, ty + 9 + rrr);
        ctx.quadraticCurveTo(tx - tw / 2, ty + 9 + rrr, tx - tw / 2, ty + 9);
        ctx.lineTo(tx - tw / 2, ty - 9 + rrr);
        ctx.quadraticCurveTo(tx - tw / 2, ty - 9, tx - tw / 2 + rrr, ty - 9);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.speech.text, tx, ty + 4);
      }

      // Вспышка штрафа
      if (p.hitFlash > 0) {
        ctx.fillStyle = 'rgba(214, 90, 60, ' + (p.hitFlash * 0.45) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    // =========================================
    //   КАТСЦЕНА 2
    // =========================================
    // =========================================
    //   ЧАСТЬ 3 — ПЛИТКА ЁЛОЧКОЙ
    // =========================================
    // НОВАЯ МЕХАНИКА: игрок таскает плитки мышью и кладёт ИХ ТАМ, где отпустил.
    // Магнит-к-сетке отсутствует. Плитка фиксируется с лёгким случайным сдвигом
    // и наклоном — «дрогнула рука». Перфекционисты страдают. В финале —
    // сравнение «идеал vs реальность» с процентом точности.
    let p3 = null;

    function renderPart3() {
      const wrap = document.createElement('div');
      wrap.className = 'level5-part3';

      const step = document.createElement('div');
      step.className = 'level5-step';
      step.textContent = 'Шаг 3 · Плитка ёлочкой';
      wrap.appendChild(step);

      const bubble = buildBubble(
        'Поехали. Главное — не торопиться. И не быть перфекционистом. ' +
        'Перфекционисты в ремонте умирают.'
      );
      wrap.appendChild(bubble);

      // HUD: статус + счётчик
      const hud = document.createElement('div');
      hud.className = 'level5-p3-hud';
      hud.innerHTML =
        '<div class="p3-status">Сквозь стену видны направляющие — куда должна лечь плитка.</div>' +
        '<div class="p3-counter">0 / ' + TILE_COUNT + '</div>';
      wrap.appendChild(hud);

      const stageWrap = document.createElement('div');
      stageWrap.className = 'level5-tile-stage-v2';
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 360;
      canvas.className = 'level5-tile-canvas';
      stageWrap.appendChild(canvas);
      wrap.appendChild(stageWrap);

      const hint = document.createElement('p');
      hint.className = 'level5-hint';
      hint.textContent =
        'Тяни плитку из стопки снизу к стене и отпусти. ' +
        'Кликни на уложенную — взять обратно. R — повернуть.';
      wrap.appendChild(hint);

      // Кнопка «Повернуть» для мобильных (на десктопе скрыта)
      const rotateBtn = document.createElement('button');
      rotateBtn.className = 'level5-tile-rotate-btn';
      rotateBtn.type = 'button';
      rotateBtn.textContent = '↻ Повернуть';
      wrap.appendChild(rotateBtn);

      later(() => startP3(canvas, bubble, hud, wrap, rotateBtn), 80);
      return wrap;
    }

    function startP3(canvas, bubble, hud, wrap, rotateBtn) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;

      p3 = {
        placed: [],
        pileCount: TILE_COUNT,
        dragging: null,
        mouseX: -100, mouseY: -100,
        eventState: null,
        eventTimer: 0,
        shakeBoost: 0,
        nextShortTile: false,
        workerVisible: false,
        voiceVisible: false,
        finished: false,
        led: 0,
        triggeredEvents: new Set(),
      };

      function counterText() {
        const c = hud.querySelector('.p3-counter');
        if (c) c.textContent = p3.placed.length + ' / ' + TILE_COUNT;
      }
      function noriText(t) {
        const p = bubble.querySelector('p');
        if (p) p.textContent = t;
      }
      function noriProgress() {
        const pct = p3.placed.length / TILE_COUNT;
        if (pct < 0.3) return 'Уже что-то вырисовывается.';
        if (pct < 0.55) return 'Ты лучше его. Не обижайся, рабочий, но это правда.';
        if (pct < 0.8) return 'Видишь? У тебя получается.';
        if (pct < 0.95) return 'Ещё чуть-чуть.';
        return 'Финиш близко. Не сдавайся.';
      }

      function canvasCoordsFromEvent(e) {
        const r = canvas.getBoundingClientRect();
        let cx = e.clientX;
        let cy = e.clientY;
        if (cx == null && e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
        if (cx == null && e.changedTouches && e.changedTouches[0]) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
        return {
          x: (cx - r.left) * (W / r.width),
          y: (cy - r.top) * (H / r.height),
        };
      }

      function pickupFromPile() {
        if (p3.dragging || p3.pileCount <= 0) return;
        const rot = (p3.placed.length % 2 === 0) ? -45 : 45;
        const isShort = p3.nextShortTile;
        p3.nextShortTile = false;
        p3.dragging = {
          x: p3.mouseX, y: p3.mouseY,
          rot, isShort, fromPlacedIdx: null,
        };
        p3.pileCount--;
        noriText(isShort
          ? 'Эта обрезанная. Под край. Поверни в голове.'
          : noriProgress());
      }

      function pickupPlacedAt(x, y) {
        for (let i = p3.placed.length - 1; i >= 0; i--) {
          const t = p3.placed[i];
          const dx = x - t.x, dy = y - t.y;
          const a = -t.rot * Math.PI / 180;
          const lx = dx * Math.cos(a) - dy * Math.sin(a);
          const ly = dx * Math.sin(a) + dy * Math.cos(a);
          const halfW = (t.isShort ? TILE_W * 0.85 : TILE_W) / 2;
          if (Math.abs(lx) <= halfW && Math.abs(ly) <= TILE_H / 2) {
            p3.dragging = {
              x: t.x, y: t.y, rot: t.rot,
              isShort: t.isShort, fromPlacedIdx: i,
            };
            p3.placed.splice(i, 1);
            counterText();
            progress.part3tiles = p3.placed.length;
            saveProgress();
            return true;
          }
        }
        return false;
      }

      function placeDragging() {
        if (!p3.dragging) return;
        // КООРДИНАТЫ берём из ТЕКУЩЕГО положения курсора, а не из dragging
        // (dragging.x/y — это место подъёма, оно неактуально на момент сброса).
        // ±3-5px смещение и ±5° (±10° при тряске) — «неровная рука».
        const noisePx = 3 + Math.random() * 2;
        const noiseDeg = 5 + p3.shakeBoost;
        const dirA = Math.random() * Math.PI * 2;
        const placedX = p3.mouseX + Math.cos(dirA) * noisePx;
        const placedY = p3.mouseY + Math.sin(dirA) * noisePx;
        const placedRot = p3.dragging.rot + (Math.random() * 2 - 1) * noiseDeg;
        const wasFromPile = (p3.dragging.fromPlacedIdx === null);
        p3.placed.push({
          x: placedX, y: placedY, rot: placedRot, isShort: p3.dragging.isShort,
        });
        p3.dragging = null;
        progress.part3tiles = p3.placed.length;
        saveProgress();
        counterText();
        if (wasFromPile) maybeTriggerEvent();
        if (p3.placed.length >= TILE_COUNT && p3.pileCount === 0) finishPart3();
      }

      function rotateDragging(deg) {
        if (!p3.dragging) return;
        p3.dragging.rot += deg;
      }

      function maybeTriggerEvent() {
        const n = p3.placed.length;
        if (n === 3 && !p3.triggeredEvents.has('shake')) startEvent('shake');
        else if (n === 6 && !p3.triggeredEvents.has('short')) startEvent('short');
        else if (n === 9 && !p3.triggeredEvents.has('worker')) startEvent('worker');
        else if (n === 12 && !p3.triggeredEvents.has('voice')) startEvent('voice');
      }

      function startEvent(kind) {
        p3.triggeredEvents.add(kind);
        p3.eventState = kind;
        if (kind === 'shake') {
          p3.shakeBoost = 5;
          p3.eventTimer = 5000;
          noriText('Дрогнула рука. Бывает. Не сдавайся.');
        } else if (kind === 'short') {
          p3.nextShortTile = true;
          p3.eventTimer = 0;
        } else if (kind === 'worker') {
          p3.workerVisible = true;
          p3.eventTimer = 3000;
          noriText('Рабочий вернулся: «Я бы делал не так. Но ладно.» Не слушай. Делай дальше.');
        } else if (kind === 'voice') {
          p3.voiceVisible = true;
          p3.eventTimer = 2200;
          noriText('Назар прислал голосовое. Ответь ему потом. Не отвлекайся.');
        }
      }

      function finishPart3() {
        p3.finished = true;
        const accuracy = computeAccuracy();
        progress.passed = true;
        saveProgress();
        noriText('Готово. Сделано вечером. Не за три недели.');
        // Лента плавно загорается, потом — экран сравнения.
        // Используем setInterval (а не requestAnimationFrame), чтобы анимация
        // не залипала во фоновых вкладках / iframe (rAF там не тикает).
        const startT = Date.now();
        const ledTimer = setInterval(() => {
          const dtt = (Date.now() - startT) / 1800;
          p3.led = Math.min(1, dtt);
          draw();
          if (dtt >= 1) {
            clearInterval(ledTimer);
            later(() => fadeTo(renderCompare(accuracy)), 700);
          }
        }, 60);
        timeouts.push(ledTimer);
      }

      // -------- DRAWING --------
      function draw() {
        // Фон стены
        ctx.fillStyle = '#f0e8d8';
        ctx.fillRect(0, 0, W, H);

        // LED-лента
        drawLED();

        // Игровая зона стены — расширена вниз (была верхняя половина, теперь
        // занимает всю площадь до столешницы). Светло-серая.
        ctx.fillStyle = '#dfdbd0';
        ctx.fillRect(20, 12, 560, 240);

        // Полупрозрачные направляющие — куда плитка должна лечь
        ctx.save();
        ctx.globalAlpha = 0.32;
        IDEAL_TILES.forEach(t => drawTileShape(t.x, t.y, t.rotation, null, '#5a564e', false, true));
        ctx.restore();

        // Уложенные игроком плитки — контрастные, светло-серые с обводкой
        p3.placed.forEach(t => drawTileShape(t.x, t.y, t.rot, '#b8b3a8', '#3a342c', t.isShort, false));

        // Столешница (чёрная) — нижняя полоса
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 260, W, 28);
        // Кран
        ctx.fillStyle = '#888';
        ctx.fillRect(78, 263, 4, 16);
        ctx.fillRect(68, 263, 24, 4);
        ctx.fillStyle = '#666';
        ctx.fillRect(64, 277, 24, 2);

        // Стопка плиток (внизу)
        drawPile();

        // Рабочий справа (событие)
        if (p3.workerVisible) drawWorker();
        // Иконка голосового сообщения (событие)
        if (p3.voiceVisible) drawVoiceIcon();

        // Плитка, которая follows курсор (поверх всего)
        if (p3.dragging) {
          drawTileShape(p3.mouseX, p3.mouseY, p3.dragging.rot, '#cac5b9', '#3a342c', p3.dragging.isShort, false, true);
        }
      }

      function drawLED() {
        const lit = p3.led || 0;
        if (lit <= 0.02) {
          ctx.fillStyle = '#d8d4c8';
          ctx.fillRect(20, 4, 560, 5);
          // Профиль
          ctx.fillStyle = '#b8b4a8';
          ctx.fillRect(20, 9, 560, 1);
          return;
        }
        ctx.save();
        ctx.shadowColor = 'rgba(255,240,200,' + (0.7 * lit) + ')';
        ctx.shadowBlur = 16 * lit;
        ctx.fillStyle = 'rgba(255, 250, 225, ' + lit + ')';
        ctx.fillRect(20, 4, 560, 5);
        ctx.restore();
        // Освещение стены — тонкий градиент
        const grad = ctx.createLinearGradient(0, 12, 0, 80);
        grad.addColorStop(0, 'rgba(255,240,200,' + (0.35 * lit) + ')');
        grad.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(20, 12, 560, 80);
      }

      function drawTileShape(x, y, rot, fill, stroke, isShort, isGuide, isGhost) {
        const w = isShort ? TILE_W * 0.85 : TILE_W;
        const h = TILE_H;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot * Math.PI / 180);
        if (isGuide) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(-w/2, -h/2, w, h);
          ctx.setLineDash([]);
        } else {
          if (isGhost) ctx.globalAlpha = 0.85;
          ctx.fillStyle = fill;
          ctx.fillRect(-w/2, -h/2, w, h);
          // мраморный развод
          const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
          grad.addColorStop(0, 'rgba(255,255,255,0.18)');
          grad.addColorStop(0.5, 'rgba(120,114,104,0)');
          grad.addColorStop(1, 'rgba(120,114,104,0.18)');
          ctx.fillStyle = grad;
          ctx.fillRect(-w/2, -h/2, w, h);
          // тонкая обводка
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 0.6;
          ctx.strokeRect(-w/2, -h/2, w, h);
          // лёгкая жилка мрамора
          ctx.strokeStyle = 'rgba(120,114,104,0.25)';
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(-w/2 + 6, -h/2 + 4);
          ctx.bezierCurveTo(-w/4, h/2 - 5, w/4, -h/2 + 4, w/2 - 6, h/2 - 3);
          ctx.stroke();
          if (isGhost) ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      function drawPile() {
        // Светлая полоса под столешницей — где лежат плитки
        ctx.fillStyle = '#f0e8d8';
        ctx.fillRect(0, 288, W, 72);
        ctx.fillStyle = '#cbb98a';
        ctx.fillRect(0, 288, W, 1);
        // Подпись
        ctx.fillStyle = '#5a4836';
        ctx.font = 'bold 12px "Space Grotesk", sans-serif';
        ctx.fillText('Стопка плиток · ' + p3.pileCount + ' шт', 24, 306);
        ctx.font = '11px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#8a7c64';
        ctx.fillText('зажми и тащи', 24, 322);
        // Стопка плиток — рисуется веером справа
        const visible = Math.min(8, p3.pileCount);
        const baseX = 200, baseY = 326;
        for (let i = 0; i < visible; i++) {
          const dx = baseX + i * 22;
          ctx.save();
          ctx.translate(dx, baseY);
          ctx.rotate((i - visible / 2) * 0.04);
          ctx.fillStyle = '#b8b3a8';
          ctx.strokeStyle = '#3a342c';
          ctx.lineWidth = 0.7;
          ctx.fillRect(-26, -8, 52, 16);
          ctx.strokeRect(-26, -8, 52, 16);
          ctx.restore();
        }
      }

      function drawWorker() {
        const x = 555, y = 240;
        ctx.save();
        ctx.translate(x, y);
        // тело
        ctx.fillStyle = '#c97b5a';
        ctx.fillRect(-7, -16, 14, 24);
        // голова
        ctx.fillStyle = '#f4d3a8';
        ctx.beginPath(); ctx.arc(0, -22, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2218';
        ctx.fillRect(-5, -27, 10, 3);
        // облачко с репликой
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-72, -50, 64, 22, 5);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2a18';
        ctx.font = '9px "Space Grotesk", sans-serif';
        ctx.fillText('Я бы не так…', -68, -36);
        ctx.restore();
      }

      function drawVoiceIcon() {
        ctx.save();
        ctx.translate(W - 36, 28);
        ctx.fillStyle = '#5a8a3a';
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎤', 0, 5);
        ctx.textAlign = 'left';
        ctx.restore();
      }

      // -------- LOOP --------
      let lastT = 0;
      function tick(t) {
        if (!p3 || p3.finished) return;
        const dt = lastT ? Math.min(50, t - lastT) : 0;
        lastT = t;
        if (p3.eventTimer > 0) {
          p3.eventTimer -= dt;
          if (p3.eventTimer <= 0) {
            if (p3.eventState === 'shake') p3.shakeBoost = 0;
            if (p3.eventState === 'worker') p3.workerVisible = false;
            if (p3.eventState === 'voice') p3.voiceVisible = false;
            p3.eventState = null;
          }
        }
        draw();
        rafId = requestAnimationFrame(tick);
      }

      // -------- INPUT (Pointer Events — единые для мыши и тача) --------
      // setPointerCapture гарантирует, что палец/курсор «прилипает» к canvas
      // даже если ушёл за пределы — стабильно для дрэга на мобильных.
      const PICKUP_Y_MAX = 252;   // вся стена (увеличили под новую геометрию)
      const PILE_Y_MIN   = 288;

      on(canvas, 'pointerdown', (e) => {
        if (p3.finished) return;
        // На мыши — только левая кнопка
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const c = canvasCoordsFromEvent(e);
        p3.mouseX = c.x; p3.mouseY = c.y;
        try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
        if (!p3.dragging) {
          if (c.y >= 12 && c.y <= PICKUP_Y_MAX) {
            if (pickupPlacedAt(c.x, c.y)) { draw(); e.preventDefault(); return; }
          }
          if (c.y >= PILE_Y_MIN && p3.pileCount > 0) {
            pickupFromPile();
          }
        }
        draw();
        e.preventDefault();
      });
      on(canvas, 'pointermove', (e) => {
        const c = canvasCoordsFromEvent(e);
        p3.mouseX = c.x; p3.mouseY = c.y;
        if (p3.dragging) { draw(); e.preventDefault(); }
      });
      on(canvas, 'pointerup', (e) => {
        try { canvas.releasePointerCapture(e.pointerId); } catch (er) {}
        if (p3.dragging) { placeDragging(); draw(); }
      });
      on(canvas, 'pointercancel', (e) => {
        try { canvas.releasePointerCapture(e.pointerId); } catch (er) {}
        if (p3.dragging) { placeDragging(); draw(); }
      });
      // Right-click — поворот на 90° (десктоп)
      on(canvas, 'contextmenu', (e) => {
        e.preventDefault();
        rotateDragging(90);
        draw();
      });
      // Кнопка «Повернуть» — для мобильных (правый клик там недоступен)
      if (rotateBtn) {
        on(rotateBtn, 'click', () => {
          rotateDragging(15);
          draw();
        });
      }
      on(window, 'keydown', (e) => {
        if (!p3 || !p3.dragging) return;
        const k = e.key;
        if (k === 'r' || k === 'R' || k === 'к' || k === 'К') {
          rotateDragging(15);
          draw();
          e.preventDefault();
        }
      });

      counterText();
      rafId = requestAnimationFrame(tick);
    }

    // Считаем точность: для каждой уложенной плитки находим ближайший
    // неиспользованный идеальный слот и суммируем штрафы за расстояние и угол.
    function computeAccuracy() {
      if (!p3 || !p3.placed.length) return 0;
      const slots = IDEAL_TILES.map(t => ({ ...t }));
      const used = new Array(slots.length).fill(false);
      let totalPenalty = 0;
      p3.placed.forEach((t) => {
        let bestI = -1, bestD = Infinity;
        for (let i = 0; i < slots.length; i++) {
          if (used[i]) continue;
          const d = Math.hypot(t.x - slots[i].x, t.y - slots[i].y);
          if (d < bestD) { bestD = d; bestI = i; }
        }
        if (bestI === -1) { totalPenalty += 100; return; }
        used[bestI] = true;
        const s = slots[bestI];
        let da = Math.abs(((t.rot - s.rotation) % 180) + 180) % 180;
        if (da > 90) da = 180 - da;
        const distPen = Math.min(bestD * 1.6, 60);
        const anglePen = Math.min(da * 2.2, 30);
        totalPenalty += distPen + anglePen;
      });
      const avg = totalPenalty / p3.placed.length;
      return Math.max(0, Math.min(100, Math.round(100 - avg)));
    }

    function noriForAccuracy(acc) {
      if (acc >= 90) return 'Ты молодец. Лучше чем у Назара. Не показывай ему — обидится.';
      if (acc >= 70) return 'Норм. Это лучше, чем три недели ожидания. Назар покритиковал бы. Но Назар не идеален тоже.';
      if (acc >= 50) return 'Кривовато. Но это сделал ты. Своими руками. Это уже подвиг. Назар бы сказал «эх». Но Назар нам уже надоел.';
      if (acc >= 30) return 'Ну… своими руками же. Главное — не идеал. Главное — что сделал. Назар, не смотри.';
      return 'Знаешь, забудь про точность. Это сделал ты сам. И у меня есть подозрение, что Назар тоже не идеально клал. Просто он быстрее ушёл на обед.';
    }

    function renderCompare(accuracy) {
      const wrap = document.createElement('div');
      wrap.className = 'level5-compare';

      const head = document.createElement('div');
      head.className = 'level5-compare-accuracy';
      head.innerHTML = 'Точность: <span>' + accuracy + '%</span>';
      wrap.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'level5-compare-grid';

      const mkSide = (title, tiles, kind) => {
        const side = document.createElement('div');
        side.className = 'level5-compare-side ' + kind;
        const t = document.createElement('div');
        t.className = 'level5-compare-title';
        t.textContent = title;
        side.appendChild(t);
        const c = document.createElement('canvas');
        c.width = 320; c.height = 200;
        c.className = 'level5-compare-canvas';
        side.appendChild(c);
        drawComparePanel(c.getContext('2d'), tiles);
        return side;
      };

      grid.appendChild(mkSide('Идеал (по версии Назара)',
        IDEAL_TILES.map(t => ({ x: t.x, y: t.y, rot: t.rotation, isShort: false })),
        'ideal'));
      grid.appendChild(mkSide('Твой результат', p3.placed, 'actual'));
      wrap.appendChild(grid);

      const noriQuote = document.createElement('div');
      noriQuote.className = 'level5-compare-nori';
      noriQuote.innerHTML =
        '<span class="speaker">— Нори:</span> <em>' + noriForAccuracy(accuracy) + '</em>';
      wrap.appendChild(noriQuote);

      const finalLine = document.createElement('p');
      finalLine.className = 'level5-compare-final';
      finalLine.textContent = 'Это сделал ты. Сам. Без лапок. Иногда это важнее точности.';
      wrap.appendChild(finalLine);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Дальше';
      on(btn, 'click', () => fadeTo(renderFinal()));
      wrap.appendChild(btn);

      return wrap;
    }

    function drawComparePanel(ctx, tiles) {
      const W = 320, H = 200;
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(0, 0, W, H);
      const scale = W / 600;
      ctx.save();
      ctx.scale(scale, scale);
      tiles.forEach(t => {
        const w = t.isShort ? TILE_W * 0.85 : TILE_W;
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rot * Math.PI / 180);
        ctx.fillStyle = '#cdc7b8';
        ctx.fillRect(-w/2, -TILE_H/2, w, TILE_H);
        ctx.strokeStyle = '#7a7468';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(-w/2, -TILE_H/2, w, TILE_H);
        ctx.restore();
      });
      ctx.restore();
    }

    // =========================================
    //   ФИНАЛЬНЫЙ ЭКРАН
    // =========================================
    function renderFinal() {
      const wrap = document.createElement('div');
      wrap.className = 'level5-final';

      const title = document.createElement('h3');
      title.className = 'level5-final-title';
      title.textContent = 'Ремонт закончен. Прошло 8 месяцев.';
      wrap.appendChild(title);

      // Финальная картинка квартиры — та же что в Части 1, теперь обжитая
      const scene = document.createElement('div');
      scene.className = 'level5-apt-scene all-set lived-in';
      scene.innerHTML = buildApartmentSVG();
      Object.keys(progress.part1).forEach((id) => {
        scene.setAttribute('data-' + id, String(progress.part1[id]));
      });
      wrap.appendChild(scene);

      // Статистика
      const stats = document.createElement('div');
      stats.className = 'level5-stats';
      const rows = [
        ['Решений принято', '138'],
        ['Раз Рубэн прошёл по коридору', '∞'],
        ['Плиток уложено лично', '47'],
        ['Изначальный срок', '2 месяца'],
        ['Реальный срок', '8 месяцев'],
        ['Итог', 'у нас есть своё гнёздышко'],
      ];
      rows.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'level5-stat-row';
        row.style.setProperty('--row-i', String(i));
        row.innerHTML = '<span class="k">' + r[0] + '</span><span class="dots"></span><span class="v">' + r[1] + '</span>';
        stats.appendChild(row);
      });
      wrap.appendChild(stats);

      wrap.appendChild(buildNori(
        'Иногда ремонт — это не про квартиру. Это про двух человек, ' +
        'которые пережили его вместе. Они пережили.'
      ));

      const row = document.createElement('div');
      row.className = 'row';
      const replay = document.createElement('button');
      replay.className = 'btn btn-secondary';
      replay.type = 'button';
      replay.textContent = 'Пройти заново';
      on(replay, 'click', () => { clearProgress(); fadeTo(renderPart1()); });
      row.appendChild(replay);
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Дальше';
      on(btn, 'click', () => { progress.passed = true; saveProgress(); if (onCompleteCb) onCompleteCb(); });
      row.appendChild(btn);
      wrap.appendChild(row);

      return wrap;
    }

    return {
      id: 5,
      title: 'Своя квартира. Ремонт',
      intro:
        'А это они делали ремонт. Долго. Очень долго. Со строителями, с пылью ' +
        'и с Рубэном в куртке. Я расскажу.',
      completionTitle: 'Уровень 5 пройден: ремонт окончен!',
      completionText:
        'Много месяцев на матрасе в пыли. Бесконечная укладка плитки на кухне. ' +
        'Но мы справились и теперь у нас есть самое уютное место в мире. Наш дом.',
      photoCaption: 'наша квартира',
      nextButtonText: 'На карту',

      mount(container, onComplete) {
        onCompleteCb = onComplete;
        loadProgress();
        const root = document.createElement('div');
        root.className = 'level5-root';
        contentEl = document.createElement('div');
        contentEl.className = 'level5-content';
        root.appendChild(contentEl);
        container.appendChild(root);
        // Куда вошли: продолжить с того места, где остановились
        if (progress.passed || progress.part3tiles >= TILE_COUNT) {
          contentEl.appendChild(renderFinal());
        } else if (progress.part2done >= 3) {
          // 3-я часть начинается — сразу к плитке (катсцена убрана).
          contentEl.appendChild(renderPart3());
        } else if (progress.part2done > 0) {
          contentEl.appendChild(renderPart2());
        } else if (Object.keys(progress.part1).length >= PICKS.length) {
          contentEl.appendChild(renderPart2());
        } else if (Object.keys(progress.part1).length > 0) {
          // Уже что-то выбирал — продолжаем расстановку без приветствия
          contentEl.appendChild(renderPart1());
        } else {
          // Первый заход — праздничный экран про покупку квартиры
          contentEl.appendChild(renderHello());
        }
      },

      unmount() {
        cleanupAll();
        p2 = null;
        p3 = null;
        contentEl = null;
        onCompleteCb = null;
      },
    };
  }

  // ============================================================
  //  Уровень 6: «Путешествия. Собери чемоданы.» — сортировка предметов
  // ============================================================
  function createLevel6() {
    const L6_STORAGE_KEY = 'nori-story-level6-v1';

    const SUITCASES = [
      { id: 'jp', label: 'Япония',   flag: '🇯🇵', primary: '#bc002d', soft: '#fde0e4' },
      { id: 'mu', label: 'Маврикий', flag: '🏝️', primary: '#0a8aa0', soft: '#dff0f3' },
      { id: 'it', label: 'Италия',   flag: '🇮🇹', primary: '#a64a1f', soft: '#f4e4d2' },
    ];

    // Все предметы. valid — список чемоданов, куда подходит.
    // universal — подходит в любой. trap — никуда не подходит.
    const ITEMS = [
      // Япония (4)
      { id: 'adapter',      name: 'Переходник тип A',      icon: '🔌',  valid: ['jp'] },
      { id: 'guide_tokyo',  name: 'Путеводитель «Токио»',  icon: '📖',  valid: ['jp'] },
      { id: 'mini_case',    name: 'Второй чемодан',         icon: '🧳',  valid: ['jp'] },
      { id: 'antizapor',    name: 'Средство от запора',    icon: '💊',  valid: ['jp'] },
      // Маврикий (5)
      { id: 'trunks',       name: 'Плавки',                 icon: '🩳',  valid: ['mu'] },
      { id: 'sunscreen',    name: 'Крем SPF 50+',           icon: '🧴',  valid: ['mu'] },
      { id: 'snorkel',      name: 'Маска для снорклинга',   icon: '🤿',  valid: ['mu'] },
      { id: 'sandals',      name: 'Сандалии',               icon: '🩴',  valid: ['mu'] },
      { id: 'burn_aid',     name: 'Аптечка от ожогов',      icon: '🩹',  valid: ['mu'] },
      // Италия (4)
      { id: 'crossbody',    name: 'Кросс-боди сумка',       icon: '👜',  valid: ['it'] },
      { id: 'phrasebook',   name: 'Разговорник итальянский', icon: '📕',  valid: ['it'] },
      { id: 'cobble_shoes', name: 'Обувь для брусчатки',    icon: '👟',  valid: ['it'] },
      { id: 'long_pants',   name: 'Длинные брюки',          icon: '👖',  valid: ['it'] },
      // Подколы (4)
      { id: 'parka',        name: 'Зимняя парка',           icon: '🧥',  valid: [], trap: true,
        trapReply: 'Илья. Куда. Это лето.' },
      { id: 'dostoevsky',   name: '«Достоевский» (т. 1–10)',icon: '📚',  valid: [], trap: true,
        trapReply: 'Я знаю, ты любишь. Но не на пляж.' },
      { id: 'five_tshirts', name: '5 одинаковых футболок',  icon: '👕',  valid: [], trap: true,
        trapReply: 'Ты на 10 дней. Не на месяц.' },
      { id: 'kettle',       name: 'Электрочайник',          icon: '🫖',  valid: [], trap: true,
        trapReply: 'Илья. Нет. Просто нет.' },
    ];

    // Реплики Нори при попытке положить НЕ туда. Ключ: itemId + '-' + suitcaseId
    const WRONG = {
      'trunks-jp':       'В Японии у вас не пляжный сезон. Это к Маврикию.',
      'trunks-it':       'В Италии вы по городам ходите. Это к Маврикию.',
      'sunscreen-jp':    'В Японии вы будете по городам, не на пляже. Положи к Маврикию.',
      'sunscreen-it':    'В Италии тоже город. Крем — к Маврикию.',
      'adapter-mu':      'Тип A — это японские розетки. Это в Японию.',
      'adapter-it':      'Тип A — это японские розетки. Это в Японию.',
      'antizapor-mu':    'Япония + непривычная еда = известная проблема. Это туда.',
      'antizapor-it':    'Япония + непривычная еда = известная проблема. Это туда.',
      'mini_case-mu':    'В Японии они закупаются на полный чемодан. Это туда.',
      'mini_case-it':    'В Японии они закупаются на полный чемодан. Это туда.',
      'guide_tokyo-mu':  'Токио — это Япония. Очевидно.',
      'guide_tokyo-it':  'Токио — это Япония. Очевидно.',
      'snorkel-jp':      'Снорклинг — это океан. Это к Маврикию.',
      'snorkel-it':      'Снорклинг — это океан. Это к Маврикию.',
      'sandals-jp':      'В городе сандалии — не вариант. На пляж.',
      'sandals-it':      'В городе сандалии — не вариант. На пляж.',
      'burn_aid-jp':     'Аптечка от ожогов — значит, к Маврикию.',
      'burn_aid-it':     'Аптечка от ожогов — значит, к Маврикию.',
      'crossbody-jp':    'В Японии очень безопасно. Это в Италию против карманников.',
      'crossbody-mu':    'На пляже карманников нет. Это к Италии.',
      'phrasebook-jp':   'В Японии итальянский не пригодится. Это в Италию.',
      'phrasebook-mu':   'На пляже итальянский не нужен. Это в Италию.',
      'cobble_shoes-jp': 'В Японии асфальт, не брусчатка. В Италию.',
      'cobble_shoes-mu': 'На пляже брусчатки нет. В Италию.',
      'long_pants-jp':   'В Японии нет такой строгости в одежде. Это в Италию — для соборов.',
      'long_pants-mu':   'На пляж в длинных брюках? Нет.',
    };

    const CORRECT_LINES = [
      'Логично.',
      'Хорошо. Дальше.',
      'Согласна.',
      'Это туда. Я бы тоже так.',
      'Ага.',
    ];

    const UNIVERSAL_LINE = 'Это везде нужно. Молодец.';

    const VIBE_LINES = [
      'Вера, как обычно, всё планирует. Я уважаю.',
      'Я бы помогла. Но я родилась позже. Я просто комментирую.',
      'Они мне про Японию рассказывали час. Я помню каждую деталь.',
    ];

    const FINAL_LINE =
      'Они мне всё это рассказывали. Я слушала. Каждый раз, когда они ' +
      'возвращались, в доме пахло другой страной. И они рассказывали. ' +
      'И мне хватало.';

    const POLAROIDS = {
      jp: 'Япония. Мы съели всё, что не двигалось. И ещё немного того, что двигалось.',
      mu: 'Маврикий. Океан. Тишина. Илья сгорел в первый день.',
      it: 'Италия. Паста. Вино. Карманники прошли мимо — кросс-боди спасла.',
    };

    // 13 — все категориальные предметы. Универсальные и подколы не считаем.
    const CATEGORICAL_COUNT = ITEMS.filter(it => !it.universal && !it.trap).length;

    // --- Прогресс ---
    const progress = { placed: {}, completed: false };
    function loadProgress() {
      // ВАЖНО: сначала сбросить к дефолтам. Иначе модульная переменная
      // progress сохраняет состояние от прошлого прохождения, и при
      // «Пройти заново» (когда storage очищен) renderFinal показывается
      // вместо игры — потому что progress.completed остаётся true в памяти.
      progress.placed = {};
      progress.completed = false;
      try {
        const raw = localStorage.getItem(L6_STORAGE_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (p.placed) progress.placed = p.placed;
        progress.completed = !!p.completed;
      } catch (e) {}
    }
    function saveProgress() {
      try { localStorage.setItem(L6_STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
    }
    function clearProgress() {
      progress.placed = {}; progress.completed = false;
      try { localStorage.removeItem(L6_STORAGE_KEY); } catch (e) {}
    }

    // --- Ресурсы ---
    const listeners = [];
    const timeouts = [];
    function on(el, evt, fn, opts) {
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }
    function cleanupAll() {
      listeners.forEach((fn) => fn()); listeners.length = 0;
      timeouts.forEach((t) => clearTimeout(t)); timeouts.length = 0;
    }

    let contentEl = null;
    let onCompleteCb = null;
    let selectedItemId = null;
    let vibeTimer = null;

    function fadeTo(node) {
      if (!contentEl) return;
      document.querySelector('.nori-quote')?.classList.add('hidden');
      contentEl.classList.add('level6-fading');
      later(() => {
        contentEl.innerHTML = '';
        contentEl.appendChild(node);
        contentEl.classList.remove('level6-fading');
      }, 220);
    }

    function buildBubble(text) {
      const b = document.createElement('div');
      b.className = 'level6-bubble';
      b.innerHTML = '<span class="speaker">— Нори:</span><p></p>';
      b.querySelector('p').textContent = text;
      return b;
    }
    function setBubble(scope, text, kind) {
      // Всплывашка-toast. Показывает сообщение (правильно/ошибка/подсказка)
      // и сама исчезает через 3с. Накапливается стопкой вверху поля.
      const host = scope.querySelector('.level6-toasts');
      if (!host) return;
      const toast = document.createElement('div');
      toast.className = 'level6-toast' + (kind ? ' ' + kind : '');
      // Префикс-эмодзи в зависимости от типа: ✓ / ✗ / 🐾
      const prefix = kind === 'correct' ? '✓' : kind === 'wrong' ? '✗' : '🐾';
      toast.innerHTML = '<span class="l6-toast-icon">' + prefix + '</span><span>' + text + '</span>';
      host.appendChild(toast);
      // Авто-скрытие
      setTimeout(() => {
        toast.classList.add('fade');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
      }, 3000);
      // Ограничим стопку максимум 3 одновременно — старые убираем
      while (host.children.length > 3) {
        host.firstChild.remove();
      }
    }

    function pickCorrectLine() {
      return CORRECT_LINES[Math.floor(Math.random() * CORRECT_LINES.length)];
    }
    function pickVibeLine() {
      return VIBE_LINES[Math.floor(Math.random() * VIBE_LINES.length)];
    }

    function countCategoricalPlaced() {
      let n = 0;
      Object.keys(progress.placed).forEach((id) => {
        const it = ITEMS.find(x => x.id === id);
        if (it && !it.universal && !it.trap) n++;
      });
      return n;
    }

    // ====== ЭКРАН СОРТИРОВКИ ======
    function renderSort() {
      const wrap = document.createElement('div');
      wrap.className = 'level6-sort';

      // Контейнер для всплывающих уведомлений (toast'ов). Сами тосты появляются
      // на правильных/ошибочных действиях и сами исчезают через ~3 секунды.
      const toasts = document.createElement('div');
      toasts.className = 'level6-toasts';
      wrap.appendChild(toasts);

      // Чемоданы в ряд
      const suitRow = document.createElement('div');
      suitRow.className = 'level6-suitcases';
      SUITCASES.forEach((sc) => {
        const s = document.createElement('button');
        s.className = 'level6-suitcase';
        s.type = 'button';
        s.dataset.suitcaseId = sc.id;
        s.style.setProperty('--sc-color', sc.primary);
        s.style.setProperty('--sc-soft', sc.soft);
        s.innerHTML =
          '<span class="sc-flag">' + sc.flag + '</span>' +
          '<span class="sc-label">' + sc.label + '</span>' +
          '<span class="sc-mouth"></span>' +
          '<span class="sc-handle"></span>' +
          '<span class="sc-count">0</span>';
        on(s, 'click', () => handleSuitcaseClick(sc.id, wrap, s));
        // Drag-and-drop: чемодан принимает «брошенную» карточку
        on(s, 'dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          s.classList.add('drag-over');
        });
        on(s, 'dragleave', () => s.classList.remove('drag-over'));
        on(s, 'drop', (e) => {
          e.preventDefault();
          s.classList.remove('drag-over');
          const id = e.dataTransfer.getData('text/plain');
          if (id) handleSuitcaseClick(sc.id, wrap, s, id);
        });
        suitRow.appendChild(s);
      });
      wrap.appendChild(suitRow);

      // HUD: счётчик
      const hud = document.createElement('div');
      hud.className = 'level6-hud';
      hud.innerHTML =
        '<span class="l6-hint">Кликни предмет → чемодан. Или перетащи мышкой.</span>' +
        '<span class="l6-counter">Разобрано: <b>0</b> / ' + CATEGORICAL_COUNT + '</span>';
      wrap.appendChild(hud);

      // Стол с предметами
      const table = document.createElement('div');
      table.className = 'level6-table';
      // Перемешивание Фишера-Йейтса со случайным сидом каждое прохождение,
      // чтобы предметы не выстраивались по странам по порядку.
      // (Предыдущая формула seed*(i+1) % (i+1) всегда давала 0 — ничего не
      // перемешивала, выводя элементы практически в исходном порядке.)
      const shuffled = ITEMS.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((it) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'level6-item';
        card.dataset.itemId = it.id;
        if (it.trap) card.classList.add('trap');
        if (it.universal) card.classList.add('universal');
        // Native HTML5 drag-and-drop
        card.draggable = true;
        card.innerHTML =
          '<span class="l6-item-icon">' + it.icon + '</span>' +
          '<span class="l6-item-name">' + it.name + '</span>';
        // Лёгкий случайный наклон ±3° для «брошенности на столе»
        const tilt = ((it.id.charCodeAt(0) * 13 + it.id.charCodeAt(1)) % 7) - 3;
        card.style.setProperty('--tilt', tilt + 'deg');
        if (progress.placed[it.id]) {
          card.classList.add('packed');
          card.disabled = true;
        }
        on(card, 'click', () => handleItemClick(it.id, wrap));
        on(card, 'dragstart', (e) => {
          if (card.disabled) { e.preventDefault(); return; }
          e.dataTransfer.setData('text/plain', it.id);
          e.dataTransfer.effectAllowed = 'move';
          card.classList.add('dragging');
        });
        on(card, 'dragend', () => card.classList.remove('dragging'));
        table.appendChild(card);
      });
      wrap.appendChild(table);

      // Восстановить счётчик и количество в чемоданах
      refreshSuitcaseCounts(wrap);
      refreshCounter(wrap);

      // Vibe-таймер: раз в 30 секунд лёгкая фраза. Не перебиваем —
      // если в стопке уже есть тост, ждём следующего цикла.
      vibeTimer = setInterval(() => {
        if (selectedItemId) return;
        const host = wrap.querySelector('.level6-toasts');
        if (host && host.children.length > 0) return;
        setBubble(wrap, pickVibeLine());
      }, 30000);
      timeouts.push(vibeTimer);

      return wrap;
    }

    function handleItemClick(itemId, scope) {
      const card = scope.querySelector('.level6-item[data-item-id="' + itemId + '"]');
      if (!card || card.disabled) return;
      // Если уже выбран этот же — снимаем выбор
      if (selectedItemId === itemId) {
        selectedItemId = null;
        card.classList.remove('selected');
        return;
      }
      // Снимаем выбор с других
      scope.querySelectorAll('.level6-item.selected').forEach(el => el.classList.remove('selected'));
      selectedItemId = itemId;
      card.classList.add('selected');
      // Подсказка
      setBubble(scope, 'Куда?');
    }

    function handleSuitcaseClick(suitcaseId, scope, suitcaseEl, explicitItemId) {
      // Если передан id (drag-and-drop) — берём его. Иначе — то, что выбрано кликом.
      const itemId = explicitItemId || selectedItemId;
      if (!itemId) {
        setBubble(scope, 'Сначала возьми предмет со стола.');
        return;
      }
      const item = ITEMS.find(x => x.id === itemId);
      if (!item) return;
      const card = scope.querySelector('.level6-item[data-item-id="' + item.id + '"]');
      if (!card || card.disabled) return;
      // Если был выбран другой предмет — снимаем подсветку
      if (selectedItemId && selectedItemId !== item.id) {
        const prev = scope.querySelector('.level6-item.selected');
        if (prev) prev.classList.remove('selected');
      }
      selectedItemId = item.id;

      const valid = item.valid.includes(suitcaseId);

      if (item.trap) {
        // подкол — отскок + специальная реплика
        bounceBack(card, suitcaseEl, scope, item.trapReply);
        return;
      }
      if (!valid) {
        // Неправильно — отскок + подсказка
        const reply = WRONG[item.id + '-' + suitcaseId] ||
          'Это не туда. Подумай ещё.';
        bounceBack(card, suitcaseEl, scope, reply);
        return;
      }

      // Правильно — летит в чемодан
      flyIntoSuitcase(card, suitcaseEl, item, scope);
    }

    function bounceBack(card, suitcaseEl, scope, replyText) {
      AUDIO.play('error');
      card.classList.add('shake');
      suitcaseEl.classList.add('reject');
      setBubble(scope, replyText, 'wrong');
      later(() => {
        card.classList.remove('shake');
        suitcaseEl.classList.remove('reject');
      }, 500);
    }

    function flyIntoSuitcase(card, suitcaseEl, item, scope) {
      // Тише, чем общий success — в L6 он играет часто и должен быть фоновым.
      AUDIO.play('success', { volume: 0.15 });
      const cardRect = card.getBoundingClientRect();
      const targetRect = suitcaseEl.getBoundingClientRect();
      const dx = (targetRect.left + targetRect.width / 2) - (cardRect.left + cardRect.width / 2);
      const dy = (targetRect.top + targetRect.height / 2) - (cardRect.top + cardRect.height / 2);

      card.classList.remove('selected');
      card.style.setProperty('--fly-dx', dx + 'px');
      card.style.setProperty('--fly-dy', dy + 'px');
      card.classList.add('flying');
      // Чемодан слегка «глотает»
      suitcaseEl.classList.add('accept');
      later(() => suitcaseEl.classList.remove('accept'), 500);

      later(() => {
        card.classList.add('packed');
        card.disabled = true;
        card.classList.remove('flying');
        card.style.removeProperty('--fly-dx');
        card.style.removeProperty('--fly-dy');
      }, 480);

      // Сохраняем
      progress.placed[item.id] = suitcaseEl.dataset.suitcaseId;
      saveProgress();
      selectedItemId = null;

      // Реплика. Для некоторых предметов — кастомные комментарии
      // (воришки на кросс-боди, и т.п.); иначе случайная похвала.
      const CUSTOM_CORRECT = {
        crossbody: 'Кросс-боди — против воришек. Карманники в Италии цепкие. ' +
                   'А у вас сумка спереди и на молнии. Молодцы.',
      };
      let reply;
      if (CUSTOM_CORRECT[item.id]) {
        reply = CUSTOM_CORRECT[item.id];
      } else if (item.universal) {
        reply = UNIVERSAL_LINE;
      } else {
        reply = pickCorrectLine();
      }
      setBubble(scope, reply, 'correct');

      refreshSuitcaseCounts(scope);
      refreshCounter(scope);

      // Проверка финала — переходим сразу на экран «Уровень 6 пройден»,
      // в нём показываются полароиды и благодарность (см. buildLevelCompleteView).
      if (countCategoricalPlaced() >= CATEGORICAL_COUNT) {
        progress.completed = true;
        saveProgress();
        later(() => { if (onCompleteCb) onCompleteCb(); }, 1400);
      }
    }

    function refreshSuitcaseCounts(scope) {
      const counts = { jp: 0, mu: 0, it: 0 };
      Object.values(progress.placed).forEach((scId) => {
        if (counts[scId] != null) counts[scId]++;
      });
      scope.querySelectorAll('.level6-suitcase').forEach((sEl) => {
        const id = sEl.dataset.suitcaseId;
        const c = sEl.querySelector('.sc-count');
        if (c) c.textContent = counts[id] || 0;
      });
    }

    function refreshCounter(scope) {
      const n = countCategoricalPlaced();
      const cEl = scope.querySelector('.l6-counter b');
      if (cEl) cEl.textContent = n;
    }

    // ====== ФИНАЛ — ЧЕМОДАНЫ ЗАКРЫВАЮТСЯ, ПОЛАРОИДЫ ======
    function renderFinal() {
      const wrap = document.createElement('div');
      wrap.className = 'level6-final';

      const grid = document.createElement('div');
      grid.className = 'level6-final-grid';
      SUITCASES.forEach((sc, idx) => {
        const col = document.createElement('div');
        col.className = 'level6-final-col';
        // Полароид: только флаг + название страны (без длинной подписи)
        const polaroid = document.createElement('div');
        polaroid.className = 'level6-polaroid';
        polaroid.style.setProperty('--rot', ((idx - 1) * 3) + 'deg');
        polaroid.style.setProperty('--delay', (0.4 + idx * 0.3) + 's');
        polaroid.innerHTML =
          '<div class="polaroid-photo" style="background:' + sc.soft + '">' +
            '<span class="polaroid-flag">' + sc.flag + '</span>' +
          '</div>' +
          '<div class="polaroid-caption">' + sc.label + '</div>';
        col.appendChild(polaroid);
        // Подгружаем реальное фото с фолбэком по расширениям. Файл лежит
        // в images/polaroids/{japan,mauritius,italy}.{jpg,png,jpeg}.
        const PHOTO_NAMES = { jp: 'japan', mu: 'mauritius', it: 'italy' };
        tryLoadPolaroidPhoto(polaroid, PHOTO_NAMES[sc.id]);
        grid.appendChild(col);
      });
      wrap.appendChild(grid);

      // Тёплая благодарность под полароидами
      const thanks = document.createElement('p');
      thanks.className = 'level6-final-thanks';
      thanks.textContent = 'Спасибо за возможность открывать этот мир вместе с тобой!';
      wrap.appendChild(thanks);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Дальше';
      on(btn, 'click', () => {
        // Не очищаем прогресс — пусть остаётся, как в других уровнях,
        // если игрок зайдёт повторно — увидит сразу финал.
        if (onCompleteCb) onCompleteCb();
      });
      wrap.appendChild(btn);

      return wrap;
    }

    return {
      id: 6,
      title: 'Путешествия. Собери чемоданы.',
      intro:
        'Мои хозяева — заядлые путешественники. Я пока не знаю, каково это ' +
        'остаться в холодной Москве без вас. Ну что же, собирайте чемоданы, ' +
        'бросайте меня на произвол судьбы!',
      completionTitle: 'Уровень 6 пройден: чемоданы собраны!',
      completionText: '',
      photoCaption: '',
      nextButtonText: 'На карту',

      mount(container, onComplete) {
        onCompleteCb = onComplete;
        loadProgress();
        const root = document.createElement('div');
        root.className = 'level6-root';
        contentEl = document.createElement('div');
        contentEl.className = 'level6-content';
        root.appendChild(contentEl);
        container.appendChild(root);
        if (progress.completed) {
          // Уровень уже пройден — сразу показываем экран «Уровень 6 пройден»
          // (полароиды + благодарность теперь внутри него).
          later(() => { if (onCompleteCb) onCompleteCb(); }, 0);
        } else {
          contentEl.appendChild(renderSort());
        }
      },

      unmount() {
        cleanupAll();
        if (vibeTimer) { clearInterval(vibeTimer); vibeTimer = null; }
        contentEl = null;
        onCompleteCb = null;
        selectedItemId = null;
      },
    };
  }

  // ============================================================
  //  Уровень 7: «Нори и сейчас. Финал.» — 4 части и поздравление
  // ============================================================
  function createLevel7() {
    const L7_STORAGE_KEY = 'nori-story-level7-v1';

    const INTRO_LINES = [
      'Привет. Это была я. Я рассказывала тебе всё это — шесть уровней подряд. ' +
      'А теперь — я здесь. Я бегаю как ненормальная по квартире. Я бужу тебя в 5 утра хвостом по лицу. И я знаю — без меня история была неполной.',
      'Я главный комментатор этой семьи. И, кажется, я её сердце.',
      'Ур-Урур-ур.',
    ];

    const FLASHBACK_ICONS = [
      { icon: '🖨️', label: 'типография' },
      { icon: '🌿', label: 'зелёная комната' },
      { icon: '🥟', label: 'карантин' },
      { icon: '🏦', label: 'банк' },
      { icon: '🔨', label: 'ремонт' },
      { icon: '✈️', label: 'путешествия' },
    ];

    const STAT_DEFS = [
      { id: 'hunger', icon: '🍣', label: 'Голод',
        lowReply: 'Илья. Я голодаю.' },
      { id: 'litter', icon: '🪨', label: 'Лоток',
        lowReply: 'Я не могу так жить.' },
      { id: 'play',   icon: '🎾', label: 'Игра',
        lowReply: 'Мне скучно. Я страдаю.' },
      { id: 'pet',    icon: '🐾', label: 'Ласка',
        lowReply: 'Я начинаю забывать, как меня любят.' },
    ];

    const FOOD_OPTIONS = [
      { id: 'dry',  label: 'Сухой корм',     reply: 'Сухой? В мой день?',  boost: 20 },
      { id: 'wet',  label: 'Влажный корм',   reply: 'Норм. Спасибо.',      boost: 40 },
      { id: 'tuna', label: 'Тунец',          reply: 'Ты меня понимаешь.',  boost: 60 },
    ];

    // ---- Прогресс ----
    const progress = {
      part1Done: false,
      part2Done: false,
      part3Done: false,
      passed: false,
      stats: { hunger: 20, litter: 20, play: 20, pet: 20 },
    };
    function loadProgress() {
      // Сброс к дефолтам — чтобы in-memory state не пережил «Пройти заново».
      progress.part1Done = false;
      progress.part2Done = false;
      progress.part3Done = false;
      progress.passed = false;
      progress.stats = { hunger: 20, litter: 20, play: 20, pet: 20 };
      try {
        const raw = localStorage.getItem(L7_STORAGE_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        progress.part1Done = !!p.part1Done;
        progress.part2Done = !!p.part2Done;
        progress.part3Done = !!p.part3Done;
        progress.passed = !!p.passed;
        if (p.stats) progress.stats = Object.assign({}, progress.stats, p.stats);
      } catch (e) {}
    }
    function saveProgress() {
      try { localStorage.setItem(L7_STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
    }

    // ---- Ресурсы ----
    const listeners = [];
    const timeouts = [];
    const intervals = [];
    function on(el, evt, fn, opts) {
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    }
    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timeouts.push(t);
      return t;
    }
    function every(fn, ms) {
      const t = setInterval(fn, ms);
      intervals.push(t);
      return t;
    }
    function cleanupAll() {
      listeners.forEach((fn) => fn()); listeners.length = 0;
      timeouts.forEach((t) => clearTimeout(t)); timeouts.length = 0;
      intervals.forEach((t) => clearInterval(t)); intervals.length = 0;
    }

    let contentEl = null;
    let onCompleteCb = null;

    function fadeTo(node) {
      if (!contentEl) return;
      document.querySelector('.nori-quote')?.classList.add('hidden');
      contentEl.classList.add('level7-fading');
      later(() => {
        contentEl.innerHTML = '';
        contentEl.appendChild(node);
        contentEl.classList.remove('level7-fading');
      }, 240);
    }

    // ---- Нори (SVG-спрайт) ----
    function noriSpriteSVG() {
      // Чёрная кошка — стройная, изящная: компактное тело, тонкий хвост,
      // чуть удлинённый силуэт. Сидит, грудка выраженная, плечи у́же головы.
      return '<svg class="level7-nori-svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">' +
        '<ellipse cx="100" cy="178" rx="34" ry="5" fill="#2a2520" opacity="0.45"/>' +
        // тело — стройнее: rx 42→34, ry 35→34. Чуть овальное.
        '<ellipse cx="100" cy="138" rx="34" ry="34" fill="#1a1614"/>' +
        // лёгкое сужение «грудки» — наложение овала под головой
        '<ellipse cx="100" cy="112" rx="22" ry="14" fill="#1a1614"/>' +
        // хвост — тонкий (8), длиннее, изящный S
        '<path d="M 130 138 Q 168 118 170 86 Q 167 58 156 60" stroke="#1a1614" stroke-width="8" fill="none" stroke-linecap="round"/>' +
        // лапки спереди — узкие, длинные
        '<rect x="87" y="162" width="9" height="20" fill="#1a1614" rx="3"/>' +
        '<rect x="104" y="162" width="9" height="20" fill="#1a1614" rx="3"/>' +
        // голова — чуть меньше
        '<ellipse cx="100" cy="80" rx="32" ry="29" fill="#1a1614"/>' +
        // уши — пропорционально меньше и ближе
        '<path d="M 74 58 L 66 30 L 90 50 Z" fill="#1a1614"/>' +
        '<path d="M 126 58 L 134 30 L 110 50 Z" fill="#1a1614"/>' +
        '<path d="M 78 51 L 76 38 L 86 49 Z" fill="#f4a8a8" opacity="0.7"/>' +
        '<path d="M 122 51 L 124 38 L 114 49 Z" fill="#f4a8a8" opacity="0.7"/>' +
        // глаза — жёлтые, чуть выше под новый центр головы
        '<ellipse class="nori-eye" cx="88" cy="77" rx="6.5" ry="8.5" fill="#f4b53c"/>' +
        '<ellipse class="nori-eye" cx="112" cy="77" rx="6.5" ry="8.5" fill="#f4b53c"/>' +
        '<ellipse class="nori-pupil" cx="88" cy="77" rx="1.5" ry="7" fill="#1a1614"/>' +
        '<ellipse class="nori-pupil" cx="112" cy="77" rx="1.5" ry="7" fill="#1a1614"/>' +
        '<circle cx="90" cy="74" r="1.2" fill="#fff"/>' +
        '<circle cx="114" cy="74" r="1.2" fill="#fff"/>' +
        // носик
        '<path d="M 96 88 L 104 88 L 100 93 Z" fill="#d68aa0"/>' +
        // рот
        '<path d="M 100 93 Q 95 98 90 95 M 100 93 Q 105 98 110 95" stroke="#3a2a2a" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        // усики — тонкие, длинные
        '<line x1="74" y1="88" x2="54" y2="84" stroke="#e0d8c8" stroke-width="0.9" stroke-linecap="round"/>' +
        '<line x1="74" y1="92" x2="54" y2="94" stroke="#e0d8c8" stroke-width="0.9" stroke-linecap="round"/>' +
        '<line x1="126" y1="88" x2="146" y2="84" stroke="#e0d8c8" stroke-width="0.9" stroke-linecap="round"/>' +
        '<line x1="126" y1="92" x2="146" y2="94" stroke="#e0d8c8" stroke-width="0.9" stroke-linecap="round"/>' +
      '</svg>';
    }

    // =========================================
    //   ЧАСТЬ 1 — Появление + типографика
    // =========================================
    function renderPart1() {
      const wrap = document.createElement('div');
      wrap.className = 'level7-part1';

      // Полоска флэшбэков
      const flash = document.createElement('div');
      flash.className = 'level7-flashbacks';
      FLASHBACK_ICONS.forEach((f, i) => {
        const el = document.createElement('div');
        el.className = 'level7-flashback';
        el.style.setProperty('--delay', (i * 0.18) + 's');
        el.innerHTML = '<span class="fb-icon">' + f.icon + '</span><span class="fb-label">' + f.label + '</span>';
        flash.appendChild(el);
      });
      wrap.appendChild(flash);

      // Нори появляется в центре с эффектом «проявления»
      const stage = document.createElement('div');
      stage.className = 'level7-nori-stage';
      stage.innerHTML = noriSpriteSVG();
      wrap.appendChild(stage);

      // Тёплый ореол вокруг Нори
      const halo = document.createElement('div');
      halo.className = 'level7-halo';
      stage.appendChild(halo);

      // Реплика — построчно, эффект печатания
      const bubble = document.createElement('div');
      bubble.className = 'level7-typed-bubble';
      bubble.innerHTML = '<span class="speaker">— Нори:</span><div class="typed-lines"></div>';
      wrap.appendChild(bubble);

      const btnRow = document.createElement('div');
      btnRow.className = 'level7-btn-row';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary level7-reveal-btn';
      btn.type = 'button';
      btn.textContent = 'Заслужить подарок';
      on(btn, 'click', () => {
        progress.part1Done = true; saveProgress();
        fadeTo(renderPart2());
      });
      btnRow.appendChild(btn);
      wrap.appendChild(btnRow);

      // ОСОБЕННО громкое мяу для первого появления Нори в уровне 7.
      later(() => AUDIO.play('meow', { volume: 0.5 }), 900);
      // Реплика появляется сразу целиком, без эффекта печатания.
      later(() => {
        const linesEl = bubble.querySelector('.typed-lines');
        INTRO_LINES.forEach(text => {
          const p = document.createElement('p');
          p.className = 'typed-line';
          p.textContent = text;
          linesEl.appendChild(p);
        });
        later(() => btn.classList.add('visible'), 400);
      }, 1500);

      return wrap;
    }

    // =========================================
    //   ЧАСТЬ 2 — Тамагочи
    // =========================================
    let p2State = null;
    function renderPart2() {
      const wrap = document.createElement('div');
      wrap.className = 'level7-part2';

      const bubble = document.createElement('div');
      bubble.className = 'level7-bubble';
      bubble.innerHTML = '<span class="speaker">— Нори:</span><p>Подарок — потом. Сначала покажи, что ты умеешь обо мне заботиться. Тут всё просто. Накорми, убери, поиграй и приласкай. Я несложная. (Шутка.)</p>';
      wrap.appendChild(bubble);

      // Стат-панель + Нори в центре
      const board = document.createElement('div');
      board.className = 'level7-tama-board';

      const stats = document.createElement('div');
      stats.className = 'level7-stats';
      STAT_DEFS.forEach(s => {
        const row = document.createElement('div');
        row.className = 'level7-stat';
        row.dataset.statId = s.id;
        row.innerHTML =
          '<span class="stat-icon">' + s.icon + '</span>' +
          '<span class="stat-label">' + s.label + '</span>' +
          '<div class="stat-bar"><div class="stat-fill"></div></div>' +
          '<span class="stat-value">20%</span>';
        stats.appendChild(row);
      });
      board.appendChild(stats);

      const noriBox = document.createElement('div');
      noriBox.className = 'level7-tama-nori';
      noriBox.innerHTML = noriSpriteSVG();
      board.appendChild(noriBox);
      wrap.appendChild(board);

      // Действия
      const actions = document.createElement('div');
      actions.className = 'level7-actions';
      const actionDefs = [
        { id: 'feed',   icon: '🥣', label: 'Покормить' },
        { id: 'litter', icon: '🧹', label: 'Убрать лоток' },
        { id: 'play',   icon: '🪀', label: 'Поиграть' },
        { id: 'pet',    icon: '✋', label: 'Почесать' },
      ];
      actionDefs.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level7-action';
        b.dataset.actionId = a.id;
        b.innerHTML = '<span class="act-icon">' + a.icon + '</span><span>' + a.label + '</span>';
        on(b, 'click', () => handleAction(a.id, wrap));
        actions.appendChild(b);
      });
      wrap.appendChild(actions);

      // Кнопка перехода (скрыта пока не 100%)
      const nextRow = document.createElement('div');
      nextRow.className = 'level7-btn-row';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-primary level7-tama-next';
      nextBtn.type = 'button';
      nextBtn.textContent = 'Получить подарок';
      on(nextBtn, 'click', () => {
        progress.part2Done = true; saveProgress();
        fadeTo(renderPart3());
      });
      nextRow.appendChild(nextBtn);
      wrap.appendChild(nextRow);

      // Состояние
      p2State = {
        stats: Object.assign({}, progress.stats),
        actionLock: null,    // 'feed-modal' | 'play' | 'pet' | 'litter'
        lowWarnings: { hunger: 0, litter: 0, play: 0, pet: 0 },
        completed: false,
      };

      function refreshStats() {
        STAT_DEFS.forEach(s => {
          const v = p2State.stats[s.id];
          const row = wrap.querySelector('.level7-stat[data-stat-id="' + s.id + '"]');
          if (!row) return;
          const fill = row.querySelector('.stat-fill');
          const val = row.querySelector('.stat-value');
          fill.style.width = v + '%';
          fill.classList.remove('low', 'mid', 'high');
          if (v < 30) fill.classList.add('low');
          else if (v < 70) fill.classList.add('mid');
          else fill.classList.add('high');
          val.textContent = Math.round(v) + '%';
        });
        // Кнопка появляется, когда все шкалы ≥ 95% — 100% одновременно
        // недостижимо из-за декремента, а ≥95% означает «всё в порядке».
        const all = STAT_DEFS.every(s => p2State.stats[s.id] >= 95);
        if (all && !p2State.completed) {
          p2State.completed = true;
          nextBtn.classList.add('visible');
          setBubble(wrap, 'Хорошо. Ты прошёл проверку. Заботливый. Это я и так знала. Но проверить было приятно.');
        }
      }
      refreshStats();

      // Декрементер. После выполнения — уже не убавляем, чтобы игроку не
      // приходилось гнаться за стрелкой.
      every(() => {
        if (!p2State || p2State.completed) return;
        let changed = false;
        STAT_DEFS.forEach(s => {
          if (p2State.stats[s.id] > 0) {
            p2State.stats[s.id] = Math.max(0, p2State.stats[s.id] - 1);
            changed = true;
          }
        });
        if (changed) refreshStats();
        // Лёгкие реплики при низком значении (не чаще одной за раз)
        if (!p2State.actionLock) {
          for (const s of STAT_DEFS) {
            if (p2State.stats[s.id] < 30 && Date.now() - p2State.lowWarnings[s.id] > 12000) {
              setBubble(wrap, s.lowReply);
              p2State.lowWarnings[s.id] = Date.now();
              break;
            }
          }
        }
      }, 5000);

      // Сохраняем состояние
      every(() => {
        progress.stats = Object.assign({}, p2State.stats);
        saveProgress();
      }, 4000);

      // Хелпер boostStat
      wrap._boostStat = (id, amount, reply) => {
        p2State.stats[id] = Math.min(100, p2State.stats[id] + amount);
        refreshStats();
        // Положительное действие — звук успеха
        AUDIO.play('success');
        if (reply) setBubble(wrap, reply);
      };
      wrap._refresh = refreshStats;

      return wrap;
    }

    function setBubble(scope, text) {
      const b = scope.querySelector('.level7-bubble');
      if (!b) return;
      const p = b.querySelector('p');
      if (p) p.textContent = text;
    }

    // Новая механика: кнопка снизу = «взять инструмент». Инструмент-эмодзи
    // прилипает к курсору. Водишь по Нори — соответствующая шкала растёт.
    // Клик по той же кнопке — отпустить инструмент.
    const TOOL_TO_STAT = {
      feed: 'hunger',
      litter: 'litter',
      play: 'play',
      pet: 'pet',
    };
    const TOOL_ICON = {
      feed:   '🥣',
      litter: '🧹',
      play:   '🪀',
      pet:    '✋',
    };
    const TOOL_HINT = {
      feed:   'Веди миску ко мне — буду есть.',
      litter: 'Веник в руки — пройдись по лотку.',
      play:   'Размахивай игрушкой — догоню.',
      pet:    'Гладь меня. Только не сильно.',
    };
    const TOOL_DONE = {
      feed:   'Спасибо. Я почти сыта.',
      litter: 'Чистый лоток — чистая совесть кошки.',
      play:   'Я как ненормальная. Это мой стиль.',
      pet:    'Мрррр. Только не за ушком. Ну ладно, можно за ушком.',
    };

    function handleAction(actionId, scope) {
      if (!p2State) return;
      activateTool(actionId, scope);
    }

    function activateTool(toolId, scope) {
      // Если этот же инструмент уже активен — отпускаем
      if (p2State.activeTool === toolId) {
        deactivateTool(scope);
        return;
      }
      // Сменили инструмент — гасим прежнее состояние (purr и т.п.)
      if (p2State.activeTool) deactivateTool(scope);
      p2State.activeTool = toolId;
      // Подсвечиваем выбранную кнопку
      scope.querySelectorAll('.level7-action').forEach(b => {
        b.classList.toggle('selected', b.dataset.actionId === toolId);
      });
      // Покажем ghost-инструмент при движении мыши
      ensureToolGhost(scope);
      // Для ласки — заводим мурлыканье
      if (toolId === 'pet') AUDIO.playLoop('purr');
      setBubble(scope, TOOL_HINT[toolId]);
    }

    function deactivateTool(scope) {
      if (!p2State) return;
      if (p2State.activeTool === 'pet') AUDIO.stopLoop('purr');
      p2State.activeTool = null;
      scope.querySelectorAll('.level7-action').forEach(b => b.classList.remove('selected'));
      const ghost = scope.querySelector('.level7-tool-ghost');
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }

    function ensureToolGhost(scope) {
      // Призрак-эмодзи следует за курсором. Создаётся лениво при первом mousemove.
      const board = scope.querySelector('.level7-tama-board');
      if (!board) return;
      if (board._mouseTracker) return;
      board._mouseTracker = true;
      const noriBox = scope.querySelector('.level7-tama-nori');
      let ghost = null;
      let lastOver = false;
      let petStrokes = 0;
      let lastReaction = 0;

      function moveHandler(e) {
        if (!p2State.activeTool) {
          if (ghost) { ghost.remove(); ghost = null; }
          return;
        }
        if (!ghost) {
          ghost = document.createElement('div');
          ghost.className = 'level7-tool-ghost';
          board.appendChild(ghost);
        }
        ghost.textContent = TOOL_ICON[p2State.activeTool];
        const br = board.getBoundingClientRect();
        ghost.style.left = (e.clientX - br.left) + 'px';
        ghost.style.top  = (e.clientY - br.top) + 'px';
        // Проверка наведения на Нори
        const nb = noriBox.getBoundingClientRect();
        const over = e.clientX >= nb.left && e.clientX <= nb.right &&
                     e.clientY >= nb.top  && e.clientY <= nb.bottom;
        if (over) {
          // Прирост шкалы — раз в кадр движения мыши над Нори.
          const stat = TOOL_TO_STAT[p2State.activeTool];
          if (stat) {
            p2State.stats[stat] = Math.min(100, p2State.stats[stat] + 1.4);
            scope._refresh();
            // Раз в ~250мс — визуальная реакция (сердечко/нота/блюдо)
            const now = Date.now();
            if (now - lastReaction > 250) {
              spawnReaction(noriBox, p2State.activeTool);
              lastReaction = now;
              // Если pet — отметим «штрих»
              if (p2State.activeTool === 'pet') petStrokes++;
            }
            // Когда шкала достигла 100 — короткий комментарий + отпустим
            if (p2State.stats[stat] >= 100 && !p2State._lastDoneAt) {
              setBubble(scope, TOOL_DONE[p2State.activeTool] || '');
              p2State._lastDoneAt = stat;
            }
          }
        }
        lastOver = over;
      }
      function leaveHandler() {
        if (ghost) { ghost.remove(); ghost = null; }
      }
      // Тач — преобразуем touchmove в pseudo-mousemove с координатами пальца
      function touchHandler(e) {
        if (!e.touches || !e.touches[0]) return;
        e.preventDefault();
        moveHandler({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      }
      board.addEventListener('mousemove', moveHandler);
      board.addEventListener('mouseleave', leaveHandler);
      board.addEventListener('touchstart', touchHandler, { passive: false });
      board.addEventListener('touchmove', touchHandler, { passive: false });
      board.addEventListener('touchend', leaveHandler);
      board.addEventListener('touchcancel', leaveHandler);
      listeners.push(() => board.removeEventListener('mousemove', moveHandler));
      listeners.push(() => board.removeEventListener('mouseleave', leaveHandler));
      listeners.push(() => board.removeEventListener('touchstart', touchHandler));
      listeners.push(() => board.removeEventListener('touchmove', touchHandler));
      listeners.push(() => board.removeEventListener('touchend', leaveHandler));
      listeners.push(() => board.removeEventListener('touchcancel', leaveHandler));
    }

    function spawnReaction(noriBox, toolId) {
      const reactions = {
        feed:   ['🍣', '🐟', '🍴'],
        litter: ['✨', '💨'],
        play:   ['💨', '🐭', '⚡'],
        pet:    ['💗', '💗', '💕'],
      };
      const arr = reactions[toolId] || ['💗'];
      const el = document.createElement('span');
      el.className = 'level7-pet-heart';
      el.textContent = arr[Math.floor(Math.random() * arr.length)];
      el.style.left = (25 + Math.random() * 50) + '%';
      el.style.top  = (25 + Math.random() * 30) + '%';
      noriBox.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1200);
    }

    // (старые doFeed/doLitter/doPlay/doPet и showFeedModal удалены —
    //  заменены на activateTool + ensureToolGhost выше.)

    // =========================================
    //   ЧАСТЬ 3 — КУСЬ
    // =========================================
    function renderPart3() {
      const wrap = document.createElement('div');
      wrap.className = 'level7-part3';

      const bubble = document.createElement('div');
      bubble.className = 'level7-bubble';
      bubble.innerHTML =
        '<span class="speaker">— Нори:</span>' +
        '<p>Так. Теперь главное.<br><br>' +
        'Я долго думала, что тебе подарить. Подарки от котов — это сложно. Мышь? Ты не оценишь. Тапок в миске? Тоже мимо.<br><br>' +
        'Поэтому решила так. Подойди ближе. Я хочу сказать тебе кое-что на ушко.</p>';
      wrap.appendChild(bubble);

      const stage = document.createElement('div');
      stage.className = 'level7-kus-stage';
      const noriBox = document.createElement('div');
      noriBox.className = 'level7-kus-nori';
      noriBox.innerHTML = noriSpriteSVG();
      stage.appendChild(noriBox);
      wrap.appendChild(stage);

      const btnRow = document.createElement('div');
      btnRow.className = 'level7-btn-row';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Наклониться к Нори';
      on(btn, 'click', () => doKus(stage, noriBox, bubble, btn, wrap));
      btnRow.appendChild(btn);
      wrap.appendChild(btnRow);

      return wrap;
    }

    function doKus(stage, noriBox, bubble, btn, wrap) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      // Камера приближается — масштаб Нори вырастает
      noriBox.classList.add('zooming');
      later(() => {
        // Создаём стикер заранее, чтобы дать браузеру commit'нуть в DOM,
        // и одновременно с активацией .show запускаем звук — синхронно.
        const sticker = document.createElement('div');
        sticker.className = 'level7-kus-sticker';
        sticker.innerHTML = buildKusStickerSVG();
        stage.appendChild(sticker);
        // requestAnimationFrame гарантирует, что .show triggernet анимацию,
        // и звук стартует ровно в тот же кадр, что и pop стикера.
        requestAnimationFrame(() => {
          AUDIO.play('cartoon-bite');
          sticker.classList.add('show');
        });
        later(() => {
          sticker.classList.add('fade');
          later(() => {
            if (sticker.parentNode) sticker.parentNode.removeChild(sticker);
            noriBox.classList.remove('zooming');
            // Финальная реплика
            const p = bubble.querySelector('p');
            if (p) p.innerHTML =
              'Ха. Это было обязательно. Кусь — мой авторский почерк.<br><br>' +
              'А теперь серьёзно. Подарок у Веры. Она ждала, когда я разрешу. Я разрешаю.<br><br>' +
              'Иди к ней.';
            // Кнопка → финал
            btn.style.opacity = '1';
            btn.disabled = false;
            btn.textContent = 'Теперь к настоящему подарку →';
            // Заменяем обработчик
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            on(newBtn, 'click', () => {
              progress.part3Done = true; progress.passed = true;
              saveProgress();
              fadeTo(renderFinal());
            });
          }, 700);
        }, 2400);
      }, 1100);
    }

    function buildKusStickerSVG() {
      // Чёрный кот в позе «кусаю» по референсу: открытая красная пасть,
      // белые клыки, огромные белые глаза с вертикальными зрачками,
      // острые ушки, длинные усы.
      return '<svg viewBox="0 0 280 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
        // мягкий тёплый ореол вокруг (как у референса)
        '<ellipse cx="140" cy="150" rx="115" ry="125" fill="#f4d68a" opacity="0.35"/>' +
        // ТЕЛО+ГОЛОВА — крупный овал-силуэт
        '<ellipse cx="140" cy="155" rx="92" ry="112" fill="#1a1614"/>' +
        // УШИ — острые треугольники по углам головы
        '<path d="M 78 78 L 102 26 L 128 68 Z" fill="#1a1614"/>' +
        '<path d="M 202 78 L 178 26 L 152 68 Z" fill="#1a1614"/>' +
        // Внутренняя розовая часть уха
        '<path d="M 92 70 L 102 42 L 118 65 Z" fill="#5a2a2a" opacity="0.55"/>' +
        '<path d="M 188 70 L 178 42 L 162 65 Z" fill="#5a2a2a" opacity="0.55"/>' +
        // ОГРОМНЫЕ ЖЁЛТЫЕ ГЛАЗА — как у настоящей Нори
        '<circle cx="105" cy="120" r="16" fill="#f4b53c"/>' +
        '<circle cx="170" cy="120" r="16" fill="#f4b53c"/>' +
        // Вертикальные зрачки (как у злого кота)
        '<ellipse cx="108" cy="120" rx="2.8" ry="11" fill="#1a1614"/>' +
        '<ellipse cx="167" cy="120" rx="2.8" ry="11" fill="#1a1614"/>' +
        // Маленькие белые блики в глазах
        '<circle cx="111" cy="116" r="2" fill="#fff"/>' +
        '<circle cx="173" cy="116" r="2" fill="#fff"/>' +
        // ОТКРЫТАЯ ПАСТЬ — большой красный овал слегка смещён влево от центра
        '<ellipse cx="118" cy="195" rx="32" ry="36" fill="#e63946"/>' +
        // Внутренняя часть пасти — глубже, темнее
        '<ellipse cx="118" cy="200" rx="22" ry="25" fill="#a01828"/>' +
        // Полоски-«рёбра» на языке
        '<path d="M 100 198 Q 118 202 136 198" stroke="#7a0e1c" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M 100 210 Q 118 214 136 210" stroke="#7a0e1c" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M 102 220 Q 118 224 134 220" stroke="#7a0e1c" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
        // ВЕРХНИЕ КЛЫКИ — две белые треугольные «иглы» сверху пасти
        '<path d="M 99 165 L 104 180 L 109 165 Z" fill="#fff" stroke="#e0d0a0" stroke-width="0.5"/>' +
        '<path d="M 127 165 L 132 180 L 137 165 Z" fill="#fff" stroke="#e0d0a0" stroke-width="0.5"/>' +
        // НИЖНИЕ КЛЫКИ — направлены вверх
        '<path d="M 103 225 L 108 213 L 113 225 Z" fill="#fff" stroke="#e0d0a0" stroke-width="0.5"/>' +
        '<path d="M 123 225 L 128 213 L 133 225 Z" fill="#fff" stroke="#e0d0a0" stroke-width="0.5"/>' +
        // ДЛИННЫЕ УСЫ ВПРАВО (как на референсе — основная масса справа)
        '<path d="M 150 175 Q 200 168 262 158" stroke="#f8f4e8" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M 150 192 Q 205 195 268 200" stroke="#f8f4e8" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M 150 210 Q 200 220 258 240" stroke="#f8f4e8" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
        // КОРОТКИЕ УСЫ ВЛЕВО
        '<path d="M 90 178 Q 60 172 22 168" stroke="#f8f4e8" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M 90 195 Q 55 200 18 208" stroke="#f8f4e8" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        // Подпись «Кусь!» — рукописная, под котом, слегка повёрнута
        '<text x="140" y="298" text-anchor="middle" fill="#1a1614" ' +
          'font-family="Caveat, cursive" font-size="44" font-weight="700" ' +
          'transform="rotate(-3 140 298)">Кусь!</text>' +
      '</svg>';
    }

    // =========================================
    //   ЧАСТЬ 4 — ФИНАЛЬНЫЙ ЭКРАН
    // =========================================
    function renderFinal() {
      // Нори появляется на финальном экране — приветственное мяу
      AUDIO.play('meow', { volume: 0.3 });
      // Финальный экран: торжественная мелодия final.mp3 — зацикленно,
      // плавно нарастает с тишины до 0.4 за 2 секунды («оркестр вступает»).
      // При клике «Конец» сделаем fade-out 1с — см. ниже.
      AUDIO.playLoop('final', { volume: 0.4, fadeIn: 2000 });

      const wrap = document.createElement('div');
      wrap.className = 'level7-final';

      // Конфетти-фон
      const confetti = document.createElement('div');
      confetti.className = 'level7-confetti';
      for (let i = 0; i < 24; i++) {
        const c = document.createElement('span');
        c.className = 'l7-confetto';
        c.style.left = (Math.random() * 100) + '%';
        c.style.setProperty('--delay', (Math.random() * 4) + 's');
        c.style.setProperty('--duration', (4 + Math.random() * 4) + 's');
        c.style.setProperty('--col', ['#e63946','#f4b53c','#4b8a3a','#c97b5a','#0a8aa0'][i % 5]);
        confetti.appendChild(c);
      }
      wrap.appendChild(confetti);

      const headline = document.createElement('h2');
      headline.className = 'level7-final-headline';
      headline.textContent = 'С днём рождения, любимый!';
      wrap.appendChild(headline);

      // Поздравительный текст — компактно, без переноса между предложениями.
      // (Нори-спрайт убран — она и так на фото ниже.)
      const card = document.createElement('div');
      card.className = 'level7-letter';
      card.innerHTML =
        '<p>Я смотрю на всё, что у нас было, и не могу поверить, как нам повезло. ' +
        'Я люблю тебя! Люблю все эти годы вместе, и все, что ещё впереди. ' +
        'С днём рождения, любимый!</p>';
      wrap.appendChild(card);

      // Рамка под фото — подгружаем то же images/уровень-7.jpg, что и на
      // экране «Финал.». Если файла нет — остаётся пунктирная плашка.
      const photo = document.createElement('div');
      photo.className = 'level7-photo-frame';
      photo.innerHTML = '<span>наше фото · мы трое</span>';
      wrap.appendChild(photo);
      tryLoadLevelPhoto(7, photo, 'мы трое');

      // Подпись
      const sig = document.createElement('div');
      sig.className = 'level7-signature';
      sig.innerHTML = 'С любовью,<br>Вера и 🐾 Нори';
      wrap.appendChild(sig);

      // Кнопки в ряд: «Сыграть ещё раз» (вторичная) и «Конец» (основная)
      const btnRow = document.createElement('div');
      btnRow.className = 'level7-final-btnrow';

      const replay = document.createElement('button');
      replay.className = 'btn btn-secondary';
      replay.type = 'button';
      replay.textContent = 'Сыграть ещё раз';
      on(replay, 'click', () => {
        // Гасим мелодию, чистим прогресс уровня и перезапускаем с Части 1
        AUDIO.stopLoop('final', { fadeOut: 600 });
        try { localStorage.removeItem(L7_STORAGE_KEY); } catch (e) {}
        // Сбрасываем in-memory state
        progress.part1Done = false;
        progress.part2Done = false;
        progress.part3Done = false;
        progress.passed = false;
        progress.stats = { hunger: 20, litter: 20, play: 20, pet: 20 };
        // Перерисовываем контент с нуля
        fadeTo(renderPart1());
      });
      btnRow.appendChild(replay);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'На карту';
      on(btn, 'click', () => {
        // Плавно гасим финальную мелодию за 1с перед переходом.
        // Идём СРАЗУ на карту, минуя промежуточный экран «Финал.» —
        // этот birthday-экран уже сам по себе финал.
        AUDIO.stopLoop('final', { fadeOut: 1000 });
        markLevelCompleted(7);
        goTo('map');
      });
      btnRow.appendChild(btn);

      wrap.appendChild(btnRow);

      return wrap;
    }

    return {
      id: 7,
      title: 'Нори и сейчас.',
      intro:
        'А это моя любимая глава. Здесь я наконец говорю сама. Слушайте внимательно.',
      completionTitle: 'Финал.',
      completionText:
        '[ВПИШУ ПОЗЖЕ — финальное послание, благодарность за всё, ' +
        'и обещание следующей главы]',
      photoCaption: 'мы трое',
      nextButtonText: 'На карту',

      mount(container, onComplete) {
        onCompleteCb = onComplete;
        loadProgress();
        const root = document.createElement('div');
        root.className = 'level7-root';
        contentEl = document.createElement('div');
        contentEl.className = 'level7-content';
        root.appendChild(contentEl);
        container.appendChild(root);
        // Куда вошли
        if (progress.passed) {
          contentEl.appendChild(renderFinal());
        } else if (progress.part2Done) {
          contentEl.appendChild(renderPart3());
        } else if (progress.part1Done) {
          contentEl.appendChild(renderPart2());
        } else {
          contentEl.appendChild(renderPart1());
        }
      },

      unmount() {
        cleanupAll();
        // Останавливаем все зацикленные звуки уровня:
        //   purr — если игрок ушёл во время «Почесать»
        //   final — если ушёл с финального экрана по «← на карту», а не по «Конец»
        AUDIO.stopLoop('purr');
        AUDIO.stopLoop('final');
        contentEl = null;
        onCompleteCb = null;
        p2State = null;
      },
    };
  }

  const LEVELS = [
    createLevel1(),
    createLevel2(),
    createLevel3(),
    createLevel4(),
    createLevel5(),
    createLevel6(),
    createLevel7(),
  ];

  function getLevel(id) {
    return LEVELS.find((l) => l.id === id) || null;
  }

  // ============================================================
  //  Навигация / рендер
  // ============================================================
  const appEl = document.getElementById('app');
  let activeLevel = null; // объект уровня, чтобы вызвать unmount при уходе

  function clearApp() {
    if (activeLevel && typeof activeLevel.unmount === 'function') {
      try { activeLevel.unmount(); } catch (e) { console.warn(e); }
    }
    activeLevel = null;
    resetMapDialogState();
    appEl.innerHTML = '';
  }

  function goTo(screen, params) {
    clearApp();
    state.lastScreen = screen;
    saveState();
    // Класс на body — CSS использует его для тёмной темы старт-экрана.
    document.body.className = document.body.className
      .split(/\s+/).filter((c) => !c.startsWith('screen-')).join(' ').trim();
    document.body.classList.add('screen-' + screen + '-active');
    if (screen === 'start') renderStart();
    else if (screen === 'map') renderMap();
    else if (screen === 'level') renderLevel(params && params.levelId);
    else if (screen === 'final') renderFinal();
    else renderStart();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // ---------- Стартовый экран ----------
  function renderStart() {
    const root = document.createElement('section');
    root.className = 'screen-start';

    const hello = document.createElement('h1');
    hello.className = 'start-hello';
    hello.textContent = 'Лю!';
    root.appendChild(hello);

    const t1 = document.createElement('p');
    t1.className = 'start-text first';
    t1.textContent = 'Поздравляю тебя с твоим днём.';
    root.appendChild(t1);

    const t2 = document.createElement('p');
    t2.className = 'start-text';
    t2.textContent =
      'Я собрала здесь нашу историю — самые важные моменты твоего пути. ' +
      'Семь уровней, семь поворотов нашей жизни.';
    root.appendChild(t2);

    const t3 = document.createElement('p');
    t3.className = 'start-text';
    t3.textContent =
      'Тебя проведёт Нори. Дойди до конца — там тебя будет ждать подарок.';
    root.appendChild(t3);

    const signoff = document.createElement('p');
    signoff.className = 'start-signoff';
    signoff.textContent = 'С любовью.';
    root.appendChild(signoff);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.type = 'button';
    btn.textContent = 'Начать';
    btn.addEventListener('click', () => goTo('map'));
    root.appendChild(btn);

    appEl.appendChild(root);
  }

  // ---------- Карта ----------
  // Точки расставлены по зигзагу внутри viewBox 600×420.
  const MAP_VIEWBOX = { w: 600, h: 420 };
  const MAP_POINTS = [
    { x: 80,  y: 350 },
    { x: 175, y: 250 },
    { x: 100, y: 140 },
    { x: 230, y: 70  },
    { x: 370, y: 130 },
    { x: 460, y: 240 },
    { x: 530, y: 360 },
  ];
  const POINT_RADIUS = 26;

  // ============================================================
  //  Карта истории: реплики Нори и диалог
  // ============================================================
  const DIALOGS = {
    firstVisit:
      'Так. Семь точек, семь воспоминаний. Я буду идти с тобой. ' +
      'Постарайся не отставать — у меня лапы короче, но шаг увереннее.',
    subsequentVisit: 'Я всё ещё здесь.',
    hoverAvailable: {
      1: 'С этого началось. Без этого не было бы меня. Я уважаю это место.',
      2: 'Это когда вы пытались стать бизнесменами на Рязанке. Три раза. Угадай, сколько раз получилось.',
      3: 'Это когда вы заперлись вдвоём на полгода. Многие пары такого не пережили. Вы — да.',
      4: 'А вот это мой любимый эпизод. Здесь ты понял, что не всё надо тащить самому. Гордая за тебя.',
      5: 'Вы делали ремонт. Я тогда наблюдала издалека и думала: они готовят мне дом. Готовили, конечно.',
      6: 'Вы уехали без меня. Я не обижалась. Почти.',
      7: 'А это уже про меня. Самая правдивая часть истории.',
    },
    afterLevel: {
      1: 'Хорошо. Теперь дальше.',
      2: 'Иди, иди. Я за тобой.',
      3: 'Ты молодец, что дошёл сюда.',
      4: '🐾 одобряет.',
      5: 'Уютно стало, да?',
      6: 'А я всё это время ждала.',
      7: 'Ну вот. Теперь — главное.',
    },
    lockedClick: [
      'Не торопись. Уровни проходят по порядку. Я тоже не сразу всему научилась.',
      'Сначала предыдущий. Так у нас, котов, принято.',
    ],
    completedClick:
      'Этот ты уже прошёл. Молодец. ' +
      'Но если хочешь — иди ещё раз, я никуда не денусь.',
    noriClick: ['Что?', 'Я слежу.', 'Гладить будешь?', 'Иди уже играй.', '🐾'],
  };

  // Состояние диалога — общее для одной сессии карты.
  const mapDialog = {
    el: null,
    textEl: null,
    typewriterId: null,
    dismissId: null,
    onComplete: null,
    noriClickIdx: 0,
    lockedClickIdx: 0,
  };

  function showMapDialog(text, opts) {
    opts = opts || {};
    if (mapDialog.typewriterId) { clearInterval(mapDialog.typewriterId); mapDialog.typewriterId = null; }
    if (mapDialog.dismissId)    { clearTimeout(mapDialog.dismissId);    mapDialog.dismissId = null; }
    if (!mapDialog.el || !mapDialog.textEl) return;

    mapDialog.el.classList.add('visible');
    mapDialog.textEl.textContent = '';
    mapDialog.textEl.classList.add('typing');
    mapDialog.onComplete = opts.onComplete || null;

    let i = 0;
    mapDialog.typewriterId = setInterval(() => {
      if (i < text.length) {
        mapDialog.textEl.textContent += text[i++];
      } else {
        clearInterval(mapDialog.typewriterId);
        mapDialog.typewriterId = null;
        mapDialog.textEl.classList.remove('typing');
        const duration = (opts.duration != null) ? opts.duration : 4500;
        mapDialog.dismissId = setTimeout(() => hideMapDialog(true), duration);
      }
    }, 28);
  }

  function hideMapDialog(runCallback) {
    if (mapDialog.typewriterId) { clearInterval(mapDialog.typewriterId); mapDialog.typewriterId = null; }
    if (mapDialog.dismissId)    { clearTimeout(mapDialog.dismissId);    mapDialog.dismissId = null; }
    if (mapDialog.el) {
      mapDialog.el.classList.remove('visible');
      if (mapDialog.textEl) mapDialog.textEl.classList.remove('typing');
    }
    const cb = mapDialog.onComplete;
    mapDialog.onComplete = null;
    if (runCallback && typeof cb === 'function') cb();
  }

  function resetMapDialogState() {
    if (mapDialog.typewriterId) { clearInterval(mapDialog.typewriterId); mapDialog.typewriterId = null; }
    if (mapDialog.dismissId)    { clearTimeout(mapDialog.dismissId);    mapDialog.dismissId = null; }
    mapDialog.el = null;
    mapDialog.textEl = null;
    mapDialog.onComplete = null;
  }

  // Нори сидит рядом с текущей доступной лапой (или в центре после прохождения всех).
  const NORI_BY_PAW = [
    { x: 140, y: 290 },  // у лапы 1
    { x: 235, y: 210 },  // у лапы 2
    { x: 155, y: 100 },  // у лапы 3
    { x: 310, y: 50 },   // у лапы 4 (правее, выше)
    { x: 290, y: 80 },   // у лапы 5 (левее, выше)
    { x: 400, y: 205 },  // у лапы 6
    { x: 470, y: 305 },  // у лапы 7
  ];
  const NORI_FINAL = { x: 300, y: 200 };

  function currentNoriPos() {
    const next = firstAvailableLevelId();
    if (next === null) return NORI_FINAL;
    return NORI_BY_PAW[next - 1];
  }

  function buildNoriSprite() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'map-nori');

    // Хвост — длинный, изгибается за телом
    const tail = document.createElementNS(svgNS, 'path');
    tail.setAttribute('class', 'nori-tail');
    tail.setAttribute('d', 'M 9 20 Q 24 14 25 -4 Q 25 -22 15 -24');
    g.appendChild(tail);

    // Тело — стройный teardrop: узкое у плеч, шире у основания
    const body = document.createElementNS(svgNS, 'path');
    body.setAttribute('class', 'nori-body');
    body.setAttribute('d',
      'M -4 -4 Q -12 4 -10 22 Q -8 29 0 29 Q 8 29 10 22 Q 12 4 4 -4 Z');
    g.appendChild(body);

    // Голова — компактный овал
    const head = document.createElementNS(svgNS, 'ellipse');
    head.setAttribute('class', 'nori-head');
    head.setAttribute('cx', '0'); head.setAttribute('cy', '-13');
    head.setAttribute('rx', '9'); head.setAttribute('ry', '8.5');
    g.appendChild(head);

    // Ушки — высокие острые
    const earL = document.createElementNS(svgNS, 'path');
    earL.setAttribute('class', 'nori-ear');
    earL.setAttribute('d', 'M -8 -18 L -10 -28 L -2 -21 Z');
    g.appendChild(earL);
    const earR = document.createElementNS(svgNS, 'path');
    earR.setAttribute('class', 'nori-ear');
    earR.setAttribute('d', 'M 2 -21 L 10 -28 L 8 -18 Z');
    g.appendChild(earR);

    // Внутренние ушки — лёгкий розоватый намёк
    const earLi = document.createElementNS(svgNS, 'path');
    earLi.setAttribute('class', 'nori-ear-inner');
    earLi.setAttribute('d', 'M -7 -20 L -8 -25 L -4.5 -22 Z');
    g.appendChild(earLi);
    const earRi = document.createElementNS(svgNS, 'path');
    earRi.setAttribute('class', 'nori-ear-inner');
    earRi.setAttribute('d', 'M 4.5 -22 L 8 -25 L 7 -20 Z');
    g.appendChild(earRi);

    // Усы — тонкие линии в стороны
    const whiskers = document.createElementNS(svgNS, 'g');
    whiskers.setAttribute('class', 'nori-whiskers');
    [
      'M -8 -9 L -16 -10',
      'M -8 -8 L -16 -7',
      'M 8 -9 L 16 -10',
      'M 8 -8 L 16 -7',
    ].forEach((d) => {
      const w = document.createElementNS(svgNS, 'path');
      w.setAttribute('d', d);
      whiskers.appendChild(w);
    });
    g.appendChild(whiskers);

    // Глазки — жёлтые миндалины
    const eyeL = document.createElementNS(svgNS, 'ellipse');
    eyeL.setAttribute('class', 'nori-eye');
    eyeL.setAttribute('cx', '-4'); eyeL.setAttribute('cy', '-13');
    eyeL.setAttribute('rx', '2.1'); eyeL.setAttribute('ry', '2.7');
    g.appendChild(eyeL);
    const eyeR = document.createElementNS(svgNS, 'ellipse');
    eyeR.setAttribute('class', 'nori-eye');
    eyeR.setAttribute('cx', '4'); eyeR.setAttribute('cy', '-13');
    eyeR.setAttribute('rx', '2.1'); eyeR.setAttribute('ry', '2.7');
    g.appendChild(eyeR);

    // Зрачки — кошачьи вертикальные щели
    const pupilL = document.createElementNS(svgNS, 'ellipse');
    pupilL.setAttribute('class', 'nori-pupil');
    pupilL.setAttribute('cx', '-4'); pupilL.setAttribute('cy', '-13');
    pupilL.setAttribute('rx', '0.7'); pupilL.setAttribute('ry', '2.3');
    g.appendChild(pupilL);
    const pupilR = document.createElementNS(svgNS, 'ellipse');
    pupilR.setAttribute('class', 'nori-pupil');
    pupilR.setAttribute('cx', '4'); pupilR.setAttribute('cy', '-13');
    pupilR.setAttribute('rx', '0.7'); pupilR.setAttribute('ry', '2.3');
    g.appendChild(pupilR);

    // Носик — маленький треугольничек
    const nose = document.createElementNS(svgNS, 'path');
    nose.setAttribute('class', 'nori-nose');
    nose.setAttribute('d', 'M -1.5 -8.5 L 1.5 -8.5 L 0 -6.8 Z');
    g.appendChild(nose);

    // Передние лапки
    const pawL = document.createElementNS(svgNS, 'ellipse');
    pawL.setAttribute('class', 'nori-front-paw');
    pawL.setAttribute('cx', '-4'); pawL.setAttribute('cy', '28');
    pawL.setAttribute('rx', '3'); pawL.setAttribute('ry', '2');
    g.appendChild(pawL);
    const pawR = document.createElementNS(svgNS, 'ellipse');
    pawR.setAttribute('class', 'nori-front-paw');
    pawR.setAttribute('cx', '4'); pawR.setAttribute('cy', '28');
    pawR.setAttribute('rx', '3'); pawR.setAttribute('ry', '2');
    g.appendChild(pawR);

    return g;
  }

  // Пути из оригинального SVG (лап-копия.svg): 1 подушечка + 4 пальчика.
  const PAW_SVG_PATHS = [
    'M473.3,530.3c0.4,13.8-2.1,30.7-10.4,46.4c-14.8,27.7-38.8,43.4-68.4,51.5c-29.4,8-58.3,3.8-86.6-5.6c-17.1-5.7-33.8-12.5-50.6-19.1c-16.2-6.3-32.6-11.4-50.3-10c-16.5,1.3-32.1,6.2-47.4,12.4c-23,9.4-45.8,19.3-70.1,24.8c-30.6,7-60.7,7.2-89.3-7.5c-28.2-14.5-45.3-37.9-50.1-69c-8-52.4,5-99.6,39-140.3c14.2-17,30.3-32.3,45.4-48.5c23.2-24.8,46.1-49.9,69.4-74.6c18-19,37.2-36.7,60.5-49.4c17.6-9.6,36.6-14.1,56.6-12c20.3,2.1,38.1,10.6,54,23.4c19.5,15.6,35.9,34.2,52.3,52.8c19.1,21.7,40.1,41.4,61.6,60.6c28.4,25.4,54.5,52.9,69.6,88.7C468.3,477.8,473.5,501.7,473.3,530.3z',
    'M561.3,191.9c-0.9,51-18.4,95.2-54.3,131.8c-16.3,16.6-35.9,25.8-59.6,25.6c-29-0.3-53.9-18.6-64.4-47.9c-6.1-17-7.4-34.6-5.3-52.5c5.8-48.6,27.3-89.3,61.8-123.4c12.6-12.4,27.2-21.6,44.9-25.3c27-5.7,51.1,5.5,63.6,30.2C557.8,149.6,561.7,170.3,561.3,191.9z',
    'M47.1,260.5c-0.9,24.5-3.9,44.9-16.8,62.4c-15.5,21.2-36.7,28.8-62,25.5c-28.7-3.7-48.9-21.1-65.4-43.3c-19.6-26.3-30.9-56.1-35-88.7c-3-23.6-3.2-47,4.1-70c4.9-15.4,12.5-29,26-38.5c10.6-7.5,22.7-10,35.4-9.1c26.4,2,45.7,16.6,62.5,35.4c25.1,28.2,40.3,61.3,47.7,98.1C45.7,242.7,46.2,253.4,47.1,260.5z',
    'M399.1,56.2c-0.7,38.6-10.2,74.5-34.4,105.4c-11.6,14.7-25.8,25.8-44.7,29.7c-27.9,5.9-56.2-5.6-72.1-29.3c-16.1-23.9-20-50.4-17.2-78.5c3.3-32.9,13.2-63.8,29-92.8c9.2-16.9,20.4-32.4,36.1-44c24.6-18.1,52.1-15.2,71.9,7.6c10.6,12.3,17.1,26.9,21.9,42C395.9,15.8,399.4,35.8,399.1,56.2z',
    'M27.5,62.7c1.2-37.2,5.2-67.1,19.6-94.7c7.7-14.7,18.1-26.9,34.9-31.3c18.5-4.9,34.7,0.6,49.2,12.3c17.1,13.9,28,32.2,37.7,51.5c13.2,26.1,22.1,53.6,25.7,82.6c3.4,26.7,1.3,52.9-13.8,76.3c-24,37.1-70.4,44.3-104.8,16.5c-23.4-18.9-36.4-44.2-42.8-72.9C29.9,87.7,28.8,71.9,27.5,62.7z',
  ];
  // Transform для большой лапы (точки уровней). Подобран эмпирически —
  // вписывает оригинальный bbox в ~30×30 SVG-юнитов с центром в (0,0).
  const PAW_INNER_TRANSFORM = 'scale(0.045) translate(-225, -270)';
  const PAW_INNER_TRANSFORM_MINI = 'scale(0.014) translate(-225, -270)';

  function buildLevelPaw(svgNS, levelId, status, rotation) {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'map-point ' + status);
    g.dataset.levelId = String(levelId);

    // Стабильный хитбокс (невидимый). Не двигается, не дёргает hover.
    const hit = document.createElementNS(svgNS, 'rect');
    hit.setAttribute('class', 'paw-hit');
    hit.setAttribute('x', '-32'); hit.setAttribute('y', '-32');
    hit.setAttribute('width', '64'); hit.setAttribute('height', '64');
    g.appendChild(hit);

    // Сам отпечаток — вращаем целиком (включая подушечку и пальчики).
    const shape = document.createElementNS(svgNS, 'g');
    shape.setAttribute('class', 'paw-shape');
    shape.setAttribute('transform', 'rotate(' + rotation + ')');

    // Оригинальная лапа из SVG (path data из лап-копия.svg).
    // Содержит подушечку + 4 пальчика как 5 path-элементов.
    // Вложенная группа подгоняет масштаб и центрирует под мою систему координат.
    const inner = document.createElementNS(svgNS, 'g');
    PAW_SVG_PATHS.forEach((d) => {
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      inner.appendChild(p);
    });
    inner.setAttribute('transform', PAW_INNER_TRANSFORM);
    shape.appendChild(inner);
    g.appendChild(shape);

    // Номер — справа от лапы, не вращается с ней.
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('class', 'paw-label');
    label.setAttribute('x', '22'); label.setAttribute('y', '10');
    label.textContent = String(levelId);
    g.appendChild(label);

    return g;
  }

  function renderMap() {
    const root = document.createElement('section');
    root.className = 'screen-map';

    const header = document.createElement('div');
    header.className = 'map-header';
    const h2 = document.createElement('h2');
    h2.textContent = 'Карта истории';
    header.appendChild(h2);
    const progressLabel = document.createElement('span');
    progressLabel.className = 'progress';
    progressLabel.textContent = state.completedLevels.length + ' / ' + LEVELS.length;
    header.appendChild(progressLabel);
    root.appendChild(header);

    const canvas = document.createElement('div');
    canvas.className = 'map-canvas';
    canvas.appendChild(buildMapSvg());
    root.appendChild(canvas);

    // Реплика Нори под картой
    const dialog = document.createElement('div');
    dialog.className = 'nori-dialog-wrap';
    const speaker = document.createElement('span');
    speaker.className = 'nori-dialog-speaker';
    speaker.textContent = 'Нори:';
    dialog.appendChild(speaker);
    const textEl = document.createElement('span');
    textEl.className = 'nori-dialog-text';
    dialog.appendChild(textEl);
    root.appendChild(dialog);
    mapDialog.el = dialog;
    mapDialog.textEl = textEl;

    // Подвал: кнопка сброса. Кнопка «К финалу» убрана — финальный экран
    // уровня 7 («С днём рождения, любимый!») и есть последний слайд.
    const footer = document.createElement('div');
    footer.className = 'map-footer';
    footer.appendChild(document.createElement('span'));
    const reset = document.createElement('button');
    reset.className = 'btn btn-ghost';
    reset.type = 'button';
    reset.textContent = 'Сбросить прогресс';
    reset.addEventListener('click', () => {
      if (confirm('Сбросить весь прогресс?')) {
        resetProgress();
        goTo('start');
      }
    });
    footer.appendChild(reset);
    root.appendChild(footer);

    // Клик в любом месте карты (кроме интерактивных элементов с собственной логикой)
    // скрывает текущую реплику — и по самой плашке тоже.
    root.addEventListener('click', (e) => {
      if (
        e.target.closest('.map-point') ||
        e.target.closest('.map-nori') ||
        e.target.closest('button')
      ) return;
      hideMapDialog();
    });

    appEl.appendChild(root);

    triggerInitialMapDialog();
  }

  function triggerInitialMapDialog() {
    // Только что прошёл уровень → реплика afterLevel[id]
    if (justCompletedLevelId !== null) {
      const id = justCompletedLevelId;
      justCompletedLevelId = null;
      const text = DIALOGS.afterLevel[id] || '';
      // После любого уровня (включая последний) — просто показываем реплику
      // на карте. Финальный экран-заглушка удалён — последний слайд это
      // birthday-screen внутри L7.
      showMapDialog(text, { duration: 3600 });
      return;
    }
    // Первый визит — длинная реплика
    if (!state.mapVisited) {
      state.mapVisited = true;
      saveState();
      showMapDialog(DIALOGS.firstVisit, { duration: 6000 });
      return;
    }
    // Повторный визит — короткая
    showMapDialog(DIALOGS.subsequentVisit, { duration: 2800 });
  }

  // Тонкие line-art иконки для декора карты. ViewBox каждой ~24×24, центр в (0,0).
  const DECOR_SHAPES = {
    heart: '<path d="M 0 6 C -6 2 -8 -3 -4 -5 C -2 -6 -1 -4 0 -3 C 1 -4 2 -6 4 -5 C 8 -3 6 2 0 6 Z"/>',
    yarn:  '<circle cx="0" cy="0" r="7" fill="none"/>' +
           '<path d="M -7 0 Q 0 -5 7 0 M -6 3 Q 0 -2 6 3 M -5 -3 Q 0 2 5 -3" stroke-width="1" fill="none"/>' +
           '<path d="M 5 5 L 9 9 M 9 7 L 9 11 L 5 9" stroke-width="0.8" fill="none"/>',
    fish:  '<path d="M -8 0 Q -4 -5 4 -3 Q 9 -2 9 0 Q 9 2 4 3 Q -4 5 -8 0 Z" fill="none"/>' +
           '<path d="M -8 0 L -12 -4 L -10 0 L -12 4 Z" fill="none"/>' +
           '<circle cx="5" cy="-1" r="0.7"/>',
    star:  '<path d="M 0 -6 L 1.6 -2 L 6 -2 L 2.4 0.6 L 4 5 L 0 2.4 L -4 5 L -2.4 0.6 L -6 -2 L -1.6 -2 Z" fill="none"/>',
    paw:   '<ellipse cx="0" cy="1.5" rx="3.5" ry="3" fill="none"/>' +
           '<circle cx="-3.5" cy="-3" r="1.6" fill="none"/>' +
           '<circle cx="-1" cy="-5" r="1.4" fill="none"/>' +
           '<circle cx="1.5" cy="-5" r="1.4" fill="none"/>' +
           '<circle cx="4" cy="-3" r="1.6" fill="none"/>',
  };

  function buildMapSvg() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'map-svg');
    svg.setAttribute('viewBox', '0 0 ' + MAP_VIEWBOX.w + ' ' + MAP_VIEWBOX.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Декоративный фон — разбросанные «штуки кошачьей жизни»: сердечки,
    // клубочки, рыбки, звёздочки. Тонкие, полупрозрачные, не отвлекают.
    const decor = document.createElementNS(svgNS, 'g');
    decor.setAttribute('class', 'map-decor');
    const DECOR = [
      // [type, x, y, rot]
      ['heart',   60,  60,   12],
      ['yarn',   520,  40,  -8],
      ['fish',   560, 180,   18],
      ['star',    40, 200,    0],
      ['heart',  330, 200,  -10],
      ['paw',    480, 350,   25],
      ['yarn',    90, 380,   15],
      ['fish',    20, 100,  -20],
      ['star',   570, 290,    0],
      ['paw',    260, 380,  -18],
      ['heart',  140, 30,    24],
      ['star',   300, 30,     0],
    ];
    DECOR.forEach(([type, x, y, rot]) => {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'decor-' + type);
      g.setAttribute('transform', 'translate(' + x + ',' + y + ') rotate(' + rot + ')');
      g.innerHTML = DECOR_SHAPES[type];
      decor.appendChild(g);
    });
    svg.appendChild(decor);

    // Тропинка
    const pathD = buildSmoothPath(MAP_POINTS);
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('class', 'map-path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);

    // Маленькие следы лапок — видны вдоль уже пройденного пути
    for (let i = 0; i < MAP_POINTS.length - 1; i++) {
      const from = MAP_POINTS[i];
      const to = MAP_POINTS[i + 1];
      const targetLevelId = i + 2;
      const visible = isLevelCompleted(targetLevelId);
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const px = from.x + (to.x - from.x) * t;
        const py = from.y + (to.y - from.y) * t;
        const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90;
        const offset = (k % 2 === 0) ? 8 : -8;
        const nx = Math.cos((angle - 90) * Math.PI / 180) * offset;
        const ny = Math.sin((angle - 90) * Math.PI / 180) * offset;
        const paw = createPawGroup(svgNS, px + nx, py + ny, angle);
        if (visible) paw.classList.add('paw-visible');
        svg.appendChild(paw);
      }
    }

    // Большие лапы-уровни
    const available = firstAvailableLevelId();
    MAP_POINTS.forEach((p, idx) => {
      const id = idx + 1;
      const completed = isLevelCompleted(id);
      let status = 'locked';
      if (completed) status = 'completed';
      else if (id === available) status = 'available';
      // Лёгкий детерминированный поворот для естественности следа
      const rotation = ((id * 31 + 7) % 23) - 11;
      const g = buildLevelPaw(svgNS, id, status, rotation);
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');

      if (status === 'available') {
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '0');
        const open = () => goTo('level', { levelId: id });
        g.addEventListener('click', (e) => { e.stopPropagation(); open(); });
        g.addEventListener('mouseenter', () => {
          showMapDialog(DIALOGS.hoverAvailable[id] || '', { duration: 4500 });
        });
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      } else if (status === 'completed') {
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '0');
        const replay = () => {
          // Сразу открываем уровень — без задержки на типпинг реплики.
          hideMapDialog(false);
          goTo('level', { levelId: id });
        };
        g.addEventListener('click', (e) => { e.stopPropagation(); replay(); });
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replay(); }
        });
      } else {
        g.addEventListener('click', (e) => {
          e.stopPropagation();
          const arr = DIALOGS.lockedClick;
          const text = arr[Math.floor(Math.random() * arr.length)];
          showMapDialog(text, { duration: 4200 });
        });
      }

      svg.appendChild(g);
    });

    // Нори — последняя (поверх всего), с анимированным «прыжком» к новой позиции
    const nori = buildNoriSprite();
    nori.style.cursor = 'pointer';
    nori.addEventListener('click', () => AUDIO.play('meow', { volume: 0.4 }));
    const current = currentNoriPos();
    let initial = current;
    if (justCompletedLevelId !== null
        && justCompletedLevelId >= 1
        && justCompletedLevelId <= NORI_BY_PAW.length) {
      initial = NORI_BY_PAW[justCompletedLevelId - 1];
    }
    nori.style.transform = 'translate(' + initial.x + 'px, ' + initial.y + 'px)';
    if (initial.x !== current.x || initial.y !== current.y) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        nori.style.transform = 'translate(' + current.x + 'px, ' + current.y + 'px)';
      }));
    }
    nori.addEventListener('click', (e) => {
      e.stopPropagation();
      const arr = DIALOGS.noriClick;
      const text = arr[Math.floor(Math.random() * arr.length)];
      showMapDialog(text, { duration: 2400 });
    });
    svg.appendChild(nori);

    // Глазки следят за курсором по карте
    attachNoriEyeTracking(svg, nori);

    return svg;
  }

  function attachNoriEyeTracking(svg, nori) {
    const pupils = nori.querySelectorAll('.nori-pupil');
    if (pupils.length < 2) return;
    // Базовые позиции зрачков (в координатах группы Нори)
    const baseL = { x: -4, y: -13 };
    const baseR = { x: 4,  y: -13 };

    function getNoriPos() {
      // Нори перемещается через CSS transform translate(x px, y px)
      // Парсим из inline-стиля
      const m = (nori.style.transform || '').match(/translate\(([\d.-]+)px,\s*([\d.-]+)px\)/);
      if (!m) return { x: 0, y: 0 };
      return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    }

    function move(e) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const cur = pt.matrixTransform(ctm.inverse());
      const np = getNoriPos();

      // Координата зрачка в системе SVG = np + base
      function calc(base) {
        const cx = np.x + base.x;
        const cy = np.y + base.y;
        const dx = cur.x - cx;
        const dy = cur.y - cy;
        // Максимальный сдвиг зрачка в пределах глаза (eye rx=2.1, ry=2.7)
        const maxX = 1.2, maxY = 1.4;
        const len = Math.hypot(dx, dy) || 1;
        const t = Math.min(1, len / 60);
        return { x: base.x + (dx / len) * maxX * t,
                 y: base.y + (dy / len) * maxY * t };
      }

      const l = calc(baseL);
      const r = calc(baseR);
      pupils[0].setAttribute('cx', String(l.x));
      pupils[0].setAttribute('cy', String(l.y));
      pupils[1].setAttribute('cx', String(r.x));
      pupils[1].setAttribute('cy', String(r.y));
    }

    function reset() {
      pupils[0].setAttribute('cx', String(baseL.x));
      pupils[0].setAttribute('cy', String(baseL.y));
      pupils[1].setAttribute('cx', String(baseR.x));
      pupils[1].setAttribute('cy', String(baseR.y));
    }

    svg.addEventListener('mousemove', move);
    svg.addEventListener('mouseleave', reset);
  }

  // Изогнутая тропинка — кривые Безье с альтернирующим боковым сдвигом контрольной точки.
  function buildSmoothPath(points) {
    if (points.length < 2) return '';
    let d = 'M ' + points[0].x + ' ' + points[0].y;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const sign = (i % 2 === 0) ? 1 : -1;
      const cx = (prev.x + cur.x) / 2 + sign * (-dy * 0.20);
      const cy = (prev.y + cur.y) / 2 + sign * (dx * 0.20);
      d += ' Q ' + cx + ' ' + cy + ' ' + cur.x + ' ' + cur.y;
    }
    return d;
  }

  function createPawGroup(svgNS, x, y, angleDeg) {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'map-paw');
    g.setAttribute('transform', 'translate(' + x + ',' + y + ') rotate(' + angleDeg + ')');
    // Мини-лапка из тех же оригинальных SVG-путей
    const inner = document.createElementNS(svgNS, 'g');
    PAW_SVG_PATHS.forEach((d) => {
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      inner.appendChild(p);
    });
    inner.setAttribute('transform', PAW_INNER_TRANSFORM_MINI);
    g.appendChild(inner);
    return g;
  }

  // ---------- Экран уровня ----------
  function renderLevel(levelId) {
    const level = getLevel(levelId);
    if (!level) { goTo('map'); return; }
    activeLevel = level;

    const root = document.createElement('section');
    root.className = 'screen-level';

    // Шапка
    const header = document.createElement('div');
    header.className = 'level-header';
    const back = document.createElement('button');
    back.className = 'back-link';
    back.type = 'button';
    back.textContent = '← на карту';
    back.addEventListener('click', () => goTo('map'));
    header.appendChild(back);
    const h2 = document.createElement('h2');
    h2.textContent = level.title;
    header.appendChild(h2);
    root.appendChild(header);

    // Реплика Нори
    const quote = document.createElement('div');
    quote.className = 'nori-quote';
    const label = document.createElement('span');
    label.className = 'nori-label';
    label.textContent = 'От Нори:';
    quote.appendChild(label);
    const quoteP = document.createElement('p');
    quoteP.textContent = level.intro;
    quote.appendChild(quoteP);
    root.appendChild(quote);

    // Сцена миниигры
    const stage = document.createElement('div');
    stage.className = 'level-stage';
    root.appendChild(stage);

    appEl.appendChild(root);

    // Уровень монтируется в stage и сам вызывает onComplete.
    level.mount(stage, () => {
      stage.innerHTML = '';
      stage.appendChild(buildLevelCompleteView(level));
    });
  }

  // Подгружает фото-полароид в чемодан-карточку L6. Пробуем 2 локации:
  // - images/{name}.ext (как у тебя сейчас)
  // - images/polaroids/{name}.ext (старая структура, на всякий случай)
  // И все варианты регистра расширения — GitHub Pages case-sensitive.
  function tryLoadPolaroidPhoto(polaroidEl, name) {
    const photoEl = polaroidEl.querySelector('.polaroid-photo');
    if (!photoEl) return;
    // У тебя файлы в /images/polaroids/ — пробуем эту папку ПЕРВОЙ
    // чтобы не было 6 лишних 404-запросов на мобильном.
    const paths = [];
    ['jpg','JPG','jpeg','JPEG','png','PNG'].forEach(ext => {
      paths.push('images/polaroids/' + name + '.' + ext);
      paths.push('images/' + name + '.' + ext);
    });
    let i = 0;
    function tryNext() {
      if (i >= paths.length) return;
      const img = new Image();
      img.className = 'polaroid-img';
      img.alt = name;
      img.onload = () => {
        photoEl.innerHTML = '';
        photoEl.appendChild(img);
        photoEl.style.background = '#000';
        // iOS Safari криво считает height у img:height=100% внутри flex-родителя
        // с aspect-ratio. Переключаемся на block-layout — child заполняет
        // родителя по реальной геометрии.
        photoEl.classList.add('has-photo');
      };
      img.onerror = () => { i++; tryNext(); };
      img.src = paths[i];
    }
    tryNext();
  }

  // Имена фото уровней. У L6 фото нет (мы убрали photoCaption).
  // На GitHub Pages регистр имеет значение, файлы лежат в /images/levels/
  // как-есть: l1.jpg, l2.JPG, l3.HEIC, l4.JPG, l5.JPG, final.JPG.
  // (HEIC браузеры не отображают — для L3 рекомендуется конвертировать
  // l3.HEIC в l3.jpg на стороне репозитория.)
  const LEVEL_PHOTO_NAMES = {
    1: 'l1', 2: 'l2', 3: 'l3', 4: 'l4', 5: 'l5', 7: 'final',
  };

  function tryLoadLevelPhoto(levelId, container, caption) {
    const baseName = LEVEL_PHOTO_NAMES[levelId];
    if (!baseName) return; // нет фото для этого уровня
    // Пробуем все комбинации: подпапка levels/ или корень images/,
    // и все варианты регистра расширения (GitHub Pages case-sensitive).
    const paths = [];
    ['jpg','JPG','jpeg','JPEG','png','PNG'].forEach(ext => {
      paths.push('images/levels/' + baseName + '.' + ext);
      paths.push('images/' + baseName + '.' + ext);
    });
    let i = 0;
    const altText = caption || ('Уровень ' + levelId);
    function tryNext() {
      if (i >= paths.length) return;
      const img = new Image();
      img.className = 'level-photo';
      img.alt = altText;
      img.onload = () => {
        container.innerHTML = '';
        container.appendChild(img);
        container.classList.add('has-photo');
      };
      img.onerror = () => { i++; tryNext(); };
      img.src = paths[i];
    }
    tryNext();
  }

  function buildLevelCompleteView(level) {
    // На L3 продолжает играть georgia.mp3 из финала — success не нужен,
    // он бы перебил мелодию.
    if (level.id !== 3) {
      AUDIO.play('success', { volume: 0.2 });
    }
    const wrap = document.createElement('div');
    wrap.className = 'level-complete stack';

    const h2 = document.createElement('h2');
    h2.textContent = level.completionTitle || 'Уровень пройден';
    wrap.appendChild(h2);

    // L6: над текстом показываем три полароида (страны) и благодарность.
    // Это объединяет «финал игры» и «экран Уровень 6 пройден» в один.
    if (level.id === 6) {
      const polRow = document.createElement('div');
      polRow.className = 'level-complete-polaroids';
      const COUNTRIES = [
        { id: 'jp', label: 'Япония',   flag: '🇯🇵', soft: '#fde0e4', file: 'japan' },
        { id: 'mu', label: 'Маврикий', flag: '🏝️', soft: '#dff0f3', file: 'mauritius' },
        { id: 'it', label: 'Италия',   flag: '🇮🇹', soft: '#f4e4d2', file: 'italy' },
      ];
      COUNTRIES.forEach((c, idx) => {
        const pol = document.createElement('div');
        pol.className = 'level6-polaroid';
        pol.style.setProperty('--rot', ((idx - 1) * 3) + 'deg');
        pol.style.setProperty('--delay', (0.3 + idx * 0.25) + 's');
        pol.innerHTML =
          '<div class="polaroid-photo" style="background:' + c.soft + '">' +
            '<span class="polaroid-flag">' + c.flag + '</span>' +
          '</div>' +
          '<div class="polaroid-caption">' + c.label + '</div>';
        polRow.appendChild(pol);
        tryLoadPolaroidPhoto(pol, c.file);
      });
      wrap.appendChild(polRow);
    }

    // Текст-поздравление: пропускаем, если уровень его явно не задал (пустая строка)
    if (level.completionText) {
      const msg = document.createElement('p');
      msg.style.textAlign = 'center';
      msg.style.maxWidth = '460px';
      msg.textContent = level.completionText;
      wrap.appendChild(msg);
    }

    // Фото: пропускаем, если photoCaption пустой (уровень не хочет показывать рамку)
    if (level.photoCaption) {
      const photo = document.createElement('div');
      photo.className = 'photo-placeholder';
      photo.textContent = level.photoCaption;
      wrap.appendChild(photo);
      // Пытаемся подгрузить картинку из /images/ по имени «уровень-N.{jpg,png,jpeg}»
      // Если ни одного варианта нет — placeholder с подписью остаётся как есть.
      tryLoadLevelPhoto(level.id, photo, level.photoCaption);
    }

    const row = document.createElement('div');
    row.className = 'row';

    // Сначала отмечаем уровень пройденным.
    markLevelCompleted(level.id);

    // Кнопка «Пройти заново» — перезапустить тот же уровень С САМОГО НАЧАЛА
    // (с Части 1, если уровень многочастный). Чистим его внутренний прогресс.
    const replay = document.createElement('button');
    replay.className = 'btn btn-secondary';
    replay.type = 'button';
    replay.textContent = 'Пройти заново';
    replay.addEventListener('click', () => {
      const lvlKey = 'nori-story-level' + level.id + '-v1';
      try { localStorage.removeItem(lvlKey); } catch (e) {}
      goTo('level', { levelId: level.id });
    });
    row.appendChild(replay);

    // Основная кнопка «Дальше» → карта
    const next = document.createElement('button');
    next.className = 'btn btn-primary';
    next.type = 'button';
    next.textContent = level.nextButtonText || 'Дальше';
    next.addEventListener('click', () => goTo('map'));
    row.appendChild(next);
    wrap.appendChild(row);

    return wrap;
  }

  // ---------- Финал ----------
  function renderFinal() {
    const root = document.createElement('section');
    root.className = 'screen-final';

    const h1 = document.createElement('h1');
    h1.textContent = 'С днём рождения, Илья!';
    root.appendChild(h1);

    const p = document.createElement('p');
    p.style.maxWidth = '520px';
    p.style.margin = '0 auto 24px';
    p.textContent = 'Здесь будет финальное слово от Нори — тёплое и важное.';
    root.appendChild(p);

    const row = document.createElement('div');
    row.className = 'row';
    const again = document.createElement('button');
    again.className = 'btn btn-secondary';
    again.type = 'button';
    again.textContent = 'Пройти заново';
    again.addEventListener('click', () => {
      if (confirm('Сбросить прогресс и начать заново?')) {
        resetProgress();
        goTo('start');
      }
    });
    row.appendChild(again);
    root.appendChild(row);

    appEl.appendChild(root);
  }

  // ============================================================
  //  Фон стартового экрана
  // ============================================================
  function setupBackdrop() {
    if (document.querySelector('.backdrop')) return;
    const div = document.createElement('div');
    div.className = 'backdrop';
    div.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(div, document.body.firstChild);
  }

  // ============================================================
  //  Запуск
  // ============================================================
  loadState();
  setupBackdrop();

  // Если уже что-то пройдено — открываем карту, чтобы не показывать старт заново.
  const initialScreen = state.completedLevels.length > 0 ? 'map' : 'start';
  goTo(initialScreen);
})();
