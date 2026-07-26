-- 补充 5 个高价值欧洲独立定价区
-- 这 5 个区在 App Store 都有独立 storefront 且定价显著不同于 EUR 主区
--   - es/it/nl 用 EUR 但价格档位与 de/fr 不同
--   - pl 用 PLN（波兰兹罗提），价格洼地之一
--   - ru 用 RUB（俄罗斯卢布），经典价格洼地
-- 与 src/lib/regions.ts 同步；INSERT OR IGNORE 保证可重复执行
INSERT OR IGNORE INTO regions (code, name, name_en, flag, currency, sort_order) VALUES
  ('es', '西班牙',     'Spain',      '🇪🇸', 'EUR', 18),
  ('it', '意大利',     'Italy',      '🇮🇹', 'EUR', 19),
  ('nl', '荷兰',       'Netherlands','🇳🇱', 'EUR', 25),
  ('pl', '波兰',       'Poland',     '🇵🇱', 'PLN', 26),
  ('ru', '俄罗斯',     'Russia',     '🇷🇺', 'RUB', 29);
