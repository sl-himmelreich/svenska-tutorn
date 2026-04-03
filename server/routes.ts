import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Get all lessons with progress
  app.get("/api/lessons", (_req, res) => {
    const lessons = storage.getLessons();
    const allProgress = storage.getAllProgress();
    const result = lessons.map((lesson) => {
      const prog = allProgress.find((p) => p.lessonId === lesson.id);
      return {
        ...lesson,
        progress: prog ? prog.score : 0,
        completed: prog ? (prog.score > 0) : false,
      };
    });
    res.json(result);
  });

  // Get single lesson with words
  app.get("/api/lessons/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const lesson = storage.getLesson(id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    const lessonWords = storage.getLessonWords(id);
    const prog = storage.getProgress(id);
    res.json({
      ...lesson,
      words: lessonWords,
      progress: prog ? prog.score : 0,
    });
  });

  // Get quiz data for a lesson
  app.get("/api/quiz/:lessonId", (req, res) => {
    const lessonId = parseInt(req.params.lessonId);
    const lesson = storage.getLesson(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    const lessonWords = storage.getLessonWords(lessonId);
    // Also get words from other lessons for distractor options
    const allLessons = storage.getLessons();
    const allWords: { swedish: string; russian: string }[] = [];
    for (const l of allLessons) {
      const ws = storage.getLessonWords(l.id);
      allWords.push(...ws.map((w) => ({ swedish: w.swedish, russian: w.russian })));
    }
    res.json({
      lesson,
      words: lessonWords,
      allWords,
    });
  });

  // Submit quiz result
  app.post("/api/quiz/submit", (req, res) => {
    const { lessonId, score, correctCount, totalCount } = req.body;
    if (!lessonId || score === undefined) {
      return res.status(400).json({ message: "Missing lessonId or score" });
    }

    const now = new Date().toISOString();

    // Save progress
    const prog = storage.saveProgress({
      lessonId,
      score,
      completedAt: now,
      streak: 0,
    });

    // Add XP: +10 per correct answer, +50 bonus if lesson completed
    const xpFromAnswers = correctCount * 10;
    const completionBonus = score >= 70 ? 50 : 0;
    const totalXpEarned = xpFromAnswers + completionBonus;
    storage.addXp(totalXpEarned);

    // Update streak
    storage.updateStreak();

    // Track words learned
    storage.incrementWordsLearned(correctCount);

    // Check achievements
    const unlockedAchievements: any[] = [];
    const allAchievements = storage.getAchievements();
    const stats = storage.getUserStats();
    const allProgress = storage.getAllProgress();

    // "Первые шаги" — first lesson completed
    const firstSteps = allAchievements.find((a) => a.name === "Первые шаги");
    if (firstSteps && !firstSteps.unlockedAt && allProgress.some((p) => p.score > 0)) {
      const unlocked = storage.unlockAchievement(firstSteps.id);
      if (unlocked) unlockedAchievements.push(unlocked);
    }

    // "Полиглот" — all 6 lessons completed
    const polyglot = allAchievements.find((a) => a.name === "Полиглот");
    if (polyglot && !polyglot.unlockedAt) {
      const completedLessons = allProgress.filter((p) => p.score > 0).length;
      if (completedLessons >= 6) {
        const unlocked = storage.unlockAchievement(polyglot.id);
        if (unlocked) unlockedAchievements.push(unlocked);
      }
    }

    // "Отличник" — 100% on any quiz
    const perfectScore = allAchievements.find((a) => a.name === "Отличник");
    if (perfectScore && !perfectScore.unlockedAt && score === 100) {
      const unlocked = storage.unlockAchievement(perfectScore.id);
      if (unlocked) unlockedAchievements.push(unlocked);
    }

    // "На огне" — 3-day streak
    const onFire = allAchievements.find((a) => a.name === "На огне 🔥");
    if (onFire && !onFire.unlockedAt && stats.currentStreak >= 3) {
      const unlocked = storage.unlockAchievement(onFire.id);
      if (unlocked) unlockedAchievements.push(unlocked);
    }

    // "Мастер слов" — 50 words learned
    const wordMaster = allAchievements.find((a) => a.name === "Мастер слов");
    if (wordMaster && !wordMaster.unlockedAt && stats.wordsLearned >= 50) {
      const unlocked = storage.unlockAchievement(wordMaster.id);
      if (unlocked) unlockedAchievements.push(unlocked);
    }

    res.json({
      progress: prog,
      xpEarned: totalXpEarned,
      stats: storage.getUserStats(),
      unlockedAchievements,
    });
  });

  // Get user stats
  app.get("/api/stats", (_req, res) => {
    const stats = storage.getUserStats();
    // Also update streak on any activity
    storage.updateStreak();
    res.json(storage.getUserStats());
  });

  // Get achievements
  app.get("/api/achievements", (_req, res) => {
    res.json(storage.getAchievements());
  });

  return httpServer;
}
