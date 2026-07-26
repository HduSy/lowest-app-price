-- 地区种子数据（与 src/lib/regions.ts 一致）
-- 35 个国家全部参与比价（已验证 pk/kz 等 App Store 均有 storefront）
-- 用 INSERT OR IGNORE 保证可重复执行；为新增国家做增量
INSERT OR IGNORE INTO regions (code, name, name_en, flag, currency, sort_order) VALUES
  -- 美洲
  ('us','美国','United States','🇺🇸','USD',1),
  ('ca','加拿大','Canada','🇨🇦','CAD',2),
  ('br','巴西','Brazil','🇧🇷','BRL',3),
  ('mx','墨西哥','Mexico','🇲🇽','MXN',4),
  ('ar','阿根廷','Argentina','🇦🇷','ARS',5),
  ('cl','智利','Chile','🇨🇱','CLP',6),
  ('co','哥伦比亚','Colombia','🇨🇴','COP',7),
  -- 欧洲
  ('gb','英国','United Kingdom','🇬🇧','GBP',10),
  ('de','德国','Germany','🇩🇪','EUR',11),
  ('fr','法国','France','🇫🇷','EUR',12),
  ('tr','土耳其','Türkiye','🇹🇷','TRY',13),
  ('no','挪威','Norway','🇳🇴','NOK',14),
  ('ch','瑞士','Switzerland','🇨🇭','CHF',15),
  ('dk','丹麦','Denmark','🇩🇰','DKK',16),
  ('il','以色列','Israel','🇮🇱','ILS',17),
  -- 中东 + 非洲
  ('ae','阿联酋','United Arab Emirates','🇦🇪','AED',20),
  ('sa','沙特','Saudi Arabia','🇸🇦','SAR',21),
  ('ng','尼日利亚','Nigeria','🇳🇬','NGN',22),
  ('za','南非','South Africa','🇿🇦','ZAR',23),
  ('eg','埃及','Egypt','🇪🇬','EGP',24),
  -- 亚太
  ('jp','日本','Japan','🇯🇵','JPY',30),
  ('kr','韩国','South Korea','🇰🇷','KRW',31),
  ('cn','中国大陆','China','🇨🇳','CNY',32),
  ('hk','香港','Hong Kong','🇭🇰','HKD',33),
  ('tw','台湾','Taiwan','🇹🇼','TWD',34),
  ('in','印度','India','🇮🇳','INR',35),
  ('id','印度尼西亚','Indonesia','🇮🇩','IDR',36),
  ('th','泰国','Thailand','🇹🇭','THB',37),
  ('vn','越南','Vietnam','🇻🇳','VND',38),
  ('ph','菲律宾','Philippines','🇵🇭','PHP',39),
  ('my','马来西亚','Malaysia','🇲🇾','MYR',40),
  ('sg','新加坡','Singapore','🇸🇬','SGD',41),
  ('pk','巴基斯坦','Pakistan','🇵🇰','PKR',42),
  ('kz','哈萨克斯坦','Kazakhstan','🇰🇿','KZT',43),
  -- 大洋洲
  ('au','澳大利亚','Australia','🇦🇺','AUD',50);
