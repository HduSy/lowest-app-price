-- 迁移支付商 Stripe -> Paddle：加 Paddle 交易/客户字段
-- 保留老 stripe_session_id / stripe_customer_id 列以兼容历史购买记录
-- 新购买记录走 paddle_transaction_id / paddle_customer_id

ALTER TABLE purchases ADD COLUMN paddle_transaction_id TEXT;
ALTER TABLE purchases ADD COLUMN paddle_customer_id TEXT;

-- 幂等去重索引（partial unique index：仅非 NULL 行参与，避免老 Stripe 记录 NULL 冲突）
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_paddle_transaction
  ON purchases(paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL;
