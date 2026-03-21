"""
Diff 엔진: 신규/변경/삭제 매물 감지 + DB 저장
"""
from datetime import datetime
from supabase import Client


def process_crawled_data(
    supabase: Client,
    filter_id: str,
    crawled_articles: list[dict],
) -> dict:
    """
    크롤링된 매물과 DB 비교 → 신규/변경/삭제 감지

    Returns: { "new": [...], "changed": [...], "removed": [...] }
    """
    result = {"new": [], "changed": [], "removed": []}

    # DB에서 이 필터의 기존 active 매물 가져오기
    existing_resp = supabase.table("re_listings").select("*").eq(
        "filter_id", filter_id
    ).eq("status", "active").execute()
    existing = {row["naver_article_id"]: row for row in (existing_resp.data or [])}

    crawled_ids = set()
    now = datetime.utcnow().isoformat()

    for article in crawled_articles:
        article_id = article["naver_article_id"]
        if not article_id:
            continue
        crawled_ids.add(article_id)

        if article_id in existing:
            # 기존 매물 → 가격 변동 체크
            db_row = existing[article_id]
            # address/build_year/trade_type 보완 (항상 최신 데이터로 업데이트)
            extra_update = {}
            if article.get("address"):
                extra_update["address"] = article["address"]
            if article.get("build_year"):
                extra_update["build_year"] = article["build_year"]
            # trade_type은 DB 컬럼 추가 후 활성화
            # if not db_row.get("trade_type") and article.get("trade_type"):
            #     extra_update["trade_type"] = article["trade_type"]

            if article["price_man"] != db_row["price_man"] and article["price_man"] > 0:
                # 가격 변동!
                old_price = db_row["price_man"]
                new_price = article["price_man"]

                # listing 업데이트
                supabase.table("re_listings").update({
                    "price_man": new_price,
                    "price_text": article.get("price_text", ""),
                    "last_seen_at": now,
                    **extra_update,
                }).eq("id", db_row["id"]).execute()

                # 히스토리 기록
                supabase.table("re_listing_history").insert({
                    "listing_id": db_row["id"],
                    "old_price_man": old_price,
                    "new_price_man": new_price,
                }).execute()

                result["changed"].append({
                    **article,
                    "old_price_man": old_price,
                })
            else:
                # 동일 → last_seen_at 업데이트 + address/build_year 보완
                supabase.table("re_listings").update({
                    "last_seen_at": now,
                    "is_new": False,
                    **extra_update,
                }).eq("id", db_row["id"]).execute()
        else:
            # 신규 매물!
            insert_data = {
                "filter_id": filter_id,
                "naver_article_id": article_id,
                "complex_name": article.get("complex_name", ""),
                "complex_no": article.get("complex_no"),
                # "trade_type": article.get("trade_type", ""),  # DB 컬럼 추가 후 활성화
                "price_text": article.get("price_text", ""),
                "price_man": article.get("price_man", 0),
                "area_m2": article.get("area_m2"),
                "area_pyeong": article.get("area_pyeong"),
                "floor_info": article.get("floor_info"),
                "direction": article.get("direction"),
                "description": article.get("description"),
                "confirm_date": article.get("confirm_date"),
                "detail_url": article.get("detail_url"),
                "address": article.get("address", ""),
                "build_year": article.get("build_year", ""),
                "status": "active",
                "is_new": True,
                "is_favorited": False,
            }
            supabase.table("re_listings").insert(insert_data).execute()
            result["new"].append(article)

    # 삭제 감지: DB에 있지만 이번 크롤링에 없는 매물
    for article_id, db_row in existing.items():
        if article_id not in crawled_ids:
            # removed 처리 (바로 삭제하지 않고 status만 변경)
            supabase.table("re_listings").update({
                "status": "removed",
            }).eq("id", db_row["id"]).execute()
            result["removed"].append({
                "complex_name": db_row["complex_name"],
                "price_man": db_row["price_man"],
            })

    return result
