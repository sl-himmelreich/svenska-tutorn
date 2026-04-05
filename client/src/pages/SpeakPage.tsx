import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Mic, MicOff, Volume2, CheckCircle2, XCircle, RotateCcw, ChevronRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { Lesson, Word } from "@shared/schema";
import { useState, useRef, useCallback, useEffect } from "react";

interface LessonData extends Lesson {
  words: Word[];
  progress: number;
}

type WordResult = "correct" | "incorrect" | "skipped" | null;

interface SpeechState {
  isListening: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  supported: boolean;
}

function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null);
  const stoppingRef = useRef(false);
  const [state, setState] = useState<SpeechState>({
    isListening: false,
    transcript: "",
    confidence: 0,
    error: null,
    supported: typeof window !== "undefined" && !!(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    ),
  });

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState(s => ({ ...s, error: "Браузер не поддерживает распознавание речи. Используйте Chrome." }));
      return;
    }

    // Stop any previous session
    if (recognitionRef.current) {
      stoppingRef.current = true;
      try { recognitionRef.current.abort(); } catch (_) {}
    }

    stoppingRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = "sv-SE";
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = true; // Keep listening until user finishes

    recognition.onstart = () => {
      setState(s => ({ ...s, isListening: true, transcript: "", confidence: 0, error: null }));
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let bestConfidence = 0;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript = result[0].transcript;
          bestConfidence = result[0].confidence;
          for (let a = 0; a < result.length; a++) {
            if (result[a].confidence > bestConfidence) {
              bestConfidence = result[a].confidence;
            }
          }
        } else {
          setState(s => ({ ...s, transcript: result[0].transcript }));
        }
      }
      if (finalTranscript) {
        // Got a final result — stop listening and return it
        stoppingRef.current = true;
        try { recognition.stop(); } catch (_) {}
        setState(s => ({
          ...s,
          transcript: finalTranscript,
          confidence: bestConfidence,
          isListening: false,
        }));
      }
    };

    recognition.onerror = (event: any) => {
      // Silently ignore no-speech / aborted / audio-capture — auto-restart via onend
      if (event.error === "no-speech" || event.error === "aborted" || event.error === "audio-capture") {
        return;
      }
      if (event.error === "not-allowed") {
        setState(s => ({ ...s, error: "Доступ к микрофону запрещён. Разреши в настройках браузера.", isListening: false }));
        stoppingRef.current = true;
      } else if (event.error === "network") {
        setState(s => ({ ...s, error: "Нет подключения к интернету.", isListening: false }));
        stoppingRef.current = true;
      }
      // All other errors — just ignore and let auto-restart handle it
    };

    recognition.onend = () => {
      // If we didn't explicitly stop, auto-restart (handles no-speech timeout)
      if (!stoppingRef.current) {
        try {
          recognition.start();
        } catch (_) {
          setState(s => ({ ...s, isListening: false }));
        }
        return;
      }
      setState(s => ({ ...s, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  }, []);

  return { ...state, start, stop };
}

function speakSwedish(text: string, rate: number = 0.85) {
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sv-SE";
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Try to find a Swedish voice
    const voices = window.speechSynthesis.getVoices();
    const svVoice = voices.find(v => v.lang.startsWith("sv"));
    if (svVoice) utterance.voice = svVoice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()\-–—]/g, "")
    .replace(/\s+/g, " ");
}

function compareWords(spoken: string, target: string): { match: boolean; similarity: number } {
  const s = normalizeText(spoken);
  const t = normalizeText(target);

  // Exact match
  if (s === t) return { match: true, similarity: 1.0 };

  // Contains match (the spoken text might contain extra words)
  if (s.includes(t) || t.includes(s)) return { match: true, similarity: 0.9 };

  // Levenshtein-based similarity
  const distance = levenshtein(s, t);
  const maxLen = Math.max(s.length, t.length);
  const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;

  // Threshold: if similarity > 0.6, it's probably close enough
  return { match: similarity >= 0.6, similarity };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export default function SpeakPage() {
  const params = useParams<{ id: string }>();
  const lessonId = parseInt(params.id || "1");

  const { data, isLoading } = useQuery<LessonData>({
    queryKey: ["/api/lessons", lessonId],
  });

  const speech = useSpeechRecognition();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<WordResult[]>([]);
  const [phase, setPhase] = useState<"intro" | "listen" | "speak" | "result" | "done">("intro");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastComparison, setLastComparison] = useState<{ match: boolean; similarity: number } | null>(null);

  // Load voices on mount
  useEffect(() => {
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
  }, []);

  // Initialize results array when data loads
  useEffect(() => {
    if (data?.words) {
      setResults(new Array(data.words.length).fill(null));
    }
  }, [data]);

  // Auto-evaluate when transcript changes and we're in speak phase
  useEffect(() => {
    if (phase === "speak" && speech.transcript && !speech.isListening && data?.words) {
      const currentWord = data.words[currentIndex];
      const comparison = compareWords(speech.transcript, currentWord.swedish);
      setLastComparison(comparison);

      const newResults = [...results];
      newResults[currentIndex] = comparison.match ? "correct" : "incorrect";
      setResults(newResults);
      setPhase("result");
    }
  }, [speech.transcript, speech.isListening, phase]);

  if (isLoading) {
    return <SpeakSkeleton />;
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

  const currentWord = data.words[currentIndex];
  const correctCount = results.filter(r => r === "correct").length;
  const answeredCount = results.filter(r => r !== null).length;
  const progressPercent = data.words.length > 0 ? (answeredCount / data.words.length) * 100 : 0;

  const handleListen = async () => {
    setPhase("listen");
    setIsSpeaking(true);
    await speakSwedish(currentWord.swedish);
    setIsSpeaking(false);
    setPhase("speak");
  };

  const handleStartListening = () => {
    setPhase("speak");
    speech.start();
  };

  const handleRetry = () => {
    setLastComparison(null);
    const newResults = [...results];
    newResults[currentIndex] = null;
    setResults(newResults);
    setPhase("intro");
  };

  const handleNext = () => {
    if (currentIndex < data.words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setLastComparison(null);
      setPhase("intro");
    } else {
      setPhase("done");
    }
  };

  const handleSkip = () => {
    const newResults = [...results];
    newResults[currentIndex] = "skipped";
    setResults(newResults);
    handleNext();
  };

  // Done screen
  if (phase === "done") {
    const total = data.words.length;
    const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
      <div className="space-y-6" data-testid="speak-done">
        <div className="flex items-center gap-3">
          <Link href={`/lesson/${lessonId}`}>
            <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">Результат</h1>
        </div>

        <Card className="p-6 text-center border border-card-border rounded-xl">
          <Sparkles className="h-12 w-12 text-accent mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-1">
            {scorePercent >= 80 ? "Отлично!" : scorePercent >= 50 ? "Хорошо!" : "Продолжай тренироваться!"}
          </h2>
          <p className="text-3xl font-bold text-primary mb-2">{scorePercent}%</p>
          <p className="text-sm text-muted-foreground">
            {correctCount} из {total} слов произнесено правильно
          </p>
        </Card>

        {/* Word-by-word results */}
        <div className="space-y-2">
          {data.words.map((word, idx) => (
            <div
              key={word.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                results[idx] === "correct"
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : results[idx] === "incorrect"
                  ? "bg-red-50 dark:bg-red-950/30"
                  : "bg-muted/50"
              }`}
            >
              {results[idx] === "correct" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : results[idx] === "incorrect" ? (
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex-shrink-0" />
              )}
              <span className="font-medium text-foreground">{word.swedish}</span>
              <span className="text-muted-foreground">— {word.russian}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2 pb-4">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl"
            onClick={() => {
              setCurrentIndex(0);
              setResults(new Array(data.words.length).fill(null));
              setLastComparison(null);
              setPhase("intro");
            }}
            data-testid="button-retry-all"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Ещё раз
          </Button>
          <Link href={`/lesson/${lessonId}`} className="flex-1">
            <Button className="w-full h-11 rounded-xl" data-testid="button-back-to-lesson">
              К уроку
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="speak-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/lesson/${lessonId}`}>
          <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Тренировка речи</h1>
          <p className="text-sm text-muted-foreground">{data.titleSv} — {data.titleRu}</p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {currentIndex + 1}/{data.words.length}
        </span>
      </div>

      {/* Progress bar */}
      <Progress value={progressPercent} className="h-2" />

      {/* Browser support warning */}
      {!speech.supported && (
        <Card className="p-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Распознавание речи работает только в Google Chrome. Пожалуйста, откройте приложение в Chrome.
          </p>
        </Card>
      )}

      {/* Teacher chat area */}
      <div className="space-y-3">
        {/* Teacher message: show word */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg">🎓</span>
          </div>
          <Card className="flex-1 p-4 rounded-xl rounded-tl-sm border border-card-border bg-card">
            <p className="text-sm text-muted-foreground mb-2">Произнеси по-шведски:</p>
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-foreground">{currentWord.swedish}</p>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-8 w-8 p-0"
                onClick={handleListen}
                disabled={isSpeaking}
                data-testid="button-listen"
              >
                <Volume2 className={`h-4 w-4 ${isSpeaking ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{currentWord.russian}</p>
            <p className="text-xs text-muted-foreground/70 italic mt-0.5">[{currentWord.pronunciation}]</p>
          </Card>
        </div>

        {/* User speech area */}
        {phase === "intro" && (
          <div className="flex justify-center pt-4">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Сначала послушай, потом повтори</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl gap-2"
                  onClick={handleListen}
                  disabled={isSpeaking}
                  data-testid="button-hear-word"
                >
                  <Volume2 className="h-4 w-4" />
                  Послушать
                </Button>
                <Button
                  className="h-11 rounded-xl gap-2"
                  onClick={handleStartListening}
                  disabled={!speech.supported}
                  data-testid="button-record"
                >
                  <Mic className="h-4 w-4" />
                  Произнести
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase === "listen" && (
          <div className="flex justify-center pt-4">
            <div className="text-center space-y-3">
              <Volume2 className="h-8 w-8 text-primary animate-pulse mx-auto" />
              <p className="text-sm text-muted-foreground">Слушай внимательно...</p>
            </div>
          </div>
        )}

        {phase === "speak" && (
          <div className="flex justify-end gap-3">
            <Card className="p-4 rounded-xl rounded-tr-sm border border-primary/30 bg-primary/5 max-w-[80%]">
              <div className="flex items-center gap-3">
                {speech.isListening ? (
                  <>
                    <div className="relative">
                      <Mic className="h-5 w-5 text-primary animate-pulse" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {speech.transcript || "Говори..."}
                      </p>
                      <p className="text-xs text-muted-foreground">Слушаю...</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Нажми кнопку и произнеси слово</p>
                    </div>
                  </>
                )}
              </div>
              {speech.isListening ? (
                <Button
                  className="w-full h-10 mt-3 rounded-lg gap-2"
                  variant="secondary"
                  onClick={() => speech.stop()}
                  data-testid="button-stop-mic"
                >
                  <MicOff className="h-4 w-4" />
                  Остановить
                </Button>
              ) : !speech.transcript ? (
                <Button
                  className="w-full h-10 mt-3 rounded-lg gap-2"
                  onClick={() => speech.start()}
                  disabled={!speech.supported}
                  data-testid="button-start-mic"
                >
                  <Mic className="h-4 w-4" />
                  Начать запись
                </Button>
              ) : null}
            </Card>
          </div>
        )}

        {/* Result */}
        {phase === "result" && lastComparison && (
          <>
            {/* What was recognized */}
            <div className="flex justify-end gap-3">
              <Card className={`p-4 rounded-xl rounded-tr-sm border max-w-[80%] ${
                lastComparison.match
                  ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-red-300 bg-red-50 dark:bg-red-950/30"
              }`}>
                <div className="flex items-center gap-2">
                  {lastComparison.match ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <p className="text-sm font-medium text-foreground">
                    «{speech.transcript}»
                  </p>
                </div>
              </Card>
            </div>

            {/* Teacher feedback */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg">🎓</span>
              </div>
              <Card className="flex-1 p-4 rounded-xl rounded-tl-sm border border-card-border bg-card">
                {lastComparison.match ? (
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {lastComparison.similarity >= 0.95 ? "Отлично! Идеальное произношение! 🌟" :
                       lastComparison.similarity >= 0.8 ? "Очень хорошо! 👏" :
                       "Правильно! Но можно чуть точнее 👍"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Точность: {Math.round(lastComparison.similarity * 100)}%
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Не совсем. Попробуй ещё раз! 💪
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ты сказал: «{speech.transcript}» — а нужно: «{currentWord.swedish}»
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 gap-1 text-xs"
                      onClick={handleListen}
                      data-testid="button-listen-again"
                    >
                      <Volume2 className="h-3 w-3" />
                      Послушать правильное произношение
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl gap-2"
                onClick={handleRetry}
                data-testid="button-retry"
              >
                <RotateCcw className="h-4 w-4" />
                Ещё раз
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl gap-2"
                onClick={handleNext}
                data-testid="button-next"
              >
                {currentIndex < data.words.length - 1 ? "Дальше" : "Результат"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Error message */}
        {speech.error && (
          <Card className="p-3 border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
            <p className="text-sm text-amber-800 dark:text-amber-200">{speech.error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-xs"
              onClick={() => {
                setPhase("intro");
              }}
              data-testid="button-dismiss-error"
            >
              Попробовать снова
            </Button>
          </Card>
        )}

        {/* Skip button */}
        {phase !== "done" && phase !== "result" && (
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={handleSkip}
              data-testid="button-skip"
            >
              Пропустить это слово →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28 mt-1" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
