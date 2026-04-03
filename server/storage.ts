import {
  type Lesson, type Word, type Progress, type Achievement, type UserStats,
  type InsertProgress,
  lessons, words, progress, achievements, userStats,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";
import lessonsData from "./lessons-data.json";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_ru TEXT NOT NULL,
    title_sv TEXT NOT NULL,
    category TEXT NOT NULL,
    "order" INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    swedish TEXT NOT NULL,
    russian TEXT NOT NULL,
    pronunciation TEXT NOT NULL,
    example_sv TEXT NOT NULL DEFAULT '',
    example_ru TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    streak INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    unlocked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_xp INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    words_learned INTEGER NOT NULL DEFAULT 0
  );
`);

export interface IStorage {
  // Lessons
  getLessons(): Lesson[];
  getLesson(id: number): Lesson | undefined;
  getLessonWords(lessonId: number): Word[];

  // Progress
  getProgress(lessonId: number): Progress | undefined;
  getAllProgress(): Progress[];
  saveProgress(data: InsertProgress): Progress;

  // Achievements
  getAchievements(): Achievement[];
  unlockAchievement(id: number): Achievement | undefined;

  // User stats
  getUserStats(): UserStats;
  addXp(amount: number): UserStats;
  updateStreak(): UserStats;
  incrementWordsLearned(count: number): UserStats;
}

export class DatabaseStorage implements IStorage {
  getLessons(): Lesson[] {
    return db.select().from(lessons).all();
  }

  getLesson(id: number): Lesson | undefined {
    return db.select().from(lessons).where(eq(lessons.id, id)).get();
  }

  getLessonWords(lessonId: number): Word[] {
    return db.select().from(words).where(eq(words.lessonId, lessonId)).all();
  }

  getProgress(lessonId: number): Progress | undefined {
    return db.select().from(progress).where(eq(progress.lessonId, lessonId)).get();
  }

  getAllProgress(): Progress[] {
    return db.select().from(progress).all();
  }

  saveProgress(data: InsertProgress): Progress {
    const existing = this.getProgress(data.lessonId);
    if (existing) {
      const newScore = Math.max(existing.score, data.score ?? 0);
      db.update(progress)
        .set({
          score: newScore,
          completedAt: data.completedAt ?? existing.completedAt,
          streak: data.streak ?? existing.streak,
        })
        .where(eq(progress.lessonId, data.lessonId))
        .run();
      return this.getProgress(data.lessonId)!;
    }
    return db.insert(progress).values(data).returning().get();
  }

  getAchievements(): Achievement[] {
    return db.select().from(achievements).all();
  }

  unlockAchievement(id: number): Achievement | undefined {
    const now = new Date().toISOString();
    db.update(achievements)
      .set({ unlockedAt: now })
      .where(eq(achievements.id, id))
      .run();
    return db.select().from(achievements).where(eq(achievements.id, id)).get();
  }

  getUserStats(): UserStats {
    let stats = db.select().from(userStats).get();
    if (!stats) {
      stats = db.insert(userStats).values({
        totalXp: 0,
        currentStreak: 0,
        wordsLearned: 0,
      }).returning().get();
    }
    return stats;
  }

  addXp(amount: number): UserStats {
    const stats = this.getUserStats();
    db.update(userStats)
      .set({ totalXp: stats.totalXp + amount })
      .where(eq(userStats.id, stats.id))
      .run();
    return this.getUserStats();
  }

  updateStreak(): UserStats {
    const stats = this.getUserStats();
    const today = new Date().toISOString().split("T")[0];
    const lastActive = stats.lastActiveDate;

    if (lastActive === today) {
      return stats;
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak = lastActive === yesterday ? stats.currentStreak + 1 : 1;

    db.update(userStats)
      .set({
        currentStreak: newStreak,
        lastActiveDate: today,
      })
      .where(eq(userStats.id, stats.id))
      .run();
    return this.getUserStats();
  }

  incrementWordsLearned(count: number): UserStats {
    const stats = this.getUserStats();
    db.update(userStats)
      .set({ wordsLearned: stats.wordsLearned + count })
      .where(eq(userStats.id, stats.id))
      .run();
    return this.getUserStats();
  }
}

export const storage = new DatabaseStorage();

// Seed data from JSON
function seedDatabase() {
  const existingLessons = db.select().from(lessons).all();
  if (existingLessons.length > 0) return;

  // Load lesson data from embedded JSON
  const data = lessonsData as {
    lessons: Array<{ titleRu: string; titleSv: string; category: string; order: number; emoji: string }>;
    words: Array<{ lessonId: number; swedish: string; russian: string; pronunciation: string; exampleSv: string; exampleRu: string }>;
  };

  for (const lesson of data.lessons) {
    db.insert(lessons).values({
      titleRu: lesson.titleRu,
      titleSv: lesson.titleSv,
      category: lesson.category,
      order: lesson.order,
    }).run();
  }

  for (const word of data.words) {
    db.insert(words).values(word).run();
  }

  // Seed achievements
  const achievementData = [
    { name: "Первые шаги", description: "Пройди первый урок", icon: "footprints" },
    { name: "Полиглот", description: "Пройди все 50 уроков", icon: "globe" },
    { name: "Отличник", description: "Получи 100% на любой викторине", icon: "star" },
    { name: "На огне 🔥", description: "Серия 3 дня подряд", icon: "flame" },
    { name: "Мастер слов", description: "Выучи 50 слов", icon: "book-open" },
    { name: "На полпути", description: "Пройди 25 уроков", icon: "milestone" },
    { name: "Знаток 💯", description: "Получи 100% на 5 тестах", icon: "trophy" },
    { name: "Марафонец", description: "Серия 7 дней подряд", icon: "timer" },
    { name: "Эрудит", description: "Выучи 200 слов", icon: "brain" },
    { name: "Легенда", description: "Набери 5000 XP", icon: "crown" },
  ];

  for (const achievement of achievementData) {
    db.insert(achievements).values(achievement).run();
  }

  // Initialize user stats
  db.insert(userStats).values({
    totalXp: 0,
    currentStreak: 0,
    wordsLearned: 0,
  }).run();
}

seedDatabase();
