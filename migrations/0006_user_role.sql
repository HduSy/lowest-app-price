-- users 表加 role 列：'user'（默认）| 'admin'
-- 用于区分普通用户和管理员，admin 可执行特殊操作（如 backfill、管理 App 等）
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
