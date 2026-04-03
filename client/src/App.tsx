import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LessonPage from "@/pages/LessonPage";
import PracticePage from "@/pages/PracticePage";
import AchievementsPage from "@/pages/AchievementsPage";
import SpeakPage from "@/pages/SpeakPage";
import WelcomePage from "@/pages/WelcomePage";
import NotFound from "@/pages/not-found";
import { useState, useCallback } from "react";
import { getPlayerName, setPlayerName, clearAllData } from "@/lib/staticData";

function AppRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/lesson/:id" component={LessonPage} />
        <Route path="/practice/:id" component={PracticePage} />
        <Route path="/speak/:id" component={SpeakPage} />
        <Route path="/achievements" component={AchievementsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [name, setName] = useState<string | null>(getPlayerName);

  const handleStart = useCallback((newName: string) => {
    setPlayerName(newName);
    setName(newName);
  }, []);

  const handleLogout = useCallback(() => {
    clearAllData();
    // Invalidate all queries so UI resets
    queryClient.clear();
    setName(null);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          {name ? (
            <Router hook={useHashLocation}>
              <PlayerContext.Provider value={{ name, onLogout: handleLogout }}>
                <AppRouter />
              </PlayerContext.Provider>
            </Router>
          ) : (
            <WelcomePage onStart={handleStart} />
          )}
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Context for player info accessible throughout the app
import { createContext, useContext } from "react";

interface PlayerContextType {
  name: string;
  onLogout: () => void;
}

export const PlayerContext = createContext<PlayerContextType>({
  name: "",
  onLogout: () => {},
});

export function usePlayer() {
  return useContext(PlayerContext);
}

export default App;
