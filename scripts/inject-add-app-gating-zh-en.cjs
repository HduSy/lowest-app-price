// 幂等注入「添加 App 仅会员」改造所需的新 i18n key 到 messages/zh-CN.json 和 messages/en.json
// 已存在的 key 跳过，避免覆盖手工精修
const fs = require("fs");

const add = {
  "zh-CN": {
    AppsToolbar: {
      // 保留 loginRequired（仍可能在某些路径触发，作为兜底文案）
      // searchPlaceholder 文案微调，不再暗示「任何人都能添加」
      searchPlaceholderB: "搜索名称，或粘贴 App Store 链接 / ID（会员可添加）"
    },
    ExternalAppCard: {
      add: "添加",
      adding: "添加中",
      indexed: "已收录",
      developerUnknown: "未知开发者"
    },
    AppsList: {
      // 改成中性的「会员/登录」表述，单 key 不分 A/B
      addHintB: "点击「添加」会从 Apple 拉取该 App 信息并触发 40 区价格抓取，需要会员（登录即会员）。"
    }
  },
  "en": {
    AppsToolbar: {
      searchPlaceholderB: "Search by name, or paste App Store link / ID (members can add)"
    },
    ExternalAppCard: {
      add: "Add",
      adding: "Adding",
      indexed: "Indexed",
      developerUnknown: "Unknown developer"
    },
    AppsList: {
      addHintB: "Click \"Add\" to fetch from Apple and trigger 40-region price crawling. Members only (sign in to become a member)."
    }
  }
};

let changed = 0;
for (const [loc, namespaces] of Object.entries(add)) {
  const path = "messages/" + loc + ".json";
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  let locChanged = false;
  for (const [ns, keys] of Object.entries(namespaces)) {
    if (!data[ns]) data[ns] = {};
    for (const [k, v] of Object.entries(keys)) {
      if (data[ns][k] === undefined) {
        data[ns][k] = v;
        locChanged = true;
      }
    }
  }
  if (locChanged) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    changed++;
    console.log("[zh-CN/en inject] " + loc + " updated");
  } else {
    console.log("[zh-CN/en inject] " + loc + " skipped (idempotent)");
  }
}
console.log("done, " + changed + " files changed");
