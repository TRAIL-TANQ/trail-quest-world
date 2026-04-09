import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0b1128 100%)' }}>
      <div className="text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <h1 className="text-5xl font-bold mb-2 font-[var(--font-orbitron)]"
          style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.3)' }}>404</h1>
        <p className="text-amber-200/50 mb-6">このページは見つかりませんでした</p>
        <button onClick={() => navigate('/')} className="rpg-btn rpg-btn-gold px-8 py-3">
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
