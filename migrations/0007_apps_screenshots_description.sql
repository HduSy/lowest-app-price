-- apps 表加 screenshots + description 列
-- screenshots: App Store 截图 URL 数组（JSON 字符串）
-- description: App 完整长描述（iTunes API description 字段）
ALTER TABLE apps ADD COLUMN screenshots TEXT;
ALTER TABLE apps ADD COLUMN description TEXT;
