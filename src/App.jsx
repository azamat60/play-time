import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Check, Trash2, ChevronLeft,
  RotateCcw, History, X, CalendarPlus
} from 'lucide-react';
import {
  getTodayTasks, getUpcomingTasks, getTodayBalance,
  addTask, deleteTask, completeTask, updateTask, postponeTask, addSpend,
  getAllHistory, computeRollover, getTodayCompletions,
  deleteHistoryItem
} from './store.js';
import './App.css';

const TODAY = () => new Date().toISOString().slice(0, 10);

const PRESET_MINUTES = [5, 10, 15, 20, 30, 60];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const CATEGORIES = [
  { id: 'other',       label: 'Other',       emoji: '⭐', color: '#6366F1', bg: '#E0E7FF' },
  { id: 'health',      label: 'Health',      emoji: '🌿', color: '#22C55E', bg: '#DCFCE7' },
  { id: 'sport',       label: 'Sport',       emoji: '💪', color: '#EF4444', bg: '#FEE2E2' },
  { id: 'learning',    label: 'Learning',    emoji: '📚', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'work',        label: 'Work',        emoji: '💼', color: '#64748B', bg: '#F1F5F9' },
  { id: 'business',    label: 'Business',    emoji: '📈', color: '#8B5CF6', bg: '#EDE9FE' },
  { id: 'family',      label: 'Family',      emoji: '👨‍👩‍👧', color: '#EC4899', bg: '#FCE7F3' },
  { id: 'mindfulness', label: 'Mindfulness', emoji: '🧘', color: '#3B82F6', bg: '#DBEAFE' },
];

const SPEND_PRESETS = [5, 10, 15, 20, 30, 60];

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function recurrenceLabel(r) {
  if (!r) return null;
  if (r === 'daily') return 'Daily';
  if (r === 'weekly') return 'Weekly';
  if (Array.isArray(r)) return r.map(k => WEEKDAYS_SHORT[WEEKDAY_KEYS.indexOf(k)]).join(', ');
  return null;
}

// ── Spend Modal ─────────────────────────────────────────────────────────────
function SpendModal({ onClose, onSpend }) {
  const [minutes, setMinutes] = useState(15);
  const [customMin, setCustomMin] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function handleSpend() {
    const mins = customMin ? parseInt(customMin) : minutes;
    if (!mins || mins < 1) { setError('Enter number of minutes'); return; }
    onSpend(mins, note.trim() || null);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-drag" />
        <div className="modal-header">
          <div className="modal-title">🎮 Spend Time</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Minutes</label>
            <div className="preset-grid">
              {SPEND_PRESETS.map(m => (
                <button
                  key={m}
                  className={`preset-btn ${minutes === m && !customMin ? 'active' : ''}`}
                  onClick={() => { setMinutes(m); setCustomMin(''); setError(''); }}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              className="input mt-8"
              type="number"
              placeholder="Custom amount..."
              value={customMin}
              min={1}
              onChange={e => { setCustomMin(e.target.value); setMinutes(0); setError(''); }}
            />
          </div>
          <div className="form-group">
            <label>What for (optional)</label>
            <input
              className="input"
              placeholder="YouTube, games, series..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn-spend" onClick={handleSpend}>
            🎮 Spend {customMin || minutes} min
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Balance Header ──────────────────────────────────────────────────────────
function BalanceHeader({ balance, rollover, onHistory, onSpend }) {
  return (
    <div className="balance-header">
      <div className="balance-top-row">
        <div className="balance-greeting">
          <div className="brain-avatar">🧠</div>
          <div>
            <div className="balance-label">Time Balance</div>
            <div className="balance-value">
              {balance} <span className="balance-unit">min</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="play-btn" onClick={onSpend}>
            🎮 PLAY
          </button>
          <button className="icon-pill" onClick={onHistory}>
            <History size={18} />
          </button>
        </div>
      </div>
      {rollover > 0 && (
        <div className="rollover-badge">
          <RotateCcw size={11} /> +{rollover} rolled over from yesterday
        </div>
      )}
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete, onEdit, onPostpone, showDate }) {
  const cat = getCat(task.category);
  const rec = recurrenceLabel(task.recurrence);
  return (
    <div className="task-card" onClick={() => onEdit(task)}>
      <div className="task-cat-badge" style={{ background: cat.bg, color: cat.color }}>
        <span className="task-cat-emoji">{cat.emoji}</span>
      </div>
      <div className="task-body">
        <div className="task-info">
          <div className="task-name">{task.name}</div>
          <div className="task-meta">
            <span className="task-cat-label" style={{ color: cat.color }}>{cat.label}</span>
            {showDate && <span className="task-date">· {formatDate(task.date)}</span>}
            {rec && <span className="task-rec">· {rec}</span>}
          </div>
        </div>
        <div className="task-right">
          <div className="task-reward">⏱ {task.minutes} min</div>
          <div className="task-btns">
            <button className="task-action-btn done" onClick={e => { e.stopPropagation(); onComplete(task); }}>
              <Check size={15} />
            </button>
            {onPostpone && (
              <button className="task-action-btn postpone" title="Tomorrow" onClick={e => { e.stopPropagation(); onPostpone(task.id); }}>
                <CalendarPlus size={15} />
              </button>
            )}
            <button className="task-action-btn del" onClick={e => { e.stopPropagation(); onDelete(task.id); }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Form (Create + Edit) ───────────────────────────────────────────────
function TaskForm({ initialTask, onSave, onBack }) {
  const isEdit = !!initialTask;
  const [name, setName] = useState(initialTask?.name || '');
  const [minutes, setMinutes] = useState(
    PRESET_MINUTES.includes(initialTask?.minutes) ? initialTask.minutes : 15
  );
  const [customMin, setCustomMin] = useState(
    initialTask && !PRESET_MINUTES.includes(initialTask.minutes) ? String(initialTask.minutes) : ''
  );
  const [date, setDate] = useState(initialTask?.date || TODAY());
  const [recurrence, setRecurrence] = useState(() => {
    if (!initialTask?.recurrence) return null;
    if (Array.isArray(initialTask.recurrence)) return 'days';
    return initialTask.recurrence;
  });
  const [selDays, setSelDays] = useState(
    Array.isArray(initialTask?.recurrence) ? initialTask.recurrence : []
  );
  const [category, setCategory] = useState(initialTask?.category || 'other');
  const [error, setError] = useState('');

  function toggleDay(key) {
    setSelDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  }

  function setRec(val) {
    setRecurrence(val);
    if (val !== 'days') setSelDays([]);
  }

  function handleSave() {
    if (!name.trim()) { setError('Enter task name'); return; }
    const mins = customMin ? parseInt(customMin) : minutes;
    if (!mins || mins < 1) { setError('Enter number of minutes'); return; }
    const rec = recurrence === 'days'
      ? (selDays.length > 0 ? selDays : null)
      : recurrence;
    onSave({ name: name.trim(), minutes: mins, date, recurrence: rec, category });
  }

  const cat = getCat(category);

  return (
    <div className="screen slide-in create-screen">
      <div className="sky-bg" />
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <h2>{isEdit ? 'Edit Task' : 'New Task'}</h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="main-content">
      <div className="form-body">
        <div className="form-group">
          <label>Name</label>
          <input
            className="input"
            placeholder="What needs to be done?"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <div className="category-grid">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`category-btn ${category === c.id ? 'active' : ''}`}
                style={category === c.id ? { background: c.bg, borderColor: c.color, color: c.color } : {}}
                onClick={() => setCategory(c.id)}
              >
                <span>{c.emoji}</span>
                <span className="cat-btn-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Reward (minutes)</label>
          <div className="preset-grid">
            {PRESET_MINUTES.map(m => (
              <button
                key={m}
                className={`preset-btn ${minutes === m && !customMin ? 'active' : ''}`}
                onClick={() => { setMinutes(m); setCustomMin(''); }}
              >
                ⏱ {m}
              </button>
            ))}
          </div>
          <input
            className="input mt-8"
            type="number"
            placeholder="Or custom amount..."
            value={customMin}
            min={1}
            onChange={e => { setCustomMin(e.target.value); setMinutes(0); }}
          />
        </div>

        <div className="form-group">
          <label>Date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Repeat</label>
          <div className="rec-options">
            {[
              { val: null, label: 'None' },
              { val: 'daily', label: 'Daily' },
              { val: 'weekly', label: 'Weekly' },
              { val: 'days', label: 'By days' },
            ].map(({ val, label }) => (
              <button
                key={String(val)}
                className={`rec-btn ${recurrence === val ? 'active' : ''}`}
                onClick={() => setRec(val)}
              >
                {label}
              </button>
            ))}
          </div>
          {recurrence === 'days' && (
            <div className="weekday-grid">
              {WEEKDAYS_SHORT.map((d, i) => (
                <button
                  key={d}
                  className={`weekday-btn ${selDays.includes(WEEKDAY_KEYS[i]) ? 'active' : ''}`}
                  onClick={() => toggleDay(WEEKDAY_KEYS[i])}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="preview-card" style={{ borderColor: cat.color }}>
          <div className="preview-cat" style={{ background: cat.bg }}>{cat.emoji}</div>
          <div className="preview-info">
            <div className="preview-name">{name || 'Task preview'}</div>
            <div className="preview-cat-label" style={{ color: cat.color }}>{cat.label}</div>
          </div>
          <div className="preview-reward">⏱ {customMin || minutes} min</div>
        </div>

        <button className="btn-primary" onClick={handleSave}>
          {isEdit ? '✏️ Save Changes' : '✨ Create Task'}
        </button>
      </div>
      </div>
    </div>
  );
}

// ── History Screen ──────────────────────────────────────────────────────────
function HistoryScreen({ onBack, onRefreshBalance }) {
  const [history, setHistory] = useState(getAllHistory);
  const today = TODAY();

  function handleDelete(id, type) {
    deleteHistoryItem(id, type);
    onRefreshBalance();
    onBack();
  }

  const grouped = {};
  history.forEach(item => {
    const date = (item.date || item.completedAt?.slice(0, 10) || item.spentAt?.slice(0, 10));
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });

  return (
    <div className="screen slide-in history-screen">
      <div className="sky-bg" />
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <h2>History</h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="main-content">
      <div className="history-body">
        {Object.keys(grouped).length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">📭</div>
            <p>History is empty</p>
          </div>
        )}
        {Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(date => (
          <div key={date} className="history-day">
            <div className="history-date-label">
              {date === today ? 'Today' : formatDate(date)}
            </div>
            {grouped[date].map(item => {
              const cat = item.category ? getCat(item.category) : null;
              return (
                <div key={item.id} className={`history-item ${item.type}`}>
                  <div className="history-icon" style={cat ? { background: cat.bg } : {}}>
                    {item.type === 'earn' ? (cat ? cat.emoji : '✅') : '🎮'}
                  </div>
                  <div className="history-info">
                    <div className="history-name">{item.taskName}</div>
                    <div className="history-time">
                      {new Date(item.completedAt || item.spentAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className={`history-mins ${item.type}`}>
                    {item.type === 'earn' ? '+' : '-'}{item.minutes} min
                  </div>
                  <button className="history-del" onClick={() => handleDelete(item.id, item.type)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('main'); // main | create | edit | history
  const [prevScreen, setPrevScreen] = useState(null);
  const [direction, setDirection] = useState('forward'); // 'forward' | 'back'
  const [editingTask, setEditingTask] = useState(null);
  const [tasks, setTasks] = useState({ today: [], upcoming: [] });
  const [balance, setBalance] = useState(0);
  const [rollover, setRollover] = useState(0);
  const [showSpend, setShowSpend] = useState(false);
  const [tab, setTab] = useState('today');

  const refresh = useCallback(() => {
    setTasks({ today: getTodayTasks(), upcoming: getUpcomingTasks() });
    setBalance(getTodayBalance());
    setRollover(computeRollover());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const screenRef = useRef(screen);
  const goBackRef = useRef(null);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    let startX = 0, startY = 0;
    const onStart = e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = e => {
      if (screenRef.current === 'main') return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (startX < 40 && dx > 70 && dy < 100) {
        goBackRef.current?.();
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  function goTo(newScreen) {
    setDirection('forward');
    setPrevScreen(screen);
    setScreen(newScreen);
    setTimeout(() => setPrevScreen(null), 320);
  }

  function goBack() {
    setDirection('back');
    setPrevScreen(screen);
    setScreen('main');
    setTimeout(() => { setPrevScreen(null); setEditingTask(null); }, 320);
  }
  goBackRef.current = goBack;

  function handleSaveTask(taskData) {
    addTask(taskData);
    refresh();
    goBack();
  }

  function handleUpdateTask(taskData) {
    updateTask(editingTask.id, taskData);
    refresh();
    goBack();
  }

  function handleEditTask(task) {
    setEditingTask(task);
    goTo('edit');
  }

  function handleComplete(task) {
    completeTask(task);
    refresh();
  }

  function handleDelete(id) {
    deleteTask(id);
    refresh();
  }

  function handlePostpone(id) {
    postponeTask(id);
    refresh();
  }

  function handleSpend(mins) {
    addSpend(mins, `${mins} min screen time`);
    refresh();
    setShowSpend(false);
  }

  const currentList = tab === 'today' ? tasks.today : tasks.upcoming;
  const todayDone = getTodayCompletions().length;
  const todayEarned = getTodayCompletions().reduce((s,c) => s + c.minutes, 0);

  const enterClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';
  const exitClass  = direction === 'forward' ? 'slide-out-left' : 'slide-out-right';

  function renderScreen(name, animClass) {
    if (name === 'main') {
      return (
        <div key="main" className={`screen-layer ${animClass}`}>
          <div className="app">
            <div className="sky-bg" />
            <BalanceHeader
              balance={balance}
              rollover={rollover}
              onSpend={() => setShowSpend(true)}
              onHistory={() => goTo('history')}
            />
            <div className="main-content">
              <div className="stats-row">
                <div className="stat-pill">🎯 <span>{tasks.today.length} tasks</span></div>
                <div className="stat-pill done">✅ <span>{todayDone} done</span></div>
                <div className="stat-pill earn">⏱ <span>{todayEarned} min earned</span></div>
              </div>
              <div className="tab-bar">
                <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
                  📋 Today
                </button>
                <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
                  📅 Upcoming
                </button>
              </div>
              <div className="task-list">
                {currentList.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-emoji">🌱</div>
                    <p>{tab === 'today' ? 'No tasks for today' : 'No upcoming tasks'}</p>
                    <button className="btn-outline" onClick={() => goTo('create')}>
                      <Plus size={16} /> Add task
                    </button>
                  </div>
                )}
                {currentList.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onEdit={handleEditTask}
                    onPostpone={tab === 'today' ? handlePostpone : null}
                    showDate={tab === 'upcoming'}
                  />
                ))}
              </div>
            </div>
            <button className="fab" onClick={() => goTo('create')}>
              <Plus size={26} />
            </button>
            {showSpend && (
              <SpendModal onSpend={handleSpend} onClose={() => setShowSpend(false)} />
            )}
          </div>
        </div>
      );
    }
    if (name === 'create') {
      return (
        <div key="create" className={`screen-layer ${animClass}`}>
          <TaskForm onSave={handleSaveTask} onBack={goBack} />
        </div>
      );
    }
    if (name === 'edit') {
      return (
        <div key="edit" className={`screen-layer ${animClass}`}>
          <TaskForm initialTask={editingTask} onSave={handleUpdateTask} onBack={goBack} />
        </div>
      );
    }
    if (name === 'history') {
      return (
        <div key="history" className={`screen-layer ${animClass}`}>
          <HistoryScreen onBack={goBack} onRefreshBalance={refresh} />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="screen-stack">
      {prevScreen && renderScreen(prevScreen, exitClass)}
      {renderScreen(screen, prevScreen ? enterClass : '')}
    </div>
  );
}
