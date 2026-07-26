-- App 详情页补充信息：简介（subtitle）+ 价格摘要（price_label，如 "Free · In‑App Purchases"）
ALTER TABLE apps ADD COLUMN subtitle TEXT;
ALTER TABLE apps ADD COLUMN price_label TEXT;
