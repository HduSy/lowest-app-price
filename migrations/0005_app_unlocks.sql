-- 每个 App 每日解锁记录
-- 配合 daily_views（全局配额计数）使用：
--   - daily_views: 每天总共能解锁几次（DAILY_VIEW_LIMIT=3）
--   - app_unlocks: 今天是否已解锁过某 App（解锁后当天再看此 App 不重复扣配额）
-- 语义：每天 3 次免费解锁机会，每个 App 每天只扣 1 次，3 次 = 3 个不同 App
CREATE TABLE IF NOT EXISTS app_unlocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  view_date TEXT NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  unlocked_at TEXT NOT NULL,        -- ISO 时间戳
  PRIMARY KEY (user_id, app_id, view_date)
);

-- 按用户+日期查今日已解锁的 App 集合
CREATE INDEX IF NOT EXISTS idx_app_unlocks_user_date ON app_unlocks(user_id, view_date);
