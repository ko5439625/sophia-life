# sophia.life 프로젝트 컨텍스트

## 개요
겉은 감성 블로그, 안은 부부 전용 생활 관리 대시보드 (자산/일정/부동산/경제)
닉네임: 무요 & 데굴

## 기술 스택
- Frontend: React, TypeScript, Tailwind CSS, Framer Motion, Recharts
- Backend: Supabase (DB + Edge Functions + Storage)
- 배포: Vercel (Hobby) - CLI 배포: `npx vercel --prod --yes`
- 빌드: Vite

## Supabase
- Project ref: `atjmxzdlhshdplhvnens`
- URL: `https://atjmxzdlhshdplhvnens.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0am14emRsaHNoZHBsaHZuZW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mjc3MTcsImV4cCI6MjA4OTMwMzcxN30.WumIlmsKLXGnbgQLGylsW2PvargXRc-RwLYguBRT5EE`
- Access Token: `sbp_a0a938d63d2231e939382ee1564504ea12275201`
- Edge Function 배포: `SUPABASE_ACCESS_TOKEN=sbp_a0a938d63d2231e939382ee1564504ea12275201 npx supabase functions deploy api-proxy --project-ref atjmxzdlhshdplhvnens`
- Storage: `blog-images` 버킷 (public)

## Vercel
- 계정: `goahyeon12-7194s-projects` (로그인: goahyeon12@gmail.com)
- 도메인: `sophia-life.vercel.app`
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- GitHub push가 Blocked되면 CLI로 직접 배포

## Git
- repo: `ko5439625/sophia-life`
- user.name: `ko5439625` / user.email: `goahyeon12@gmail.com`

## API 프록시 (Edge Function: api-proxy)
yahoo-quote, yahoo-historical, yahoo-news, yahoo-search, news, molit-trade, subscription, alpha-quote, weather, kakao-search, fear-greed

## DB 테이블
posts, todos, events, plans, budgets, finances, holdings, trades, pension_funds, inspections, ddays, wishes, albums, memos, user_settings, favorite_apartments, owned_properties

## user_settings 주요 필드
- `api_keys` (jsonb): API 키 + 자산 기초값 (cashHoldings, pensionSavings, irpBalance, dcBalance, baseRate)
- `blog_categories`: ["일상","개발","여행","웨딩"]
- `locked_categories`: ["웨딩"]
- `annual_income1/2`, `cash_savings`, `emergency_fund`, `monthly_loan_payment`
- user_settings ID: `c7a9defe-0e45-57e0-9b26-4ef82dd867c1`

## 중요 규칙
- **mock 데이터 금지**: API 실패 시 가짜 데이터 표시하면 안 됨
- `finances` 테이블 사용 (이전 `expenses` → 수정됨)
- `.single()` 대신 `.maybeSingle()` 사용
- ID는 반드시 `crypto.randomUUID()` (Date.now() 사용 금지 - UUID 타입 불일치)
- 속닥속닥: sophia=데굴, partner=무요
- 배포 후 Build Note 작성

## 남은 작업

### 자산 탭 구조 개편 (최우선)
- [ ] 탭 순서: 예산 계획 → 지출 관리 → 자산 현황
- [ ] 지출 관리 탭:
  - 예산 카테고리별 예산 가져와서 실제 지출 대비
  - 추가 지출 입력 시 사유/메모 (왜 추가됐는지)
  - 비상금/현금 실시간 변동
  - AI 분석: 지출 패턴 → 다음달 예산 계획 제안
- [ ] 예산 카테고리 설정에서 커스텀 (보험 등 추가)
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
