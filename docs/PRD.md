# sophia.life PRD (Product Requirements Document)

> Bolt.new 프롬프트용 제품 요구사항 문서
> 이 문서는 AI 웹 빌더(Bolt.new)에게 전달하기 위한 상세 명세서입니다.

---

## 1. 프로젝트 개요

- **프로젝트명**: sophia.life
- **작성일**: 2026-03-17
- **한 줄 설명**: 겉은 감성 블로그, 안은 부부 전용 생활 관리 대시보드
- **핵심 목표**: 외부 방문자에게는 세련된 블로그를 보여주고, 숨겨진 PIN 인증을 통해 부부 전용 대시보드(자산관리, 일정관리, 부동산 리서치 등)에 접근하는 올인원 라이프 플랫폼
- **타겟 사용자**: 부부 2명 (블로그는 외부 공개)
- **기술 스택**: React + TypeScript + Tailwind CSS + Supabase (Auth 제외, DB + Storage만 사용) + Framer Motion

---

## 2. 인증 시스템 (숨겨진 PIN 방식)

### 중요: 일반 로그인 버튼 없음

- 공개 블로그에는 **로그인 UI가 전혀 보이지 않음**
- 헤더의 로고 "sophia.life"를 **5번 연속 탭/클릭**하면 PIN 입력 모달이 나타남
- PIN은 **4자리 숫자** (기본값: `1002`, 설정에서 변경 가능)
- 인증 성공 시 → 비공개 대시보드 진입
- 세션 유지: sessionStorage (브라우저 탭 닫으면 로그아웃)

### PIN 입력 UI
- 화면 전체에 블러 백드롭
- 하단에서 슬라이드업되는 모달
- 원형 도트 4개 (○ ○ ○ ○), 입력 시 하나씩 채워지며 바운스 애니메이션 (●)
- 넘버패드 (1~9, 0, 백스페이스) 표시, 터치 시 ripple 효과
- 성공 → 도트 전부 초록 → 화면 확장 전환 애니메이션
- 실패 → 도트 전부 빨강 → shake 애니메이션

---

## 3. 컬러 시스템

### 라이트 모드
| 용도 | 컬러 | HEX |
|------|------|-----|
| 배경 | 라이트 그레이 | #F5F5F5 |
| 카드/서피스 | 화이트 | #FFFFFF |
| 텍스트 | 블랙 | #1A1A1A |
| 서브 텍스트 | 그레이 | #6B7280 |
| 메인 (CTA, 완료, 긍정) | 스타벅스 그린 | #00704A |
| 포인트 (사이드바, 헤더) | 네이비 | #1E3A5F |
| 액센트 (링크, 활성탭) | 블루 | #2563EB |
| 보조 | 차콜 | #374151 |

### 다크 모드
| 용도 | 컬러 | HEX |
|------|------|-----|
| 배경 | 딥 블랙 | #0D1117 |
| 카드/서피스 | 다크 그레이 | #161B22 |
| 텍스트 | 라이트 | #E6EDF3 |
| 서브 텍스트 | 미디엄 그레이 | #8B949E |
| 메인 | 스타벅스 그린 | #00704A |
| 포인트 | 블루 | #2563EB |
| 보조 | 다크 보더 | #30363D |

### 다크모드 토글
- 우측 상단 🌞/🌙 아이콘
- 클릭 시 아이콘 회전 애니메이션 + 배경색 0.3s smooth transition
- 사용자 선택 localStorage 저장

---

## 4. 타이포그래피

| 용도 | 폰트 | 사이즈 |
|------|------|--------|
| 제목 (h1) | Pretendard Bold | 28-32px |
| 부제목 (h2) | Pretendard SemiBold | 22-24px |
| 본문 | Pretendard Regular | 16px |
| 캡션/날짜 | Pretendard Light | 13px |
| 영문 포인트/로고 | Outfit 또는 Playfair Display | - |

---

## 5. 공개 영역: 블로그

### 5-1. 블로그 메인 (매거진 레이아웃)

#### 헤더
- 중앙 또는 왼쪽: "sophia.life" 로고 텍스트 (Outfit 폰트, **볼드체, 큰 사이즈 36-48px**, 네이비 컬러)
- 첫 진입 시 로고에 **타이핑 효과** (한 글자씩 순차적으로 나타남, 커서 깜빡임 포함)
- 오른쪽: 🌞/🌙 다크모드 토글
- 로고 5번 탭 → PIN 모달 (이스터에그, 외부에 노출 안 됨)

#### 로고 아래 자유 텍스트 영역
- 로고 바로 아래에 **한 줄 소개글/문구** 표시 영역 (대시보드에서 자유 작성 가능)
- 예: "일상을 기록하는 공간", "우리의 이야기" 등
- 소개글도 첫 진입 시 로고 타이핑 후 fade-in으로 순차 등장

#### 카테고리 탭바
- 수평 탭: 전체 | 일상 | 여행 | 맛집 | 감성 | ...
- **카테고리는 동적 추가/수정/삭제 가능** (대시보드 블로그 관리에서)
- 선택 시 언더라인 슬라이드 애니메이션 + 콘텐츠 fade 전환

#### 카드 그리드 (히어로 배너 없음, 카드만)
- **히어로 배너 없음** — 모든 글이 동일한 카드 형태로 표시
- 3열 카드 그리드 (데스크탑), 2열 (모바일)
- 각 카드: 썸네일 사진 + 제목 + 날짜 + 카테고리 태그
- 스크롤 진입 시 stagger fade-up (카드마다 0.1s 딜레이, Intersection Observer)
- 카드 호버: translateY(-8px) + 포인트 컬러 그림자 + 이미지 scale(1.05)

#### 푸터
- "sophia.life ♡ made with love"
- fade-in 애니메이션

### 5-2. 블로그 글 상세 페이지

- 상단: ← 돌아가기 버튼 + 다크모드 토글
- 카테고리 태그 + 날짜
- 제목 (큰 타이포)
- 메인 사진 (풀 와이드)
- 본문 텍스트 (마크다운 지원)
- 추가 사진들 (인라인 또는 갤러리 뷰)
- 페이지 전환: fade + 슬라이드 애니메이션

---

## 6. 비공개 영역: 대시보드

### 전체 네비게이션 구조

```
비공개 대시보드
├── 🏠 홈 (대시보드 요약)
├── 📝 블로그 관리
├── 📅 일정 관리
│   ├── 오늘 체크리스트
│   ├── 캘린더
│   └── 플래너
├── 💰 자산 & 경제
│   ├── 자산 현황
│   ├── 지출 분석
│   ├── 부동산
│   │   ├── 실거래가 검색
│   │   ├── 구매 시뮬레이터
│   │   └── 임장 노트
│   ├── 경제 지표
│   └── 뉴스
├── 👫 부부 공간
│   ├── D-day
│   └── 위시리스트
├── 📷 갤러리
└── ⚙️ 설정
```

### 6-1. 대시보드 레이아웃

#### 데스크탑
- 왼쪽: 사이드바 (아이콘 + 텍스트, 접힘/펼침 가능)
  - 사이드바 배경: 네이비 (#1E3A5F)
  - 아이콘/텍스트: 화이트
  - 활성 메뉴: 스타벅스 그린 하이라이트
- 상단 헤더: "sophia.life 🔓" + 탭 네비게이션 + 로그아웃 버튼
- 메인 영역: 위젯 카드 그리드

#### 모바일
- 사이드바 → 햄버거 메뉴 (☰), 탭하면 슬라이드 오버레이
- 위젯 카드 → 세로 스택 배치

### 6-2. 🏠 대시보드 홈

위젯 카드 배치 (2열 그리드):

**Row 1:**
- **인사 카드**: "안녕, sophia & ♡ · 2026년 3월 17일 월요일"
- **무드 이모지**: 오늘 기분 이모지 한 번 터치 → 월별 무드 캘린더로 시각화

**Row 2:**
- **오늘 할 일 카드**: 체크리스트 미리보기 (최대 5개)
- **이번 달 지출 카드**: 총 지출 금액 + 카테고리별 미니 바 차트

**Row 3:**
- **다가오는 일정 카드**: D-day 카운트다운 포함 (기념일 ❤️, 여행 ✈️, 데이트 🍽️)
- **경제 미니 지표**: 공포탐욕지수 + 환율 (USD/KRW) + 코스피

**Row 4 (조건부):**
- **💌 1년 전 오늘**: 1년 전 오늘 일정/블로그 글이 있으면 추억 카드 노출
  - 사진이 있으면 사진 + 텍스트, 없으면 텍스트만
  - 부드러운 fade-in + 사진 패럴랙스
  - 없는 날은 카드 숨김

**Row 5 (조건부):**
- **부부 한마디**: 서로에게 짧은 메시지 남기기 (포스트잇 느낌 카드)

### 6-3. 📝 블로그 관리

- 글 목록 (제목, 날짜, 카테고리, 공개/비공개 상태)
- 새 글 작성: 제목 + 본문(마크다운 에디터) + 사진 업로드(다중) + 카테고리 선택 + 공개/비공개 토글
- 글 수정/삭제
- **카테고리 관리**: 카테고리 추가/수정/삭제 기능 (설정 또는 블로그 관리 내)

### 6-4. 📅 일정 관리

#### 탭 1: 오늘 체크리스트
- 날짜 선택 (기본: 오늘)
- 할 일 추가 (텍스트 + 메모)
- 체크 시: 스타벅스 그린 체크 + 취소선 애니메이션
- 반복 일정 지원 (매일/매주)

#### 탭 2: 캘린더
- 월간 캘린더 뷰
- 날짜에 일정 도트 표시
- 부부 공유 일정은 색상 구분 (그린 vs 블루)
- 일정 클릭 → 상세/수정

#### 탭 3: 플래너
- 여행/데이트 등 멀티데이 계획 작성
- 구성: 플랜 제목 + 날짜 범위 + 일별 타임라인
- 각 일정: 시간 + 장소 + 카테고리(🍽️식사, 📸관광, 🏨숙소 등) + 메모
- 예상 비용 합산 표시
- 완료된 플랜 아카이브
- 플랜 목록에서 관리

### 6-5. 💰 자산 & 경제

#### 탭 1: 📊 자산 현황
- **총 자산 추이 라인 그래프** (월별 기록 → 우상향 여부 한눈에)
- 전월 대비, 전년 대비 증감률 (%, ▲▼)
- 자산 구성 도넛 차트 (예금/주식/부동산/기타 비중)
- 자산 항목 추가/수정 입력 폼
- 차트 데이터 로드 시 draw 애니메이션 (선이 그려지듯)

#### 탭 2: 💳 지출 분석
- 수입/지출 입력 폼 (금액 + 카테고리 + 날짜 + 메모)
- 카테고리: 식비, 교통, 쇼핑, 카페, 문화, 생활, 경조사, 용돈, 기타
- 이번 달 총 지출 + 카테고리별 수평 바 차트 (비중 %)
- 월별 지출 추이 라인 그래프
- 전월 대비 카테고리별 증감
- **자동 인사이트 한 줄**: "식비가 전월 대비 12% 증가했어요. 외식 비중이 높아요." (가장 많이 쓴 카테고리 + 변화량 기반)

#### 탭 3: 🏠 부동산

##### 실거래가 검색
- 아파트 이름/지역 검색 입력
- 검색 결과: 아파트명, 위치, 평형별 최근 실거래가
- 전세가 + **전세가율 자동 계산** (게이지 바 시각화)
- 실거래 추이 라인 그래프 (최근 2~3년)
- 관심 아파트 ⭐ 즐겨찾기 등록
- **데이터 소스**: 국토교통부 실거래가 공공 API

##### 구매 시뮬레이터
- 현재 총 자산 자동 연동
- 목표 아파트 가격대 입력 (직접 입력 또는 검색 연동)
- 월 저축액 기반 → 목표 도달 예상 시기 계산
- 가격대별 (3억/5억/7억/9억) 도달 가능 시기 리스트
- 대출 포함 시뮬레이션 (LTV, DSR 간단 계산)

##### 임장 노트
- 임장 기록 작성: 아파트 선택(검색 연동) + 방문일
- **항목별 별점** (5점 만점): 교통, 학군, 환경, 상권, 단지
- **종합 점수 자동 계산** (항목 평균)
- 사진 첨부 (다중)
- 한줄 후기/메모
- 임장 기록 목록: 카드형, 종합 점수 표시
- **임장 비교표**: 다녀온 아파트들을 테이블로 한 눈에 비교 (항목별 + 종합 점수, 정렬 가능)

#### 탭 4: 📈 경제 지표
- 공포탐욕지수 (Fear & Greed Index) - 게이지 표시
- 환율 (USD/KRW) - 변동률
- 코스피, S&P500, 나스닥, 비트코인 - 미니 차트 + 전일 대비
- 각 지표 카드형 배치

#### 탭 5: 📰 뉴스
- 경제/사회 뉴스 스크래핑 (한국 + 미국)
- 소스: 연합뉴스, 한경, Reuters, AP
- 카테고리 필터: 경제 / 사회 / 미국 / 전체
- 헤드라인 10~20개 리스트
- 접속 시 최신 데이터 (1시간 캐싱)

### 6-6. 👫 부부 공간

#### D-day
- 기념일 등록 (제목, 날짜, 이모지)
- D-day 카운트다운 카드
- 대시보드 홈에도 표시

#### 위시리스트
- 사고 싶은 것, 가고 싶은 곳 목록
- 카테고리 (물건/장소/경험)
- 완료 체크 가능
- 부부 공용

### 6-7. 📷 갤러리
- 앨범 형태로 사진 모음
- 앨범 생성 (제목 + 날짜 + 설명)
- 사진 다중 업로드
- 공개/비공개 설정 (공개 시 블로그에서도 접근 가능)

### 6-8. ⚙️ 설정
- PIN 변경
- 블로그 카테고리 관리
- 지출 카테고리 관리
- 다크모드 기본값

---

## 7. 데이터 모델 (Supabase)

### 테이블 구조

```sql
-- 블로그 글
posts (
  id uuid PK,
  title text,
  content text,          -- 마크다운
  images text[],         -- Supabase Storage URLs
  category text,
  is_public boolean DEFAULT true,
  created_at timestamp,
  updated_at timestamp
)

-- 블로그 카테고리
categories (
  id uuid PK,
  name text UNIQUE,
  sort_order integer,
  created_at timestamp
)

-- 일별 체크리스트
todos (
  id uuid PK,
  date date,
  title text,
  memo text,
  is_done boolean DEFAULT false,
  repeat_type text,      -- null, 'daily', 'weekly'
  created_at timestamp
)

-- 일정/이벤트
events (
  id uuid PK,
  title text,
  date date,
  end_date date,         -- 멀티데이 일정
  emoji text,
  is_shared boolean DEFAULT true,
  event_type text,       -- 'schedule', 'anniversary', 'plan'
  created_at timestamp
)

-- 플래너 (여행/데이트 계획)
plans (
  id uuid PK,
  title text,
  start_date date,
  end_date date,
  estimated_cost integer,
  status text DEFAULT 'planned',  -- 'planned', 'completed'
  created_at timestamp
)

plan_items (
  id uuid PK,
  plan_id uuid FK -> plans,
  day_number integer,
  time text,             -- '09:00'
  title text,
  place text,
  category text,         -- 'food', 'tour', 'hotel', etc.
  memo text,
  sort_order integer
)

-- 자산 기록 (월별)
assets (
  id uuid PK,
  year_month text,       -- '2026-03'
  category text,         -- 'deposit', 'stock', 'real_estate', 'other'
  amount bigint,
  memo text,
  created_at timestamp
)

-- 수입/지출
finances (
  id uuid PK,
  type text,             -- 'income' or 'expense'
  amount integer,
  category text,
  date date,
  memo text,
  created_at timestamp
)

-- 임장 기록
inspections (
  id uuid PK,
  apartment_name text,
  location text,
  visit_date date,
  score_transport decimal,    -- 5점 만점
  score_school decimal,
  score_environment decimal,
  score_commercial decimal,
  score_complex decimal,
  total_score decimal,        -- 자동 계산 (평균)
  photos text[],
  review text,
  created_at timestamp
)

-- 관심 아파트
favorite_apartments (
  id uuid PK,
  apartment_name text,
  location text,
  created_at timestamp
)

-- 부부 D-day
ddays (
  id uuid PK,
  title text,
  date date,
  emoji text,
  created_at timestamp
)

-- 위시리스트
wishlist (
  id uuid PK,
  title text,
  category text,         -- 'item', 'place', 'experience'
  is_done boolean DEFAULT false,
  created_at timestamp
)

-- 갤러리 앨범
albums (
  id uuid PK,
  title text,
  description text,
  photos text[],
  is_public boolean DEFAULT false,
  created_at timestamp
)

-- 무드 기록
moods (
  id uuid PK,
  date date UNIQUE,
  emoji text,
  created_at timestamp
)

-- 부부 한마디
couple_notes (
  id uuid PK,
  message text,
  author text,           -- 'sophia' or 'partner'
  created_at timestamp
)
```

---

## 8. 인터랙션 & 애니메이션 명세

| 요소 | 효과 | 구현 방식 |
|------|------|----------|
| 페이지 첫 진입 | 로고 타이핑 애니메이션 (한 글자씩, 커서 깜빡임) + 소개글 fade-in | CSS keyframes |
| 카테고리 탭 전환 | 언더라인 슬라이드 + 콘텐츠 fade | CSS transition |
| 카드 스크롤 진입 | stagger fade-up (0.1s 딜레이) | Intersection Observer + CSS |
| 카드 호버 | translateY(-8px) + 포인트 그림자 + 이미지 scale(1.05) | CSS hover |
| 페이지 전환 | fade + 슬라이드 | Framer Motion |
| 다크모드 토글 | 아이콘 회전 + 배경 0.3s transition | CSS transition |
| PIN 모달 등장 | 바텀 슬라이드업 + 블러 백드롭 | CSS animation |
| PIN 도트 입력 | 채워지며 바운스 | CSS keyframes |
| PIN 성공 | 도트 초록 → 화면 확장 전환 | Framer Motion |
| PIN 실패 | 도트 빨강 → shake | CSS keyframes |
| 넘버패드 터치 | ripple 효과 | CSS |
| 대시보드 진입 | 전체 화면 확장 애니메이션 | Framer Motion |
| 차트 로드 | draw 애니메이션 (선 그리기) | recharts animationBegin |
| 체크박스 완료 | 그린 체크 + 텍스트 취소선 애니메이션 | CSS transition |
| 추억 카드 | fade-in + 사진 패럴랙스 | CSS |
| 모달 | 블러 백드롭 + 슬라이드업 | CSS |
| 스크롤 | scroll-behavior: smooth | CSS |

---

## 9. 반응형 디자인

### 브레이크포인트
- Desktop: 1024px 이상 (3열 그리드, 사이드바 펼침)
- Tablet: 768px ~ 1023px (2열 그리드, 사이드바 접힘)
- Mobile: 767px 이하 (1~2열, 햄버거 메뉴)

### 모바일 변환 규칙
| 데스크탑 | 모바일 |
|---------|--------|
| 사이드바 (항상 표시) | 햄버거 메뉴 (☰) → 슬라이드 오버레이 |
| 카드 그리드 3열 | 2열 또는 1열 |
| 대시보드 위젯 2열 | 세로 스택 (1열) |
| 로고 (큰 볼드체) | 사이즈 축소 (28-32px) |
| 카테고리 탭 (한 줄) | 가로 스크롤 |
| PIN 넘버패드 | 큰 터치 영역 (최소 48px) |
| 차트 | 가로 스크롤 또는 축소 |

---

## 10. 외부 API 연동

| 기능 | API/소스 | 비고 |
|------|---------|------|
| 실거래가 | 국토교통부 공공 API | 아파트 실거래가 조회 |
| 공포탐욕지수 | CNN Fear & Greed (크롤링 또는 대체 API) | 실시간 지수 |
| 환율 | ExchangeRate API 또는 한국은행 API | USD/KRW |
| 주요 지표 | Yahoo Finance API 또는 대체 | 코스피, S&P500, 나스닥, BTC |
| 뉴스 | RSS (연합뉴스, 한경, Reuters) | 헤드라인 스크래핑 |

---

## 11. 마일스톤

| Phase | 목표 | 핵심 산출물 |
|-------|------|-----------|
| **Phase 1** | 블로그 + 숨겨진 PIN 인증 | 공개 블로그(매거진 레이아웃), PIN 인증, 대시보드 레이아웃 껍데기, 다크모드 |
| **Phase 2** | 일정 관리 + 가계부 | 체크리스트, 캘린더, 플래너, 수입/지출 입력/분석 |
| **Phase 3** | 자산 & 경제 대시보드 | 자산 추이 그래프, 공포지수, 환율, 뉴스, 경제 지표 |
| **Phase 4** | 부동산 리서치 | 실거래가 검색, 구매 시뮬레이터, 임장 노트/비교표 |
| **Phase 5** | 부부 기능 + 갤러리 + 고도화 | D-day, 위시리스트, 갤러리, 추억 알림, 무드 이모지, 부부 한마디 |

---

## 12. 리스크 & 대응

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| Bolt.new 무료 토큰 소진 | 높음 | Phase 1에 집중, 이후 코드 다운로드 후 직접 개발 |
| 공공 API 호출 제한 | 중간 | 캐싱 적용 (1시간~1일), 요청 최소화 |
| 사진 저장 용량 | 낮음 | Supabase Storage 무료 1GB, 이미지 압축 적용 |
| Bolt.new 복잡한 기능 한계 | 높음 | 기본 구조만 Bolt에서, 세부 로직은 직접 구현 |
| 부동산 API 데이터 정확도 | 중간 | 공공 데이터 기반으로 참고용 표시, 면책 문구 |
