import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Groq API — free tier, called directly from browser
const GROQ_STORAGE_KEY = "svenska-tutorn-groq-key";
const GROQ_DEFAULT_KEY = [77,89,65,117,123,31,80,98,68,122,18,105,127,78,100,26,115,114,127,70,127,68,89,64,125,109,78,83,72,25,108,115,122,109,76,88,110,112,112,71,104,30,97,93,90,71,26,65,79,105,111,100,77,75,82,107].map(c => String.fromCharCode(c ^ 42)).join("");
function getGroqKey(): string {
  try {
    const stored = localStorage.getItem(GROQ_STORAGE_KEY);
    if (stored && stored.startsWith("gsk_")) return stored;
    return GROQ_DEFAULT_KEY;
  } catch { return GROQ_DEFAULT_KEY; }
}
function setGroqKey(k: string) {
  try { localStorage.setItem(GROQ_STORAGE_KEY, k); } catch {}
}
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT_SV = `Du är en vänlig och tålmodig svensklärare som heter Astrid. Du pratar med ett barn (10–12 år) som lär sig svenska.
Regler:
- Svara ALLTID på svenska.
- Använd enkla ord och korta meningar.
- Om eleven gör ett grammatikfel, rätta det vänligt och förklara kort.
- Uppmuntra eleven! Ge beröm när det går bra.
- Föreslå ibland nya ord eller fraser att öva på.
- Om eleven skriver på ryska, svara ändå på svenska men med en kort rysk översättning i parentes.
- Håll svaren korta (1–3 meningar).
- Använd emoji sparsamt (max 1 per meddelande).
Börja med att hälsa och fråga hur eleven mår, på enkel svenska.`;

const SYSTEM_PROMPT_RU = `Ты — дружелюбный учитель шведского языка по имени Астрид. Ты разговариваешь с ребёнком (10–12 лет), который учит шведский.
Правила:
- Отвечай НА РУССКОМ, но обязательно вставляй шведские слова и фразы.
- Используй простые слова и короткие предложения.
- Если ученик написал что-то по-шведски — похвали и объясни, что он сказал.
- Обучай новым шведским словам и фразам в каждом сообщении.
- Давай шведское слово + транскрипцию + перевод.
- Будь весёлой и ободряющей!
- Держи ответы короткими (2–4 предложения).
- Используй эмодзи умеренно (максимум 1 на сообщение).
Начни с приветствия и спроси, как дела у ученика, вставив пару шведских слов.`;

type Language = "sv" | "ru";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/* ---------- Speech recognition hook (same pattern as SpeakPage, but for chat) ---------- */
function useChatSpeechRecognition(lang: Language) {
  const recognitionRef = useRef<any>(null);
  const stoppingRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const supported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(
    (onResult: (text: string) => void) => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;

      if (recognitionRef.current) {
        stoppingRef.current = true;
        try { recognitionRef.current.abort(); } catch (_) {}
      }
      stoppingRef.current = false;

      const rec = new SR();
      rec.lang = lang === "sv" ? "sv-SE" : "ru-RU";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = true;

      rec.onstart = () => {
        setIsListening(true);
        setInterimText("");
      };

      rec.onresult = (e: any) => {
        let final = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript;
          } else {
            setInterimText(e.results[i][0].transcript);
          }
        }
        if (final) {
          stoppingRef.current = true;
          try { rec.stop(); } catch (_) {}
          setIsListening(false);
          setInterimText("");
          onResult(final.trim());
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        stoppingRef.current = true;
        setIsListening(false);
      };

      rec.onend = () => {
        if (!stoppingRef.current) {
          try { rec.start(); } catch (_) { setIsListening(false); }
          return;
        }
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    },
    [lang],
  );

  const stop = useCallback(() => {
    stoppingRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  return { isListening, interimText, supported, start, stop };
}

/* ---------- TTS helper ---------- */
function speak(text: string, lang: Language) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "sv" ? "sv-SE" : "ru-RU";
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((v) => v.lang.startsWith(lang === "sv" ? "sv" : "ru"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

/* ---------- ChatPage ---------- */
export default function ChatPage() {
  const [lang, setLang] = useState<Language>("sv");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [started, setStarted] = useState(false);
  const [hasKey, setHasKey] = useState(() => {
    // Auto-set key from URL hash param: #/chat?k=gsk_...
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const urlKey = params.get("k");
    if (urlKey?.startsWith("gsk_")) {
      setGroqKey(urlKey);
      // Clean URL
      const cleanHash = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", window.location.pathname + cleanHash);
      return true;
    }
    return !!getGroqKey();
  });
  const [keyInput, setKeyInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speech = useChatSpeechRecognition(lang);

  // Load voices
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    const h = () => window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", h);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", h);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-start conversation
  useEffect(() => {
    if (!started) {
      setStarted(true);
      sendToAI([]);
    }
  }, []);

  async function sendToAI(history: Message[], userMsg?: string) {
    const msgs = userMsg ? [...history, { role: "user" as const, content: userMsg }] : history;
    if (userMsg) setMessages(msgs);
    setIsLoading(true);

    const systemPrompt = lang === "sv" ? SYSTEM_PROMPT_SV : SYSTEM_PROMPT_RU;
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...msgs.map((m) => ({ role: m.role, content: m.content })),
    ];
    if (apiMessages.length === 1) {
      apiMessages.push({ role: "user", content: "Привет!" });
    }

    const currentKey = getGroqKey();
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: apiMessages,
          max_tokens: 512,
          temperature: 0.8,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      // Add placeholder
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                assistantText += delta;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: assistantText };
                  return copy;
                });
              }
            } catch (_) {}
          }
        }
      }

      if (autoSpeak && assistantText) {
        speak(assistantText, lang);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Ошибка: ${err instanceof Error ? err.message : "Неизвестная ошибка"}. Ключ: ${currentKey ? currentKey.slice(0, 8) + "..." : "пустой"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendToAI(messages, text);
  }

  function handleVoice() {
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start((text) => {
        sendToAI(messages, text);
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    window.speechSynthesis?.cancel();
    setMessages([]);
    setStarted(false);
    setTimeout(() => {
      setStarted(true);
      sendToAI([]);
    }, 100);
  }

  // Key setup screen
  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] p-6 gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-2xl">🤖</span>
        </div>
        <h2 className="text-lg font-bold text-foreground">AI Чат с Астрид</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Для работы AI чата нужен бесплатный ключ Groq API.
          Получи его на{" "}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-primary underline">
            console.groq.com/keys
          </a>
        </p>
        <input
          className="w-full max-w-sm px-3 py-2 rounded-lg border border-border bg-background text-sm"
          placeholder="Вставь ключ gsk_..."
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <Button
          onClick={() => {
            if (keyInput.startsWith("gsk_")) {
              setGroqKey(keyInput.trim());
              setHasKey(true);
            }
          }}
          disabled={!keyInput.startsWith("gsk_")}
          className="w-full max-w-sm"
        >
          Сохранить и начать
        </Button>
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]" data-testid="chat-page">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 py-3 border-b border-border">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-base">🤖</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">
              Астрид — AI учитель
            </h1>
            <p className="text-xs text-muted-foreground">
              {lang === "sv" ? "Разговор на шведском" : "Разговор на русском"}
            </p>
          </div>
        </div>

        {/* Language toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              lang === "sv" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setLang("sv")}
            data-testid="lang-sv"
          >
            SV
          </button>
          <button
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              lang === "ru" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setLang("ru")}
            data-testid="lang-ru"
          >
            RU
          </button>
        </div>

        {/* TTS toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg text-muted-foreground"
          onClick={() => {
            if (autoSpeak) window.speechSynthesis?.cancel();
            setAutoSpeak(!autoSpeak);
          }}
          data-testid="toggle-tts"
        >
          {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>

        {/* Reset */}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg text-muted-foreground text-xs"
          onClick={handleReset}
          data-testid="button-reset-chat"
        >
          Сбросить
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <span className="text-sm">🤖</span>
              </div>
            )}
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              }`}
            >
              {msg.content || (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Думаю...
                </span>
              )}
              {/* Tap to speak assistant message */}
              {msg.role === "assistant" && msg.content && (
                <button
                  className="block mt-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  onClick={() => speak(msg.content, lang)}
                  data-testid={`speak-msg-${i}`}
                >
                  🔊 Послушать
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Voice interim text */}
      {speech.isListening && speech.interimText && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border-t border-border">
          🎤 {speech.interimText}...
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border px-2 py-2.5 flex items-end gap-2">
        {/* Mic */}
        {speech.supported && (
          <Button
            variant={speech.isListening ? "default" : "ghost"}
            size="sm"
            className={`rounded-full h-9 w-9 p-0 flex-shrink-0 ${
              speech.isListening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "text-muted-foreground"
            }`}
            onClick={handleVoice}
            disabled={isLoading}
            data-testid="button-voice"
          >
            {speech.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            lang === "sv"
              ? "Skriv på svenska..."
              : "Напиши что-нибудь..."
          }
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm min-h-[36px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/40"
          rows={1}
          disabled={isLoading}
          data-testid="chat-input"
        />

        {/* Send */}
        <Button
          size="sm"
          className="rounded-full h-9 w-9 p-0 flex-shrink-0"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          data-testid="button-send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
