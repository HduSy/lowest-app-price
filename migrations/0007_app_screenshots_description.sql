-- App 详情页补充信息：截图（screenshots）+ 完整描述（description）
-- screenshots 存 JSON 字符串数组（mzstatic 图片 URL），读取时解析
-- description 是 App Store 详情页的完整长描述（数千字符）
ALTER TABLE apps ADD COLUMN screenshots TEXT;
ALTER TABLE apps ADD COLUMN description TEXT;
