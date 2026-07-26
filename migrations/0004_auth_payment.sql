-- 用户、购买、每日查看配额 + prices 订阅周期识别
-- 用于：登录功能（Google/X/GitHub OAuth）+ $1.99 买断 + 每日 3 次免费查看限流

-- 用户表（OAuth 登录用户）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- 内部 uuid
  email TEXT,                       -- OAuth 提供的 email（GitHub 私邮箱可能为 null）
  name TEXT,
  image TEXT,
  oauth_provider TEXT NOT NULL,     -- 'google' | 'twitter' | 'github'
  oauth_account_id TEXT NOT NULL,   -- OAuth 提供商的用户 id
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_account_id)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider_account ON users(oauth_provider, oauth_account_id);

-- 购买记录（$1.99 一次性买断）
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,              -- 内部 uuid
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,    -- Stripe Checkout Session id
  stripe_customer_id TEXT,          -- Stripe Customer id
  amount_cents INTEGER NOT NULL,    -- 199 = $1.99
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,             -- 'paid' | 'refunded'
  purchased_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

-- 每日查看配额（登录未付费用户，每天 3 次免费查看完整价格）
CREATE TABLE IF NOT EXISTS daily_views (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_date TEXT NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, view_date)
);

-- prices 加订阅周期列（用于套餐识别：monthly/yearly/weekly/lifetime/one_time/NULL）
ALTER TABLE prices ADD COLUMN period TEXT;
