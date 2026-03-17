# sophia.life 부동산 모니터링 모듈 PRD

> sophia.life 대시보드 > 자산 & 경제 > 부동산 탭 확장
> 기존 PRD Phase 4에 해당, 네이버 부동산 크롤링 검증 완료 (2026-03-17)

---

## 1. 개요

- **모듈명**: 부동산 매물 모니터링
- **작성일**: 2026-03-17
- **목표**: 네이버 부동산 매물을 자동 수집하여, 수동으로 네이버를 확인하지 않아도 조건에 맞는 매물을 대시보드에서 바로 확인하고 알림 받기
- **타겟**: 부부 2명 (내집마련 준비)
- **기존 PRD 위치**: 6-5. 자산 & 경제 > 탭 3: 부동산

---

## 2. 배경 & 문제 정의

### As-Is
- 매일 네이버 부동산에 직접 접속해서 지역별로 매물 확인
- 새 매물이 올라왔는지, 가격이 변경됐는지 수동 추적
- 관심 지역이 여러 곳이라 확인에 시간이 많이 걸림

### Pain Point
- 매물 등록/변경을 놓침
- 반복 작업에 시간 소모
- 가격 변동 추이를 기억에 의존

### To-Be
- 조건 설정 한 번이면 자동으로 매물 수집
- 새 매물, 가격 변동 시 즉시 알림
- 대시보드에서 한눈에 비교/관리

---

## 3. 기술 검증 결과 (2026-03-17)

| 항목 | 결과 |
|------|------|
| 크롤링 방식 | Playwright 브라우저 세션 (requests는 401 차단) |
| API 엔드포인트 | `complexes/single-markers/2.0` → 단지 목록, 단지 페이지 방문 → `articles/complex/{id}` 응답 캡처 |
| 필터링 | 가격/면적/매매유형 서버단 필터 가능, 클라이언트에서 2차 필터링 |
| 테스트 결과 | 성남 분당·수정·중원 + 용인 수지 + 하남 → 10건 수집 성공 |
| Rate Limit | 단지당 ~3초 소요, 과다 요청 시 429 (하루 4회로 대응) |

---

## 4. 핵심 기능

### P0 (필수 - MVP)

| # | 기능 | 설명 |
|---|------|------|
| 1 | **동적 필터 관리** | UI에서 모니터링 조건 추가/수정/삭제 (지역, 매매유형, 가격범위, 면적범위) |
| 2 | **자동 매물 수집** | Python 크롤러가 하루 4회(06/12/18/24시) 네이버 부동산에서 필터 조건에 맞는 매물 수집 |
| 3 | **매물 피드** | 수집된 매물 리스트 (최신순), 신규 매물 하이라이트, 네이버 상세 링크 |
| 4 | **신규 매물 감지** | naver_article_id 기준 diff, 처음 보이는 매물에 NEW 뱃지 |

### P1 (중요)

| # | 기능 | 설명 |
|---|------|------|
| 5 | **가격 변동 추적** | 기존 매물의 가격이 변경되면 이력 기록 + 변동 표시 (▲▼) |
| 6 | **Discord 알림** | 신규 매물/가격 변동 시 Discord webhook으로 즉시 알림 |
| 7 | **매물 삭제(내려감) 감지** | 이전에 있던 매물이 사라지면 status를 removed로 변경 |

### P2 (있으면 좋음)

| # | 기능 | 설명 |
|---|------|------|
| 8 | **매물 즐겨찾기** | 관심 매물 별표 표시, 별도 탭으로 모아보기 |
| 9 | **지역별 통계** | 지역/단지별 평균가, 매물 수 추이 차트 |
| 10 | **임장 노트 연동** | 매물 목록에서 바로 임장 노트 작성 연결 |

---

## 5. 시스템 아키텍처

```
┌────────────────────────────────────────────┐
│          sophia.life (React/Next.js)        │
│                                             │
│  부동산 탭 (기존 PRD 6-5 탭3 확장)            │
│  ┌──────────┬──────────┬──────────┐         │
│  │ 매물 모니터│실거래가   │임장노트   │         │
│  │ (신규!)   │검색(기존) │(기존)    │         │
│  └────┬─────┴──────────┴──────────┘         │
│       │                                      │
│  ┌────▼──────────────────────────┐           │
│  │ FilterManager                 │           │
│  │ - 필터 추가/수정/삭제 UI        │           │
│  │ - 지역 선택 (시/구 드롭다운)    │           │
│  │ - 가격/면적 범위 슬라이더       │           │
│  └────┬──────────────────────────┘           │
│       │                                      │
│  ┌────▼──────────────────────────┐           │
│  │ ListingFeed                   │           │
│  │ - 매물 카드 리스트 (최신순)     │           │
│  │ - NEW 뱃지 / 가격변동 표시     │           │
│  │ - 필터별 탭 전환               │           │
│  │ - 네이버 상세 링크             │           │
│  └────┬──────────────────────────┘           │
│       │ Supabase Realtime 구독                │
└───────┼──────────────────────────────────────┘
        │
   ┌────▼──────────────────┐
   │      Supabase          │
   │  filters              │
   │  listings             │
   │  listing_history      │
   └────▲──────────────────┘
        │ INSERT/UPDATE
   ┌────┴──────────────────┐
   │   Python Crawler       │
   │   (별도 프로세스)       │
   │                        │
   │   cron: 06/12/18/24시  │
   │   Playwright 브라우저   │
   │   → 네이버 부동산 크롤링 │
   │   → diff 감지           │
   │   → DB 저장             │
   │   → Discord 알림        │
   └────────────────────────┘
```

---

## 6. 데이터 모델

### 6-1. filters (모니터링 조건)

```sql
create table re_filters (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- "분당 5-9억 25평+"
  region_code text not null,          -- "4113500000" (네이버 cortarNo)
  region_name text not null,          -- "성남시 분당구"
  trade_type text not null default 'A1',  -- A1:매매, B1:전세, B2:월세
  price_min int,                      -- 만원 단위 (50000 = 5억)
  price_max int,                      -- 만원 단위 (90000 = 9억)
  area_min float,                     -- ㎡ 단위 (49.5 ≈ 15평)
  area_max float,                     -- null이면 제한 없음
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 6-2. listings (수집된 매물)

```sql
create table re_listings (
  id uuid primary key default gen_random_uuid(),
  filter_id uuid references re_filters(id) on delete cascade,
  naver_article_id text not null,     -- 중복 방지 키
  complex_name text not null,
  complex_no text,
  price_text text,                    -- 원본: "5억 4,000"
  price_man int not null,             -- 비교/정렬용: 54000
  area_m2 float,
  area_pyeong float,                  -- 계산값: area_m2 / 3.3058
  floor_info text,                    -- "8/25"
  direction text,                     -- "남향"
  description text,
  confirm_date text,                  -- "20260317"
  detail_url text,                    -- 네이버 매물 상세 URL
  status text default 'active',       -- active / removed
  is_new boolean default true,        -- 최초 발견 시 true, 확인 후 false
  is_favorited boolean default false,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),

  unique(naver_article_id)
);

-- 인덱스
create index idx_listings_filter on re_listings(filter_id);
create index idx_listings_status on re_listings(status);
create index idx_listings_new on re_listings(is_new) where is_new = true;
```

### 6-3. listing_history (가격 변동 이력)

```sql
create table re_listing_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references re_listings(id) on delete cascade,
  old_price_man int not null,
  new_price_man int not null,
  changed_at timestamptz default now()
);
```

### 6-4. 지역 코드 매핑 (참조 데이터)

```sql
create table re_regions (
  id uuid primary key default gen_random_uuid(),
  city_name text not null,            -- "성남시"
  district_name text,                 -- "분당구" (시 단위면 null)
  display_name text not null,         -- "성남시 분당구"
  cortar_no text not null unique,     -- "4113500000"
  lat float,                          -- 지도 중심 위도
  lon float,                          -- 지도 중심 경도
  sort_order int default 0
);

-- 초기 데이터
insert into re_regions (city_name, district_name, display_name, cortar_no, lat, lon, sort_order) values
  ('성남시', '분당구', '성남시 분당구', '4113500000', 37.38, 127.12, 1),
  ('성남시', '수정구', '성남시 수정구', '4113100000', 37.45, 127.15, 2),
  ('성남시', '중원구', '성남시 중원구', '4113300000', 37.43, 127.15, 3),
  ('용인시', '수지구', '용인시 수지구', '4146300000', 37.32, 127.08, 4),
  ('용인시', '기흥구', '용인시 기흥구', '4146500000', 37.28, 127.11, 5),
  ('용인시', '처인구', '용인시 처인구', '4146100000', 37.23, 127.20, 6),
  ('하남시', null,     '하남시',        '4145000000', 37.54, 127.20, 7);
  -- 서울 25개 구는 별도 마이그레이션으로 추가
```

---

## 7. 크롤러 상세 설계

### 7-1. 디렉토리 구조

```
sophia-life/
└── crawler/
    ├── main.py                 # 진입점 + 스케줄러
    ├── config.py               # Supabase URL/Key, Discord webhook URL
    ├── naver_client.py         # Playwright 크롤링 코어
    ├── diff_engine.py          # 신규/변경/삭제 감지 로직
    ├── notifier.py             # Discord webhook 알림
    ├── requirements.txt        # playwright, supabase, apscheduler
    └── .env                    # 환경변수 (Supabase key 등)
```

### 7-2. 크롤링 플로우 (naver_client.py)

```
1. Playwright Chromium 브라우저 실행 (headless)
2. https://new.land.naver.com/ 접속 (쿠키/세션 확보)
3. 필터별 반복:
   a. 지역 페이지 접속 → single-markers API 응답 캡처 → 단지 목록
   b. 각 단지 페이지 접속 → articles/complex API 응답 캡처 → 매물 리스트
   c. 가격/면적 클라이언트 필터링
   d. 단지 간 1~2초 딜레이
4. 브라우저 종료
5. 수집된 매물 반환
```

### 7-3. Diff 엔진 (diff_engine.py)

```
입력: 크롤링된 매물 리스트 + DB 기존 매물

처리:
  for each 크롤링 매물:
    DB에서 naver_article_id로 조회
    ├── 없음 → INSERT (is_new=true, status='active')      → 신규 알림
    ├── 있음 + 가격 다름 → UPDATE price + INSERT history   → 가격변동 알림
    └── 있음 + 동일 → UPDATE last_seen_at만

  for each DB 기존 매물 (이번 크롤링에 없는 것):
    └── 2회 연속 미발견 → status='removed'                 → 삭제 알림
```

### 7-4. 스케줄 (main.py)

```python
# APScheduler cron 트리거
scheduler.add_job(
    crawl_cycle,
    CronTrigger(hour='6,12,18,0', minute=0),  # 06:00, 12:00, 18:00, 24:00
    id='naver_realestate_crawl'
)
```

### 7-5. 알림 포맷 (notifier.py)

```
Discord Embed:

🏠 새 매물 발견! (분당 5-9억)
━━━━━━━━━━━━━━━━━━
📍 성남시 분당구 | 피더하우스
💰 5억 2,000
📐 18.5평 (61㎡) | 3/3층 | 남향
📝 빠른입주도 가능 방2개 욕실1 녹지전망
🔗 네이버에서 보기

📉 가격 변동!
━━━━━━━━━━━━━━━━━━
📍 용인시 수지구 | 코오롱하늘채
💰 5억 7,000 → 5억 4,000 (▼3,000만)
```

---

## 8. 화면 구성

### 8-1. 부동산 탭 구조 변경

```
기존:                          변경 후:
부동산                         부동산
├── 실거래가 검색               ├── 📡 매물 모니터 (신규!)
├── 구매 시뮬레이터             ├── 🔍 실거래가 검색
└── 임장 노트                  ├── 🧮 구매 시뮬레이터
                               └── 📋 임장 노트
```

### 8-2. 매물 모니터 화면

#### 상단: 필터 영역

```
┌──────────────────────────────────────────────┐
│  내 모니터링 필터                    [+ 필터 추가] │
│                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────┐│
│  │ 분당 5-9억   │ │ 수지 5-9억   │ │ 하남 전체 ││
│  │ 매매·15평+   │ │ 매매·15평+   │ │ 매매     ││
│  │ ● 활성      │ │ ● 활성      │ │ ○ 비활성  ││
│  └─────────────┘ └─────────────┘ └──────────┘│
└──────────────────────────────────────────────┘
```

#### 필터 추가/수정 모달

```
┌──────────────────────────────────┐
│  필터 설정                        │
│                                   │
│  이름: [분당 5-9억 25평+        ] │
│                                   │
│  지역: [성남시 ▼] [분당구 ▼]      │
│                                   │
│  매매유형: (●) 매매  ( ) 전세  ( ) 월세 │
│                                   │
│  가격:  [5]억 ~ [9]억             │
│         ├────●━━━━━━━━●────┤      │
│                                   │
│  면적:  [15]평 이상               │
│         ├────●━━━━━━━━━━━━┤      │
│                                   │
│  [취소]              [저장]        │
└──────────────────────────────────┘
```

#### 하단: 매물 리스트

```
┌──────────────────────────────────────────────┐
│  전체 (47)  │ 분당 (12) │ 수지 (28) │ 하남 (7) │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                               │
│  ┌─────────────────────────────────────┐      │
│  │ NEW  코오롱하늘채 5단지              │      │
│  │ 용인시 수지구                        │      │
│  │ 💰 5억 5,000   📐 25.4평   🏢 19/25층│      │
│  │ 🧭 남서향  📅 2026-03-16            │      │
│  │ "TOP. 기본형 탁 트인 뷰"             │      │
│  │                     ☆ 즐겨찾기  🔗   │      │
│  └─────────────────────────────────────┘      │
│                                               │
│  ┌─────────────────────────────────────┐      │
│  │ ▼3,000  코오롱하늘채 5단지           │      │
│  │ 용인시 수지구                        │      │
│  │ 💰 5억 7,000 → 5억 4,000  📐 30.9평 │      │
│  │ 🏢 4/17층  🧭 남서향                │      │
│  │ 📅 2026-03-09                       │      │
│  │                     ★ 즐겨찾기  🔗   │      │
│  └─────────────────────────────────────┘      │
│                                               │
│  마지막 수집: 2026-03-17 18:00  다음: 24:00    │
└──────────────────────────────────────────────┘
```

### 8-3. 모바일 레이아웃

- 필터 칩: 가로 스크롤
- 매물 카드: 1열 풀 와이드
- 필터 추가: 풀스크린 모달 (바텀시트)

---

## 9. 사용자 흐름

### 최초 설정
```
1. 대시보드 > 자산 & 경제 > 부동산 > 매물 모니터
2. "아직 설정된 필터가 없어요" 안내 + [첫 필터 만들기] 버튼
3. 필터 모달에서 지역/가격/면적 설정 후 저장
4. "다음 수집 시간(06/12/18/24시)에 매물을 가져올게요" 안내
5. (크롤러 실행 후) 매물 카드 리스트 표시
```

### 일상 사용
```
1. 대시보드 진입 → 홈 위젯에 "새 매물 3건" 뱃지
2. 부동산 탭 클릭 → 매물 모니터
3. NEW 뱃지 매물 확인 → 관심 매물 즐겨찾기
4. 네이버 링크로 상세 확인
5. 마음에 들면 임장 노트로 연결
```

### Discord 알림 수신
```
1. 크롤러가 06:00 실행
2. 새 매물 2건 감지
3. Discord 채널에 매물 정보 알림
4. 알림 터치 → sophia.life 열어서 확인
```

---

## 10. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| 크롤링 빈도 | 하루 4회 (06:00, 12:00, 18:00, 00:00) |
| 크롤링 소요시간 | 필터 1개당 ~2분 (단지 수에 따라 변동) |
| 데이터 보존 | 매물 데이터 영구 보존, removed 매물도 유지 |
| 알림 지연 | 크롤링 완료 후 30초 이내 Discord 전송 |
| 에러 처리 | 크롤링 실패 시 Discord에 에러 알림, 다음 스케줄에 재시도 |
| 보안 | Supabase key는 .env로 관리, 크롤러 서버에만 존재 |

---

## 11. 크롤러 호스팅 옵션

| 옵션 | 비용 | 장점 | 단점 |
|------|------|------|------|
| **로컬 PC (Windows)** | 무료 | 쉬움, Playwright 이미 설치됨 | PC 켜져 있어야 함 |
| **Railway** | 무료~$5/월 | 항상 실행, cron 지원 | Playwright 설치 무거움 |
| **Render** | 무료 | cron job 지원 | 무료 tier 제한 |
| **GitHub Actions** | 무료 | cron 스케줄 지원, 관리 쉬움 | 실행시간 제한 (6시간/월 무료) |
| **Supabase Edge Function + Deno** | 무료 | Supabase 내 통합 | Playwright 사용 불가 |

**추천**: 초기에는 **로컬 PC** (Task Scheduler로 스케줄), 안정화 후 **GitHub Actions** 또는 **Railway**로 이전

---

## 12. 마일스톤

| Phase | 목표 | 산출물 | 의존성 |
|-------|------|--------|--------|
| **Phase 1** | 크롤러 MVP | Python 크롤러 + Supabase 연동 + Discord 알림 | sophia.life Supabase 배포 완료 |
| **Phase 2** | 프론트 UI | 필터 관리 + 매물 리스트 + Realtime | Phase 1 완료 |
| **Phase 3** | 고도화 | 가격 변동 추적 + 즐겨찾기 + 통계 차트 + 임장노트 연동 | Phase 2 완료 |

### Phase 1 세부 태스크

```
1-1. Supabase 테이블 생성 (re_filters, re_listings, re_listing_history, re_regions)
1-2. crawler/config.py - Supabase 연결
1-3. crawler/naver_client.py - Playwright 크롤링 코어
1-4. crawler/diff_engine.py - 신규/변경/삭제 감지
1-5. crawler/notifier.py - Discord webhook
1-6. crawler/main.py - 스케줄러 (하루 4회)
1-7. 로컬 테스트 → 첫 수집 실행
1-8. Windows Task Scheduler 등록
```

### Phase 2 세부 태스크

```
2-1. 부동산 탭에 "매물 모니터" 서브탭 추가
2-2. FilterManager 컴포넌트 (필터 CRUD)
2-3. ListingFeed 컴포넌트 (매물 카드 리스트)
2-4. Supabase Realtime 구독 연결
2-5. 대시보드 홈 위젯에 "새 매물" 뱃지 추가
```

---

## 13. 리스크 & 대응

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 네이버 API 스펙 변경 | 중 | 에러 감지 → Discord 알림, naver_client.py 파싱만 수정 |
| IP 차단 | 하 | 하루 4회 + 단지당 딜레이로 충분히 안전 |
| 서울 전체 조회 시 단지 수 폭발 | 중 | 서울은 구 단위로 필터 생성 강제 (시 단위 X) |
| 크롤러 실행 중 PC 꺼짐 | 중 | 다음 스케줄에 자동 재시도, 이후 서버로 이전 |
| Playwright 브라우저 메모리 | 하 | 크롤링 종료 시 반드시 browser.close(), 프로세스 단위 격리 |
| 네이버 이용약관 | 중 | 개인 용도 + 소량 요청 + 비상업적 → 최소 리스크, 데이터 외부 공개 X |

---

## 14. 기존 PRD와의 관계

이 문서는 기존 `sophia-life/docs/PRD.md`의 **6-5. 자산 & 경제 > 탭 3: 부동산** 섹션을 확장합니다.

### 기존 부동산 기능 (PRD 원본 유지)
- 실거래가 검색 (국토교통부 API)
- 구매 시뮬레이터
- 임장 노트

### 이 PRD로 추가되는 기능
- **매물 모니터링** (네이버 부동산 크롤링)
- 부동산 탭 첫 번째 서브탭으로 배치

기존 기능과 충돌 없이 독립적으로 확장 가능.
