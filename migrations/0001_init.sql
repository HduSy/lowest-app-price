-- ============ 地区表 ============
CREATE TABLE IF NOT EXISTS regions (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  flag        TEXT NOT NULL,
  currency    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_regions_sort ON regions(sort_order);

-- ============ App 主表 ============
CREATE TABLE IF NOT EXISTS apps (
  app_id        TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  developer     TEXT,
  icon_url      TEXT,
  bundle_id     TEXT,
  -- App 分类与兼容性（来自 iTunes Lookup）
  category      TEXT,            -- 主分类 'Productivity' / 'Graphics & Design' 等
  genres        TEXT,            -- 完整分类 JSON 数组 ["Productivity","Utilities"]
  compatibility TEXT,            -- 兼容平台 JSON 数组 ["iPhone","iPad","Mac"]
  -- 状态
  last_fetched_at TEXT,          -- 最近一次 18 区价格抓取时间
  submitted_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apps_name ON apps(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_apps_submitted ON apps(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category);

-- ============ 价格表 ============
-- 每个 (app × region × iap) 只保留最新一条（覆盖更新）
CREATE TABLE IF NOT EXISTS prices (
  app_id        TEXT NOT NULL REFERENCES apps(app_id) ON DELETE CASCADE,
  region_code   TEXT NOT NULL REFERENCES regions(code),
  iap_key       TEXT NOT NULL,
  iap_name      TEXT NOT NULL,
  price_raw     TEXT NOT NULL,
  amount        REAL NOT NULL,
  currency      TEXT NOT NULL,
  amount_usd    REAL,
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (app_id, region_code, iap_key)
);
CREATE INDEX IF NOT EXISTS idx_prices_app ON prices(app_id);
CREATE INDEX IF NOT EXISTS idx_prices_fetched ON prices(fetched_at DESC);
