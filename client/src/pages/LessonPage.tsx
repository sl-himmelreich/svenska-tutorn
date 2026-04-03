import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Volume2, ChevronRight, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Lesson, Word } from "@shared/schema";
import { useState } from "react";

interface LessonData extends Lesson {
  words: Word[];
  progress: number;
}

export default function LessonPage() {
  const params = useParams<{ id: string }>();
  const lessonId = parseInt(params.id || "1");
  const [expandedWord, setExpandedWord] = useState<number | null>(null);

  const { data, isLoading } = useQuery<LessonData>({
    queryKey: ["/api/lessons", lessonId],
  });

  if (isLoading) {
    return <LessonSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Урок не найден</p>
        <Link href="/">
          <Button variant="ghost" className="mt-4">На главную</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="lesson-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground" data-testid="text-lesson-title">
            {data.titleSv}
          </h1>
          <p className="text-sm text-muted-foreground">{data.titleRu}</p>
        </div>
      </div>

      {/* Word count + category */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="rounded-full text-xs">
          {data.words.length} слов
        </Badge>
        <Badge variant="outline" className="rounded-full text-xs">
          {data.category === "phrases" ? "Фразы" : "Словарь"}
        </Badge>
        {data.progress > 0 && (
          <Badge className="rounded-full text-xs bg-success text-success-foreground">
            {data.progress}%
          </Badge>
        )}
      </div>

      {/* Word cards */}
      <div className="space-y-2.5">
        {data.words.map((word, index) => {
          const isExpanded = expandedWord === word.id;
          return (
            <Card
              key={word.id}
              className="bg-card border border-card-border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-sm"
              onClick={() => setExpandedWord(isExpanded ? null : word.id)}
              data-testid={`card-word-${word.id}`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{word.swedish}</div>
                      <div className="text-xs text-muted-foreground">{word.russian}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground italic">[{word.pronunciation}]</span>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 bg-muted/30 animate-slide-up">
                  <p className="text-xs text-muted-foreground mb-1">Пример:</p>
                  <p className="text-sm font-medium text-foreground">{word.exampleSv}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{word.exampleRu}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Start quiz button */}
      <div className="pt-2 pb-4">
        <Link href={`/practice/${lessonId}`}>
          <Button
            className="w-full h-12 text-sm font-semibold rounded-xl gap-2"
            data-testid="button-start-quiz"
          >
            <PlayCircle className="h-5 w-5" />
            Начать тест
          </Button>
        </Link>
      </div>
    </div>
  );
}

function LessonSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24 mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
