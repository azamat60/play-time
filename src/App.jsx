import { useState, useEffect, useCallback } from 'react';
import {
  Plus, CheckCircle2, Trash2, ChevronLeft,
  RotateCcw, History, Calendar, X, Minus
} from 'lucide-react';
import {
  getTodayTasks, getUpcomingTasks, getTodayBalance,
  addTask, deleteTask, completeTask, addSpend,
  getAllHistory, computeRollover, getTodayCompletions, getSpends,
  deleteHistoryItem
} from './store.js';
import './App.css';

const TODAY = () => new Date().toISOString().slice(0, 10);

const PRESET_MINUTES = [5, 10, 15, 20, 30, 60];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORIES = [
  { id: 'other',       label: 'Другое',     emoji: '⭐', color: '#6366F1', bg: '#E0E7FF' },
  { id: 'health',      label: 'Здоровье',   emoji: '🌿', color: '#22C55E', bg: '#DCFCE7' },
  { id: 'sport',       label: 'Спорт',      emoji: '💪', color: '#EF4444', bg: '#FEE2E2' },
  { id: 'focus',       label: 'Фокус',      emoji: '🎯', color: '#8B5CF6', bg: '#EDE9FE' },
  { id: 'learning',    label: 'Обучение',   emoji: '📚', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'mindfulness', label: 'Спокойствие',emoji: '🧘', color: '#3B82F6', bg: '#DBEAFE' },
  { id: 'creative',    label: 'Творчество', emoji: '✨', color: '#EC4899', bg: '#FCE7F3' },
  { id: 'social',      label: 'Общение',    emoji: '👥', color: '#06B6D4', bg: '#CFFAFE' },
];

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
  if (r === 'daily') return 'Ежедневно';
  if (r === 'weekly') return 'Еженедельно';
  if (Array.isArray(r)) return r.map(k => WEEKDAYS[WEEKDAY_KEYS.indexOf(k)]).join(', ');
  return null;
}

// ── Spend Modal ─────────────────────────────────────────────────────────────
const SPEND_PRESETS = [5, 10, 15, 20, 30, 60];

function SpendModal({ onClose, onSpend }) {
  const [minutes, setMinutes] = useState(15);
  const [customMin, setCustomMin] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function handleSpend() {
    const mins = customMin ? parseInt(customMin) : minutes;
    if (!mins || mins < 1) { setError('Укажи количество минут'); return; }
    onSpend(mins, note.trim() || null);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-title">🎮 Потратить минуты</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Сколько минут</label>
            <div className="preset-grid">
              {SPEND_PRESETS.map(m => (
                <button
                  key={m}
                  className={`preset-btn spend-preset ${minutes === m && !customMin ? 'active' : ''}`}
                  onClick={() => { setMinutes(m); setCustomMin(''); setError(''); }}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              className="input mt-8"
              type="number"
              placeholder="Или своё число..."
              value={customMin}
              min={1}
              onChange={e => { setCustomMin(e.target.value); setMinutes(0); setError(''); }}
            />
          </div>

          <div className="form-group">
            <label>На что тратишь (необязательно)</label>
            <input
              className="input"
              placeholder="YouTube, игры, сериал..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="spend-preview">
            <span className="spend-preview-mins">−{customMin || minutes} мин</span>
            {(note || customMin || minutes) && (
              <span className="spend-preview-note">{note || 'Экранное время'}</span>
            )}
          </div>

          <button className="btn-spend" onClick={handleSpend}>
            🎮 Списать минуты
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
            <div className="balance-label">Баланс минут</div>
            <div className="balance-value">
              {balance} <span className="balance-unit">мин</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="play-btn" onClick={onSpend}>
            🎮 Играть
          </button>
          <button className="icon-pill" onClick={onHistory}>
            <History size={18} />
          </button>
        </div>
      </div>

      {rollover > 0 && (
        <div className="rollover-badge">
          <RotateCcw size={11} /> +{rollover} перенесено вчера
        </div>
      )}
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete, showDate }) {
  const cat = getCat(task.category);
  const rec = recurrenceLabel(task.recurrence);
  return (
    <div className="task-card">
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
          <div className="task-reward">
            ⏱ {task.minutes} мин
          </div>
          <div className="task-btns">
            <button className="btn-done" onClick={() => onComplete(task)}>
              <CheckCircle2 size={24} />
            </button>
            <button className="btn-del" onClick={() => onDelete(task.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Screen ───────────────────────────────────────────────────────────
function CreateScreen({ onSave, onBack }) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [customMin, setCustomMin] = useState('');
  const [date, setDate] = useState(TODAY());
  const [recurrence, setRecurrence] = useState(null);
  const [selDays, setSelDays] = useState([]);
  const [category, setCategory] = useState('other');
  const [error, setError] = useState('');

  function toggleDay(key) {
    setSelDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  }

  function setRec(val) {
    setRecurrence(val);
    if (val !== 'days') setSelDays([]);
  }

  function handleSave() {
    if (!name.trim()) { setError('Введи название задачи'); return; }
    const mins = customMin ? parseInt(customMin) : minutes;
    if (!mins || mins < 1) { setError('Укажи количество минут'); return; }
    const rec = recurrence === 'days'
      ? (selDays.length > 0 ? selDays : null)
      : recurrence;
    onSave({ name: name.trim(), minutes: mins, date, recurrence: rec, category });
  }

  const cat = getCat(category);

  return (
    <div className="screen slide-in create-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <h2>Новая задача</h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="form-body">
        <div className="form-group">
          <label>Название</label>
          <input
            className="input"
            placeholder="Что нужно сделать?"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
          />
        </div>

        <div className="form-group">
          <label>Категория</label>
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
          <label>Награда (минуты)</label>
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
            placeholder="Или своё число..."
            value={customMin}
            min={1}
            onChange={e => { setCustomMin(e.target.value); setMinutes(0); }}
          />
        </div>

        <div className="form-group">
          <label>Дата</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Повторение</label>
          <div className="rec-options">
            {[
              { val: null, label: 'Нет' },
              { val: 'daily', label: 'Ежедневно' },
              { val: 'weekly', label: 'Еженедельно' },
              { val: 'days', label: 'По дням' },
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
              {WEEKDAYS.map((d, i) => (
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
          <div className="preview-cat" style={{ background: cat.bg }}>
            {cat.emoji}
          </div>
          <div className="preview-info">
            <div className="preview-name">{name || 'Предпросмотр задачи'}</div>
            <div className="preview-cat-label" style={{ color: cat.color }}>{cat.label}</div>
          </div>
          <div className="preview-reward">
            ⏱ {customMin || minutes} мин
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave}>
          ✨ Создать задачу
        </button>
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
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
        <h2>История</h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="history-body">
        {Object.keys(grouped).length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">📭</div>
            <p>История пуста</p>
          </div>
        )}
        {Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(date => (
          <div key={date} className="history-day">
            <div className="history-date-label">
              {date === today ? 'Сегодня' : formatDate(date)}
            </div>
            {grouped[date].map(item => {
              const cat = item.category ? getCat(item.category) : null;
              return (
                <div key={item.id} className={`history-item ${item.type}`}>
                  <div className="history-icon" style={cat ? { background: cat.bg } : {}}>
                    {item.type === 'earn' ? (cat ? cat.emoji : '✅') : '🛒'}
                  </div>
                  <div className="history-info">
                    <div className="history-name">{item.taskName}</div>
                    <div className="history-time">
                      {new Date(item.completedAt || item.spentAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className={`history-mins ${item.type}`}>
                    {item.type === 'earn' ? '+' : '-'}{item.minutes} мин
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
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('main');
  const [tasks, setTasks] = useState({ today: [], upcoming: [] });
  const [balance, setBalance] = useState(0);
  const [rollover, setRollover] = useState(0);
  const [tab, setTab] = useState('today');
  const [spendOpen, setSpendOpen] = useState(false);

  const refresh = useCallback(() => {
    setTasks({ today: getTodayTasks(), upcoming: getUpcomingTasks() });
    setBalance(getTodayBalance());
    setRollover(computeRollover());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function handleSaveTask(task) {
    addTask(task);
    refresh();
    setScreen('main');
  }

  function handleComplete(task) {
    completeTask(task);
    refresh();
  }

  function handleDelete(id) {
    deleteTask(id);
    refresh();
  }

  function handleSpend(mins, note) {
    addSpend(mins, note);
    refresh();
    setSpendOpen(false);
  }

  if (screen === 'create') {
    return <CreateScreen onSave={handleSaveTask} onBack={() => setScreen('main')} />;
  }
  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('main')} onRefreshBalance={refresh} />;
  }

  const currentList = tab === 'today' ? tasks.today : tasks.upcoming;
  const todayDone = getTodayCompletions().length;

  return (
    <div className="app">
      <div className="sky-bg" />

      <BalanceHeader
        balance={balance}
        rollover={rollover}
        onHistory={() => setScreen('history')}
        onSpend={() => setSpendOpen(true)}
      />

      {spendOpen && (
        <SpendModal onClose={() => setSpendOpen(false)} onSpend={handleSpend} />
      )}

      <div className="main-content">
        <div className="stats-row">
          <div className="stat-pill">
            🎯 <span>{tasks.today.length} задач</span>
          </div>
          <div className="stat-pill done">
            ✅ <span>{todayDone} выполнено</span>
          </div>
          <div className="stat-pill earn">
            ⏱ <span>{getTodayCompletions().reduce((s,c)=>s+c.minutes,0)} мин заработано</span>
          </div>
        </div>

        <div className="tab-bar">
          <button
            className={`tab-btn ${tab === 'today' ? 'active' : ''}`}
            onClick={() => setTab('today')}
          >
            📋 Сегодня
          </button>
          <button
            className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setTab('upcoming')}
          >
            📅 Впереди
          </button>
        </div>

        <div className="task-list">
          {currentList.length === 0 && (
            <div className="empty-state">
              <div className="empty-emoji">🌱</div>
              <p>{tab === 'today' ? 'Нет задач на сегодня' : 'Нет предстоящих задач'}</p>
              <button className="btn-outline" onClick={() => setScreen('create')}>
                <Plus size={16} /> Добавить задачу
              </button>
            </div>
          )}
          {currentList.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onDelete={handleDelete}
              showDate={tab === 'upcoming'}
            />
          ))}
        </div>
      </div>

      <button className="fab" onClick={() => setScreen('create')}>
        <Plus size={26} />
      </button>
    </div>
  );
}
