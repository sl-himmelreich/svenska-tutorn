import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

interface WelcomePageProps {
  onStart: (name: string) => void;
}

export default function WelcomePage({ onStart }: WelcomePageProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 1) {
      onStart(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm"
      >
        <Card className="p-6 bg-card border border-card-border rounded-2xl shadow-lg">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none" aria-label="Svenska Tutorn">
                <text
                  x="16"
                  y="24"
                  textAnchor="middle"
                  className="fill-primary-foreground"
                  fontWeight="700"
                  fontSize="22"
                  fontFamily="var(--font-sans)"
                >
                  S
                </text>
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground">
              Svenska Tutorn
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Учи шведский весело! 🇸🇪
            </p>
          </div>

          {/* Name form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="player-name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Как тебя зовут?
              </label>
              <Input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введи своё имя"
                className="h-11 rounded-lg text-sm"
                maxLength={30}
                autoFocus
                autoComplete="off"
                data-testid="input-player-name"
              />
            </div>

            <Button
              type="submit"
              disabled={name.trim().length < 1}
              className="w-full h-11 rounded-xl text-sm font-semibold"
              data-testid="button-start"
            >
              Начать обучение
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Прогресс сохраняется в этом браузере
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
