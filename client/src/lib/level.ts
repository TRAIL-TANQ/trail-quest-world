interface LevelEntry {
  level: number;
  requiredAlt: number;
  title: string;
}

export const LEVEL_TABLE: LevelEntry[] = [
  { level: 1,  requiredAlt: 0,      title: 'はじまりの探究者' },
  { level: 2,  requiredAlt: 100,    title: 'かけだし冒険者' },
  { level: 3,  requiredAlt: 300,    title: '見習いクエスター' },
  { level: 4,  requiredAlt: 500,    title: 'ひとなみの探究者' },
  { level: 5,  requiredAlt: 800,    title: '一人前の探究者' },
  { level: 7,  requiredAlt: 1500,   title: '腕利きの探究者' },
  { level: 10, requiredAlt: 2500,   title: '探究マスター' },
  { level: 15, requiredAlt: 5000,   title: '伝説の探究者' },
  { level: 20, requiredAlt: 10000,  title: 'QUEST KING' },
  { level: 25, requiredAlt: 20000,  title: '探究の神' },
];

export function calculateLevel(totalAlt: number) {
  let current = LEVEL_TABLE[0];
  for (const entry of LEVEL_TABLE) {
    if (totalAlt >= entry.requiredAlt) {
      current = entry;
    } else break;
  }
  const nextIdx = LEVEL_TABLE.findIndex((e) => e.level === current.level) + 1;
  const nextLevelAlt = nextIdx < LEVEL_TABLE.length ? LEVEL_TABLE[nextIdx].requiredAlt : null;
  const progress = nextLevelAlt
    ? (totalAlt - current.requiredAlt) / (nextLevelAlt - current.requiredAlt)
    : 1;
  return {
    ...current,
    nextLevelAlt,
    progress: Math.min(Math.max(progress, 0), 1),
  };
}
