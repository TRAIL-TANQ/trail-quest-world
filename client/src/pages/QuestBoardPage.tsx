/**
 * QuestBoardPage - ジャンル選択画面
 * 4ジャンルの中からクイズを選んでQuizPracticePageへ遷移
 */
import { Link } from 'wouter';
import { ALL_BATTLE_CARDS, CATEGORY_INFO, type CardCategory } from '@/lib/knowledgeCards';

const GENRES: { key: string; category: CardCategory; emoji: string; label: string; color: string }[] = [
  { key: 'great-person', category: 'great_person', emoji: '👑', label: '偉人クエスト', color: '#f59e0b' },
  { key: 'creature', category: 'creature', emoji: '🐟', label: '生き物クエスト', color: '#22c55e' },
  { key: 'heritage', category: 'heritage', emoji: '🏛️', label: '世界遺産クエスト', color: '#8b5cf6' },
  { key: 'invention', category: 'invention', emoji: '🔬', label: '科学発明クエスト', color: '#3b82f6' },
];

function countQuizCards(category: CardCategory): number {
  return ALL_BATTLE_CARDS.filter(
    (c) => c.category === category && c.quizzes.length > 0,
  ).length;
}

export default function QuestBoardPage() {
  return (
    <div className="relative min-h-full px-4 pt-6 pb-24" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
      <div className="text-center mb-6">
        <span className="text-4xl block mb-2">📚</span>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
          クエストボード
        </h1>
        <p className="text-amber-200/50 text-xs">カードのクイズで腕試し！正解するとALTがもらえるよ</p>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        {GENRES.map((g) => {
          const count = countQuizCards(g.category);
          return (
            <Link key={g.key} href={`/games/quiz/${g.key}`}>
              <button
                className="w-full rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                  border: `2px solid ${g.color}35`,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.3), inset 0 0 24px ${g.color}06`,
                }}
              >
                <div className="flex items-center p-4 gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${g.color}25, ${g.color}08)`,
                      border: `1.5px solid ${g.color}50`,
                      boxShadow: `0 0 12px ${g.color}15`,
                    }}
                  >
                    {g.emoji}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="text-base font-bold text-amber-100 mb-0.5">{g.label}</h3>
                    <p className="text-[11px] text-amber-200/40">カード{count}枚のクイズから出題</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${g.color}20`, border: `1.5px solid ${g.color}40` }}>
                      <span className="text-sm" style={{ color: g.color }}>▶</span>
                    </div>
                  </div>
                </div>
              </button>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 max-w-sm mx-auto">
        <Link href="/games">
          <button className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2 block w-full text-center">
            ← ゲーム一覧へ戻る
          </button>
        </Link>
      </div>
    </div>
  );
}
