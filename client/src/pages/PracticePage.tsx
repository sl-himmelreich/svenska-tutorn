import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Check, X, Sparkles, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Lesson, Word } from "@shared/schema";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizData {
  lesson: Lesson;
  words: Word[];
  allWords: { swedish: string; russian: string }[];
}

type QuizMode = "sv-to-ru" | "ru-to-sv" | "type-answer";

interface Question {
  word: Word;
  mode: QuizMode;
  options?: string[];
  correctAnswer: string;
}

function generateQuestions(words: Word[], allWords: { swedish: string; russian: string }[]): Question[] {
  const questions: Question[] = [];
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length; i++) {
    const word = shuffled[i];
    // Cycle through modes
    const modeIndex = i % 3;
    let mode: QuizMode;
    if (modeIndex === 0) mode = "sv-to-ru";
    else if (modeIndex === 1) mode = "ru-to-sv";
    else mode = "type-answer";

    if (mode === "sv-to-ru") {
      const correctAnswer = word.russian;
      const distractors = allWords
        .filter((w) => w.russian !== correctAnswer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((w) => w.russian);
      const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
      questions.push({ word, mode, options, correctAnswer });
    } else if (mode === "ru-to-sv") {
      const correctAnswer = word.swedish;
      const distractors = allWords
        .filter((w) => w.swedish !== correctAnswer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((w) => w.swedish);
      const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
      questions.push({ word, mode, options, correctAnswer });
    } else {
      questions.push({ word, mode, correctAnswer: word.russian });
    }
  }

  return questions;
}

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const lessonId = parseInt(params.id || "1");
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<QuizData>({
    queryKey: ["/api/quiz", lessonId],
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<any[]>([]);

  useEffect(() => {
    if (data && data.words.length > 0) {
      setQuestions(generateQuestions(data.words, data.allWords));
    }
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: async (payload: { lessonId: number; score: number; correctCount: number; totalCount: number }) => {
      const res = await apiRequest("POST", "/api/quiz/submit", payload);
      return res.json();
    },
    onSuccess: (result) => {
      setXpEarned(result.xpEarned);
      setUnlockedAchievements(result.unlockedAchievements || []);
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
    },
  });

  const handleAnswer = useCallback((answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
    setIsAnswered(true);

    const question = questions[currentIndex];
    const correct = answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    if (correct) {
      setCorrectCount((c) => c + 1);
    }
  }, [isAnswered, questions, currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      // Quiz complete
      const finalCorrect = correctCount + (isCorrect ? 0 : 0); // already updated
      const score = Math.round((correctCount / questions.length) * 100);
      setShowResults(true);
      submitMutation.mutate({
        lessonId,
        score,
        correctCount,
        totalCount: questions.length,
      });
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setTypedAnswer("");
      setIsAnswered(false);
      setIsCorrect(false);
    }
  }, [currentIndex, questions, correctCount, isCorrect, lessonId, submitMutation]);

  const handleRetry = () => {
    if (data) {
      setQuestions(generateQuestions(data.words, data.allWords));
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setTypedAnswer("");
      setIsAnswered(false);
      setIsCorrect(false);
      setCorrectCount(0);
      setShowResults(false);
    }
  };

  if (isLoading) {
    return <QuizSkeleton />;
  }

  if (!data || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (showResults) {
    const score = Math.round((correctCount / questions.length) * 100);
    return (
      <ResultsScreen
        score={score}
        correctCount={correctCount}
        totalCount={questions.length}
        xpEarned={xpEarned}
        unlockedAchievements={unlockedAchievements}
        lessonId={lessonId}
        onRetry={handleRetry}
      />
    );
  }

  const question = questions[currentIndex];
  const progressValue = ((currentIndex) / questions.length) * 100;

  return (
    <div className="space-y-5" data-testid="practice-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          onClick={() => setLocation(`/lesson/${lessonId}`)}
          data-testid="button-back-quiz"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <Progress value={progressValue} className="h-2 rounded-full" />
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {currentIndex + 1}/{questions.length}
        </span>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="p-5 bg-card border border-card-border rounded-xl" data-testid="quiz-question">
            {/* Mode label */}
            <div className="text-xs text-muted-foreground mb-3 font-medium">
              {question.mode === "sv-to-ru" && "Выбери перевод на русский:"}
              {question.mode === "ru-to-sv" && "Выбери перевод на шведский:"}
              {question.mode === "type-answer" && "Напиши перевод на русский:"}
            </div>

            {/* Prompt word */}
            <div className="text-center py-4">
              <div className="text-xl font-bold text-foreground" data-testid="text-question-word">
                {question.mode === "ru-to-sv" ? question.word.russian : question.word.swedish}
              </div>
              {question.mode !== "ru-to-sv" && (
                <div className="text-xs text-muted-foreground mt-1 italic">
                  [{question.word.pronunciation}]
                </div>
              )}
            </div>

            {/* Answer area */}
            {question.mode === "type-answer" ? (
              <div className="space-y-3 mt-2">
                <Input
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="Введи ответ..."
                  disabled={isAnswered}
                  className="h-11 rounded-lg text-center text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && typedAnswer.trim() && !isAnswered) {
                      handleAnswer(typedAnswer);
                    }
                  }}
                  data-testid="input-answer"
                />
                {!isAnswered && (
                  <Button
                    onClick={() => handleAnswer(typedAnswer)}
                    disabled={!typedAnswer.trim()}
                    className="w-full h-10 rounded-lg text-sm font-semibold"
                    data-testid="button-check-answer"
                  >
                    Проверить
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {question.options?.map((option, idx) => {
                  let variant: "outline" | "default" | "destructive" = "outline";
                  let extraClass = "hover:bg-primary/5 hover:border-primary/30";

                  if (isAnswered) {
                    if (option === question.correctAnswer) {
                      variant = "default";
                      extraClass = "bg-success text-success-foreground border-success";
                    } else if (option === selectedAnswer && !isCorrect) {
                      variant = "destructive";
                      extraClass = "";
                    } else {
                      extraClass = "opacity-50";
                    }
                  }

                  return (
                    <Button
                      key={idx}
                      variant={variant}
                      className={`h-auto min-h-[2.75rem] py-2 px-3 text-sm font-medium rounded-lg whitespace-normal ${extraClass}`}
                      onClick={() => handleAnswer(option)}
                      disabled={isAnswered}
                      data-testid={`button-option-${idx}`}
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Feedback */}
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Card className={`p-4 rounded-xl border ${isCorrect ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {isCorrect ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-sm font-semibold text-success">Правильно! +10 XP</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Неправильно</span>
                    </>
                  )}
                </div>
                {!isCorrect && (
                  <p className="text-xs text-muted-foreground">
                    Правильный ответ: <span className="font-semibold text-foreground">{question.correctAnswer}</span>
                  </p>
                )}
              </Card>

              <Button
                onClick={handleNext}
                className="w-full h-11 mt-3 rounded-xl text-sm font-semibold"
                data-testid="button-next"
              >
                {currentIndex + 1 >= questions.length ? "Показать результаты" : "Далее"}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ResultsScreen({
  score,
  correctCount,
  totalCount,
  xpEarned,
  unlockedAchievements,
  lessonId,
  onRetry,
}: {
  score: number;
  correctCount: number;
  totalCount: number;
  xpEarned: number;
  unlockedAchievements: any[];
  lessonId: number;
  onRetry: () => void;
}) {
  const [, setLocation] = useLocation();

  const getMessage = () => {
    if (score === 100) return "Отлично! Идеальный результат! 🌟";
    if (score >= 80) return "Великолепно! Так держать! 🎉";
    if (score >= 60) return "Хорошо! Можно лучше! 💪";
    return "Попробуй ещё раз! 📚";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 text-center py-4"
      data-testid="results-screen"
    >
      {/* Score circle */}
      <div className="flex justify-center">
        <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 ${
          score >= 80 ? "border-success bg-success/10" : score >= 60 ? "border-accent bg-accent/10" : "border-destructive bg-destructive/10"
        }`}>
          <span className="text-3xl font-bold text-foreground tabular-nums">{score}%</span>
          <span className="text-xs text-muted-foreground">
            {correctCount}/{totalCount}
          </span>
        </div>
      </div>

      <p className="text-base font-semibold text-foreground" data-testid="text-result-message">{getMessage()}</p>

      {/* XP earned */}
      <Card className="p-4 bg-accent/10 border border-accent/20 rounded-xl inline-flex items-center gap-2 mx-auto">
        <Sparkles className="h-5 w-5 text-accent" />
        <span className="text-sm font-bold text-foreground">+{xpEarned} XP</span>
      </Card>

      {/* Unlocked achievements */}
      {unlockedAchievements.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Новые достижения!</p>
          {unlockedAchievements.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-3 bg-accent/10 border border-accent/20 rounded-xl">
                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onRetry}
          className="flex-1 h-11 rounded-xl gap-2 text-sm font-semibold"
          data-testid="button-retry"
        >
          <RotateCcw className="h-4 w-4" />
          Ещё раз
        </Button>
        <Button
          onClick={() => setLocation("/")}
          className="flex-1 h-11 rounded-xl text-sm font-semibold"
          data-testid="button-home"
        >
          На главную
        </Button>
      </div>
    </motion.div>
  );
}

function QuizSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
