# PRD: 웨딩 정산 엑셀 매크로 (VBA)

> 버전: 1.0
> 작성일: 2026-05-14
> 상태: Draft

---

## 1. 개요

### 1.1 배경
현재 sophia-life 웹앱에서 운영 중인 웨딩 정산 기능을 **엑셀 매크로(VBA)** 기반으로 이식한다. 오프라인 환경에서도 사용 가능하고, 인쇄/공유가 편리한 엑셀 파일 형태로 제공하며, AI 영수증 분석 기능을 통합한다.

### 1.2 목표
- 웹앱의 정산 대시보드 + 업체별 디테일을 엑셀 워크북으로 1:1 재현
- Gemini Vision API를 활용한 영수증/견적서 AI 자동 분석 기능 내장
- API Key 설정 UI를 엑셀 내에서 제공 (UserForm)
- 오프라인 데이터 관리 + 선택적 웹 연동(AI 분석 시에만 인터넷 필요)

### 1.3 대상 사용자
- 결혼 준비 중인 커플 (주 사용자: 아현, 재준)
- 엑셀에 익숙하고 오프라인 관리를 선호하는 사용자

---

## 2. 시트 구조

### 2.1 워크북 구성

| # | 시트명 | 역할 | 보호 |
|---|--------|------|------|
| 1 | **대시보드** | 전체 요약 통계, 업체별 진행 현황, 결제자별 분담 | 수식 셀 잠금 |
| 2 | **업체목록** | 업체 마스터 데이터 (CRUD) | - |
| 3 | **정산내역** | 전체 정산 항목 (업체별 필터 가능) | - |
| 4 | **영수증로그** | AI 분석 결과 + 영수증 메타데이터 기록 | - |
| 5 | **설정** | API Key, 결제자명, 카테고리 등 설정값 | 숨김 가능 |

---

## 3. 시트별 상세 설계

### 3.1 대시보드 시트

웹앱의 Slim Strip + 업체 카드 목록을 엑셀 대시보드로 재현한다.

#### 3.1.1 요약 영역 (Row 1~6)

```
┌─────────────────────────────────────────────────────────────────┐
│  웨딩 정산 대시보드                                    [AI 분석] [설정] │
├──────────┬──────────┬──────────┬──────────┬──────────────────────┤
│  총 금액   │  결제 완료  │   잔금    │  진행률   │  결제자별 분담          │
│ ₩50,000,000│ ₩35,000,000│₩15,000,000│   70%   │ 아현: ₩20,000,000     │
│           │          │          │ ████░░░ │ 재준: ₩12,000,000     │
│           │          │          │         │ 공동: ₩3,000,000      │
└──────────┴──────────┴──────────┴──────────┴──────────────────────┘
```

**셀 배치:**

| 셀 | 내용 | 수식/값 |
|----|------|---------|
| B2 | "총 금액" 라벨 | 텍스트 |
| B3 | 총 금액 값 | `=SUMPRODUCT((정산내역!H:H)*(정산내역!J:J<>"service")*(정산내역!K:K<>"Y"))` |
| C2 | "결제 완료" 라벨 | 텍스트 |
| C3 | 결제 완료 금액 | 결제상태="paid" 또는 "partial"의 paidAmount 합산 |
| D2 | "잔금" 라벨 | 텍스트 |
| D3 | 잔금 값 | `=B3-C3` |
| E2 | "진행률" 라벨 | 텍스트 |
| E3 | 진행률 % | `=IF(B3>0, C3/B3, 0)` (서식: 0%) |
| E4 | 진행 바 | 조건부서식 데이터바 |
| F2~F5 | 결제자별 | 아현/재준/공동 각각 SUMPRODUCT |

#### 3.1.2 업체별 현황 테이블 (Row 8~)

| 열 | 헤더 | 너비 | 내용 |
|----|------|------|------|
| A | 이모지 | 5 | 카테고리 이모지 (텍스트) |
| B | 업체명 | 20 | 업체목록 시트 참조 |
| C | 카테고리 | 12 | 웨딩홀/스튜디오/드레스/... |
| D | 총 금액 | 15 | SUMIFS(정산내역 금액, vendorId 일치, 선납 제외, 서비스 제외) |
| E | 결제 완료 | 15 | SUMIFS(paid + partial의 paidAmount) |
| F | 잔금 | 15 | =D-E |
| G | 진행률 | 10 | =IF(D>0, E/D, 0) + 데이터바 |
| H | 상태 | 8 | "완납"/"일부"/"예정" (조건부서식: 녹/황/회) |
| I | 잔금일 | 12 | 업체목록의 finalPaymentDate |
| J | D-Day | 8 | =IF(I<>"", I-TODAY(), "") + 조건부서식(7일내 빨강) |

**조건부서식 규칙:**
- 상태="완납" → 셀 배경 emerald-100, 폰트 emerald-700
- 상태="일부" → 셀 배경 amber-100, 폰트 amber-700
- 상태="예정" → 셀 배경 gray-100
- D-Day <= 7 → 빨강 배경 + 굵은 글씨
- D-Day = "D-Day" → 빨강 배경

---

### 3.2 업체목록 시트

업체 마스터 데이터를 관리하는 테이블.

| 열 | 헤더 | 데이터 유효성 | 설명 |
|----|------|-------------|------|
| A | id | 자동생성 (VBA) | UUID 또는 시퀀스 |
| B | 업체명 | 필수 | 텍스트 |
| C | 카테고리 | 드롭다운 | venue/studio/dress/makeup/gift/honeymoon/other |
| D | 카테고리명 | 자동 | =VLOOKUP(C, 설정!카테고리매핑, 2) → 웨딩홀/스튜디오/... |
| E | 이모지 | 자동/수동 | 카테고리별 기본값 또는 사용자 지정 |
| F | 계약일 | 날짜 | yyyy-mm-dd |
| G | 잔금일 | 날짜 | yyyy-mm-dd (D-Day 계산 기준) |
| H | VAT 적용 | 드롭다운 (Y/N) | 기본값: N |
| I | 코멘트 | 텍스트 | 자유 메모 |
| J | 생성일 | 자동 | NOW() at creation |
| K | 수정일 | 자동 | NOW() at update |

**VBA 매크로:**
- `AddVendor()`: 새 행 추가, id 자동 생성, 생성일 기록
- `DeleteVendor()`: 선택 행 삭제 + 연관 정산내역/영수증 CASCADE 삭제 (확인 다이얼로그)
- 카테고리 변경 시 이모지 자동 업데이트 (`Worksheet_Change` 이벤트)

---

### 3.3 정산내역 시트

모든 업체의 정산 항목을 하나의 테이블로 관리한다. 업체별 필터링은 엑셀 자동필터 또는 VBA 필터 버튼으로 제공.

| 열 | 헤더 | 데이터 유효성 | 설명 |
|----|------|-------------|------|
| A | id | 자동 | UUID/시퀀스 |
| B | vendorId | 자동/참조 | 업체목록!A 참조 |
| C | 업체명 | 자동 | =VLOOKUP(B, 업체목록, 2) |
| D | 내역명 | 필수 | 텍스트 |
| E | 설명 | 선택 | "₩80,000 x 200명" 형태 |
| F | 단가 | 숫자 | 선택 |
| G | 수량 | 숫자 | 선택 |
| H | 금액 | 숫자, 필수 | 최종 결제 금액 |
| I | 결제자 | 드롭다운 | 미정/아현/재준/공동 |
| J | 결제수단 | 드롭다운 | 미결제/신용 일시불/신용 할부/체크카드/현금영수증/계좌이체 |
| K | 납부상태 | 드롭다운 | 미결제/일부 완납/완납/서비스 |
| L | 결제일 | 날짜 | 실제 결제한 날짜 |
| M | 납부금액 | 숫자 | 일부완납 시 실제 납부한 금액 |
| N | 선납여부 | 드롭다운 (Y/N) | 계약금 등 선납 항목 표시 |
| O | 정렬순서 | 숫자 | 업체 내 항목 순서 |

**조건부서식:**
- 결제자별 셀 배경색:
  - 아현 → indigo-100 배경
  - 재준 → teal-100 배경
  - 공동 → purple-100 배경
  - 미정 → gray-100 배경
- 납부상태별 셀 배경색:
  - 완납 → emerald-100 배경
  - 일부 완납 → amber-100 배경
  - 서비스 → sky-100 배경
  - 미결제 → gray-100 배경
- 선납(Y) 행 → 전체 행 emerald-50 배경 + 금액 emerald-600 폰트

**VBA 매크로:**
- `AddItem(vendorId)`: 지정 업체에 새 항목 추가
- `DeleteItem()`: 선택 행 삭제
- `FilterByVendor()`: 콤보박스로 업체 선택 시 자동필터
- `ApplyVAT(vendorId)`: 해당 업체 전체 항목에 VAT 10% 일괄 적용
- `RemoveVAT(vendorId)`: VAT 제거 (x 10/11)

---

### 3.4 영수증로그 시트

AI 분석 결과 및 영수증 메타데이터를 기록한다.

| 열 | 헤더 | 설명 |
|----|------|------|
| A | id | 자동 |
| B | vendorId | 연결된 업체 |
| C | 업체명 | 자동 참조 |
| D | 파일명 | 원본 파일명 |
| E | 파일경로 | 로컬 파일 경로 (하이퍼링크) |
| F | 파일크기 | KB 단위 |
| G | MIME타입 | image/jpeg, application/pdf 등 |
| H | 배지타입 | contract/deposit/final/extra/quote |
| I | 업로드일 | 분석 실행 시각 |
| J | AI모델 | 사용된 Gemini 모델명 |
| K | 신뢰도 | 0~1 (퍼센트 서식) |
| L | 추출 총액 | AI가 인식한 총 금액 |
| M | 항목수 | AI가 추출한 항목 개수 |
| N | 사용자메모 | 분석 시 입력한 메모 |
| O | 원본JSON | AI 응답 원본 (축약 표시, 더블클릭으로 전체 보기) |

---

### 3.5 설정 시트

| 영역 | 셀 범위 | 내용 |
|------|---------|------|
| API Key | B2 | Gemini API Key (마스킹 표시: `gemi...xxxx`) |
| API Key 입력 | - | `SetApiKey` 버튼 → InputBox로 입력, 레지스트리/숨김셀 저장 |
| 결제자 목록 | B5:B8 | 미정, 아현, 재준, 공동 (드롭다운 소스) |
| 카테고리 매핑 | B11:C17 | venue→웨딩홀, studio→스튜디오, ... |
| 이모지 매핑 | B11:D17 | venue→💒, studio→📸, ... |
| 결제수단 목록 | B20:B25 | 미결제/신용 일시불/신용 할부/체크카드/현금영수증/계좌이체 |
| 납부상태 목록 | B28:B31 | 미결제/일부 완납/완납/서비스 |
| Gemini 모델 | B34:B36 | gemini-2.5-flash / gemini-2.5-flash-lite / gemini-2.5-pro |

---

## 4. AI 영수증 분석 기능

### 4.1 기능 개요

엑셀 내에서 영수증/견적서 이미지를 선택하면 Gemini Vision API로 분석하여 정산 항목을 자동 생성한다.

### 4.2 사용자 흐름

```
1. 대시보드에서 [AI 분석] 버튼 클릭
   └─ 또는 리본 메뉴 > 웨딩정산 > AI 영수증 분석
        ↓
2. ReceiptAnalysisForm (UserForm) 표시
   ├─ 파일 선택 (FileDialog: 이미지/PDF, 다중 선택 가능)
   ├─ 첨부 파일 목록 표시 (파일명 + 크기)
   ├─ 내용 메모 입력 (TextBox, 여러 줄)
   │   힌트: "업체명 / 카테고리 / 결제자·결제수단을 적으면 정확도가 올라갑니다"
   └─ [AI 분석 시작] 버튼
        ↓
3. 분석 진행
   ├─ 프로그레스바 표시
   ├─ 파일을 Base64로 인코딩
   ├─ Gemini API 호출 (모델 자동 Fallback: flash → flash-lite → pro)
   ├─ JSON 응답 파싱 (safeParseJson 로직 이식)
   └─ 실패 시 에러 메시지 + 수동 입력 모드 전환
        ↓
4. 분석 결과 미리보기 (PreviewForm)
   ├─ 업체명 (편집 가능)
   ├─ 카테고리 (드롭다운, 편집 가능)
   ├─ 신뢰도 배지 (예: "AI 분석 완료 · 신뢰도 92%")
   ├─ 항목 테이블 (ListBox 또는 시트 기반 미리보기)
   │   ├─ 내역명 | 설명 | 결제자 | 결제수단 | 상태 | 금액
   │   ├─ 각 행 편집 가능
   │   ├─ 행 추가/삭제 버튼
   │   └─ 합계 표시 + VAT 적용 버튼
   └─ [확정 추가] 버튼
        ↓
5. 데이터 반영
   ├─ 업체목록 시트에 업체 추가 (신규 시)
   ├─ 정산내역 시트에 항목들 추가
   ├─ 영수증로그 시트에 분석 결과 기록
   └─ 대시보드 자동 새로고침
```

### 4.3 API Key 설정 기능

#### 4.3.1 저장 방식
- **1차**: 설정 시트 숨김 셀에 저장 (워크북과 함께 이동)
- **2차**: Windows 레지스트리 `HKCU\Software\SophiaWedding\GeminiKey`에 백업 (선택)
- 암호화: 단순 XOR 난독화 (완전한 보안은 아니지만 평문 노출 방지)

#### 4.3.2 설정 UI (ApiKeyForm)

```
┌─────────────────────────────────────────────┐
│  Gemini API Key 설정                    [X] │
├─────────────────────────────────────────────┤
│                                             │
│  현재 상태: ✅ 설정됨 (gemi...a1b2)         │
│                                             │
│  API Key:                                   │
│  ┌─────────────────────────────────────┐    │
│  │ AIzaSy...                           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  💡 Google AI Studio에서 발급받을 수 있습니다 │
│     https://aistudio.google.com/apikey      │
│                                             │
│  사용 모델: gemini-2.5-flash (자동 fallback) │
│                                             │
│  [연결 테스트]        [저장]    [취소]        │
│                                             │
└─────────────────────────────────────────────┘
```

**기능:**
- `[연결 테스트]`: 간단한 API 호출로 키 유효성 확인
- `[저장]`: 설정 시트 + 레지스트리에 저장
- API Key 미설정 시 AI 분석 버튼에 경고 표시

#### 4.3.3 API Key 취득 안내
- UserForm 내 하이퍼링크: https://aistudio.google.com/apikey
- 첫 사용 시 자동 안내 메시지 표시

### 4.4 Gemini API 연동 상세

#### 4.4.1 API 호출 구조

```vba
' VBA HTTP 호출 (WinHttpRequest 또는 XMLHTTP)
Dim http As Object
Set http = CreateObject("MSXML2.XMLHTTP")

Dim url As String
url = "https://generativelanguage.googleapis.com/v1beta/models/" & modelName & ":generateContent?key=" & apiKey

http.Open "POST", url, False
http.setRequestHeader "Content-Type", "application/json"
http.send jsonBody
```

#### 4.4.2 모델 Fallback 체인

```
gemini-2.5-flash (기본, thinking 지원)
    ↓ 429/503/404 시
gemini-2.5-flash-lite
    ↓ 실패 시
gemini-2.5-pro
    ↓ 모두 실패
에러 메시지 + 수동 입력 모드
```

#### 4.4.3 프롬프트 (웹앱과 동일)

```
당신은 결혼 준비 영수증/견적서/계약서 분석 전문가입니다.
첨부된 파일을 분석하여 JSON으로 응답하세요.

## 핵심 규칙
- 문서에 적힌 숫자를 그대로 사용하세요. 절대 추측하지 마세요.
- "할인 금액" 열이 있으면 할인 금액 기준으로 추출하세요.
- "서비스"로 표시된 항목(무료 제공)은 amount: 0, paymentStatus: "service"로 설정하세요.
- 단가x수량 패턴이 있으면 description에 "₩80,000 x 200명"처럼 기록하세요.
- 계약금이 명시되어 있으면 별도 행으로 isPrepayment: true, paymentStatus: "paid"로 넣으세요.
- "Grand Total + VAT" 또는 "VAT 포함" 줄이 있으면 반드시 그 금액을 totalAmount에 넣으세요.

## 사용자 메모
{userMemo}

## 필드값 가이드
- vendorCategory: venue | studio | dress | makeup | gift | honeymoon | other
- payer: unset | ahyun | jaejun | share
- paymentMethod: unpaid | credit-once | credit-installment | check | cash-receipt | transfer
- paymentStatus: unpaid | partial | paid | service

## JSON 스키마
{"vendorName":"","vendorCategory":"venue","emoji":"💒","totalAmount":0,
 "items":[{"name":"","description":"","unitPrice":0,"quantity":0,"amount":0,
 "payer":"unset","paymentMethod":"unpaid","paymentStatus":"unpaid","isPrepayment":false}],
 "confidence":0.9,"notes":""}
```

#### 4.4.4 JSON 파싱 (safeParseJson 이식)

VBA에서도 동일한 robust 파싱 적용:
1. 직접 JSON.parse 시도 (VBA-JSON 라이브러리 활용)
2. 실패 시 `{...}` 추출
3. trailing comma 제거: `,}` → `}`, `,]` → `]`
4. missing comma 보정
5. 최종 파싱 시도

의존 라이브러리: **VBA-JSON** (JsonConverter) - 모듈로 포함

#### 4.4.5 파일 → Base64 인코딩

```vba
Function FileToBase64(filePath As String) As String
    Dim bytes() As Byte
    Open filePath For Binary Access Read As #1
    ReDim bytes(LOF(1) - 1)
    Get #1, , bytes
    Close #1

    ' MSXML2.DOMDocument를 활용한 Base64 인코딩
    Dim xml As Object
    Set xml = CreateObject("MSXML2.DOMDocument")
    Dim node As Object
    Set node = xml.createElement("b64")
    node.DataType = "bin.base64"
    node.nodeTypedValue = bytes
    FileToBase64 = Replace(Replace(node.text, vbCr, ""), vbLf, "")
End Function
```

---

## 5. VBA 모듈 구조

### 5.1 모듈 목록

| 모듈 | 타입 | 역할 |
|------|------|------|
| `ModMain` | 표준 모듈 | 진입점, 리본 콜백, 초기화 |
| `ModVendor` | 표준 모듈 | 업체 CRUD 로직 |
| `ModItem` | 표준 모듈 | 정산항목 CRUD, VAT 적용/제거 |
| `ModGemini` | 표준 모듈 | Gemini API 호출, Base64 인코딩, JSON 파싱 |
| `ModFormat` | 표준 모듈 | 금액 포맷팅, D-Day 계산, 조건부서식 |
| `ModExport` | 표준 모듈 | CSV 내보내기, 인쇄 서식 |
| `JsonConverter` | 표준 모듈 | VBA-JSON 라이브러리 (외부) |
| `FrmReceiptAnalysis` | UserForm | AI 분석 입력 폼 (파일선택 + 메모) |
| `FrmPreview` | UserForm | AI 분석 결과 미리보기/편집 폼 |
| `FrmApiKey` | UserForm | API Key 설정 폼 |
| `FrmVendorDetail` | UserForm | 업체 상세 보기/편집 폼 |
| `ShDashboard` | 시트 모듈 | 대시보드 시트 이벤트 (버튼 클릭) |
| `ShVendors` | 시트 모듈 | 업체목록 시트 이벤트 (변경 감지) |
| `ShItems` | 시트 모듈 | 정산내역 시트 이벤트 |
| `ThisWorkbook` | 워크북 모듈 | Workbook_Open 초기화 |

### 5.2 주요 함수 시그니처

```vba
' === ModMain ===
Sub InitializeWorkbook()          ' 워크북 초기 설정 (시트 생성, 서식, 유효성)
Sub RefreshDashboard()            ' 대시보드 수식/통계 갱신
Sub ShowReceiptAnalysis()         ' AI 분석 폼 표시
Sub ShowApiKeySettings()          ' API Key 설정 폼 표시

' === ModVendor ===
Function AddVendor(name, category, ...) As String  ' 업체 추가, ID 반환
Sub UpdateVendor(vendorId, field, value)            ' 업체 정보 수정
Sub DeleteVendor(vendorId)                         ' 업체 삭제 (CASCADE)
Function GetVendorRow(vendorId) As Long            ' vendorId로 행 번호 찾기

' === ModItem ===
Function AddItem(vendorId, name, amount, ...) As String
Sub UpdateItem(itemId, field, value)
Sub DeleteItem(itemId)
Sub ApplyVAT(vendorId)             ' VAT 10% 일괄 적용
Sub RemoveVAT(vendorId)            ' VAT 제거
Function GetVendorTotal(vendorId) As Double
Function GetVendorPaid(vendorId) As Double

' === ModGemini ===
Function AnalyzeReceipt(filePaths() As String, memo As String) As Object
Function CallGeminiAPI(model, jsonBody, apiKey) As String
Function FileToBase64(filePath) As String
Function SafeParseJson(rawText) As Object
Function GetApiKey() As String
Sub SaveApiKey(key As String)
Function TestApiKey(key As String) As Boolean

' === ModFormat ===
Function FormatWon(amount As Double) As String      ' ₩50만, ₩1.5억 등
Function CalcDDay(targetDate As Date) As String     ' D-Day, D-7, D+3 등
Sub ApplyConditionalFormats(ws As Worksheet)        ' 조건부서식 일괄 적용
Function GetPayerColor(payer As String) As Long     ' RGB 색상 반환
Function GetStatusColor(status As String) As Long

' === ModExport ===
Sub ExportToCSV()                  ' CSV 내보내기 (UTF-8 BOM)
Sub PrintSettlement()              ' 인쇄 미리보기
```

---

## 6. 금액 포맷팅 규칙 (FormatWon)

웹앱과 동일한 한국식 금액 표시:

```vba
Function FormatWon(n As Double) As String
    If n = 0 Then
        FormatWon = "₩0"
    ElseIf Abs(n) >= 100000000 Then  ' 1억 이상
        FormatWon = "₩" & Format(n / 100000000, "0.0") & "억"
    ElseIf Abs(n) >= 10000 Then      ' 1만 이상
        If n Mod 10000 = 0 Then
            FormatWon = "₩" & Format(n / 10000, "0") & "만"
        Else
            FormatWon = "₩" & Format(n / 10000, "0.0") & "만"
        End If
    Else
        FormatWon = "₩" & Format(n, "#,##0")
    End If
End Function
```

---

## 7. 데이터 모델 매핑

### 7.1 웹앱 → 엑셀 필드 매핑

#### Vendor (업체)

| 웹앱 필드 | 타입 | 엑셀 열 | 비고 |
|-----------|------|---------|------|
| id | string | A (UUID) | 자동생성 |
| name | string | B | 필수 |
| category | enum | C | venue/studio/dress/makeup/gift/honeymoon/other |
| emoji | string | E | 카테고리 기본값 자동 |
| contractDate | string | F | yyyy-mm-dd |
| finalPaymentDate | string | G | D-Day 기준 |
| vatApplied | boolean | H | Y/N |
| comment | string | I | 자유 메모 |
| createdAt | number | J | 자동 |
| updatedAt | number | K | 자동 |

#### Item (정산항목)

| 웹앱 필드 | 타입 | 엑셀 열 | 비고 |
|-----------|------|---------|------|
| id | string | A | 자동 |
| vendorId | string | B | FK → 업체목록!A |
| name | string | D | 필수 |
| description | string | E | 선택 |
| unitPrice | number | F | 선택 |
| quantity | number | G | 선택 |
| amount | number | H | 필수 |
| payer | enum | I | 미정/아현/재준/공동 |
| paymentMethod | enum | J | 드롭다운 |
| paymentStatus | enum | K | 드롭다운 |
| paidDate | string | L | 날짜 |
| paidAmount | number | M | 일부완납 시 |
| isPrepayment | boolean | N | Y/N |
| order | number | O | 정렬 |

#### Receipt (영수증)

| 웹앱 필드 | 타입 | 엑셀 열 | 비고 |
|-----------|------|---------|------|
| id | string | A | 자동 |
| vendorId | string | B | FK |
| filename | string | D | 파일명 |
| dataUrl | - | E (경로) | 엑셀에선 파일경로로 대체 |
| fileSize | number | F | KB |
| mimeType | string | G | 파일 타입 |
| badgeType | enum | H | 선택 |
| uploadedAt | number | I | 자동 |
| aiExtracted.confidence | number | K | 0~1 |
| aiExtracted.totalAmount | number | L | AI 추출 금액 |
| aiExtracted.model | string | J | 모델명 |
| aiExtracted.userMemo | string | N | 사용자 메모 |

### 7.2 Enum 값 매핑

| 웹앱 값 | 엑셀 표시 (한글) |
|---------|-----------------|
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
| venue | 웨딩홀 |
| studio | 스튜디오 |
| dress | 드레스 |
| makeup | 메이크업 |
| gift | 예물/예단 |
| honeymoon | 허니문 |
| other | 기타 |

### 7.3 색상 매핑 (RGB)

| 구분 | 항목 | 배경 RGB | 폰트 RGB |
|------|------|----------|----------|
| 결제자 | 미정 | (230,230,230) | (120,120,120) |
| | 아현 | (224,231,255) | (67,56,202) |
| | 재준 | (204,251,241) | (15,118,110) |
| | 공동 | (243,232,255) | (126,34,206) |
| 상태 | 미결제 | (230,230,230) | (120,120,120) |
| | 일부 완납 | (254,243,199) | (180,83,9) |
| | 완납 | (209,250,229) | (5,150,105) |
| | 서비스 | (224,242,254) | (3,105,161) |
| D-Day | 7일 이내 | (254,226,226) | (220,38,38) |
| 진행바 | 기본 | (251,207,232)→(244,63,94) | - |

---

## 8. 버튼/UI 요소 배치

### 8.1 대시보드 시트 버튼

| 버튼 | 위치 | 매크로 | 아이콘/스타일 |
|------|------|--------|-------------|
| AI 분석 | 우측 상단 | `ShowReceiptAnalysis` | Sparkles 아이콘, 보라색 배경 |
| 설정 | AI 분석 옆 | `ShowApiKeySettings` | Settings 아이콘 |
| CSV 내보내기 | 하단 | `ExportToCSV` | Download 아이콘 |
| 새로고침 | 하단 | `RefreshDashboard` | Refresh 아이콘 |

### 8.2 업체목록 시트 버튼

| 버튼 | 매크로 |
|------|--------|
| + 새 업체 | `AddVendor` |
| 삭제 | `DeleteVendor` |
| 상세 보기 | `ShowVendorDetail` |

### 8.3 정산내역 시트 버튼

| 버튼 | 매크로 |
|------|--------|
| + 항목 추가 | `AddItem` |
| 삭제 | `DeleteItem` |
| 업체 필터 | `FilterByVendor` (콤보박스) |
| +VAT 10% | `ApplyVAT` |
| VAT 제거 | `RemoveVAT` |

---

## 9. 데이터 가져오기/내보내기

### 9.1 CSV 내보내기

웹앱의 exportCsv와 동일한 형식:

```
업체,카테고리,내역,설명,결제자,결제수단,납부상태,금액,선납여부
"DRESS GARDEN",드레스,"본식 드레스","",아현,신용 일시불,완납,1800000,
"DRESS GARDEN",드레스,"계약금","",아현,계좌이체,완납,-300000,Y
```

- UTF-8 BOM 포함 (한글 깨짐 방지)
- 파일명: `wedding-settlement-yyyy-mm-dd.csv`

### 9.2 웹앱 데이터 Import (선택 기능)

웹앱에서 내보낸 CSV를 엑셀로 가져오는 기능:
- `ImportFromCSV()` 매크로
- CSV 파싱 → 업체목록 + 정산내역에 반영

---

## 10. 비기능 요구사항

### 10.1 호환성
- Excel 2016 이상 (Windows)
- Excel for Mac은 VBA UserForm 제한으로 일부 기능 축소
- `.xlsm` 형식 (매크로 포함 워크북)

### 10.2 보안
- API Key는 평문 저장하지 않음 (XOR 난독화)
- 매크로 실행 시 신뢰 경고 표시됨 (사용자가 "매크로 허용" 필요)
- 외부 HTTP 통신은 AI 분석 시에만 발생

### 10.3 성능
- 업체 100개, 항목 1000개 기준 문제 없어야 함
- 대시보드 새로고침 1초 이내
- AI 분석 응답 10초 이내 (네트워크 의존)

### 10.4 UX
- 엑셀 표준 UX를 존중하되, 색상 코딩으로 가독성 확보
- 자동 새로고침: 데이터 변경 시 대시보드 자동 갱신 (Worksheet_Change)
- 에러 시 한글 메시지로 안내

---

## 11. 마일스톤

| 단계 | 내용 | 예상 기간 |
|------|------|----------|
| M1 | 시트 구조 + 업체/항목 CRUD + 대시보드 수식 | 1일 |
| M2 | 조건부서식 + 포맷팅 + VAT 기능 | 0.5일 |
| M3 | AI 분석 (API 연동 + UserForm + JSON 파싱) | 1일 |
| M4 | API Key 설정 UI + 연결 테스트 | 0.5일 |
| M5 | CSV 내보내기/가져오기 + 최종 QA | 0.5일 |

**총 예상**: 3~4일

---

## 12. 리스크 및 제약

| 리스크 | 영향 | 대응 |
|--------|------|------|
| VBA에서 HTTPS 호출 실패 (보안 설정) | AI 기능 불가 | WinHttpRequest + 인증서 무시 옵션 |
| Gemini API 응답이 불안정한 JSON | 파싱 실패 | safeParseJson 로직 이식 (regex 기반 보정) |
| 대용량 이미지 Base64 인코딩 | 메모리 부족 | 10MB 제한 + 이미지 리사이즈 |
| Mac Excel VBA UserForm 미지원 | Mac 사용 불가 | Windows 전용 명시 |
| 엑셀 파일 공유 시 API Key 노출 | 보안 위험 | 레지스트리 저장 옵션 + 공유 전 키 삭제 안내 |

---

## 부록: 카테고리 이모지 매핑

| 카테고리 | 코드 | 한글 | 이모지 |
|----------|------|------|--------|
| venue | venue | 웨딩홀 | 💒 |
| studio | studio | 스튜디오 | 📸 |
| dress | dress | 드레스 | 👗 |
| makeup | makeup | 메이크업 | 💄 |
| gift | gift | 예물/예단 | 💍 |
| honeymoon | honeymoon | 허니문 | ✈️ |
| other | other | 기타 | 📦 |
