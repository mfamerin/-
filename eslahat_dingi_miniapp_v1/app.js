(() => {
  'use strict';

  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor('bg_color'); } catch (_) {}
  }

  const $ = (id) => document.getElementById(id);
  const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const weekNames = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];

  const state = {
    profileName: '',
    tasks: [],
    editType: 'both',
    selectedJ: null,
    viewJY: 1405,
    viewJM: 6,
  };

  // ---------- Persian/Jalali calendar helpers ----------
  const div = (a, b) => Math.trunc(a / b);
  const mod = (a, b) => a - Math.trunc(a / b) * b;

  function jalCal(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    let jump = 0;
    if (jy < jp || jy >= breaks[breaks.length - 1]) throw new Error('Invalid Jalali year');
    for (let i = 1; i < breaks.length; i++) {
      const jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ++;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const g = d2g(jdn);
    let jy = g.gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(g.gy, 3, r.march);
    let k = jdn - jdn1f;
    let jd, jm;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy, jm, jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }

  function toJalali(date) {
    return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
  }

  function toGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  }

  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return jalCal(jy).leap === 0 ? 30 : 29;
  }

  function getWeekdayName(jy, jm, jd) {
    const g = toGregorian(jy, jm, jd);
    const d = new Date(g.gy, g.gm - 1, g.gd);
    return weekNames[d.getDay()];
  }

  function formatDate(j) {
    return `${getWeekdayName(j.jy, j.jm, j.jd)} ${j.jd} ${monthNames[j.jm - 1]} ${j.jy}`;
  }

  // ---------- Telegram CloudStorage, with device/local fallback ----------
  const storage = {
    async get(key) {
      if (tg?.CloudStorage) {
        return await new Promise((resolve) => {
          tg.CloudStorage.getItem(key, (err, value) => resolve(err ? null : (value || null)));
        });
      }
      if (tg?.DeviceStorage) {
        return await new Promise((resolve) => {
          tg.DeviceStorage.getItem(key, (err, value) => resolve(err ? null : (value || null)));
        });
      }
      return localStorage.getItem(key);
    },
    async set(key, value) {
      if (tg?.CloudStorage) {
        return await new Promise((resolve) => {
          tg.CloudStorage.setItem(key, value, (err, ok) => resolve(!err && !!ok));
        });
      }
      if (tg?.DeviceStorage) {
        return await new Promise((resolve) => {
          tg.DeviceStorage.setItem(key, value, (err, ok) => resolve(!err && !!ok));
        });
      }
      localStorage.setItem(key, value);
      return true;
    },
    async remove(key) {
      if (tg?.CloudStorage) {
        return await new Promise((resolve) => {
          tg.CloudStorage.removeItem(key, (err, ok) => resolve(!err && !!ok));
        });
      }
      if (tg?.DeviceStorage) {
        return await new Promise((resolve) => {
          tg.DeviceStorage.removeItem(key, (err, ok) => resolve(!err && !!ok));
        });
      }
      localStorage.removeItem(key);
      return true;
    }
  };

  const NAME_KEY = 'dingi_profile_name_v1';
  const INDEX_KEY = 'dingi_task_index_v1';
  const taskKey = (id) => `dingi_task_${id}`;

  async function loadTasks() {
    const raw = await storage.get(INDEX_KEY);
    let ids = [];
    try { ids = raw ? JSON.parse(raw) : []; } catch (_) { ids = []; }
    if (!Array.isArray(ids)) ids = [];
    const tasks = [];
    for (const id of ids) {
      const item = await storage.get(taskKey(id));
      if (!item) continue;
      try {
        const t = JSON.parse(item);
        if (t && t.id) tasks.push(t);
      } catch (_) {}
    }
    state.tasks = tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function saveTask(task) {
    const ids = state.tasks.map(t => t.id);
    if (!ids.includes(task.id)) ids.unshift(task.id);
    const ok1 = await storage.set(taskKey(task.id), JSON.stringify(task));
    const ok2 = await storage.set(INDEX_KEY, JSON.stringify(ids));
    return ok1 && ok2;
  }

  async function deleteTask(task) {
    state.tasks = state.tasks.filter(t => t.id !== task.id);
    await storage.remove(taskKey(task.id));
    await storage.set(INDEX_KEY, JSON.stringify(state.tasks.map(t => t.id)));
  }

  // ---------- UI ----------
  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  function haptic(kind = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(kind); } catch (_) {}
  }

  function updateProfileUI() {
    const hasName = !!state.profileName.trim();
    $('nameScreen').classList.toggle('hidden', hasName);
    $('mainScreen').classList.toggle('hidden', !hasName);
    $('renameBtn').classList.toggle('hidden', !hasName);
    $('helloText').textContent = hasName ? `سلام ${state.profileName}` : 'مدیریت ساده اصلاحات ورود و خروج';
  }

  function taskText(t) {
    const lines = [formatDate(t.date)];
    if (t.type === 'in' || t.type === 'both') lines.push(`ورود ساعت: ${t.inTime}`);
    if (t.type === 'out' || t.type === 'both') lines.push(`خروج ساعت: ${t.outTime}`);
    return lines.join('\n');
  }

  function renderTasks() {
    const list = $('taskList');
    list.innerHTML = '';
    const open = state.tasks.filter(t => !t.done).length;
    $('openCount').textContent = String(open);
    $('emptyState').classList.toggle('hidden', state.tasks.length > 0);

    for (const t of state.tasks) {
      const card = document.createElement('div');
      card.className = `task-card${t.done ? ' done' : ''}`;

      const check = document.createElement('button');
      check.type = 'button';
      check.className = `check-btn${t.done ? ' checked' : ''}`;
      check.textContent = t.done ? '✓' : '';
      check.title = t.done ? 'برگرداندن به اصلاح نشده' : 'اصلاح شد';
      check.addEventListener('click', async () => {
        t.done = !t.done;
        t.doneAt = t.done ? Date.now() : null;
        await saveTask(t);
        haptic('medium');
        renderTasks();
      });

      const body = document.createElement('div');
      body.className = 'task-body';
      const text = document.createElement('div');
      text.className = 'task-text';
      text.textContent = taskText(t);
      body.appendChild(text);

      const actions = document.createElement('div');
      actions.className = 'task-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'small-btn delete';
      del.textContent = 'حذف';
      del.addEventListener('click', async () => {
        if (!confirm('این اصلاح حذف شود؟')) return;
        await deleteTask(t);
        renderTasks();
      });
      actions.appendChild(del);
      body.appendChild(actions);

      card.append(check, body);
      list.appendChild(card);
    }
  }

  function setEditType(type) {
    state.editType = type;
    document.querySelectorAll('#typeButtons button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    $('inTimeWrap').classList.toggle('hidden', type === 'out');
    $('outTimeWrap').classList.toggle('hidden', type === 'in');
  }

  function openEditor() {
    const now = new Date();
    const j = toJalali(now);
    state.selectedJ = j;
    state.viewJY = j.jy;
    state.viewJM = j.jm;
    setEditType('both');
    $('datePickerBtn').textContent = formatDate(j);
    $('editorOverlay').classList.remove('hidden');
    haptic();
  }

  function closeEditor() { $('editorOverlay').classList.add('hidden'); }

  function renderCalendar() {
    $('calendarTitle').textContent = `${monthNames[state.viewJM - 1]} ${state.viewJY}`;
    const grid = $('calendarGrid');
    grid.innerHTML = '';

    const g = toGregorian(state.viewJY, state.viewJM, 1);
    const first = new Date(g.gy, g.gm - 1, g.gd);
    const offset = (first.getDay() + 1) % 7; // Saturday = 0
    for (let i = 0; i < offset; i++) {
      const empty = document.createElement('div');
      empty.className = 'day-empty';
      grid.appendChild(empty);
    }

    const today = toJalali(new Date());
    const len = monthLength(state.viewJY, state.viewJM);
    for (let day = 1; day <= len; day++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day-btn';
      btn.textContent = String(day);
      const isToday = today.jy === state.viewJY && today.jm === state.viewJM && today.jd === day;
      const isSelected = state.selectedJ && state.selectedJ.jy === state.viewJY && state.selectedJ.jm === state.viewJM && state.selectedJ.jd === day;
      if (isToday) btn.classList.add('today');
      if (isSelected) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        state.selectedJ = { jy: state.viewJY, jm: state.viewJM, jd: day };
        $('datePickerBtn').textContent = formatDate(state.selectedJ);
        $('calendarOverlay').classList.add('hidden');
        haptic();
      });
      grid.appendChild(btn);
    }
  }

  function changeMonth(delta) {
    let y = state.viewJY;
    let m = state.viewJM + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    state.viewJY = y;
    state.viewJM = m;
    renderCalendar();
  }

  async function init() {
    state.profileName = (await storage.get(NAME_KEY)) || '';
    await loadTasks();
    updateProfileUI();
    renderTasks();

    const now = toJalali(new Date());
    state.viewJY = now.jy;
    state.viewJM = now.jm;
    state.selectedJ = now;
  }

  $('saveNameBtn').addEventListener('click', async () => {
    const name = $('nameInput').value.trim();
    if (!name) return showToast('اسمت را وارد کن');
    state.profileName = name;
    await storage.set(NAME_KEY, name);
    updateProfileUI();
    haptic('medium');
  });

  $('nameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('saveNameBtn').click();
  });

  $('renameBtn').addEventListener('click', () => {
    $('nameInput').value = state.profileName;
    $('mainScreen').classList.add('hidden');
    $('nameScreen').classList.remove('hidden');
    $('renameBtn').classList.add('hidden');
    $('nameInput').focus();
  });

  $('newTaskBtn').addEventListener('click', openEditor);
  $('closeEditorBtn').addEventListener('click', closeEditor);

  $('typeButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (btn) setEditType(btn.dataset.type);
  });

  $('datePickerBtn').addEventListener('click', () => {
    state.viewJY = state.selectedJ.jy;
    state.viewJM = state.selectedJ.jm;
    renderCalendar();
    $('calendarOverlay').classList.remove('hidden');
  });

  $('closeCalendarBtn').addEventListener('click', () => $('calendarOverlay').classList.add('hidden'));
  $('prevMonthBtn').addEventListener('click', () => changeMonth(-1));
  $('nextMonthBtn').addEventListener('click', () => changeMonth(1));
  $('todayBtn').addEventListener('click', () => {
    const j = toJalali(new Date());
    state.selectedJ = j;
    state.viewJY = j.jy;
    state.viewJM = j.jm;
    $('datePickerBtn').textContent = formatDate(j);
    $('calendarOverlay').classList.add('hidden');
  });

  $('saveTaskBtn').addEventListener('click', async () => {
    if (!state.selectedJ) return showToast('تاریخ را انتخاب کن');
    const inTime = $('inTime').value;
    const outTime = $('outTime').value;
    if ((state.editType === 'in' || state.editType === 'both') && !inTime) return showToast('ساعت ورود را مشخص کن');
    if ((state.editType === 'out' || state.editType === 'both') && !outTime) return showToast('ساعت خروج را مشخص کن');

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
    const task = {
      id,
      date: state.selectedJ,
      type: state.editType,
      inTime: state.editType === 'out' ? '' : inTime,
      outTime: state.editType === 'in' ? '' : outTime,
      done: false,
      createdAt: Date.now()
    };

    state.tasks.unshift(task);
    const ok = await saveTask(task);
    if (!ok) {
      state.tasks = state.tasks.filter(t => t.id !== id);
      return showToast('ذخیره نشد؛ دوباره امتحان کن');
    }
    renderTasks();
    closeEditor();
    haptic('medium');
    showToast('ثبت شد');
  });

  // Close overlays by tapping the dark background.
  for (const id of ['editorOverlay', 'calendarOverlay']) {
    $(id).addEventListener('click', (e) => {
      if (e.target === $(id)) $(id).classList.add('hidden');
    });
  }

  init().catch(() => showToast('خطا در راه‌اندازی'));
})();
