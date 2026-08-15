---
id: t3-l06
title: 모바일 자동화 — Appium · Maestro · XCUITest · Espresso
summary: 웹과 다른 모바일만의 문제들. 도구별 위치를 정리하고, 무엇을 언제 고를지 판단 기준을 세운다.
minutes: 20
order: 6
tags: [Appium, Maestro, XCUITest, Espresso, UIAutomator, 모바일자동화]
---

## 개념 설명

### 모바일 자동화가 웹보다 어려운 이유

같은 E2E인데 난이도가 다르다. 이유를 알아야 도구 선택과 전략이 나온다.

| 문제 | 웹 | 모바일 |
|---|---|---|
| 실행 환경 | 브라우저 하나 | **OS 2종 × 버전 다수 × 기기 해상도 다수** |
| 앱 설치 | 없음 | 빌드 → 설치 → 실행 (수십 초~분) |
| 기기 확보 | 불필요 | 실기기 or 에뮬레이터/시뮬레이터 |
| 시스템 개입 | 거의 없음 | **권한 팝업, OS 업데이트, 전화 수신, 알림** |
| 요소 접근 | DOM 표준 | 플랫폼별 접근성 트리 (구조가 다름) |
| 배포 | 즉시 | 스토어 심사 → **롤백 불가** |
| 실행 속도 | 초 단위 | **분 단위** |

마지막 두 개가 QA 전략을 바꾼다. **롤백이 불가능하고 실행이 느리므로, 모바일은 "적게 자동화하고 정확히 자동화"** 하는 쪽으로 간다. 웹처럼 수백 개를 돌리는 전략이 잘 안 통한다.

### 도구 지형

크게 두 갈래다.

```text
[크로스 플랫폼]  하나의 코드로 iOS·Android 둘 다
   Appium      WebDriver 표준. 가장 범용적, 무겁고 느림
   Maestro     YAML 기반. 배우기 쉽고 빠름, 표현력은 제한적
   Detox       React Native 전용. 그레이박스라 빠르고 안정적

[네이티브 (플랫폼 전용)]  각 플랫폼 언어로, 앱 내부에서 실행
   XCUITest    iOS / Swift·Obj-C
   Espresso    Android / Kotlin·Java
   UIAutomator Android / 앱 밖(시스템 UI)까지 접근 가능
```

### Appium — 크로스 플랫폼의 표준

WebDriver 프로토콜을 쓰기 때문에 **Selenium을 아는 사람에게 익숙하다.** 그리고 언어 제약이 없다 (Java, Python, JS, C# 등).

```javascript
// Appium + WebdriverIO (JavaScript)
const driver = await remote({
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',   // iOS 는 'XCUITest'
    'appium:deviceName': 'Pixel_7_API_34',
    'appium:app': '/path/to/app.apk',
  },
});

// 접근성 ID 로 찾기 — 플랫폼 공통이라 가장 권장된다
const loginBtn = await driver.$('~login-button');
await loginBtn.click();

await driver.$('~email-input').setValue('qa@test.com');
```

**Appium 로케이터 우선순위** (웹의 2편과 같은 원리다)

| 우선순위 | 방법 | 비고 |
|---|---|---|
| 1 | **접근성 ID** (`~name`) | iOS `accessibilityIdentifier` / Android `content-desc` 를 공통으로 잡는다 |
| 2 | 플랫폼 ID | Android `resource-id`, iOS `name` |
| 3 | 클래스 체이닝 / predicate (iOS) | iOS 전용, 빠름 |
| 4 | XPath | **가장 느리고 잘 깨진다.** 최후의 수단 |

**XPath가 웹보다 훨씬 더 나쁘다.** Appium의 XPath는 전체 UI 트리를 직렬화한 뒤 탐색하므로 요소 하나 찾는 데 수 초가 걸리기도 한다. 실행 시간이 몇 배로 늘어난다.

**Appium의 단점**: 구조가 무겁다. `테스트 코드 → Appium 서버 → 플랫폼 드라이버 → 기기` 로 여러 단계를 거쳐 느리고, 셋업이 까다롭다. 특히 iOS는 Xcode·인증서·시뮬레이터 설정이 복잡하다.

### Maestro — 배우기 가장 쉬운 선택

YAML로 흐름을 쓴다. 코드를 몰라도 시작할 수 있어서 **수동 QA가 자동화로 넘어오는 첫 도구**로 좋다.

```yaml
appId: com.example.shop
---
- launchApp
- tapOn: "로그인"
- inputText: "qa@test.com"
- tapOn:
    id: "password_input"
- inputText: "Test1234!"
- tapOn: "확인"
- assertVisible: "대시보드"
- takeScreenshot: after-login
```

**장점**
- 학습 곡선이 완만하다. 하루면 시작한다
- **자동 대기가 내장**되어 있어 플래키가 적다
- 셋업이 간단하다 (Appium 서버 불필요)
- Maestro Studio로 화면을 보며 흐름을 만들 수 있다

**한계**
- 복잡한 로직(조건 분기, 반복, 데이터 조합)에 약하다. JavaScript 확장이 있지만 제한적이다
- API 호출로 데이터를 준비하는 등 **코드가 필요한 작업**이 불편하다
- 생태계가 Appium보다 작다

**실무 판단**: 스모크 테스트와 핵심 흐름 20~30개를 빠르게 만들 목적이면 Maestro가 압도적으로 유리하다. 수백 개의 복잡한 시나리오를 관리해야 하면 Appium이나 네이티브로 간다.

### 네이티브 도구 — XCUITest / Espresso / UIAutomator

**앱 프로세스 안에서 실행되기 때문에 훨씬 빠르고 안정적이다.** 대신 플랫폼별로 따로 짜야 한다.

```kotlin
// Espresso (Android / Kotlin)
@Test
fun 로그인에_성공하면_대시보드로_이동한다() {
    onView(withId(R.id.email)).perform(typeText("qa@test.com"))
    onView(withId(R.id.password)).perform(typeText("Test1234!"), closeSoftKeyboard())
    onView(withId(R.id.loginButton)).perform(click())

    onView(withText("대시보드")).check(matches(isDisplayed()))
}
```

```swift
// XCUITest (iOS / Swift)
func test로그인성공() {
    let app = XCUIApplication()
    app.launch()

    app.textFields["email"].tap()
    app.textFields["email"].typeText("qa@test.com")
    app.secureTextFields["password"].typeText("Test1234!")
    app.buttons["login"].tap()

    XCTAssertTrue(app.staticTexts["대시보드"].waitForExistence(timeout: 5))
}
```

**Espresso 의 강점**은 **자동 동기화**다. UI 스레드가 유휴 상태가 될 때까지 알아서 기다리므로 대기 코드가 거의 필요 없다. 안정성이 매우 높다.

**Espresso 의 한계**는 **앱 밖으로 못 나간다는 것**이다. 시스템 권한 팝업, 알림 센터, 다른 앱으로의 전환을 다룰 수 없다. 그래서 **UIAutomator** 와 함께 쓴다.

```kotlin
// UIAutomator — 시스템 UI 접근 (권한 팝업 처리)
val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
device.findObject(UiSelector().text("허용")).click()
```

| 도구 | 범위 | 속도 | 안정성 |
|---|---|---|---|
| Espresso | 앱 내부만 | 매우 빠름 | 매우 높음 (자동 동기화) |
| UIAutomator | **시스템 UI 포함** | 빠름 | 높음 |
| XCUITest | iOS 앱 + 일부 시스템 | 빠름 | 높음 |
| Appium | 전부 (드라이버 경유) | 느림 | 중간 |
| Maestro | 전부 | 보통 | 높음 (자동 대기) |

### Detox — React Native 라면

RN 앱이면 Detox가 유력하다. **그레이박스** 방식이라 앱의 내부 상태(네트워크 요청 진행 중, 애니메이션 중)를 알고 **자동으로 동기화**한다. 그래서 Espresso처럼 대기 코드가 거의 필요 없고 플래키가 적다.

```javascript
await element(by.id('email')).typeText('qa@test.com');
await element(by.id('loginButton')).tap();
await expect(element(by.text('대시보드'))).toBeVisible();
```

### 모바일 특유의 테스트 항목

웹에는 없는, **반드시 확인해야 할 것들**이다. 자동화하든 수동으로 하든 목록에 있어야 한다.

```text
□ 권한 팝업 — 허용 / 거부 / "다시 묻지 않음" 각각의 동작
□ 앱 백그라운드 → 복귀 (세션 유지? 화면 상태 복원?)
□ 강제 종료 후 재실행
□ 네트워크 끊김 / 저속 / 비행기 모드 → 오프라인 처리
□ 전화 수신, 알림 도착 중 인터럽트
□ 화면 회전 (가로/세로 전환 시 상태 유지)
□ 다크 모드
□ 시스템 폰트 크기 확대 (접근성 — 레이아웃 깨짐)
□ 저사양 기기 / 메모리 부족 상황
□ 앱 업데이트 (구버전 데이터 → 신버전 마이그레이션)
□ 딥링크 진입 (로그인 안 된 상태에서 딥링크를 열면?)
□ 백버튼 (Android) — 뒤로가기 스택
```

**마지막 세 개가 자주 누락되고 자주 터진다.** 특히 앱 업데이트 시 마이그레이션은 롤백이 불가능해서 사고가 크다.

### 실기기 vs 에뮬레이터

| | 에뮬레이터/시뮬레이터 | 실기기 |
|---|---|---|
| 비용 | **무료** | 기기 구매 or 클라우드 |
| 속도 | 빠름 (CI에 적합) | 느림 |
| 정확도 | 카메라·센서·성능·배터리 재현 안 됨 | 실제 그대로 |
| 권장 | 기능 회귀 대부분 | 출시 전 최종 확인, 성능·센서 |

**학습 목적으로는 에뮬레이터로 충분하다.** Android Studio의 AVD와 Xcode 시뮬레이터 모두 무료다.

클라우드 기기 팜(BrowserStack, Sauce Labs 등)은 유료다. 오픈소스 대안으로 **Appium + 로컬 기기** 조합이 있고, Firebase Test Lab에 무료 할당량이 있지만 제한적이다.

### 도구 선택 판단 기준

```text
React Native 앱인가?
  → Detox 우선 검토

빠르게 스모크·핵심 흐름만 자동화하고 싶은가?
  → Maestro

iOS·Android 코드를 하나로 유지해야 하는가?
  팀에 자동화 전담 인력이 있는가?
  → Appium

개발팀이 테스트를 함께 작성하는가?
  앱 내부 로직까지 검증해야 하는가?
  최고의 안정성·속도가 필요한가?
  → Espresso / XCUITest (네이티브)

시스템 UI·권한 팝업을 다뤄야 하는가?
  → UIAutomator(Android) 또는 Appium/Maestro
```

**현실적인 조합**을 하나 들면: **핵심 흐름 20개는 Maestro로 매일 CI 실행, 개발팀은 Espresso/XCUITest로 단위·통합 테스트, 출시 전 실기기 수동 확인.** 하나의 도구로 다 하려 하지 않는 게 실무적이다.

## 왜 채용시장이 요구하는가

- **모바일 앱 서비스 회사의 QA 공고에는 Appium이 거의 항상 들어간다.** 웹 자동화만 할 줄 알면 지원 가능한 회사가 절반으로 준다.
- **Maestro 언급이 최근 빠르게 늘고 있다.** 진입 장벽이 낮아 팀이 도입하기 쉽기 때문이다. 이름을 알고 장단점을 말할 수 있으면 최신 흐름을 따라가는 사람으로 보인다.
- 면접 질문: **"모바일 자동화가 웹보다 어려운 점은 무엇인가요?"** — 위의 표를 답으로 쓸 수 있어야 한다. 특히 **롤백 불가**를 언급하면 릴리즈 리스크를 이해하는 사람으로 읽힌다.
- **"앱 업데이트 시 데이터 마이그레이션을 테스트해 봤는가"** 는 경력자를 가르는 질문이다.
- **AI에게 Appium 코드를 시키면 XPath를 남발한다.** 웹의 습관이 그대로 나오는데, 모바일에서 XPath는 성능 문제가 훨씬 심각하다. 접근성 ID를 쓰라고 요청하는 것, 그리고 개발팀에 `accessibilityIdentifier`/`content-desc` 를 넣어달라고 요청하는 것이 사람의 몫이다.

## 실습 과제

### 과제 1 — 무료 환경 구축 (20분)

둘 중 하나를 고른다. **Android 쪽이 설치가 쉽고 무료다.**

**Android (권장)**
1. Android Studio 설치 → AVD Manager 에서 에뮬레이터 생성 (Pixel 7 / API 34)
2. 연습용 앱: [Sunflower](https://github.com/android/sunflower) 나 [ApiDemos](https://github.com/appium/android-apidemos) APK 등 오픈소스 앱
3. `adb devices` 로 연결 확인

**iOS (macOS 필요)**
1. Xcode 설치 → Simulator 실행
2. 오픈소스 iOS 샘플 앱 빌드

### 과제 2 — Maestro 첫 흐름 (15분)

Maestro는 설치가 한 줄이다.

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

1. 에뮬레이터에 앱을 설치하고 `maestro studio` 실행
2. 화면을 보며 흐름을 만들고 YAML 로 저장
3. `maestro test flow.yaml` 로 실행
4. **일부러 텍스트를 틀리게 바꿔** 실패시켜 보고, 에러 메시지가 얼마나 친절한지 확인

### 과제 3 — 로케이터 비교 (15분)

Appium Inspector(무료) 또는 Android Studio의 Layout Inspector 로 앱의 UI 트리를 열어본다.

요소 하나를 골라 네 가지 방법으로 지목하고 비교한다.

| 방법 | 코드 | 찾는 데 걸린 시간 | 언제 깨지는가 |
|---|---|---|---|
| 접근성 ID | | | |
| resource-id | | | |
| 텍스트 | | | |
| XPath | | | |

**XPath의 소요 시간을 꼭 측정한다.** 웹과 얼마나 다른지 체감하는 게 이 과제의 목적이다.

### 과제 4 — 모바일 특유 항목 테스트 설계 (12분)

본인이 자주 쓰는 앱 하나를 골라 위 체크리스트 12개 항목에 대한 **구체적인 테스트 시나리오**를 작성한다.

각 항목마다:
- 어떻게 그 상황을 만들 것인가 (에뮬레이터 설정? adb 명령? 수동?)
- 무엇이 기대 결과인가
- **자동화 가능한가, 수동으로 남길 것인가** (10편의 판단 기준 예습)

예시:
```text
네트워크 끊김
  만드는 법: adb shell svc data disable  또는 에뮬레이터 설정
  기대 결과: 오프라인 안내 표시, 재시도 버튼 제공, 입력 중이던 데이터 유지
  자동화: 가능 (adb 명령을 테스트에서 호출)
```

### 과제 5 — AI 모바일 자동화 코드 검증 (12분)

AI 실습 도우미에 요청한다.

> Android 쇼핑 앱에서 로그인 후 상품을 장바구니에 담는 Appium 테스트를 JavaScript(WebdriverIO)로 작성하라.

| 확인 항목 | 결과 |
|---|---|
| 로케이터로 XPath 를 남발했는가 | |
| 접근성 ID(`~name`) 사용을 제안했는가 | |
| **권한 팝업 처리**를 고려했는가 | |
| 고정 대기(`driver.pause`)를 썼는가 | |
| capabilities 의 옵션명이 실제로 존재하는가 (환각 점검) | |
| 앱 상태 초기화(`fullReset`, 앱 데이터 삭제)를 고려했는가 | |

**권한 팝업과 앱 상태 초기화는 AI가 거의 항상 빠뜨린다.** 그런데 실기기에서 돌리면 첫 실행에 반드시 마주치는 문제다.

## 자가 체크리스트

- [ ] 모바일 자동화가 웹보다 어려운 이유를 7가지 이상 설명할 수 있다
- [ ] 롤백 불가와 느린 실행이 모바일 자동화 전략을 어떻게 바꾸는지 안다
- [ ] 크로스 플랫폼 도구(Appium/Maestro/Detox)와 네이티브 도구를 구분할 수 있다
- [ ] Appium의 로케이터 우선순위를 알고, 접근성 ID를 1순위로 쓴다
- [ ] Appium에서 XPath가 웹보다 훨씬 느린 이유를 설명할 수 있다
- [ ] Maestro의 장점(학습 용이, 자동 대기)과 한계(복잡한 로직)를 말할 수 있다
- [ ] Espresso의 자동 동기화가 무엇이고 왜 안정적인지 설명할 수 있다
- [ ] Espresso가 앱 밖으로 못 나가는 한계와 UIAutomator의 보완 관계를 안다
- [ ] Detox가 React Native에서 유리한 이유(그레이박스 동기화)를 안다
- [ ] 모바일 특유 테스트 항목 12가지를 나열할 수 있다
- [ ] 앱 업데이트 시 데이터 마이그레이션 테스트의 중요성을 설명할 수 있다
- [ ] 실기기와 에뮬레이터의 차이를 알고 상황에 맞게 선택할 수 있다
- [ ] 도구 선택 판단 기준을 상황별로 제시할 수 있다
- [ ] 하나의 도구로 전부 하려 하지 않고 조합 전략을 설계할 수 있다
- [ ] AI가 만든 모바일 코드에서 XPath 남발·권한 팝업 누락을 짚어낼 수 있다

## 참고 링크

- [Appium 공식 문서](https://appium.io/docs/en/latest/) — 드라이버별 capabilities 확인 (환각 검증용)
- [Maestro 문서](https://docs.maestro.dev/) — 설치와 명령어 레퍼런스
- [Espresso 가이드 (Android 공식)](https://developer.android.com/training/testing/espresso) — 한국어 지원
- [XCUITest (Apple)](https://developer.apple.com/documentation/xctest/user-interface-tests) — 공식 문서
- [Detox](https://wix.github.io/Detox/) — React Native 전용
- [Appium Inspector](https://github.com/appium/appium-inspector) — 무료 UI 트리 탐색기
