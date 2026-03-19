"""
네이버 부동산 크롤링 코어
Playwright 브라우저로 네이버 부동산 API 응답을 캡처
"""
import asyncio
import json
import math
from typing import Optional
from playwright.async_api import async_playwright, Page, Route

from config import NAVER_LAND_URL, CRAWL_DELAY_SEC, MAX_COMPLEXES_PER_FILTER


async def get_complexes(page: Page, cortar_no: str) -> list[dict]:
    """지역의 단지 목록 조회 (single-markers API)"""
    captured = []

    async def capture_markers(route: Route):
        response = await route.fetch()
        try:
            data = await response.json()
            captured.append(data)
        except:
            pass
        await route.fulfill(response=response)

    await page.route("**/complexes/single-markers/**", capture_markers)

    # 지역 페이지 접속
    url = f"{NAVER_LAND_URL}/complexes/single-markers/2.0?cortarNo={cortar_no}&zoom=14&priceType=RETAIL&markerId=&markerType=&selectedComplexNo=&selectedComplexBuildingNo=&fakeComplexMarker=&realEstateType=APT&tradeType=&tag=%3A%3A%3A%3A%3A%3A%3A%3A&rentPriceMin=0&rentPriceMax=900000000&priceMin=0&priceMax=900000000&areaMin=0&areaMax=900000000&oldBuildYears=&recentlyBuildYears=&minHouseHoldCount=&maxHouseHoldCount=&showArticle=false&sameAddressGroup=true&directions=&leftLon={127.0}&rightLon={127.2}&topLat={37.5}&bottomLat={37.3}"
    await page.goto(url, wait_until="networkidle", timeout=15000)
    await page.unroute("**/complexes/single-markers/**")

    complexes = []
    for data in captured:
        markers = data.get("complexMarkers", data.get("result", []))
        if isinstance(markers, list):
            for m in markers:
                if isinstance(m, dict) and m.get("complexNo"):
                    complexes.append({
                        "complexNo": str(m["complexNo"]),
                        "complexName": m.get("complexName", ""),
                        "markerLat": m.get("latitude", 0),
                        "markerLon": m.get("longitude", 0),
                    })

    return complexes[:MAX_COMPLEXES_PER_FILTER]


async def get_articles(page: Page, complex_no: str, trade_type: str = "A1",
                       price_min: Optional[int] = None, price_max: Optional[int] = None,
                       area_min: Optional[float] = None) -> list[dict]:
    """단지의 매물 목록 조회"""
    captured = []

    async def capture_articles(route: Route):
        response = await route.fetch()
        try:
            data = await response.json()
            captured.append(data)
        except:
            pass
        await route.fulfill(response=response)

    await page.route(f"**/articles/complex/{complex_no}**", capture_articles)

    # 단지 페이지 접속
    url = f"{NAVER_LAND_URL}/complexes/{complex_no}?ms={37.4},{127.1},16&a={trade_type}&e=RETAIL"
    try:
        await page.goto(url, wait_until="networkidle", timeout=15000)
    except:
        pass  # timeout은 무시, 캡처된 데이터 사용

    await page.unroute(f"**/articles/complex/{complex_no}**")
    await asyncio.sleep(CRAWL_DELAY_SEC)

    articles = []
    for data in captured:
        article_list = data.get("articleList", [])
        for a in article_list:
            # 가격 필터 (만원 단위)
            price_man = a.get("dealOrWarrantPrc", "0")
            if isinstance(price_man, str):
                price_man = price_man.replace(",", "").replace("억", "0000").replace(" ", "")
                # "5억 4,000"  54000
                try:
                    if "0000" in price_man:
                        parts = price_man.split("0000")
                        price_man = int(parts[0]) * 10000 + (int(parts[1]) if parts[1] else 0)
                    else:
                        price_man = int(price_man)
                except:
                    price_man = 0

            area_m2 = float(a.get("area2", a.get("exclusiveArea", 0)) or 0)
            area_pyeong = round(area_m2 / 3.3058, 1) if area_m2 > 0 else 0

            # 클라이언트 필터링
            if price_min and price_man < price_min:
                continue
            if price_max and price_man > price_max:
                continue
            if area_min and area_m2 < area_min:
                continue

            articles.append({
                "naver_article_id": str(a.get("articleNo", "")),
                "complex_name": a.get("complexName", a.get("articleName", "")),
                "complex_no": complex_no,
                "price_text": a.get("dealOrWarrantPrc", ""),
                "price_man": price_man,
                "area_m2": area_m2,
                "area_pyeong": area_pyeong,
                "floor_info": a.get("floorInfo", ""),
                "direction": a.get("direction", ""),
                "description": a.get("articleFeatureDesc", a.get("tagList", "")),
                "confirm_date": a.get("articleConfirmYmd", ""),
                "detail_url": f"https://new.land.naver.com/houses/detail/{a.get('articleNo', '')}",
            })

    return articles


async def crawl_filter(filter_data: dict) -> list[dict]:
    """하나의 필터에 대해 크롤링 실행"""
    print(f"   크롤링 시작: {filter_data['name']} ({filter_data['region_name']})")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ignore_https_errors=True
        )
        page = await context.new_page()

        all_articles = []

        try:
            # 1. 네이버 부동산 메인 접속 (쿠키 확보)
            await page.goto(NAVER_LAND_URL, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(2)

            # 2. 단지 목록 가져오기
            complexes = await get_complexes(page, filter_data["region_code"])
            print(f"     {len(complexes)}개 단지 발견")

            # 3. 각 단지별 매물 조회
            for i, cx in enumerate(complexes):
                try:
                    articles = await get_articles(
                        page,
                        cx["complexNo"],
                        trade_type=filter_data.get("trade_type", "A1"),
                        price_min=filter_data.get("price_min"),
                        price_max=filter_data.get("price_max"),
                        area_min=filter_data.get("area_min"),
                    )
                    all_articles.extend(articles)
                    if articles:
                        print(f"    [{i+1}/{len(complexes)}] {cx['complexName']}: {len(articles)}건")
                except Exception as e:
                    print(f"    [{i+1}/{len(complexes)}] {cx['complexName']}: 오류 - {e}")

        except Exception as e:
            print(f"   크롤링 실패: {e}")
        finally:
            await browser.close()

        print(f"   총 {len(all_articles)}건 수집 완료")
        return all_articles
