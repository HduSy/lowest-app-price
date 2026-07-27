-- Magic Link 邮箱登录：一次性 token 表
-- 流程：用户输入邮箱 → 后端生成 token 入库 + 发邮件 → 用户点邮件链接 → 后端验 token 并登入
-- 安全要点：
--   1. token 列存 SHA-256 哈希（不存明文，DB 脱库后 token 仍不可用）
--   2. expires_at 15 分钟过期
--   3. used_at 标记消费后不可复用
--   4. email 列明文以便 upsert user，但 token_hash 不依赖 email
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id           TEXT PRIMARY KEY,         -- uuid
  email        TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,     -- sha256(raw_token) hex
  expires_at   TEXT NOT NULL,            -- ISO datetime
  used_at      TEXT,                     -- NULL = 未使用
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  ip           TEXT                      -- 请求来源 IP（限流/审计用）
);

-- 按邮箱查未过期的近期 token（限流：60s 内不允许重复请求）
CREATE INDEX IF NOT EXISTS idx_mlt_email_created ON magic_link_tokens(email, created_at);

-- 按哈希查（验证路径）
CREATE INDEX IF NOT EXISTS idx_mlt_token_hash ON magic_link_tokens(token_hash);
