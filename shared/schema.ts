import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titleRu: text("title_ru").notNull(),
  titleSv: text("title_sv").notNull(),
  category: text("category").notNull(), // vocabulary | phrases
  order: integer("order").notNull(),
});

export const words = sqliteTable("words", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: integer("lesson_id").notNull(),
  swedish: text("swedish").notNull(),
  russian: text("russian").notNull(),
  pronunciation: text("pronunciation").notNull(),
  exampleSv: text("example_sv").notNull().default(""),
  exampleRu: text("example_ru").notNull().default(""),
});

export const progress = sqliteTable("progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: integer("lesson_id").notNull(),
  score: integer("score").notNull().default(0),
  completedAt: text("completed_at"),
  streak: integer("streak").notNull().default(0),
});

export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  unlockedAt: text("unlocked_at"),
});

export const userStats = sqliteTable("user_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalXp: integer("total_xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  wordsLearned: integer("words_learned").notNull().default(0),
});

// Insert schemas
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertWordSchema = createInsertSchema(words).omit({ id: true });
export const insertProgressSchema = createInsertSchema(progress).omit({ id: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true });

// Types
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Word = typeof words.$inferSelect;
export type InsertWord = z.infer<typeof insertWordSchema>;
export type Progress = typeof progress.$inferSelect;
export type InsertProgress = z.infer<typeof insertProgressSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserStats = typeof userStats.$inferSelect;
