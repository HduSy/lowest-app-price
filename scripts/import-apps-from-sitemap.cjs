// 从 sitemap.xml 提取 appId，本地调 iTunes Lookup（绕开 CF Workers 上 itunes.apple.com 403），
// 生成 SQL 文件，再用 `wrangler d1 execute lowest-app-price --remote --file=...` 灌入远程 D1。
//
// 用法:
//   node scripts/import-apps-from-sitemap.cjs                          # 全量（从 sitemap）
//   node scripts/import-apps-from-sitemap.cjs --limit=5                # 小批量验证
//   node scripts/import-apps-from-sitemap.cjs --offset=100 --limit=200 # 分段
//   node scripts/import-apps-from-sitemap.cjs --out=/tmp/x.sql         # 自定义输出路径
//   node scripts/import-apps-from-sitemap.cjs --ids-file=/tmp/failed.txt --out=/tmp/retry.sql  # 重试失败列表
//
// 幂等：生成的 SQL 用 INSERT OR IGNORE，重复 app_id 不会报错也不会覆盖已有数据。
// 失败追踪：未命中的 appId 写到 {out 同名}.failed.txt，可直接喂给 --ids-file 重试。
// 缓存：sitemap 优先读 /tmp/appstoreprice-sitemap.xml（已由 curl 预拉），缺失则现场 fetch。

const fs = require("fs");

const SITEMAP_URL = "https://appstoreprice.org/sitemap.xml";
const SITEMAP_CACHE = "/tmp/appstoreprice-sitemap.xml";
const ITUNES_BATCH = 10; // iTunes Lookup 单次最多 10 个 id
const BATCH_SLEEP_MS = 300; // 批间节流，QPS ≈ 10-15

const ITUNES_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ---------- sitemap ----------

function extractAppIds(xml) {
  // 匹配 /apps/{id}、/{locale}/apps/{id} 等，不绑定特定站点
  const matches = [...xml.matchAll(/\/apps\/(\d+)/gi)];
  return [...new Set(matches.map((m) => m[1]))];
}

async function loadSitemap() {
  if (fs.existsSync(SITEMAP_CACHE)) {
    const xml = fs.readFileSync(SITEMAP_CACHE, "utf8");
    console.log(`[sitemap] 从缓存加载: ${SITEMAP_CACHE} (${xml.length} bytes)`);
    return xml;
  }
  console.log(`[sitemap] 拉取 ${SITEMAP_URL} ...`);
  const resp = await fetch(SITEMAP_URL);
  if (!resp.ok) throw new Error(`fetch sitemap: HTTP ${resp.status}`);
  const xml = await resp.text();
  fs.writeFileSync(SITEMAP_CACHE, xml);
  console.log(`[sitemap] 缓存到 ${SITEMAP_CACHE} (${xml.length} bytes)`);
  return xml;
}

// ---------- iTunes Lookup（与 src/lib/itunes.ts mapResult 对齐） ----------

function upscaleIconUrl(url, size) {
  return url ? url.replace(/100x100|60x60/, size) : "";
}

function inferCompatibility(r) {
  const platforms = new Set();
  if (Array.isArray(r.supportedDevices)) {
    for (const d of r.supportedDevices) {
      if (/^iPhone/i.test(d)) platforms.add("iPhone");
      else if (/^iPad/i.test(d)) platforms.add("iPad");
      else if (/^Mac/i.test(d)) platforms.add("Mac");
      else if (/^AppleTV/i.test(d)) platforms.add("Apple TV");
      else if (/^Watch/i.test(d)) platforms.add("Apple Watch");
    }
  }
  if (platforms.size === 0) {
    if (r.screenshotUrls?.length) platforms.add("iPhone");
    if (r.ipadScreenshotUrls?.length) platforms.add("iPad");
    if (r.macScreenshotUrls?.length) platforms.add("Mac");
  }
  return [...platforms];
}

function mapResult(r) {
  return {
    app_id: String(r.trackId ?? ""),
    name: r.trackName ?? null,
    developer: r.artistName ?? null,
    icon_url: upscaleIconUrl(r.artworkUrl100 || r.artworkUrl60 || "", "200x200") || null,
    bundle_id: r.bundleId ?? null,
    category: r.primaryGenreName ?? null,
    genres: Array.isArray(r.genres) ? r.genres : null,
    compatibility: inferCompatibility(r),
    rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
    rating_count: typeof r.userRatingCount === "number" ? r.userRatingCount : null,
  };
}

async function fetchBatch(ids) {
  const url = `https://itunes.apple.com/lookup?id=${ids.join(",")}&country=us`;
  const resp = await fetch(url, { headers: ITUNES_HEADERS });
  if (!resp.ok) throw new Error(`iTunes Lookup HTTP ${resp.status}`);
  const data = await resp.json();
  return data.results || [];
}

// ---------- SQL 生成 ----------

function sqlStr(s) {
  if (s === null || s === undefined || s === "") return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "NULL";
  return String(n);
}

function sqlJsonArr(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "NULL";
  return sqlStr(JSON.stringify(arr));
}

function insertSql(app) {
  return (
    `INSERT OR IGNORE INTO apps ` +
    `(app_id, name, developer, icon_url, bundle_id, category, genres, compatibility, ` +
    `subtitle, price_label, rating, rating_count, submitted_at, updated_at) ` +
    `VALUES (${sqlStr(app.app_id)}, ${sqlStr(app.name)}, ${sqlStr(app.developer)}, ` +
    `${sqlStr(app.icon_url)}, ${sqlStr(app.bundle_id)}, ${sqlStr(app.category)}, ` +
    `${sqlJsonArr(app.genres)}, ${sqlJsonArr(app.compatibility)}, NULL, NULL, ` +
    `${sqlNum(app.rating)}, ${sqlNum(app.rating_count)}, datetime('now'), datetime('now'));`
  );
}

// ---------- main ----------

function parseArg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : undefined;
}

async function main() {
  const limit = parseArg("limit") ? parseInt(parseArg("limit"), 10) : Infinity;
  const offset = parseArg("offset") ? parseInt(parseArg("offset"), 10) : 0;
  const outFile = parseArg("out") || "/tmp/import-apps.sql";
  const idsFile = parseArg("ids-file");

  // ID 来源：--ids-file 优先（重试场景），否则从 sitemap 提取
  let allIds;
  if (idsFile) {
    if (!fs.existsSync(idsFile)) {
      throw new Error(`--ids-file 指定的文件不存在: ${idsFile}`);
    }
    const raw = fs.readFileSync(idsFile, "utf8");
    allIds = [
      ...new Set(
        raw
          .split(/\s+/)
          .map((s) => s.trim())
          .filter((s) => /^\d+$/.test(s))
      ),
    ];
    console.log(`[ids-file] 从 ${idsFile} 加载 ${allIds.length} 个 appId`);
  } else {
    const xml = await loadSitemap();
    allIds = extractAppIds(xml);
    console.log(`[sitemap] 去重后 ${allIds.length} 个 appId`);
  }

  const batch = allIds.slice(offset, offset + limit);
  console.log(
    `[lookup] 处理 ${batch.length} 个 (offset=${offset}, limit=${limit === Infinity ? "∞" : limit})`
  );

  const apps = [];
  const failedIds = []; // 未命中的 appId，写到文件供重试
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < batch.length; i += ITUNES_BATCH) {
    const sub = batch.slice(i, i + ITUNES_BATCH);
    try {
      const results = await fetchBatch(sub);
      const map = {};
      for (const r of results) {
        const id = String(r.trackId ?? "");
        if (id) map[id] = mapResult(r);
      }
      for (const id of sub) {
        const m = map[id];
        if (m && m.name) {
          apps.push(m);
          found++;
        } else {
          notFound++;
          failedIds.push(id);
        }
      }
    } catch (e) {
      console.error(`[lookup] 批次 i=${i} 失败: ${e.message}`);
      notFound += sub.length;
      failedIds.push(...sub);
    }

    if (i + ITUNES_BATCH < batch.length) {
      await new Promise((r) => setTimeout(r, BATCH_SLEEP_MS));
    }

    const done = Math.min(i + ITUNES_BATCH, batch.length);
    if (done % 500 < ITUNES_BATCH || done === batch.length) {
      console.log(`[lookup] ${done}/${batch.length} (found=${found}, notFound=${notFound})`);
    }
  }

  // 注意：不包裹 BEGIN/COMMIT —— D1 (wrangler --file) 不允许显式事务语句，
  // 每条 INSERT 独立执行；INSERT OR IGNORE 保证幂等，单条失败不影响其他。
  const lines = [
    "-- Auto-generated by scripts/import-apps-from-sitemap.cjs",
    `-- Source: ${idsFile || SITEMAP_URL}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Apps: ${apps.length} (found=${found}, notFound=${notFound})`,
    ...apps.map(insertSql),
  ];
  fs.writeFileSync(outFile, lines.join("\n"));
  console.log(
    `[sql] 写入 ${apps.length} 条 INSERT 到 ${outFile} (${fs.statSync(outFile).size} bytes)`
  );

  // 写失败列表，可直接喂给 --ids-file 重试
  const failedFile = outFile.replace(/\.sql$/, ".failed.txt");
  if (failedIds.length > 0) {
    fs.writeFileSync(failedFile, failedIds.join("\n") + "\n");
    console.log(`[failed] ${failedIds.length} 个未命中 appId 写到 ${failedFile}`);
  }
  console.log(`[done] found=${found} notFound=${notFound} total=${batch.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
