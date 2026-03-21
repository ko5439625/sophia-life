"""
네이버 부동산 크롤링 코어
Playwright 브라우저로 네이버 부동산 웹페이지를 방문하고 API 응답을 캡처
"""
import asyncio
import json
from typing import Optional
from playwright.async_api import async_playwright, Page, Response

from config import NAVER_LAND_URL, CRAWL_DELAY_SEC, MAX_COMPLEXES_PER_FILTER


async def get_complexes_via_page(page: Page, cortar_no: str, trade_type: str = "A1") -> list[dict]:
    """
    실제 네이버 부동산 페이지를 방문하여 단지 마커 API 응답을 캡처
    """
    captured_markers = []

    async def on_response(response: Response):
        url = response.url
        if "/api/complexes/single-markers/" in url:
            try:
                data = await response.json()
                if isinstance(data, list):
                    captured_markers.extend(data)
                elif isinstance(data, dict):
                    captured_markers.append(data)
            except Exception:
                pass

    page.on("response", on_response)

    # 지역 페이지 방문 (실제 유저처럼)
    url = f"{NAVER_LAND_URL}/complexes?cortarNo={cortar_no}&realEstateType=APT&tradeType={trade_type}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=20000)
    except Exception:
        pass  # timeout은 무시, 이미 캡처된 데이터 사용

    await asyncio.sleep(2)

    page.remove_listener("response", on_response)

    # 캡처된 마커에서 단지 정보 추출
    complexes = []
    seen = set()
    for item in captured_markers:
        # 응답이 리스트인 경우 (배열 형태)
        markers = [item] if isinstance(item, dict) and item.get("markerId") else []
        if isinstance(item, list):
            markers = item
        elif isinstance(item, dict):
            # nested 구조인 경우
            markers = item.get("complexMarkers", [item])

        for m in markers:
            if not isinstance(m, dict):
                continue
            complex_no = str(m.get("complexNo", m.get("markerId", "")))
            if not complex_no or complex_no in seen:
                continue
            seen.add(complex_no)
            complexes.append({
                "complexNo": complex_no,
                "complexName": m.get("complexName", ""),
                "markerLat": m.get("latitude", 0),
                "markerLon": m.get("longitude", 0),
            })

    return complexes[:MAX_COMPLEXES_PER_FILTER]


async def get_articles_via_page(page: Page, complex_no: str, trade_type: str = "A1",
                                price_min: Optional[int] = None, price_max: Optional[int] = None,
                                area_min: Optional[float] = None) -> list[dict]:
    """
    단지 상세 페이지를 방문하여 매물 API 응답 + 단지 정보(주소/준공연도)를 캡처
    """
    captured_articles = []
    complex_info = {}

    cortar_info = {}

    async def on_response(response: Response):
        url = response.url
        if f"/api/articles/complex/{complex_no}" in url:
            try:
                data = await response.json()
                captured_articles.append(data)
            except Exception:
                pass
        # 단지 상세 정보 캡처 (주소, 준공연도 등)
        elif f"/api/complexes/" in url and str(complex_no) in url and "/articles/" not in url and "/markers" not in url:
            try:
                data = await response.json()
                if isinstance(data, dict):
                    if "complexDetail" in data:
                        complex_info.update(data["complexDetail"])
                    else:
                        # overview API 등 최상위에 바로 데이터가 있는 경우
                        complex_info.update(data)
            except Exception:
                pass
        # cortars API에서 지역 주소 정보 캡처 (최신 값만 사용)
        elif "/api/cortars?" in url:
            try:
                data = await response.json()
                if isinstance(data, dict) and "cortarName" in data:
                    cortar_info.clear()
                    cortar_info.update(data)
            except Exception:
                pass

    page.on("response", on_response)

    # 단지 상세 페이지 방문
    url = f"{NAVER_LAND_URL}/complexes/{complex_no}?ms=37.38,127.12,16&a={trade_type}&e=RETAIL"
    try:
        await page.goto(url, wait_until="networkidle", timeout=15000)
    except Exception:
        pass

    await asyncio.sleep(CRAWL_DELAY_SEC)

    page.remove_listener("response", on_response)

    # 단지 주소/준공연도 추출
    # 1) address: complexDetail에 있으면 사용, 없으면 cortars 정보로 조합
    address = complex_info.get("address", complex_info.get("roadAddress", ""))
    if not address and cortar_info:
        # cortars API: cityName="경기도", divisionName="성남시 분당구", sectorName="백현동"
        parts = []
        city = cortar_info.get("cityName", "")
        div = cortar_info.get("divisionName", "")
        sector = cortar_info.get("sectorName", "")
        if city:
            parts.append(city)
        if div:
            parts.append(div)
        if sector:
            parts.append(sector)
        address = " ".join(parts)

    build_year = complex_info.get("useApproveYmd", "")
    if build_year and len(build_year) >= 4:
        build_year = build_year[:4]  # YYYYMMDD → YYYY

    # 거래 유형 코드 매핑: A1=매매, B1=전세, B2=월세, B3=단기임대
    trade_type_map = {"A1": "A1", "B1": "B1", "B2": "B2", "B3": "B2"}

    articles = []
    for data in captured_articles:
        article_list = data.get("articleList", [])
        for a in article_list:
            # 거래 유형 필터링: 요청한 거래 유형과 일치하는 매물만 수집
            article_trade = a.get("tradeTypeCode", "")
            mapped_trade = trade_type_map.get(article_trade, article_trade)
            if trade_type and mapped_trade != trade_type:
                continue

            # 가격 파싱 (만원 단위)
            price_man = a.get("dealOrWarrantPrc", "0")
            if isinstance(price_man, str):
                price_man = price_man.replace(",", "").replace(" ", "")
                try:
                    if "억" in price_man:
                        parts = price_man.split("억")
                        eok = int(parts[0]) * 10000
                        rest = int(parts[1]) if parts[1] else 0
                        price_man = eok + rest
                    else:
                        price_man = int(price_man)
                except Exception:
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
                "trade_type": article_trade,  # A1/B1/B2
                "trade_type_name": a.get("tradeTypeName", ""),  # 매매/전세/월세
                "price_text": a.get("dealOrWarrantPrc", ""),
                "price_man": price_man,
                "area_m2": area_m2,
                "area_pyeong": area_pyeong,
                "floor_info": a.get("floorInfo", ""),
                "direction": a.get("direction", ""),
                "description": a.get("articleFeatureDesc", a.get("tagList", "")),
                "confirm_date": a.get("articleConfirmYmd", ""),
                "detail_url": f"https://new.land.naver.com/complexes/{complex_no}?ms=37.38,127.12,16&articleNo={a.get('articleNo', '')}",
                "address": address,
                "build_year": build_year,
            })

    return articles


def resolve_region_codes(filter_data: dict, supabase=None) -> list[str]:
    """
    콤마 구분 지역코드를 분리하고, 시 단위 코드는 하위 구로 확장.
    예: "4113000000" (성남시 전체) → ["4113100000", "4113300000", "4113500000"]
    """
    raw_codes = filter_data.get("region_code", "").split(",")
    raw_codes = [c.strip() for c in raw_codes if c.strip()]

    if not supabase:
        return raw_codes

    resolved = []
    for code in raw_codes:
        # 하위 구가 있는지 DB에서 조회 (같은 city_name이면서 district_name이 있는 것들)
        try:
            # 먼저 이 코드의 지역 정보 가져오기
            r = supabase.table("re_regions").select("*").eq("cortar_no", code).execute()
            if not r.data:
                resolved.append(code)
                continue

            region = r.data[0]
            city_name = region.get("city_name", "")
            district_name = region.get("district_name")

            # district_name이 None이면 시 단위 → 하위 구 찾기
            if district_name is None and city_name:
                sub = supabase.table("re_regions").select("cortar_no,display_name") \
                    .eq("city_name", city_name) \
                    .not_.is_("district_name", "null") \
                    .execute()
                if sub.data and len(sub.data) > 0:
                    sub_codes = [s["cortar_no"] for s in sub.data]
                    print(f"     [{region.get('display_name')}] → 하위 {len(sub_codes)}개 구로 확장: {', '.join(s['display_name'] for s in sub.data)}")
                    resolved.extend(sub_codes)
                else:
                    # 하위 구가 없으면 (단일 시) 그대로 사용
                    resolved.append(code)
            else:
                resolved.append(code)
        except Exception:
            resolved.append(code)

    return resolved


async def crawl_filter(filter_data: dict, supabase=None) -> list[dict]:
    """하나의 필터에 대해 크롤링 실행 (다중 지역 지원)"""
    print(f"   크롤링 시작: {filter_data['name']} ({filter_data['region_name']})")

    # 지역코드 확장 (콤마 구분 + 시→구 확장)
    region_codes = resolve_region_codes(filter_data, supabase)
    print(f"     크롤링 대상 지역: {len(region_codes)}개")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            extra_http_headers={
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
            },
            ignore_https_errors=True,
        )
        page = await context.new_page()

        # webdriver 프로퍼티 숨기기
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        """)

        all_articles = []

        try:
            # 1. 네이버 부동산 메인 접속 (세션/쿠키 확보)
            await page.goto(NAVER_LAND_URL, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(2)

            trade_type = filter_data.get("trade_type", "A1")

            # 2. 각 지역별로 크롤링
            for region_idx, cortar_no in enumerate(region_codes):
                complexes = await get_complexes_via_page(page, cortar_no, trade_type)
                print(f"     [지역 {region_idx+1}/{len(region_codes)}] {cortar_no}: {len(complexes)}개 단지")

                # 3. 각 단지별 매물 조회
                for i, cx in enumerate(complexes):
                    try:
                        articles = await get_articles_via_page(
                            page,
                            cx["complexNo"],
                            trade_type=trade_type,
                            price_min=filter_data.get("price_min"),
                            price_max=filter_data.get("price_max"),
                            area_min=filter_data.get("area_min"),
                        )
                        all_articles.extend(articles)
                        if articles:
                            print(f"      [{i+1}/{len(complexes)}] {cx['complexName']}: {len(articles)}건")
                    except Exception as e:
                        print(f"      [{i+1}/{len(complexes)}] {cx['complexName']}: 오류 - {e}")

        except Exception as e:
            print(f"   크롤링 실패: {e}")
        finally:
            await browser.close()

        print(f"   총 {len(all_articles)}건 수집 완료")
        return all_articles
