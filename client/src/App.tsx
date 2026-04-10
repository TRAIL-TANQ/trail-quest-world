/*
 * TRAIL QUEST WORLD - Royal Adventurer's Guild Aesthetic
 * Dark Navy (#0b1128) + Gold (#ffd700) + Ornate Frames
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PageShell from "./components/layout/PageShell";
import HomePage from "./pages/HomePage";
import GameListPage from "./pages/GameListPage";
import KnowledgeChallenger from "./pages/KnowledgeChallenger";
import GachaPage from "./pages/GachaPage";
import RankingPage from "./pages/RankingPage";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import MyPage from "./pages/MyPage";
import ResultPage from "./pages/ResultPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/games/knowledge-challenger" component={KnowledgeChallenger} />
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
            <Route path="/admin" component={AdminPage} />
            <Route>
              <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-lg font-bold gold-text">ページが見つかりません</p>
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
