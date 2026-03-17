import json
import csv

RESULT_FILE = "/Users/shou/.salonboard_dashboard/conversion_all_results.json"
CSV_FILE = "/Users/shou/.salonboard_dashboard/lstep_転換率レポート.csv"

with open(RESULT_FILE, "r", encoding="utf-8") as f:
    results = json.load(f)

with open(CSV_FILE, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)

    # ヘッダー
    writer.writerow([
        "配信タイトル", "配信日", "配信数(人)",
        "開封率(%)", "開封数(人)",
        "予約転換数(人)", "予約転換率(%)",
        "来店転換数(人)", "来店転換率(%)"
    ])

    # データ行
    for r in results:
        c = r["campaign"]
        total = c["total"]
        open_rate = c.get("open_rate", "")
        open_count = round(total * open_rate / 100) if open_rate else ""

        writer.writerow([
            c["title"],
            c["date"],
            total,
            open_rate,
            open_count,
            r["reservation_count"],
            r["reservation_rate"],
            r["visit_count"],
            r["visit_rate"],
        ])

print(f"✅ CSV出力完了: {CSV_FILE}")
