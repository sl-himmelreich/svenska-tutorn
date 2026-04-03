import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Footprints, Globe, Star, Flame, BookOpen, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import type { Achievement } from "@shared/schema";
import { motion } from "framer-motion";

const iconMap: Record<string, any> = {
  footprints: Footprints,
  globe: Globe,
  star: Star,
  flame: Flame,
  "book-open": BookOpen,
};

export default function AchievementsPage() {
  const { data: achievements, isLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  if (isLoading) {
    return <AchievementsSkeleton />;
  }

  const unlockedCount = achievements?.filter((a) => a.unlockedAt).length ?? 0;
  const totalCount = achievements?.length ?? 0;

  return (
    <div className="space-y-5" data-testid="achievements-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-back-achievements">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Достижения
          </h1>
          <p className="text-sm text-muted-foreground">
            {unlockedCount} из {totalCount} получено
          </p>
        </div>
      </div>

      {/* Achievement cards */}
      <div className="space-y-3">
        {achievements?.map((achievement, index) => {
          const IconComponent = iconMap[achievement.icon] || Star;
          const isUnlocked = !!achievement.unlockedAt;

          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`p-4 rounded-xl border transition-all ${
                  isUnlocked
                    ? "bg-card border-accent/30 shadow-sm"
                    : "bg-muted/30 border-border opacity-60"
                }`}
                data-testid={`card-achievement-${achievement.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      isUnlocked
                        ? "bg-accent/15 text-accent"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isUnlocked ? (
                      <IconComponent className="h-6 w-6" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-sm font-semibold ${isUnlocked ? "text-foreground" : "text-muted-foreground"}`}>
                      {achievement.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    {isUnlocked && achievement.unlockedAt && (
                      <p className="text-xs text-accent mt-0.5 font-medium">
                        Получено {new Date(achievement.unlockedAt).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>
                  {isUnlocked && (
                    <div className="flex-shrink-0">
                      <span className="text-accent text-lg">✨</span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24 mt-1" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
