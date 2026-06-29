const TODAY = () => new Date().toISOString().slice(0, 10);

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function getTasks() {
  return load('pt_tasks', []);
}

export function saveTasks(tasks) {
  save('pt_tasks', tasks);
}

export function getCompletions() {
  return load('pt_completions', []);
}

export function saveCompletions(c) {
  save('pt_completions', c);
}

export function getSpends() {
  return load('pt_spends', []);
}

export function saveSpends(s) {
  save('pt_spends', s);
}

export function getSnapshot() {
  return load('pt_snapshot', { date: null, endBalance: 0 });
}

export function saveSnapshot(s) {
  save('pt_snapshot', s);
}

export function getRollover() {
  return load('pt_rollover', { date: null, amount: 0 });
}

export function saveRollover(r) {
  save('pt_rollover', r);
}

export function computeRollover() {
  const today = TODAY();
  const rollover = getRollover();
  if (rollover.date === today) return rollover.amount;

  const snapshot = getSnapshot();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate = yesterday.toISOString().slice(0, 10);

  let amount = 0;
  if (snapshot.date === yDate) {
    amount = Math.floor(snapshot.endBalance / 2);
  }

  saveRollover({ date: today, amount });
  return amount;
}

export function getTodayBalance() {
  const today = TODAY();
  const completions = getCompletions();
  const spends = getSpends();
  const rollover = computeRollover();

  const earned = completions
    .filter(c => c.date === today)
    .reduce((s, c) => s + c.minutes, 0);

  const spent = spends
    .filter(s => s.date === today)
    .reduce((s, c) => s + c.minutes, 0);

  return rollover + earned - spent;
}

export function snapshotEnd() {
  const today = TODAY();
  const balance = getTodayBalance();
  saveSnapshot({ date: today, endBalance: balance });
}

export function addTask(task) {
  const tasks = getTasks();
  tasks.push({ ...task, id: Date.now().toString(), createdAt: new Date().toISOString() });
  saveTasks(tasks);
}

export function deleteTask(id) {
  saveTasks(getTasks().filter(t => t.id !== id));
}

export function completeTask(task) {
  const today = TODAY();
  const completions = getCompletions();
  completions.push({
    id: Date.now().toString(),
    taskId: task.id,
    taskName: task.name,
    minutes: task.minutes,
    date: today,
    completedAt: new Date().toISOString(),
  });
  saveCompletions(completions);

  const tasks = getTasks();
  const filtered = tasks.filter(t => t.id !== task.id);

  if (task.recurrence) {
    const next = nextOccurrence(task);
    if (next) {
      filtered.push({ ...task, id: Date.now().toString() + 'r', date: next, createdAt: new Date().toISOString() });
    }
  }

  saveTasks(filtered);
  snapshotEnd();
}

export function addSpend(minutes, note) {
  const today = TODAY();
  const spends = getSpends();
  spends.push({ id: Date.now().toString(), minutes, note, date: today, spentAt: new Date().toISOString() });
  saveSpends(spends);
  snapshotEnd();
}

function nextOccurrence(task) {
  const base = new Date(task.date + 'T12:00:00');
  base.setDate(base.getDate() + 1);

  if (task.recurrence === 'daily') {
    return base.toISOString().slice(0, 10);
  }
  if (task.recurrence === 'weekly') {
    const d = new Date(task.date + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  if (Array.isArray(task.recurrence)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(task.date + 'T12:00:00');
      d.setDate(d.getDate() + i);
      if (task.recurrence.includes(dayNames[d.getDay()])) {
        return d.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

export function getTodayTasks() {
  const today = TODAY();
  return getTasks().filter(t => t.date === today);
}

export function getUpcomingTasks() {
  const today = TODAY();
  return getTasks()
    .filter(t => t.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getTodayCompletions() {
  const today = TODAY();
  return getCompletions().filter(c => c.date === today);
}

export function getAllHistory() {
  const completions = getCompletions().map(c => ({ ...c, type: 'earn' }));
  const spends = getSpends().map(s => ({ ...s, type: 'spend', taskName: s.note || 'Потрачено' }));
  return [...completions, ...spends].sort((a, b) =>
    (b.completedAt || b.spentAt).localeCompare(a.completedAt || a.spentAt)
  );
}

export function deleteHistoryItem(id, type) {
  if (type === 'earn') {
    saveCompletions(getCompletions().filter(c => c.id !== id));
  } else {
    saveSpends(getSpends().filter(s => s.id !== id));
  }
  snapshotEnd();
}
