/*
 * TRAIL QUEST WORLD - Dark UI × Neon Game Center
 * Background: #0F172A | Surface: #1E293B | Primary: #4F46E5 | ALT: #F59E0B
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PageShell from "./components/layout/PageShell";
import HomePage from "./pages/HomePage";
import GameListPage from "./pages/GameListPage";
import GamePlayPage from "./pages/GamePlayPage";
import GachaPage from "./pages/GachaPage";
import RankingPage from "./pages/RankingPage";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import MyPage from "./pages/MyPage";
import ResultPage from "./pages/ResultPage";
import LoginPage from "./pages/LoginPage";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/games/:gameId" component={GamePlayPage} />
      <Route path="/result" component={ResultPage} />
      <Route>
        <PageShell>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/games" component={GameListPage} />
            <Route path="/gacha" component={GachaPage} />
            <Route path="/ranking" component={RankingPage} />
            <Route path="/collection" component={CollectionPage} />
            <Route path="/shop" component={ShopPage} />
            <Route path="/mypage" component={MyPage} />
            <Route>
              <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-lg font-bold" style={{ color: '#94A3B8' }}>ページが見つかりません</p>
              </div>
            </Route>
          </Switch>
        </PageShell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
