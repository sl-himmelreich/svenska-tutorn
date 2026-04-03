import {
  type Lesson, type Word, type Progress, type Achievement, type UserStats,
  type InsertProgress,
  lessons, words, progress, achievements, userStats,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";

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

// Seed data
function seedDatabase() {
  const existingLessons = db.select().from(lessons).all();
  if (existingLessons.length > 0) return;

  // Seed lessons
  const lessonData = [
    { titleRu: "Приветствия", titleSv: "Hälsningar", category: "vocabulary", order: 1 },
    { titleRu: "Семья", titleSv: "Familjen", category: "vocabulary", order: 2 },
    { titleRu: "Еда и напитки", titleSv: "Mat och dryck", category: "vocabulary", order: 3 },
    { titleRu: "В школе", titleSv: "I skolan", category: "vocabulary", order: 4 },
    { titleRu: "Повседневные фразы", titleSv: "Vardagliga fraser", category: "phrases", order: 5 },
    { titleRu: "Числа и цвета", titleSv: "Siffror och färger", category: "vocabulary", order: 6 },
  ];

  for (const lesson of lessonData) {
    db.insert(lessons).values(lesson).run();
  }

  // Seed words
  const wordData = [
    // Lesson 1: Hälsningar
    { lessonId: 1, swedish: "Hej", russian: "Привет", pronunciation: "хей", exampleSv: "Hej! Hur mår du?", exampleRu: "Привет! Как дела?" },
    { lessonId: 1, swedish: "God morgon", russian: "Доброе утро", pronunciation: "гуд моррон", exampleSv: "God morgon, alla!", exampleRu: "Доброе утро, все!" },
    { lessonId: 1, swedish: "God kväll", russian: "Добрый вечер", pronunciation: "гуд квелль", exampleSv: "God kväll, familjen!", exampleRu: "Добрый вечер, семья!" },
    { lessonId: 1, swedish: "Hej då", russian: "Пока", pronunciation: "хей до", exampleSv: "Hej då! Vi ses imorgon.", exampleRu: "Пока! Увидимся завтра." },
    { lessonId: 1, swedish: "Tack", russian: "Спасибо", pronunciation: "такк", exampleSv: "Tack för hjälpen!", exampleRu: "Спасибо за помощь!" },
    { lessonId: 1, swedish: "Tack så mycket", russian: "Большое спасибо", pronunciation: "такк со мюкет", exampleSv: "Tack så mycket för maten!", exampleRu: "Большое спасибо за еду!" },
    { lessonId: 1, swedish: "Ursäkta", russian: "Извините", pronunciation: "урщекта", exampleSv: "Ursäkta, var är toaletten?", exampleRu: "Извините, где туалет?" },
    { lessonId: 1, swedish: "Var så god", russian: "Пожалуйста", pronunciation: "вар со гуд", exampleSv: "Var så god, här är din bok.", exampleRu: "Пожалуйста, вот твоя книга." },

    // Lesson 2: Familjen
    { lessonId: 2, swedish: "Mamma", russian: "Мама", pronunciation: "мамма", exampleSv: "Min mamma lagar mat.", exampleRu: "Моя мама готовит еду." },
    { lessonId: 2, swedish: "Pappa", russian: "Папа", pronunciation: "паппа", exampleSv: "Min pappa jobbar.", exampleRu: "Мой папа работает." },
    { lessonId: 2, swedish: "Bror", russian: "Брат", pronunciation: "брур", exampleSv: "Min bror är stor.", exampleRu: "Мой брат большой." },
    { lessonId: 2, swedish: "Syster", russian: "Сестра", pronunciation: "сюстер", exampleSv: "Min syster är liten.", exampleRu: "Моя сестра маленькая." },
    { lessonId: 2, swedish: "Farfar", russian: "Дедушка", pronunciation: "фарфар", exampleSv: "Min farfar bor i Sverige.", exampleRu: "Мой дедушка живёт в Швеции." },
    { lessonId: 2, swedish: "Farmor", russian: "Бабушка", pronunciation: "фармур", exampleSv: "Min farmor bakar kakor.", exampleRu: "Моя бабушка печёт печенье." },
    { lessonId: 2, swedish: "Barn", russian: "Ребёнок/Дети", pronunciation: "барн", exampleSv: "Barnen leker ute.", exampleRu: "Дети играют на улице." },
    { lessonId: 2, swedish: "Familj", russian: "Семья", pronunciation: "фамиль", exampleSv: "Min familj är stor.", exampleRu: "Моя семья большая." },

    // Lesson 3: Mat och dryck
    { lessonId: 3, swedish: "Bröd", russian: "Хлеб", pronunciation: "брёд", exampleSv: "Jag äter bröd.", exampleRu: "Я ем хлеб." },
    { lessonId: 3, swedish: "Mjölk", russian: "Молоко", pronunciation: "мьёльк", exampleSv: "Jag dricker mjölk.", exampleRu: "Я пью молоко." },
    { lessonId: 3, swedish: "Vatten", russian: "Вода", pronunciation: "ваттен", exampleSv: "Kan jag få vatten?", exampleRu: "Можно мне воду?" },
    { lessonId: 3, swedish: "Äpple", russian: "Яблоко", pronunciation: "эппле", exampleSv: "Äpplet är rött.", exampleRu: "Яблоко красное." },
    { lessonId: 3, swedish: "Kött", russian: "Мясо", pronunciation: "шётт", exampleSv: "Vi äter kött till middag.", exampleRu: "Мы едим мясо на ужин." },
    { lessonId: 3, swedish: "Fisk", russian: "Рыба", pronunciation: "фиск", exampleSv: "Fisken smakar bra.", exampleRu: "Рыба вкусная." },
    { lessonId: 3, swedish: "Smör", russian: "Масло", pronunciation: "смёр", exampleSv: "Smör på brödet.", exampleRu: "Масло на хлебе." },
    { lessonId: 3, swedish: "Kaffe", russian: "Кофе", pronunciation: "каффе", exampleSv: "Vill du ha kaffe?", exampleRu: "Хочешь кофе?" },

    // Lesson 4: I skolan
    { lessonId: 4, swedish: "Skola", russian: "Школа", pronunciation: "скула", exampleSv: "Jag går i skolan.", exampleRu: "Я хожу в школу." },
    { lessonId: 4, swedish: "Lärare", russian: "Учитель", pronunciation: "лэраре", exampleSv: "Läraren är snäll.", exampleRu: "Учитель добрый." },
    { lessonId: 4, swedish: "Bok", russian: "Книга", pronunciation: "бук", exampleSv: "Jag läser en bok.", exampleRu: "Я читаю книгу." },
    { lessonId: 4, swedish: "Penna", russian: "Ручка", pronunciation: "пенна", exampleSv: "Ge mig en penna.", exampleRu: "Дай мне ручку." },
    { lessonId: 4, swedish: "Lektion", russian: "Урок", pronunciation: "лекшун", exampleSv: "Lektionen börjar nu.", exampleRu: "Урок начинается сейчас." },
    { lessonId: 4, swedish: "Läxa", russian: "Домашнее задание", pronunciation: "лекса", exampleSv: "Jag gör min läxa.", exampleRu: "Я делаю домашнее задание." },
    { lessonId: 4, swedish: "Klassrum", russian: "Класс", pronunciation: "классрум", exampleSv: "Klassrummet är stort.", exampleRu: "Класс большой." },
    { lessonId: 4, swedish: "Elev", russian: "Ученик", pronunciation: "элев", exampleSv: "Eleven studerar.", exampleRu: "Ученик учится." },

    // Lesson 5: Vardagliga fraser
    { lessonId: 5, swedish: "Jag heter...", russian: "Меня зовут...", pronunciation: "яг хетер", exampleSv: "Jag heter Anna.", exampleRu: "Меня зовут Анна." },
    { lessonId: 5, swedish: "Hur mår du?", russian: "Как дела?", pronunciation: "хур мор дю", exampleSv: "Hej! Hur mår du idag?", exampleRu: "Привет! Как дела сегодня?" },
    { lessonId: 5, swedish: "Jag mår bra", russian: "У меня всё хорошо", pronunciation: "яг мор бра", exampleSv: "Tack, jag mår bra!", exampleRu: "Спасибо, у меня всё хорошо!" },
    { lessonId: 5, swedish: "Var ligger...?", russian: "Где находится...?", pronunciation: "вар лиггер", exampleSv: "Var ligger stationen?", exampleRu: "Где находится станция?" },
    { lessonId: 5, swedish: "Jag förstår inte", russian: "Я не понимаю", pronunciation: "яг фёршторр инте", exampleSv: "Ursäkta, jag förstår inte.", exampleRu: "Извините, я не понимаю." },
    { lessonId: 5, swedish: "Kan du hjälpa mig?", russian: "Можешь мне помочь?", pronunciation: "кан дю йельпа мей", exampleSv: "Kan du hjälpa mig med läxan?", exampleRu: "Можешь мне помочь с уроком?" },
    { lessonId: 5, swedish: "Vad kostar det?", russian: "Сколько это стоит?", pronunciation: "вад костар де", exampleSv: "Vad kostar den här boken?", exampleRu: "Сколько стоит эта книга?" },
    { lessonId: 5, swedish: "Jag vill ha...", russian: "Я хочу...", pronunciation: "яг виль ха", exampleSv: "Jag vill ha glass.", exampleRu: "Я хочу мороженое." },

    // Lesson 6: Siffror och färger
    { lessonId: 6, swedish: "Ett", russian: "Один", pronunciation: "этт", exampleSv: "Jag har ett äpple.", exampleRu: "У меня одно яблоко." },
    { lessonId: 6, swedish: "Två", russian: "Два", pronunciation: "тво", exampleSv: "Jag har två böcker.", exampleRu: "У меня две книги." },
    { lessonId: 6, swedish: "Tre", russian: "Три", pronunciation: "тре", exampleSv: "Det finns tre barn.", exampleRu: "Есть трое детей." },
    { lessonId: 6, swedish: "Fyra", russian: "Четыре", pronunciation: "фюра", exampleSv: "Vi är fyra vänner.", exampleRu: "Нас четверо друзей." },
    { lessonId: 6, swedish: "Fem", russian: "Пять", pronunciation: "фем", exampleSv: "Klockan är fem.", exampleRu: "Сейчас пять часов." },
    { lessonId: 6, swedish: "Röd", russian: "Красный", pronunciation: "рёд", exampleSv: "Bilen är röd.", exampleRu: "Машина красная." },
    { lessonId: 6, swedish: "Blå", russian: "Синий", pronunciation: "бло", exampleSv: "Himlen är blå.", exampleRu: "Небо синее." },
    { lessonId: 6, swedish: "Grön", russian: "Зелёный", pronunciation: "грён", exampleSv: "Gräset är grönt.", exampleRu: "Трава зелёная." },
  ];

  for (const word of wordData) {
    db.insert(words).values(word).run();
  }

  // Seed achievements
  const achievementData = [
    { name: "Первые шаги", description: "Пройди первый урок", icon: "footprints" },
    { name: "Полиглот", description: "Пройди все 6 уроков", icon: "globe" },
    { name: "Отличник", description: "Получи 100% на любой викторине", icon: "star" },
    { name: "На огне 🔥", description: "Серия 3 дня подряд", icon: "flame" },
    { name: "Мастер слов", description: "Выучи 50 слов", icon: "book-open" },
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
