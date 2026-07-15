# sophia.life 프로젝트 컨텍스트

## 개요
겉은 감성 블로그, 안은 부부 전용 생활 관리 대시보드 (자산/일정/부동산/경제/채팅/웨딩)
닉네임: 무요 & 데굴

## 기술 스택
- Frontend: React 18, TypeScript, Tailwind CSS 3, Framer Motion, Recharts
- UI 라이브러리: shadcn/ui (Radix UI 기반, 48개 컴포넌트)
- 상태관리: React Context (financialStore), React Query (TanStack Query)
- Backend: Supabase (PostgreSQL + Realtime + Edge Functions + Storage)
- 빌드: Vite 8
- 라우팅: React Router v6

## 계정 정보

### GitHub
- repo: `ko5439625/sophia-life`
- user.name: `ko5439625`
- user.email: `goahyeon12@gmail.com`
- 커밋 시: `GIT_COMMITTER_NAME="ko5439625" GIT_COMMITTER_EMAIL="goahyeon12@gmail.com" git commit --author="ko5439625 <goahyeon12@gmail.com>"`

### Cloudflare Pages (메인 배포)
- API Token: `~/.claude/secrets/cloudflare` 파일 참조
- 프로젝트: `sophia-life`
- 도메인: `sophia-life.pages.dev`
- 빌드 & 배포:
  ```bash
  npx vite build && export CLOUDFLARE_API_TOKEN=$(cat ~/.claude/secrets/cloudflare) && npx wrangler pages deploy dist --project-name=sophia-life
  ```

### Supabase
- Project ref: `atjmxzdlhshdplhvnens`
- URL: `https://atjmxzdlhshdplhvnens.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0am14emRsaHNoZHBsaHZuZW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mjc3MTcsImV4cCI6MjA4OTMwMzcxN30.WumIlmsKLXGnbgQLGylsW2PvargXRc-RwLYguBRT5EE`
- Access Token: `~/.claude/secrets/supabase-access-token` 파일 참조
- Edge Function 배포:
  ```bash
  SUPABASE_ACCESS_TOKEN=$(cat ~/.claude/secrets/supabase-access-token) npx supabase functions deploy api-proxy --project-ref atjmxzdlhshdplhvnens
  ```
- Storage: `blog-images` 버킷 (public)

## 프로젝트 구조

```
src/
├── components/
│   ├── dashboard/           # 메인 대시보드
│   │   ├── DashboardLayout.tsx  # 레이아웃 + 내비게이션 (사이드바/바텀탭)
│   │   ├── home/            # 홈 대시보드
│   │   ├── schedule/        # 일정 (CalendarTab, ChecklistTab, PlannerTab)
│   │   ├── finance/         # 자산 (BudgetPlan, ExpenseAnalysis, AssetOverview, InvestmentView, HedgingView, TradingView, QuantRecommendView)
│   │   ├── couple/          # 기록 (CoupleView)
│   │   ├── wedding/         # 웨딩 (WeddingView, WeddingSettlement, VendorDetail, ReceiptModal)
│   │   ├── blog/            # 블로그 관리 (BlogManagement)
│   │   ├── chat/            # 채팅 (ChatView)
│   │   ├── investment/      # 투자 (InvestmentHub, PensionView)
│   │   ├── realestate/      # 부동산 (RealEstateHub, PropertySearch, ListingMonitor)
│   │   ├── gallery/         # 갤러리 (GalleryView)
│   │   └── settings/        # 설정 (SettingsView)
│   ├── blog/                # 블로그 퍼블릭 UI
│   └── ui/                  # shadcn/ui 컴포넌트 (48개)
├── services/                # API 클라이언트
│   ├── supabaseSync.ts      # DB CRUD (핵심)
│   ├── chatService.ts       # 채팅 메시지/인증
│   ├── yahooFinanceApi.ts   # 주식/환율
│   ├── geminiApi.ts         # AI 분석
│   ├── marketApi.ts         # 시장 데이터 집계
│   ├── realEstateApi.ts     # 부동산 실거래가
│   ├── proxyFetch.ts        # Edge Function CORS 프록시
│   └── [기타 API 서비스들]
├── store/financialStore.tsx # 자산 상태관리 (Context)
├── hooks/                   # 커스텀 훅 (useIsMobile, useGuestMode 등)
├── lib/                     # 유틸리티 (supabase 클라이언트, mockData)
├── pages/                   # 라우트 (Index, Dashboard, BlogPost)
└── types/                   # 타입 정의
```

## 내비게이션 구조

### 데스크탑 (사이드바)
홈, 일정, 자산, 기록, 웨딩, 블로그, 투자, 뉴스, 부동산, 채팅, 설정

### 모바일 (바텀 탭 5개 + 더보기)
- 바텀 탭: 홈, 일정, 채팅, 우리, 더보기
- 더보기 메뉴: 자산, 웨딩, 블로그, 투자, 뉴스, 부동산, 설정

## API 프록시 (Edge Function: api-proxy)
yahoo-quote, yahoo-historical, yahoo-news, yahoo-search, news, molit-trade, subscription, alpha-quote, weather, kakao-search, fear-greed

## DB 테이블
posts, todos, events, plans, budgets, finances, holdings, trades, pension_funds, inspections, ddays, wishes, albums, memos, user_settings, favorite_apartments, owned_properties, chat_messages, chat_notices, wedding_items, wedding_vendors, wedding_settlement_items, wedding_receipts

## user_settings (ID: c7a9defe-0e45-57e0-9b26-4ef82dd867c1)
- `api_keys` (jsonb): API 키 + 자산 기초값 (cashHoldings, pensionSavings, irpBalance, dcBalance, baseRate)
- `blog_categories`, `locked_categories`
- `annual_income1/2`, `cash_savings`, `emergency_fund`, `monthly_loan_payment`

## 채팅 시스템
- 인증: PIN 기반 (950520=데굴, 930330=무요)
- 저장: `chat_messages` 테이블 + Supabase Realtime
- 자동삭제: pg_cron으로 매시간 KST 이전 날짜 메시지 삭제
- 레드닷: DashboardLayout에서 Realtime INSERT 감지
- 관련 프로젝트: `/Users/ahyeon/qa-jj-v2` (Electron 데스크탑 앱, 동일 Supabase 백엔드)

## 중요 규칙
- **mock 데이터 금지**: API 실패 시 가짜 데이터 표시하면 안 됨
- `finances` 테이블 사용 (이전 `expenses` → 수정됨)
- `.single()` 대신 `.maybeSingle()` 사용
- ID는 반드시 `crypto.randomUUID()` (Date.now() 사용 금지 - UUID 타입 불일치)
- 속닥속닥: sophia=데굴, partner=무요
- 모바일 텍스트: `text-[10px]` 이하 사용 금지, 최소 `text-[11px]`
- iOS 줌 방지: input/textarea/select는 모바일에서 16px 강제 (index.css)
- viewport: `maximum-scale=1.0, user-scalable=no`
- 배포는 Cloudflare Pages (Vercel 아님)

## 남은 작업

### 자산 탭 구조 개편 (최우선)
- [ ] 탭 순서: 예산 계획 -> 지출 관리 -> 자산 현황
- [ ] 지출 관리: 예산 대비 실제 지출, 사유/메모, 비상금/현금 변동, AI 분석
- [ ] 예산 카테고리 커스텀 (보험 등 추가)
- [ ] 자산 현황 = 예산+지출 기반 동적 변화

### 블로그 에디터 개선
- [ ] 폰트 통일, 정렬 기능
- [ ] 썸네일 선택 (디폴트=무요데굴 캐릭터 / 본문 이미지)

### 부동산
- [ ] DSR/LTV 게이지 (검색 시 조절)
- [ ] 국토교통부 API: https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev
- [ ] API 키: dfd8fd84ad88cb8b22de327431b426937dd4a6aae1fbf51599fea2c6d5c99c54

### 기타
- [ ] 갤러리 Supabase 연동
- [ ] 설정 > 데이터 초기화 버튼
- [ ] 증권사 API 검토 (한국투자증권 Open API)
- [ ] 커밋 미반영 작업 push 필요 (모바일 내비, 디자인 개편, 웨딩 정산, 모바일 최적화)

## 최근 완료 작업
- [x] 모바일 바텀 내비게이션 (홈/일정/채팅/우리/더보기)
- [x] 더보기 팝업 메뉴 (4열 그리드)
- [x] 채팅 안읽은 메시지 레드닷 (Supabase Realtime)
- [x] 액센트 컬러 스카이블루 (#60a5fa)
- [x] 그래디언트 제거 -> 플랫 컬러
- [x] iOS Safari 줌 방지 (viewport + CSS)
- [x] 전체 뷰 모바일 최적화 (text-[11px] 최소, 터치 타겟)
- [x] 웨딩 정산 시스템 (업체별 정산, 영수증 AI, 체크리스트 연동)
- [x] 채팅 기능 (웹+데스크탑 실시간 동기화, 자동삭제)
