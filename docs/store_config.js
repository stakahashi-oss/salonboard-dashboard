// ═══════════════════════════════════════════════════════
//  SSIN 店舗設定マスター — ここだけ編集すれば全画面に反映
//  新店舗追加: SSIN_STORES に1行追加するだけ
// ═══════════════════════════════════════════════════════
const SSIN_STORES = [
  {
    code:     "fujisawa",
    name:     "SSIN STUDIO 藤沢",
    gasUrl:   "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec",
    lineId:   "@027qvfqz"
  },
  {
    code:     "sapporo",
    name:     "SSIN STUDIO 札幌",
    gasUrl:   "https://script.google.com/macros/s/AKfycbzJRbpPVo1-bUa1ruOSADhf6ZJyGYWIiSwy98VxUlLDnqC7JxywP29iPgzn43r1aMGp/exec",
    lineId:   "@552calus"
  }
  // 新店舗追加例:
  // { code: "kumamoto", name: "SSIN STUDIO 熊本", gasUrl: "https://...", lineId: "@xxx" },
];

// ── 以下は自動生成（編集不要）──────────────────────────
const SSIN_STORE_BY_CODE = {};   // code → store object
const SSIN_STORE_BY_NAME = {};   // name → store object
const SSIN_GAS_BY_CODE   = {};   // code → gasUrl
const SSIN_GAS_BY_NAME   = {};   // name → gasUrl
const SSIN_NAME_BY_CODE  = {};   // code → name
const SSIN_DEFAULT_GAS   = SSIN_STORES[0].gasUrl;

SSIN_STORES.forEach(function(s) {
  SSIN_STORE_BY_CODE[s.code] = s;
  SSIN_STORE_BY_NAME[s.name] = s;
  SSIN_GAS_BY_CODE[s.code]   = s.gasUrl;
  SSIN_GAS_BY_NAME[s.name]   = s.gasUrl;
  SSIN_NAME_BY_CODE[s.code]  = s.name;
});
