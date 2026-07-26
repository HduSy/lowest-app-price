-- 0008: App 评分 + 评分人数（用于列表排序）
-- rating: averageUserRating from iTunes Lookup (0~5 stars)
-- rating_count: userRatingCount from iTunes Lookup (proxy for popularity/downloads)
ALTER TABLE apps ADD COLUMN rating REAL;
ALTER TABLE apps ADD COLUMN rating_count INTEGER;
CREATE INDEX IF NOT EXISTS idx_apps_rating_count ON apps(rating_count DESC);
