import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Flame, Zap, BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lesson, UserStats } from "@shared/schema";

const lessonEmojis: Record<number, string> = {
  1: "👋",
  2: "👨‍👩‍👧‍👦",
  3: "🍎",
  4: "📚",
  5: "💬",
  6: "🔢",
};

interface LessonWithProgress extends Lesson {
  progress: number;
  completed: boolean;
}

export default function Dashboard() {
  const { data: lessons, isLoading: lessonsLoading } = useQuery<LessonWithProgress[]>({
    queryKey: ["/api/lessons"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/stats"],
  });

  if (lessonsLoading || statsLoading) {
    return <DashboardSkeleton />;
  }

  const completedCount = lessons?.filter((l) => l.completed).length ?? 0;
  const totalLessons = lessons?.length ?? 6;
  const overallProgress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="text-greeting">
          Привет! 🇸🇪
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Учи шведский — это весело!
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center bg-card border border-card-border rounded-xl" data-testid="stat-xp">
          <Zap className="h-5 w-5 mx-auto mb-1 text-accent" />
          <div className="text-lg font-bold text-foreground tabular-nums">{stats?.totalXp ?? 0}</div>
          <div className="text-xs text-muted-foreground">XP</div>
        </Card>
        <Card className="p-3 text-center bg-card border border-card-border rounded-xl" data-testid="stat-streak">
          <Flame className="h-5 w-5 mx-auto mb-1 text-destructive" />
          <div className="text-lg font-bold text-foreground tabular-nums">{stats?.currentStreak ?? 0}</div>
          <div className="text-xs text-muted-foreground">Серия дней</div>
        </Card>
        <Card className="p-3 text-center bg-card border border-card-border rounded-xl" data-testid="stat-words">
          <BookOpen className="h-5 w-5 mx-auto mb-1 text-primary" />
          <div className="text-lg font-bold text-foreground tabular-nums">{stats?.wordsLearned ?? 0}</div>
          <div className="text-xs text-muted-foreground">Слов</div>
        </Card>
      </div>

      {/* Overall progress */}
      <Card className="p-4 bg-card border border-card-border rounded-xl" data-testid="overall-progress">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Общий прогресс</span>
          <span className="text-sm font-bold text-primary tabular-nums">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2.5 rounded-full" />
        <p className="text-xs text-muted-foreground mt-1.5">
          {completedCount} из {totalLessons} уроков пройдено
        </p>
      </Card>

      {/* Lesson cards */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          Уроки
        </h2>
        <div className="space-y-2.5">
          {lessons?.map((lesson) => (
            <Link key={lesson.id} href={`/lesson/${lesson.id}`}>
              <Card
                className="p-4 bg-card border border-card-border rounded-xl cursor-pointer transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.99]"
                data-testid={`card-lesson-${lesson.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                    {lessonEmojis[lesson.id] ?? "📖"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {lesson.titleSv}
                      </h3>
                      {lesson.completed && (
                        <span className="flex-shrink-0 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{lesson.titleRu}</p>
                    {lesson.progress > 0 && (
                      <div className="mt-1.5">
                        <Progress value={lesson.progress} className="h-1.5 rounded-full" />
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
