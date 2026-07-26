-- 删除 apps.description 和 apps.screenshots 列
-- 原因：详情页不再展示 App 描述和截图（App Store 链接已在页面提供，避免内容镜像与 SEO 重复）
-- 爬虫与 iTunes Lookup 不再抓取/存储这两类字段；列本身无用，一并清理
-- 注意：iTunes 原始响应里的 screenshotUrls / ipadScreenshotUrls / macScreenshotUrls 仍在 inferCompatibility 中
--       作为 supportedDevices 为空时的平台兜底，**不存 DB**，仅在 mapResult 内部消费
ALTER TABLE apps DROP COLUMN description;
ALTER TABLE apps DROP COLUMN screenshots;
