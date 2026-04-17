/*
 * TRAIL QUEST WORLD - Royal Adventurer's Guild Aesthetic
 * Dark Navy (#0b1128) + Gold (#ffd700) + Ornate Frames
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PageShell from "./components/layout/PageShell";
import HomePage from "./pages/HomePage";
import AltGamesPage from "./pages/AltGamesPage";
import KeisanBattlePage from "./pages/KeisanBattlePage";
import HikakuBattlePage from "./pages/HikakuBattlePage";
import BunsuBattlePage from "./pages/BunsuBattlePage";
import ShousuuBattlePage from "./pages/ShousuuBattlePage";
import KanjiFlashPage from "./pages/KanjiFlashPage";
import YojijukugoPage from "./pages/YojijukugoPage";
import TodofukenTouchPage from "./pages/TodofukenTouchPage";
import KenchouQuizPage from "./pages/KenchouQuizPage";
import KnowledgeChallenger from "./pages/KnowledgeChallenger";
import StageSelectPage from "./pages/StageSelectPage";
import HallOfFamePage from "./pages/HallOfFamePage";
import GachaPage from "./pages/GachaPage";
import RankingPage from "./pages/RankingPage";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import MyPage from "./pages/MyPage";
import ResultPage from "./pages/ResultPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminStudentsPage from "./pages/admin/AdminStudentsPage";
import AdminStudentDetailPage from "./pages/admin/AdminStudentDetailPage";
import AdminDecksPage from "./pages/admin/AdminDecksPage";
import AdminCardsPage from "./pages/admin/AdminCardsPage";
import AdminAltGamesPage from "./pages/admin/AdminAltGamesPage";
import AdminPvPPage from "./pages/admin/AdminPvPPage";
import AdminTournamentsPage from "./pages/admin/AdminTournamentsPage";
import AdminTournamentDetailPage from "./pages/admin/AdminTournamentDetailPage";
import AdminGuard from "./components/admin/AdminGuard";
import TournamentJoinPage from "./pages/TournamentJoinPage";
import QuizPracticePage from "./pages/QuizPracticePage";
import QuestLearningUnitPage from "./pages/QuestLearningUnitPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";
import PvPSetupPage from "./pages/PvPSetupPage";
import PvPBattlePage from "./pages/PvPBattlePage";
import TimeAttackPage from "./pages/TimeAttackPage";

function Router() {
  return (
    <Switch>
      {/* === No nav: login & battle screens === */}
      <Route path="/login" component={LoginPage} />
      <Route path="/games/knowledge-challenger/pvp/battle"><PvPBattlePage /></Route>
      <Route path="/games/knowledge-challenger/pvp"><PvPSetupPage /></Route>
      <Route path="/games/knowledge-challenger/stage/:id"><KnowledgeChallenger /></Route>
      <Route path="/games/knowledge-challenger"><KnowledgeChallenger /></Route>

      {/* === All other screens: with Header + BottomNav === */}
      <Route>
        <PageShell>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/alt-games/keisan-battle" component={KeisanBattlePage} />
            <Route path="/alt-games/hikaku-battle" component={HikakuBattlePage} />
            <Route path="/alt-games/bunsu-battle" component={BunsuBattlePage} />
            <Route path="/alt-games/shousuu-battle" component={ShousuuBattlePage} />
            <Route path="/alt-games/kanji-flash" component={KanjiFlashPage} />
            <Route path="/alt-games/yojijukugo" component={YojijukugoPage} />
            <Route path="/alt-games/todofuken" component={TodofukenTouchPage} />
            <Route path="/alt-games/kenchou" component={KenchouQuizPage} />
            <Route path="/alt-games" component={AltGamesPage} />
            <Route path="/games/stages" component={StageSelectPage} />
            <Route path="/games/quiz/:deck/:difficulty" component={QuizPracticePage} />
            <Route path="/games/time-attack/play/:difficulty" component={TimeAttackPage} />
            <Route path="/games/time-attack" component={TimeAttackPage} />
            <Route path="/quest/:deckKey" component={QuestLearningUnitPage} />
            <Route path="/deck-builder" component={DeckBuilderPage} />
            <Route path="/result" component={ResultPage} />
            <Route path="/hall-of-fame" component={HallOfFamePage} />
            <Route path="/gacha" component={GachaPage} />
            <Route path="/ranking" component={RankingPage} />
            <Route path="/collection" component={CollectionPage} />
            <Route path="/shop" component={ShopPage} />
            <Route path="/mypage" component={MyPage} />
            {/* Legacy routes → redirect to unified deck select */}
            <Route path="/games/quest-board"><Redirect to="/games/knowledge-challenger?screen=deck_select" /></Route>
            <Route path="/quest"><Redirect to="/games/knowledge-challenger?screen=deck_select" /></Route>
            <Route path="/games"><Redirect to="/alt-games" /></Route>
            {/* 管理者ダッシュボード（isAdmin=trueのみ、非管理者はホームへ） */}
            <Route path="/admin" component={AdminDashboardPage} />
            <Route path="/admin/students/:childId" component={AdminStudentDetailPage} />
            <Route path="/admin/students" component={AdminStudentsPage} />
            <Route path="/admin/decks" component={AdminDecksPage} />
            <Route path="/admin/cards" component={AdminCardsPage} />
            <Route path="/admin/alt-games" component={AdminAltGamesPage} />
            <Route path="/admin/pvp" component={AdminPvPPage} />
            <Route path="/admin/tournaments/:id" component={AdminTournamentDetailPage} />
            <Route path="/admin/tournaments" component={AdminTournamentsPage} />
            <Route path="/admin/shop-order">
              <AdminGuard><AdminPage /></AdminGuard>
            </Route>
            {/* 生徒: 大会参加 */}
            <Route path="/tournament/join" component={TournamentJoinPage} />
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
