from playwright.sync_api import sync_playwright
import time
import json
import os
from datetime import datetime

LSTEP_URL = "https://manager.linestep.net/account/login"
EMAIL = "ssin0201"
PASSWORD = "ssin020144"
BASE_URL = "https://manager.linestep.net"
PROGRESS_FILE = "/Users/shou/.salonboard_dashboard/conversion_progress.json"
RESULT_FILE = "/Users/shou/.salonboard_dashboard/conversion_all_results.json"

CAMPAIGNS = [
    {"id": "2510906292", "title": "タイトルなし",            "date": "2026-03-15", "total": 459,  "open_rate": 35.5},
    {"id": "2500398244", "title": "第一印象は見た目が9割",   "date": "2026-03-07", "total": 178,  "open_rate": 59.6},
    {"id": "2482640539", "title": "2月3月限定クーポン",      "date": "2026-02-24", "total": 315,  "open_rate": None},
    {"id": "2464562025", "title": "バレンタイン限定クーポン", "date": "2026-02-11", "total": 67,   "open_rate": 41.8},
]

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_progress(progress):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

def login(page):
    page.goto(LSTEP_URL, wait_until="load", timeout=60000)
    page.fill("input[name='name']", EMAIL)
    page.fill("input[name='password']", PASSWORD)
    print(">>> ブラウザで「私はロボットではありません」にチェックしてください（60秒）")
    for i in range(60, 0, -10):
        print(f"  あと{i}秒...")
        time.sleep(10)
    btn = page.query_selector("button[type='submit'], input[type='submit']")
    if btn:
        btn.click()
    else:
        page.keyboard.press("Enter")
    time.sleep(5)
    print(f"ログイン完了: {page.url}\n")

def get_friend_reservation(page, friend_url):
    try:
        page.goto(f"{BASE_URL}{friend_url}", wait_until="load", timeout=20000)
        time.sleep(0.8)
        spshi = page.query_selector("a:has-text('スプシで取得')")
        if not spshi:
            return {}
        spshi.click()
        time.sleep(0.8)

        import re
        body = page.inner_html("body")
        data = {}
        for field in ["次回予約日", "最終来店日", "来店回数"]:
            pattern = rf'{field}.*?value="([^"]*)"'
            match = re.search(pattern, body, re.DOTALL)
            if match:
                data[field] = match.group(1)
        return data
    except Exception as e:
        return {"error": str(e)}

def get_all_recipients(page, campaign_id):
    recipients = []
    page_num = 1
    while True:
        url = f"{BASE_URL}/magazine/sendlogs/{campaign_id}?page={page_num}"
        page.goto(url, wait_until="load", timeout=20000)
        time.sleep(1)
        found = 0
        seen_urls = {r["url"] for r in recipients}
        for row in page.query_selector_all("table tr"):
            link = row.query_selector("a[href*='/line/detail/']")
            if link:
                href = link.get_attribute("href")
                name = link.inner_text().strip()
                if href and href not in seen_urls:
                    recipients.append({"name": name, "url": href})
                    seen_urls.add(href)
                    found += 1
        print(f"  ページ{page_num}: {found}人（累計{len(recipients)}人）")
        next_btn = page.query_selector("a[rel='next'], li.next:not(.disabled) a")
        if not next_btn or found == 0:
            break
        page_num += 1
        if page_num > 50:
            break
    return recipients

def main():
    progress = load_progress()
    all_results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        for campaign in CAMPAIGNS:
            cid = campaign["id"]
            campaign_date = datetime.strptime(campaign["date"], "%Y-%m-%d")

            print(f"\n{'='*55}")
            print(f"配信: {campaign['title']} ({campaign['date']}, {campaign['total']}人)")
            print(f"{'='*55}")

            # 受信者リスト取得（キャッシュあれば使う）
            if cid in progress and "recipients" in progress[cid]:
                recipients = progress[cid]["recipients"]
                print(f"受信者キャッシュ使用: {len(recipients)}人")
            else:
                print("受信者リスト取得中...")
                recipients = get_all_recipients(page, cid)
                if cid not in progress:
                    progress[cid] = {}
                progress[cid]["recipients"] = recipients
                save_progress(progress)

            # 処理済みの友だちをスキップ
            done = progress.get(cid, {}).get("done", {})
            details = list(done.values())

            print(f"処理済み: {len(done)}人 / 残り: {len(recipients) - len(done)}人")

            for i, recipient in enumerate(recipients):
                url = recipient["url"]
                if url in done:
                    continue

                print(f"  [{i+1}/{len(recipients)}] {recipient['name'] or '(名前なし)'}...", end="", flush=True)
                res = get_friend_reservation(page, url)

                converted_reservation = False
                converted_visit = False

                next_date_str = res.get("次回予約日", "")
                last_visit_str = res.get("最終来店日", "")

                if next_date_str and next_date_str != "0":
                    try:
                        if datetime.strptime(next_date_str, "%Y-%m-%d") >= campaign_date:
                            converted_reservation = True
                    except:
                        pass

                if last_visit_str and last_visit_str != "0":
                    try:
                        if datetime.strptime(last_visit_str, "%Y-%m-%d") >= campaign_date:
                            converted_visit = True
                    except:
                        pass

                status = ("✓予約" if converted_reservation else "") + ("✓来店" if converted_visit else "") or "－"
                print(f" {status} | 予約:{next_date_str} 来店:{last_visit_str}")

                detail = {
                    "name": recipient["name"],
                    "url": url,
                    "次回予約日": next_date_str,
                    "最終来店日": last_visit_str,
                    "来店回数": res.get("来店回数", ""),
                    "converted_reservation": converted_reservation,
                    "converted_visit": converted_visit,
                }
                done[url] = detail
                details.append(detail)

                # 10人ごとに保存
                if i % 10 == 0:
                    progress[cid]["done"] = done
                    save_progress(progress)

            progress[cid]["done"] = done
            save_progress(progress)

            # 集計
            total = len(details)
            res_count = sum(1 for d in details if d["converted_reservation"])
            visit_count = sum(1 for d in details if d["converted_visit"])

            result = {
                "campaign": campaign,
                "total_processed": total,
                "reservation_count": res_count,
                "visit_count": visit_count,
                "reservation_rate": round(res_count / total * 100, 1) if total > 0 else 0,
                "visit_rate": round(visit_count / total * 100, 1) if total > 0 else 0,
                "details": details,
            }
            all_results.append(result)

            print(f"\n【{campaign['title']}】")
            print(f"  対象: {total}人")
            print(f"  予約転換: {res_count}人 ({result['reservation_rate']}%)")
            print(f"  来店転換: {visit_count}人 ({result['visit_rate']}%)")

        # 最終結果保存
        with open(RESULT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"\n保存完了: {RESULT_FILE}")

        print("\n" + "="*65)
        print("【全配信 転換率サマリー（全受信者対象）】")
        print(f"{'配信タイトル':<26} {'配信日':<12} {'対象':>5} {'開封率':>7} {'予約転換率':>9} {'来店転換率':>9}")
        print("-"*70)
        for r in all_results:
            c = r["campaign"]
            open_r = f"{c['open_rate']}%" if c['open_rate'] else "  -  "
            print(f"{c['title']:<26} {c['date']:<12} {r['total_processed']:>5} {open_r:>7} {r['reservation_rate']:>8}% {r['visit_rate']:>8}%")

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    main()
