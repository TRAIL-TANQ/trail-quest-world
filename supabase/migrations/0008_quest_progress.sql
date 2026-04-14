-- Quest Progress: deck-based quiz progress tracking
CREATE TABLE IF NOT EXISTS quest_progress (
  child_id   TEXT NOT NULL,
  category   TEXT NOT NULL,  -- 'napoleon','amazon','qinshi','galileo','jeanne','murasaki'
  difficulty TEXT NOT NULL,  -- 'beginner','challenger','master','legend'
  correct_count INTEGER NOT NULL DEFAULT 0,
  cleared    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, category, difficulty)
);

-- Index for fast lookup by child
CREATE INDEX IF NOT EXISTS idx_quest_progress_child ON quest_progress(child_id);

-- RLS
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quest_progress_select" ON quest_progress
  FOR SELECT USING (TRUE);

CREATE POLICY "quest_progress_insert" ON quest_progress
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "quest_progress_update" ON quest_progress
  FOR UPDATE USING (TRUE);
