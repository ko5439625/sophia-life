"""
Discord webhook 알림
"""
import json
import urllib.request
from config import DISCORD_WEBHOOK_URL


def send_discord(embeds: list[dict]):
    """Discord webhook으로 embed 전송"""
    if not DISCORD_WEBHOOK_URL:
        print("  ⚠️ Discord webhook URL 미설정, 알림 스킵")
        return

    data = json.dumps({"embeds": embeds[:10]}).encode("utf-8")  # max 10 embeds
    req = urllib.request.Request(
        DISCORD_WEBHOOK_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        print(f"  📨 Discord 알림 전송 ({len(embeds)}건)")
    except Exception as e:
        print(f"  ❌ Discord 알림 실패: {e}")


def format_price(price_man: int) -> str:
    """만원 → 억원 표시"""
    if price_man >= 10000:
        eok = price_man // 10000
        rest = price_man % 10000
        if rest > 0:
            return f"{eok}억 {rest:,}"
        return f"{eok}억"
    return f"{price_man:,}만"


def notify_new_listings(filter_name: str, listings: list[dict]):
    """새 매물 알림"""
    if not listings:
        return

    embeds = []
    for item in listings[:5]:  # 최대 5건
        area = item.get("area_pyeong", 0)
        floor = item.get("floor_info", "")
        direction = item.get("direction", "")
        desc = item.get("description", "")[:80]
        url = item.get("detail_url", "")

        embed = {
            "title": f"🏠 새 매물! ({filter_name})",
            "color": 0x00704A,  # green
            "fields": [
                {"name": "📍 단지", "value": item.get("complex_name", "?"), "inline": True},
                {"name": "💰 가격", "value": format_price(item.get("price_man", 0)), "inline": True},
                {"name": "📐 면적", "value": f"{area}평" if area else "?", "inline": True},
            ],
        }
        if floor:
            embed["fields"].append({"name": "🏢 층", "value": floor, "inline": True})
        if direction:
            embed["fields"].append({"name": "🧭 향", "value": direction, "inline": True})
        if desc:
            embed["description"] = desc
        if url:
            embed["url"] = url

        embeds.append(embed)

    if len(listings) > 5:
        embeds.append({
            "description": f"... 외 {len(listings) - 5}건 더",
            "color": 0x6B7280,
        })

    send_discord(embeds)


def notify_price_changes(filter_name: str, changes: list[dict]):
    """가격 변동 알림"""
    if not changes:
        return

    embeds = []
    for item in changes[:5]:
        old_p = item.get("old_price_man", 0)
        new_p = item.get("price_man", 0)
        diff = new_p - old_p
        arrow = "📈" if diff > 0 else "📉"

        embed = {
            "title": f"{arrow} 가격 변동! ({filter_name})",
            "color": 0xEF4444 if diff > 0 else 0x3B82F6,
            "fields": [
                {"name": "📍 단지", "value": item.get("complex_name", "?"), "inline": True},
                {"name": "💰 변동", "value": f"{format_price(old_p)} → {format_price(new_p)}", "inline": True},
                {"name": "차이", "value": f"{'▲' if diff > 0 else '▼'}{format_price(abs(diff))}", "inline": True},
            ],
        }
        embeds.append(embed)

    send_discord(embeds)


def notify_removed(filter_name: str, removed: list[dict]):
    """매물 삭제 알림"""
    if not removed:
        return

    names = [f"- {r['complex_name']} ({format_price(r['price_man'])})" for r in removed[:10]]
    embed = {
        "title": f"🔴 매물 내려감 ({filter_name})",
        "description": "\n".join(names),
        "color": 0x6B7280,
    }
    send_discord([embed])
