# PRD: 웨딩 정산 Google Sheets (Apps Script)

> 버전: 1.0
> 작성일: 2026-05-14
> 상태: Draft

---

## 1. 개요

### 1.1 배경
sophia-life 웹앱의 웨딩 정산 기능을 **Google Sheets + Apps Script** 기반으로 이식한다. 클라우드 기반으로 커플이 동시 편집 가능하고, 모바일/PC 어디서든 접근 가능하며, Gemini Vision API를 활용한 영수증 AI 분석 기능을 내장한다.

### 1.2 목표
- 웹앱의 정산 대시보드 + 업체별 디테일을 Google Sheets로 1:1 재현
- Apps Script로 Gemini Vision API 연동 (영수증/견적서 AI 자동 분석)
- 사이드바/모달 기반 UI로 편리한 데이터 입력
- Google Drive 연동으로 영수증 파일 관리
- API Key 안전 저장 (PropertiesService)

### 1.3 대상 사용자
- 결혼 준비 중인 커플 (주 사용자: 아현, 재준)
- Google 계정 사용자, 모바일/PC 동시 접근 필요

### 1.4 엑셀 VBA 대비 장점

| 항목 | 엑셀 VBA | Google Sheets |
|------|----------|---------------|
| API 호출 | WinHttpRequest (보안 이슈) | `UrlFetchApp` (네이티브) |
| API Key 저장 | 레지스트리/숨김셀 | `PropertiesService` (서버측 암호화) |
| UI | UserForm (Windows 전용) | HTML Service (웹 모달, 크로스플랫폼) |
| 공유 | 파일 복사 | 링크 공유 + 동시 편집 |
| 모바일 | 불가 | Google Sheets 앱으로 열람/편집 |
| 파일 첨부 | 로컬 경로만 | Google Drive 자동 연동 |
| 오프라인 | 완전 지원 | 제한적 (오프라인 모드 설정 시 가능) |
| 트리거 | 수동/이벤트 | 시간 기반 자동 트리거 가능 |

---

## 2. 시트 구조

### 2.1 스프레드시트 구성

| # | 시트명 | 역할 | 보호 |
|---|--------|------|------|
| 1 | **대시보드** | 전체 요약 통계, 업체별 진행 현황, 결제자별 분담 | 수식 셀 보호 |
| 2 | **업체목록** | 업체 마스터 데이터 (CRUD) | - |
| 3 | **정산내역** | 전체 정산 항목 (업체별 필터 가능) | - |
| 4 | **영수증로그** | AI 분석 결과 + 영수증 메타데이터 | - |
| 5 | **설정** | 결제자명, 카테고리 매핑 등 (API Key는 PropertiesService) | 숨김 |

---

## 3. 시트별 상세 설계

### 3.1 대시보드 시트

#### 3.1.1 요약 영역 (Row 1~6)

```
┌─────────────────────────────────────────────────────────────────────┐
│  웨딩 정산 대시보드                          [AI 분석] [설정] [새로고침] │
├──────────┬──────────┬──────────┬──────────┬────────────────────────┤
│  총 금액   │  결제 완료  │   잔금    │  진행률   │  결제자별 분담            │
│₩50,000,000│₩35,000,000│₩15,000,000│   70%   │ 아현: ₩20,000,000       │
│           │          │          │ ████░░░ │ 재준: ₩12,000,000       │
│           │          │          │         │ 공동: ₩3,000,000        │
└──────────┴──────────┴──────────┴──────────┴────────────────────────┘
```

**셀 수식:**

| 셀 | 내용 | 수식 |
|----|------|------|
| B3 | 총 금액 | `=SUMPRODUCT((정산내역!K2:K<>"service")*(정산내역!N2:N<>"Y")*정산내역!H2:H)` |
| C3 | 결제 완료 | Apps Script로 계산 (partial의 paidAmount 처리 필요) |
| D3 | 잔금 | `=B3-C3` |
| E3 | 진행률 | `=IF(B3>0, C3/B3, 0)` + SPARKLINE 바 |
| F3~F5 | 결제자별 | SUMPRODUCT per payer |

**SPARKLINE 진행바:**
```
=SPARKLINE(E3, {"charttype","bar";"max",1;"color1","#F43F5E";"color2","#F3F4F6"})
```

#### 3.1.2 업체별 현황 테이블 (Row 8~)

| 열 | 헤더 | 내용 |
|----|------|------|
| A | 이모지 | 카테고리 이모지 |
| B | 업체명 | 업체목록 참조 |
| C | 카테고리 | 한글 카테고리명 |
| D | 총 금액 | SUMIFS (서비스/선납 제외) |
| E | 결제 완료 | SUMIFS (paid + partial paidAmount) |
| F | 잔금 | =D-E |
| G | 진행률 | =IF(D>0,E/D,0) + SPARKLINE 바 |
| H | 상태 | "완납"/"일부"/"예정" |
| I | 잔금일 | finalPaymentDate |
| J | D-Day | =IF(I<>"", I-TODAY(), "") |

**조건부서식:**
- 상태="완납" → 배경 #D1FAE5, 폰트 #059669
- 상태="일부" → 배경 #FEF3C7, 폰트 #B45309
- D-Day 0~7 → 배경 #FEE2E2, 폰트 #DC2626

---

### 3.2 업체목록 시트

| 열 | 헤더 | 유효성 검사 | 설명 |
|----|------|-----------|------|
| A | id | 자동 (Apps Script) | UUID |
| B | 업체명 | 필수 | 텍스트 |
| C | 카테고리 | 드롭다운: 설정!카테고리 | venue/studio/... |
| D | 카테고리명 | 자동 | =VLOOKUP or SWITCH |
| E | 이모지 | 자동/수동 | 카테고리 기본값 |
| F | 계약일 | 날짜 | yyyy-mm-dd |
| G | 잔금일 | 날짜 | D-Day 기준 |
| H | VAT 적용 | 체크박스 | TRUE/FALSE |
| I | 코멘트 | 텍스트 | 메모 |
| J | 생성일 | 자동 | Timestamp |
| K | 수정일 | 자동 | Timestamp |

---

### 3.3 정산내역 시트

| 열 | 헤더 | 유효성 검사 | 설명 |
|----|------|-----------|------|
| A | id | 자동 | UUID |
| B | vendorId | 참조 | 업체목록!A |
| C | 업체명 | 자동 | =VLOOKUP |
| D | 내역명 | 필수 | 텍스트 |
| E | 설명 | 선택 | "₩80,000 x 200명" |
| F | 단가 | 숫자 | 선택 |
| G | 수량 | 숫자 | 선택 |
| H | 금액 | 숫자 | 필수 |
| I | 결제자 | 드롭다운 | 미정/아현/재준/공동 |
| J | 결제수단 | 드롭다운 | 미결제/신용 일시불/... |
| K | 납부상태 | 드롭다운 | 미결제/일부 완납/완납/서비스 |
| L | 결제일 | 날짜 | 실제 결제일 |
| M | 납부금액 | 숫자 | 일부완납 시 |
| N | 선납여부 | 체크박스 | TRUE/FALSE |
| O | 정렬순서 | 숫자 | 업체 내 순서 |

**조건부서식 (결제자별):**
- 아현 → 배경 #E0E7FF, 폰트 #4338CA
- 재준 → 배경 #CCFBF1, 폰트 #0F766E
- 공동 → 배경 #F3E8FF, 폰트 #7E22CE
- 미정 → 배경 #E6E6E6, 폰트 #787878

**조건부서식 (납부상태):**
- 완납 → 배경 #D1FAE5, 폰트 #059669
- 일부 완납 → 배경 #FEF3C7, 폰트 #B45309
- 서비스 → 배경 #E0F2FE, 폰트 #0369A1
- 미결제 → 배경 #E6E6E6

---

### 3.4 영수증로그 시트

| 열 | 헤더 | 설명 |
|----|------|------|
| A | id | 자동 |
| B | vendorId | 연결 업체 |
| C | 업체명 | 자동 참조 |
| D | 파일명 | 원본 파일명 |
| E | Drive 링크 | Google Drive 파일 URL (하이퍼링크) |
| F | 파일크기 | KB |
| G | MIME타입 | image/jpeg 등 |
| H | 배지타입 | contract/deposit/final/extra/quote |
| I | 업로드일 | Timestamp |
| J | AI모델 | gemini-2.5-flash 등 |
| K | 신뢰도 | 0~1 (퍼센트 서식) |
| L | 추출 총액 | AI 인식 금액 |
| M | 항목수 | 추출된 항목 수 |
| N | 사용자메모 | 분석 시 입력 메모 |
| O | 원본JSON | AI 응답 (Note로 표시, 더블클릭 시 전체) |

---

### 3.5 설정 시트 (숨김)

| 영역 | 셀 범위 | 내용 |
|------|---------|------|
| API Key 상태 | B2 | "설정됨" / "미설정" (실제 키는 PropertiesService) |
| 결제자 목록 | B5:B8 | 미정, 아현, 재준, 공동 |
| 카테고리 매핑 | A11:C17 | venue→웨딩홀→💒, studio→스튜디오→📸, ... |
| 결제수단 목록 | B20:B25 | 미결제/신용 일시불/... |
| 납부상태 목록 | B28:B31 | 미결제/일부 완납/완납/서비스 |
| Gemini 모델 | B34:B36 | gemini-2.5-flash / flash-lite / pro |

---

## 4. Apps Script 구조

### 4.1 파일 구조

```
프로젝트/
├── Code.gs              # 진입점, 메뉴 등록, 초기화
├── Vendor.gs            # 업체 CRUD
├── Item.gs              # 정산항목 CRUD, VAT
├── Gemini.gs            # Gemini API 호출, 파싱
├── Dashboard.gs         # 대시보드 갱신 로직
├── Format.gs            # 포맷팅, 조건부서식, 색상
├── Export.gs            # CSV 내보내기
├── sidebar.html         # AI 분석 사이드바 UI
├── preview-dialog.html  # 분석 결과 미리보기 모달
├── apikey-dialog.html   # API Key 설정 모달
└── styles.html          # 공통 CSS
```

### 4.2 메뉴 등록

```javascript
// Code.gs
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('웨딩 정산')
    .addItem('AI 영수증 분석', 'showReceiptAnalysis')
    .addItem('새 업체 추가', 'showAddVendor')
    .addSeparator()
    .addItem('대시보드 새로고침', 'refreshDashboard')
    .addItem('CSV 내보내기', 'exportToCsv')
    .addSeparator()
    .addItem('API Key 설정', 'showApiKeySettings')
    .addItem('초기 설정', 'initializeSpreadsheet')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}
```

### 4.3 주요 함수

```javascript
// === Code.gs ===
function onOpen()                          // 메뉴 등록
function initializeSpreadsheet()           // 시트 생성, 헤더, 유효성, 조건부서식 설정
function refreshDashboard()                // 대시보드 통계 재계산
function showReceiptAnalysis()             // AI 분석 사이드바 표시
function showApiKeySettings()              // API Key 설정 모달 표시

// === Vendor.gs ===
function addVendor(name, category, contractDate, finalPaymentDate, comment)
function updateVendor(vendorId, field, value)
function deleteVendor(vendorId)            // CASCADE: 정산내역 + 영수증로그도 삭제
function getVendorList()                   // 업체 목록 반환 (UI용)
function getVendorRow(vendorId)            // vendorId → 행 번호

// === Item.gs ===
function addItem(vendorId, name, amount, payer, method, status, ...)
function addItems(vendorId, itemsArray)    // 다중 항목 일괄 추가
function updateItem(itemId, field, value)
function deleteItem(itemId)
function applyVAT(vendorId)                // VAT 10% 일괄 적용
function removeVAT(vendorId)               // VAT 제거
function getVendorTotal(vendorId)          // 업체별 합계
function getVendorPaid(vendorId)           // 업체별 결제 완료

// === Gemini.gs ===
function analyzeReceipt(fileIds, memo)     // Drive 파일 → Gemini API → 파싱 결과
function callGeminiApi(model, payload)     // UrlFetchApp 호출
function fileToBase64(fileId)              // Drive 파일 → Base64
function safeParseJson(rawText)            // 웹앱 로직 이식
function getApiKey()                       // PropertiesService에서 읽기
function saveApiKey(key)                   // PropertiesService에 저장
function testApiKey(key)                   // 키 유효성 테스트

// === Dashboard.gs ===
function refreshDashboard()                // 전체 통계 갱신
function calcGlobalStats()                 // 총액/결제완료/잔금/진행률
function calcPayerStats()                  // 결제자별 분담액
function calcVendorSummary()               // 업체별 현황 테이블 갱신

// === Format.gs ===
function formatWon(amount)                 // ₩50만, ₩1.5억 등
function calcDDay(targetDate)              // D-Day, D-7, D+3 등
function applyAllConditionalFormats()      // 전 시트 조건부서식 설정
function getPayerColor(payer)              // {bg: "#E0E7FF", font: "#4338CA"}
function getStatusColor(status)

// === Export.gs ===
function exportToCsv()                     // CSV 생성 → Drive에 저장 + 다운로드 링크
```

---

## 5. AI 영수증 분석 기능

### 5.1 사용자 흐름

```
1. 메뉴 > 웨딩 정산 > AI 영수증 분석
   └─ 또는 대시보드 [AI 분석] 버튼
        ↓
2. 사이드바 표시 (sidebar.html)
   ├─ Google Drive 파일 선택 (Picker API)
   │   또는 로컬 파일 업로드 → 자동으로 Drive 저장
   ├─ 첨부 파일 목록 (썸네일 + 파일명 + 크기)
   ├─ 내용 메모 입력 (textarea)
   │   힌트: "업체명 / 카테고리 / 결제자·결제수단을 적으면 정확도 UP"
   └─ [AI 분석 시작] 버튼
        ↓
3. 분석 진행 (서버측 Apps Script)
   ├─ Drive 파일 → Base64 인코딩
   ├─ Gemini API 호출 (모델 Fallback: flash → flash-lite → pro)
   ├─ JSON 파싱 (safeParseJson)
   └─ 결과를 클라이언트로 반환
        ↓
4. 결과 미리보기 모달 (preview-dialog.html)
   ├─ 업체명 (편집 가능)
   ├─ 카테고리 (드롭다운)
   ├─ 신뢰도 배지 ("AI 분석 완료 · 신뢰도 92%")
   ├─ 항목 테이블 (편집 가능)
   │   ├─ 내역명 | 설명 | 결제자 | 결제수단 | 상태 | 금액
   │   ├─ 행 추가/삭제
   │   └─ 합계 + VAT 버튼
   └─ [확정 추가] 버튼
        ↓
5. 데이터 반영 (서버측)
   ├─ 업체목록 시트에 업체 추가
   ├─ 정산내역 시트에 항목 추가
   ├─ 영수증로그에 분석 결과 기록
   ├─ 파일을 Drive 전용 폴더로 이동
   └─ 대시보드 자동 갱신
```

### 5.2 Google Drive Picker 연동

```javascript
// sidebar.html 내 Picker API 활용
function createPicker() {
  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.DOCS_IMAGES)
    .addView(google.picker.ViewId.PDFS)
    .setOAuthToken(oauthToken)
    .setCallback(pickerCallback)
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setTitle('영수증/견적서 선택')
    .build();
  picker.setVisible(true);
}
```

또는 간단한 로컬 파일 업로드:
```html
<input type="file" multiple accept="image/*,.pdf,.heic" id="fileInput" />
```
→ 업로드된 파일은 Apps Script에서 Drive 전용 폴더에 저장

### 5.3 Drive 폴더 구조

```
My Drive/
└── 웨딩 정산/
    └── 영수증/
        ├── {업체명}_계약서.pdf
        ├── {업체명}_견적서.jpg
        └── ...
```

폴더 자동 생성: `initializeSpreadsheet()` 시 생성

---

## 6. API Key 설정

### 6.1 저장 방식

```javascript
// PropertiesService (서버측, 암호화된 저장)
function saveApiKey(key) {
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', key);
}

function getApiKey() {
  return PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
}
```

**장점:**
- 스프레드시트 파일에 키가 포함되지 않음
- 사용자별 개별 저장 (공유 시트에서도 각자의 키 사용)
- Google 서버측 암호화

### 6.2 설정 UI (apikey-dialog.html)

```html
┌─────────────────────────────────────────────┐
│  Gemini API Key 설정                    [X] │
├─────────────────────────────────────────────┤
│                                             │
│  현재 상태: ✅ 설정됨 (AIza...xxxx)         │
│                                             │
│  API Key:                                   │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Google AI Studio에서 발급:                  │
│  🔗 https://aistudio.google.com/apikey      │
│                                             │
│  모델: gemini-2.5-flash (자동 fallback)      │
│                                             │
│       [연결 테스트]     [저장]    [취소]      │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.3 연결 테스트

```javascript
function testApiKey(key) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }],
        generationConfig: { maxOutputTokens: 10 }
      }),
      muteHttpExceptions: true
    });
    return res.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}
```

---

## 7. Gemini API 연동 상세

### 7.1 API 호출

```javascript
// Gemini.gs
function callGeminiApi(model, payload) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();

  if (code !== 200) {
    const errText = res.getContentText().substring(0, 300);
    throw new Error(`Gemini API 오류 (${code}): ${errText}`);
  }

  return JSON.parse(res.getContentText());
}
```

### 7.2 모델 Fallback 체인

```javascript
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

function analyzeReceipt(fileIds, memo) {
  const parts = [];

  // Drive 파일들을 Base64로 변환하여 parts에 추가
  for (const fileId of fileIds) {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();

    parts.push({
      inlineData: { mimeType, data: base64 }
    });
  }

  parts.push({ text: buildPrompt(memo) });

  // Fallback 시도
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    try {
      const isThinking = model === 'gemini-2.5-flash' || model === 'gemini-2.5-pro';
      const payload = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          ...(isThinking ? { thinkingConfig: { thinkingBudget: 1024 } } : {})
        }
      };

      const data = callGeminiApi(model, payload);
      const responseParts = data.candidates?.[0]?.content?.parts;
      if (!responseParts?.length) { lastError = `${model}: empty`; continue; }

      // thinking이 아닌 text part 추출
      let text = '';
      for (let i = responseParts.length - 1; i >= 0; i--) {
        if (!responseParts[i].thought && responseParts[i].text) {
          text = responseParts[i].text;
          break;
        }
      }
      if (!text) text = responseParts[responseParts.length - 1]?.text || '';

      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return safeParseJson(cleaned);

    } catch (e) {
      lastError = e.message;
      Logger.log(`[Gemini] ${model} failed: ${lastError}`);
      if (lastError.includes('429') || lastError.includes('503') || lastError.includes('404')) {
        continue;
      }
      throw e;
    }
  }

  throw new Error(`모든 AI 모델 실패: ${lastError}`);
}
```

### 7.3 프롬프트 (웹앱과 동일)

```javascript
function buildPrompt(userMemo) {
  return `당신은 결혼 준비 영수증/견적서/계약서 분석 전문가입니다.
첨부된 파일을 분석하여 JSON으로 응답하세요.

## 핵심 규칙
- 문서에 적힌 숫자를 그대로 사용하세요. 절대 추측하지 마세요.
- "할인 금액" 열이 있으면 할인 금액 기준으로 추출하세요.
- "서비스"로 표시된 항목(무료 제공)은 amount: 0, paymentStatus: "service"로 설정하세요.
- 단가x수량 패턴이 있으면 description에 "₩80,000 x 200명"처럼 기록하세요.
- 계약금이 명시되어 있으면 별도 행으로 isPrepayment: true, paymentStatus: "paid"로 넣으세요.
- "Grand Total + VAT" 또는 "VAT 포함" 줄이 있으면 반드시 그 금액을 totalAmount에 넣으세요.

## 사용자 메모
${userMemo || '(없음)'}

## 필드값 가이드
- vendorCategory: venue | studio | dress | makeup | gift | honeymoon | other
- payer: unset | ahyun | jaejun | share (아현=ahyun, 재준=jaejun)
- paymentMethod: unpaid | credit-once | credit-installment | check | cash-receipt | transfer
- paymentStatus: unpaid | partial | paid | service

## JSON 스키마
{"vendorName":"","vendorCategory":"venue","emoji":"💒","totalAmount":0,
 "items":[{"name":"","description":"","unitPrice":0,"quantity":0,"amount":0,
 "payer":"unset","paymentMethod":"unpaid","paymentStatus":"unpaid","isPrepayment":false}],
 "confidence":0.9,"notes":""}`;
}
```

### 7.4 safeParseJson (Apps Script 이식)

```javascript
function safeParseJson(raw) {
  // 1. 직접 파싱
  try { return JSON.parse(raw); } catch (e) { /* continue */ }

  // 2. {...} 추출
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

  let json = match[0];

  // 3. trailing comma 제거
  json = json.replace(/,\s*([}\]])/g, '$1');

  // 4. missing comma 보정
  json = json.replace(/(\})\s*\n(\s*\{)/g, '$1,\n$2');
  json = json.replace(/(\])\s*\n(\s*\[)/g, '$1,\n$2');
  json = json.replace(/(["}\]\d])\s*\n(\s*")/g, '$1,\n$2');
  json = json.replace(/(["}\]\d])\s+(["{\[])/g, '$1, $2');

  // 5. boolean/null 뒤 comma
  json = json.replace(/(true|false|null)\s*\n(\s*")/g, '$1,\n$2');

  try { return JSON.parse(json); } catch (e) { /* continue */ }

  // 6. 최후 시도
  json = json.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  json = json.replace(/,\s*,/g, ',');

  try { return JSON.parse(json); } catch (e) {
    throw new Error('AI 응답 파싱 실패: ' + e.message);
  }
}
```

### 7.5 Drive 파일 → Base64

```javascript
function fileToBase64(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return Utilities.base64Encode(blob.getBytes());
}
```

`Utilities.base64Encode`이 네이티브 지원이므로 VBA보다 훨씬 간단하다.

---

## 8. UI (HTML Service)

### 8.1 사이드바: AI 분석 입력 (sidebar.html)

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <?!= include('styles') ?>
</head>
<body>
  <div class="container">
    <h3>영수증 AI 분석</h3>

    <!-- 파일 선택 -->
    <div class="section">
      <label>영수증 첨부</label>
      <div class="dropzone" id="dropzone">
        <input type="file" id="fileInput" multiple accept="image/*,.pdf,.heic" />
        <p>이미지를 드래그하거나 클릭</p>
        <small>PDF, JPG, PNG, HEIC (최대 10MB)</small>
      </div>
      <div id="fileList"></div>
    </div>

    <!-- 메모 -->
    <div class="section">
      <label>내용 메모</label>
      <textarea id="memo" rows="6" placeholder="업체명 / 카테고리 / 결제자·결제수단을 적으면 정확도가 올라갑니다.

예시:
- 이거는 웨딩홀 본계약
- 메리골드 가든
- 식대 70,000원 x 200명 보증
- 계약금 4,000,000원 = 아현 / 신용카드 일시불"></textarea>
    </div>

    <!-- 에러 -->
    <div id="error" class="error" style="display:none"></div>

    <!-- 버튼 -->
    <div class="actions">
      <button id="analyzeBtn" class="primary" onclick="startAnalysis()">
        AI 분석
      </button>
    </div>

    <!-- 진행바 -->
    <div id="progress" style="display:none">
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <p>분석 중...</p>
    </div>
  </div>

  <script>
    function startAnalysis() {
      const files = document.getElementById('fileInput').files;
      const memo = document.getElementById('memo').value;

      if (files.length === 0) {
        showError('영수증을 1개 이상 첨부해주세요');
        return;
      }

      showProgress(true);

      // 파일을 Base64로 변환하여 서버로 전송
      const readers = Array.from(files).map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            name: file.name,
            size: file.size,
            mimeType: file.type,
            base64: reader.result.split(',')[1]
          });
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then(fileData => {
        google.script.run
          .withSuccessHandler(onAnalysisSuccess)
          .withFailureHandler(onAnalysisError)
          .analyzeReceiptFromSidebar(fileData, memo);
      });
    }

    function onAnalysisSuccess(result) {
      showProgress(false);
      // 미리보기 모달로 전환
      google.script.run.showPreviewDialog(result);
    }

    function onAnalysisError(error) {
      showProgress(false);
      showError(error.message || '분석 실패');
    }
  </script>
</body>
</html>
```

### 8.2 미리보기 모달 (preview-dialog.html)

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <?!= include('styles') ?>
</head>
<body>
  <div class="container">
    <!-- 신뢰도 배지 -->
    <div class="confidence-badge" id="confidenceBadge">
      AI 분석 완료 · 신뢰도 <span id="confidence">0</span>%
    </div>

    <!-- 업체 정보 -->
    <div class="vendor-card">
      <span class="emoji" id="vendorEmoji">💒</span>
      <input id="vendorName" placeholder="업체명" />
      <select id="vendorCategory">
        <option value="venue">웨딩홀</option>
        <option value="studio">스튜디오</option>
        <option value="dress">드레스</option>
        <option value="makeup">메이크업</option>
        <option value="gift">예물/예단</option>
        <option value="honeymoon">허니문</option>
        <option value="other">기타</option>
      </select>
    </div>

    <!-- 항목 테이블 -->
    <table class="items-table" id="itemsTable">
      <thead>
        <tr>
          <th>내역</th><th>설명</th><th>결제자</th>
          <th>결제수단</th><th>상태</th><th>금액</th><th></th>
        </tr>
      </thead>
      <tbody id="itemsBody"></tbody>
      <tfoot>
        <tr>
          <td colspan="5">
            <strong>합계</strong>
            <button id="vatBtn" onclick="toggleVAT()">+VAT 10%</button>
          </td>
          <td id="totalAmount" class="amount">₩0</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <button class="link-btn" onclick="addItemRow()">+ 항목 추가</button>

    <!-- 액션 -->
    <div class="actions">
      <button class="secondary" onclick="google.script.host.close()">취소</button>
      <button class="primary" onclick="confirmAndSave()">확정 추가</button>
    </div>
  </div>

  <script>
    // 서버에서 전달받은 분석 결과로 테이블 렌더링
    const result = JSON.parse(document.getElementById('resultData')?.value || '{}');

    function confirmAndSave() {
      const data = collectFormData();
      google.script.run
        .withSuccessHandler(() => {
          google.script.host.close();
        })
        .withFailureHandler((e) => alert('저장 실패: ' + e.message))
        .saveAnalysisResult(data);
    }
  </script>
</body>
</html>
```

### 8.3 공통 스타일 (styles.html)

```html
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Google Sans', -apple-system, sans-serif; font-size: 13px; color: #1f2937; }
  .container { padding: 16px; }
  h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }

  .section { margin-bottom: 16px; }
  label { display: block; font-size: 11px; font-weight: 500; margin-bottom: 6px; color: #6b7280; }

  .dropzone {
    border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px;
    text-align: center; cursor: pointer; transition: all 0.2s;
  }
  .dropzone:hover { border-color: #6366f1; background: #f5f3ff; }
  .dropzone p { font-size: 12px; color: #9ca3af; }
  .dropzone small { font-size: 10px; color: #d1d5db; }
  .dropzone input[type="file"] { display: none; }

  textarea {
    width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 8px 12px; font-size: 12px; resize: none; outline: none;
  }
  textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 2px #e0e7ff; }

  .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .primary {
    background: #6366f1; color: white; border: none; padding: 8px 16px;
    border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .primary:hover { background: #4f46e5; }
  .secondary {
    background: #f3f4f6; color: #6b7280; border: none; padding: 8px 16px;
    border-radius: 8px; font-size: 12px; cursor: pointer;
  }

  .error {
    background: #fef2f2; color: #dc2626; padding: 8px 12px;
    border-radius: 8px; font-size: 11px; margin-bottom: 12px;
  }

  .confidence-badge {
    background: #ecfdf5; color: #059669; padding: 8px 12px;
    border-radius: 8px; font-size: 11px; margin-bottom: 12px;
  }

  .vendor-card {
    background: #f9fafb; border-radius: 12px; padding: 12px;
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  }
  .vendor-card .emoji { font-size: 24px; }
  .vendor-card input {
    flex: 1; border: none; background: transparent;
    font-size: 14px; font-weight: 600; outline: none;
  }
  .vendor-card select {
    font-size: 10px; border: 1px solid #e5e7eb; border-radius: 4px;
    padding: 4px 8px;
  }

  .items-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .items-table th {
    background: #f9fafb; padding: 6px 8px; text-align: left;
    font-size: 9px; text-transform: uppercase; color: #9ca3af;
  }
  .items-table td { padding: 4px 6px; border-top: 1px solid #f3f4f6; }
  .items-table input, .items-table select {
    width: 100%; border: none; background: transparent;
    font-size: 11px; padding: 2px 4px; outline: none;
  }
  .items-table input:focus, .items-table select:focus { background: #f9fafb; }
  .amount { text-align: right; font-family: monospace; }

  .link-btn {
    background: none; border: none; color: #9ca3af; font-size: 10px;
    cursor: pointer; padding: 8px; width: 100%; text-align: center;
  }
  .link-btn:hover { color: #6b7280; }

  .progress-bar {
    height: 4px; background: #e5e7eb; border-radius: 2px;
    overflow: hidden; margin: 8px 0;
  }
  .progress-fill {
    height: 100%; background: linear-gradient(to right, #f472b6, #f43f5e);
    width: 0%; animation: progress 2s ease-in-out infinite;
  }
  @keyframes progress { 0% { width: 0% } 50% { width: 80% } 100% { width: 100% } }

  /* Payer colors */
  .payer-ahyun { background: #e0e7ff; color: #4338ca; }
  .payer-jaejun { background: #ccfbf1; color: #0f766e; }
  .payer-share { background: #f3e8ff; color: #7e22ce; }
  .payer-unset { background: #e6e6e6; color: #787878; }

  /* Status colors */
  .status-paid { background: #d1fae5; color: #059669; }
  .status-partial { background: #fef3c7; color: #b45309; }
  .status-service { background: #e0f2fe; color: #0369a1; }
  .status-unpaid { background: #e6e6e6; color: #787878; }
</style>
```

---

## 9. 금액 포맷팅 (formatWon)

```javascript
function formatWon(n) {
  if (n === 0) return '₩0';
  if (Math.abs(n) >= 100000000) return `₩${(n / 100000000).toFixed(1)}억`;
  if (Math.abs(n) >= 10000) {
    return n % 10000 === 0
      ? `₩${(n / 10000).toFixed(0)}만`
      : `₩${(n / 10000).toFixed(1)}만`;
  }
  return `₩${n.toLocaleString()}`;
}
```

---

## 10. 데이터 모델 매핑

웹앱과 동일한 데이터 구조. 엑셀 VBA PRD (PRD-wedding-excel.md) 섹션 7 참조.

### 10.1 Enum 한글 매핑

| 코드 | 한글 표시 |
|------|----------|
| **Payer** | |
| unset | 미정 |
| ahyun | 아현 |
| jaejun | 재준 |
| share | 공동 |
| **PaymentMethod** | |
| unpaid | 미결제 |
| credit-once | 신용 일시불 |
| credit-installment | 신용 할부 |
| check | 체크카드 |
| cash-receipt | 현금영수증 |
| transfer | 계좌이체 |
| **PaymentStatus** | |
| unpaid | 미결제 |
| partial | 일부 완납 |
| paid | 완납 |
| service | 서비스 |
| **VendorCategory** | |
| venue / 웨딩홀 / 💒 |
| studio / 스튜디오 / 📸 |
| dress / 드레스 / 👗 |
| makeup / 메이크업 / 💄 |
| gift / 예물·예단 / 💍 |
| honeymoon / 허니문 / ✈️ |
| other / 기타 / 📦 |

### 10.2 색상 코드 (Hex)

| 구분 | 항목 | 배경 | 폰트 |
|------|------|------|------|
| 결제자 | 미정 | #E6E6E6 | #787878 |
| | 아현 | #E0E7FF | #4338CA |
| | 재준 | #CCFBF1 | #0F766E |
| | 공동 | #F3E8FF | #7E22CE |
| 상태 | 미결제 | #E6E6E6 | #787878 |
| | 일부 완납 | #FEF3C7 | #B45309 |
| | 완납 | #D1FAE5 | #059669 |
| | 서비스 | #E0F2FE | #0369A1 |
| D-Day | 7일 이내 | #FEE2E2 | #DC2626 |
| 진행바 | 그라데이션 | #F472B6 → #F43F5E | - |

---

## 11. 트리거 / 자동화

### 11.1 onEdit 트리거

```javascript
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const name = sheet.getName();

  if (name === '업체목록' || name === '정산내역') {
    // 수정일 자동 업데이트
    updateTimestamp(e);
    // 대시보드 갱신 (디바운스)
    refreshDashboard();
  }
}
```

### 11.2 시간 기반 트리거 (선택)

```javascript
// D-Day 알림: 매일 오전 9시 체크
function checkDDayAlerts() {
  const vendors = getVendorList();
  const today = new Date();

  for (const v of vendors) {
    if (!v.finalPaymentDate) continue;
    const diff = Math.ceil((v.finalPaymentDate - today) / (1000 * 60 * 60 * 24));

    if (diff === 7 || diff === 3 || diff === 1 || diff === 0) {
      // 이메일 알림
      MailApp.sendEmail({
        to: Session.getActiveUser().getEmail(),
        subject: `[웨딩 정산] ${v.name} 잔금 D-${diff}`,
        body: `${v.emoji} ${v.name}\n잔금일: ${v.finalPaymentDate}\n잔금: ${formatWon(v.remaining)}`
      });
    }
  }
}
```

설정: `ScriptApp.newTrigger('checkDDayAlerts').timeBased().everyDays(1).atHour(9).create()`

---

## 12. 내보내기

### 12.1 CSV 내보내기

```javascript
function exportToCsv() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const items = ss.getSheetByName('정산내역');
  const vendors = ss.getSheetByName('업체목록');

  const rows = ['업체,카테고리,내역,설명,결제자,결제수단,납부상태,금액,선납여부'];

  // ... 데이터 수집 ...

  const csv = rows.join('\n');
  const blob = Utilities.newBlob('\uFEFF' + csv, 'text/csv', `wedding-settlement-${Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd')}.csv`);

  // Drive에 저장
  const folder = getOrCreateFolder('웨딩 정산');
  const file = folder.createFile(blob);

  // 다운로드 링크 표시
  SpreadsheetApp.getUi().alert(`CSV 저장 완료!\n\n${file.getUrl()}`);
}
```

### 12.2 웹앱 데이터 Import

웹앱에서 내보낸 CSV를 시트로 가져오기:
```javascript
function importFromCsv() {
  // FileDialog → CSV 파싱 → 시트에 반영
}
```

---

## 13. 비기능 요구사항

### 13.1 호환성
- Google Sheets (웹, Android, iOS)
- Apps Script V8 런타임
- Chrome, Safari, Firefox 지원

### 13.2 보안
- API Key는 `PropertiesService.getUserProperties()`에 저장 (사용자별 개별)
- 스프레드시트 공유 시 API Key는 포함되지 않음
- OAuth 범위: spreadsheets, drive, script.external_request

### 13.3 성능
- Apps Script 실행 시간 제한: 6분 (AI 분석 충분)
- 일일 UrlFetchApp 할당량: 20,000회
- 업체 100개, 항목 1000개 기준 대시보드 갱신 2초 이내

### 13.4 제한사항
- Apps Script 실행 시간 최대 6분 (대용량 이미지 여러 장 시 주의)
- UrlFetchApp 응답 최대 50MB
- HTML Service 모달 크기 제한 (폭: 최대 열 수 없음, 사이드바: 300px)

---

## 14. 마일스톤

| 단계 | 내용 | 예상 기간 |
|------|------|----------|
| M1 | 시트 구조 + initializeSpreadsheet + 메뉴 등록 | 0.5일 |
| M2 | 업체/항목 CRUD (Apps Script) + 대시보드 수식 | 1일 |
| M3 | 조건부서식 + SPARKLINE + 포맷팅 | 0.5일 |
| M4 | AI 분석 (Gemini API + 사이드바 + 미리보기 모달) | 1일 |
| M5 | API Key 설정 UI + 연결 테스트 | 0.5일 |
| M6 | Drive 연동 (영수증 폴더) + CSV 내보내기 | 0.5일 |
| M7 | D-Day 알림 트리거 + 최종 QA | 0.5일 |

**총 예상**: 4~5일

---

## 15. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Apps Script 6분 실행 제한 | 대용량 파일 분석 실패 | 파일 크기 10MB 제한 + 리사이즈 |
| UrlFetchApp 일일 할당량 | 대량 분석 시 제한 | 모델 Fallback으로 호출 최소화 |
| HTML Service 사이드바 300px | UI 협소 | 모달 다이얼로그 병용 (600x500) |
| Google Drive Picker API 설정 복잡 | 파일 선택 UX | 로컬 업로드 → Drive 자동 저장 방식 우선 |
| 모바일 Apps Script UI 미지원 | 모바일에서 AI 분석 불가 | 시트 직접 편집은 가능, AI는 PC에서만 |
| PropertiesService 사용자별 저장 | 공유 시트에서 각자 키 필요 | 설정 안내 메시지 표시 |

---

## 부록: 엑셀 VBA vs Google Sheets 비교 요약

| 기능 | 엑셀 VBA | Google Sheets |
|------|----------|---------------|
| 시트 구조 | 동일 (5개) | 동일 (5개) |
| 데이터 모델 | 동일 | 동일 |
| AI 분석 | WinHttpRequest | UrlFetchApp |
| API Key | 레지스트리 + 숨김셀 | PropertiesService |
| UI | UserForm | HTML Service |
| 파일 관리 | 로컬 경로 | Google Drive |
| 포맷팅 | VBA Function | Apps Script Function |
| 조건부서식 | VBA로 설정 | Apps Script로 설정 |
| 자동화 | Worksheet_Change | onEdit + 시간 트리거 |
| 알림 | 없음 | MailApp (이메일) |
| 공유 | 파일 복사 | 링크 + 동시 편집 |
| 오프라인 | 완전 지원 | 제한적 |
