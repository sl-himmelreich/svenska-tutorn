// Static data layer — replaces Express + SQLite for the fully client-side build.
// Progress, stats, and achievements are persisted in localStorage.
// Lessons & words remain embedded in the bundle (read-only).

import rawData from "../../../server/lessons-data.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LessonMeta {
  id: number;
  titleRu: string;
  titleSv: string;
  category: string;
  order: number;
  emoji?: string;
}

interface Word {
  id: number;
  lessonId: number;
  swedish: string;
  russian: string;
  pronunciation?: string;
  exampleSv?: string;
  exampleRu?: string;
}

interface Progress {
  lessonId: number;
  score: number;
  completedAt: string;
}

interface Stats {
  id: number;
  totalXp: number;
  currentStreak: number;
  lastActiveDate: string | null;
  wordsLearned: number;
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

interface SavedState {
  progressMap: Record<number, Progress>;
  stats: Stats;
  achievements: Achievement[];
  perfectQuizCount: number;
  playerName: string | null;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "svenska-tutorn-state";

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function saveState() {
  try {
    const state: SavedState = {
      progressMap: { ...progressMap },
      stats: { ...stats },
      achievements: achievements.map((a) => ({ ...a })),
      perfectQuizCount,
      playerName,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail if storage is unavailable (e.g., private browsing)
  }
}

// ---------------------------------------------------------------------------
// Build lesson list with sequential IDs
// ---------------------------------------------------------------------------

const lessons: LessonMeta[] = (rawData.lessons as Omit<LessonMeta, "id">[]).map(
  (lesson, index) => ({
    ...lesson,
    id: index + 1, // 1-based
  })
);

// ---------------------------------------------------------------------------
// Build word list with sequential IDs
// ---------------------------------------------------------------------------

const words: Word[] = (
  rawData.words as Omit<Word, "id">[]
).map((word, index) => ({
  ...word,
  id: index + 1, // 1-based
}));

// ---------------------------------------------------------------------------
// Achievements definition (10 total per spec)
// ---------------------------------------------------------------------------

const ACHIEVEMENTS_DEF: Omit<Achievement, "unlockedAt">[] = [
  { id: 1, name: "Первые шаги",   description: "Пройди свой первый урок",      icon: "footprints" },
  { id: 2, name: "Полиглот",      description: "Пройди все 50 уроков",          icon: "globe" },
  { id: 3, name: "Отличник",      description: "Получи 100% на тесте",          icon: "star" },
  { id: 4, name: "На огне 🔥",    description: "Занимайся 3 дня подряд",        icon: "flame" },
  { id: 5, name: "Мастер слов",   description: "Выучи 50 слов",                 icon: "book-open" },
  { id: 6, name: "На полпути",    description: "Пройди 25 уроков",              icon: "star" },
  { id: 7, name: "Знаток 💯",     description: "Получи 100% на 5 тестах",       icon: "star" },
  { id: 8, name: "Марафонец",     description: "Занимайся 7 дней подряд",       icon: "flame" },
  { id: 9, name: "Эрудит",        description: "Выучи 200 слов",                icon: "book-open" },
  { id: 10, name: "Легенда",      description: "Набери 5000 XP",                icon: "star" },
];

// ---------------------------------------------------------------------------
// In-memory state (hydrated from localStorage on module load)
// ---------------------------------------------------------------------------

const saved = loadState();

const progressMap: Record<number, Progress> = saved?.progressMap ?? {};

const stats: Stats = saved?.stats ?? {
  id: 1,
  totalXp: 0,
  currentStreak: 0,
  lastActiveDate: null,
  wordsLearned: 0,
};

const achievements: Achievement[] = saved?.achievements ??
  ACHIEVEMENTS_DEF.map((a) => ({ ...a, unlockedAt: null }));

let perfectQuizCount = saved?.perfectQuizCount ?? 0;
let playerName: string | null = saved?.playerName ?? null;

// ---------------------------------------------------------------------------
// Helper: check & unlock achievements, return newly unlocked
// ---------------------------------------------------------------------------

function checkAchievements(score: number): Achievement[] {
  const completedCount = Object.keys(progressMap).length;
  const unlocked: Achievement[] = [];

  const unlock = (id: number) => {
    const a = achievements[id - 1];
    if (a && !a.unlockedAt) {
      a.unlockedAt = new Date().toISOString();
      unlocked.push(a);
    }
  };

  // 1. Первые шаги — first lesson completed
  if (completedCount >= 1) unlock(1);

  // 2. Полиглот — all 50 lessons completed
  if (completedCount >= 50) unlock(2);

  // 3. Отличник — score === 100 on any quiz
  if (score === 100) unlock(3);

  // 4. На огне — streak >= 3
  if (stats.currentStreak >= 3) unlock(4);

  // 5. Мастер слов — wordsLearned >= 50
  if (stats.wordsLearned >= 50) unlock(5);

  // 6. На полпути — 25 lessons completed
  if (completedCount >= 25) unlock(6);

  // 7. Знаток 💯 — 5 perfect quizzes
  if (perfectQuizCount >= 5) unlock(7);

  // 8. Марафонец — streak >= 7
  if (stats.currentStreak >= 7) unlock(8);

  // 9. Эрудит — wordsLearned >= 200
  if (stats.wordsLearned >= 200) unlock(9);

  // 10. Легенда — totalXp >= 5000
  if (stats.totalXp >= 5000) unlock(10);

  return unlocked;
}

// ---------------------------------------------------------------------------
// Helper: update streak
// ---------------------------------------------------------------------------

function updateStreak() {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  if (!stats.lastActiveDate) {
    stats.currentStreak = 1;
  } else {
    const last = new Date(stats.lastActiveDate);
    const now = new Date(today);
    const diffDays = Math.round(
      (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) {
      // already active today — streak unchanged
    } else if (diffDays === 1) {
      stats.currentStreak += 1;
    } else {
      stats.currentStreak = 1;
    }
  }
  stats.lastActiveDate = today;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function getLessons() {
  return lessons.map((lesson) => ({
    ...lesson,
    progress: progressMap[lesson.id]?.score || 0,
    completed: (progressMap[lesson.id]?.score ?? 0) > 0,
  }));
}

function getLessonById(id: number) {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`Lesson ${id} not found`);
  const lessonWords = words.filter((w) => w.lessonId === id);
  return {
    ...lesson,
    words: lessonWords,
    progress: progressMap[id]?.score || 0,
  };
}

function getQuiz(lessonId: number) {
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} not found`);
  const lessonWords = words.filter((w) => w.lessonId === lessonId);
  const allWords = words.map((w) => ({ swedish: w.swedish, russian: w.russian }));
  return { lesson, words: lessonWords, allWords };
}

function submitQuiz(data: {
  lessonId: number;
  score: number;
  correctCount: number;
  totalCount: number;
}) {
  const { lessonId, score, correctCount } = data;

  // Save/update progress
  progressMap[lessonId] = {
    lessonId,
    score,
    completedAt: new Date().toISOString(),
  };

  // XP
  const xpEarned = correctCount * 10 + (score >= 70 ? 50 : 0);
  stats.totalXp += xpEarned;

  // Streak
  updateStreak();

  // Words learned
  stats.wordsLearned += correctCount;

  // Perfect quiz counter
  if (score === 100) perfectQuizCount += 1;

  // Check achievements
  const unlockedAchievements = checkAchievements(score);

  // Persist to localStorage
  saveState();

  return {
    progress: progressMap[lessonId],
    xpEarned,
    stats: { ...stats },
    unlockedAchievements,
  };
}

function getStats() {
  return { ...stats };
}

function getAchievements() {
  return achievements.map((a) => ({ ...a }));
}

// ---------------------------------------------------------------------------
// Player name helpers
// ---------------------------------------------------------------------------

export function getPlayerName(): string | null {
  return playerName;
}

export function setPlayerName(name: string) {
  playerName = name.trim();
  saveState();
}

export function resetAllProgress() {
  // Clear in-memory state
  for (const key of Object.keys(progressMap)) {
    delete progressMap[Number(key)];
  }
  stats.totalXp = 0;
  stats.currentStreak = 0;
  stats.lastActiveDate = null;
  stats.wordsLearned = 0;
  perfectQuizCount = 0;

  // Reset achievements
  for (const a of achievements) {
    a.unlockedAt = null;
  }

  // Persist
  saveState();
}

export function clearAllData() {
  resetAllProgress();
  playerName = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mimics the server GET routes. queryKey is an array like
 * ["/api/lessons"], ["/api/lessons", "25"], ["/api/quiz", "3"], etc.
 */
export async function resolveQuery(queryKey: readonly unknown[]): Promise<unknown> {
  const path = queryKey.join("/").replace(/\/+/g, "/");

  // GET /api/lessons/:id
  const lessonMatch = path.match(/\/api\/lessons\/(\d+)/);
  if (lessonMatch) {
    return getLessonById(parseInt(lessonMatch[1], 10));
  }

  // GET /api/quiz/:lessonId
  const quizMatch = path.match(/\/api\/quiz\/(\d+)/);
  if (quizMatch) {
    return getQuiz(parseInt(quizMatch[1], 10));
  }

  // GET /api/lessons
  if (path.includes("/api/lessons")) {
    return getLessons();
  }

  // GET /api/stats
  if (path.includes("/api/stats")) {
    return getStats();
  }

  // GET /api/achievements
  if (path.includes("/api/achievements")) {
    return getAchievements();
  }

  throw new Error(`Unknown query path: ${path}`);
}

/**
 * Mimics the server POST routes.
 */
export async function handleMutation(url: string, data: unknown): Promise<Response> {
  // POST /api/quiz/submit
  if (url.includes("/api/quiz/submit")) {
    const result = submitQuiz(
      data as { lessonId: number; score: number; correctCount: number; totalCount: number }
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
