# DEVLOG — 개발 과정 문제 및 해결 기록

> 나선형 개발 방법론 각 Cycle에서 발생한 문제와 해결 방법을 기록합니다.
> 논문 연구 결과물 문서화 및 향후 유지보수 참고용.

---

## Cycle 2 — Activity 2 (지진파 기록하기)

### [문제] GPS enableHighAccuracy 실내 타임아웃

- **현상**: `enableHighAccuracy: true` 설정 시 실내에서 GPS chip 강제 사용으로 위치를 얻지 못하고 타임아웃 발생
- **원인**: iOS는 `enableHighAccuracy: true`이면 GPS chip을 강제 사용하여 실내에서 신호 없음
- **해결**: `enableHighAccuracy: false`로 변경 → WiFi/셀 기반 위치 사용 (실내에서도 안정적)
- **파일**: `assets/js/gps.js`

### [문제] iOS Safari DeviceMotionEvent 권한 요청 타이밍 오류

- **현상**: iOS에서 센서 측정 시작 시 권한 팝업 없이 바로 오류 발생
- **원인**: iOS Safari 13+에서 `DeviceMotionEvent.requestPermission()`은 반드시 사용자 제스처(버튼 클릭) 이후에 호출해야 함
- **해결**: 버튼 클릭 이벤트 핸들러 내에서 `_requestiOSPermission()` 호출 구조 유지
- **파일**: `assets/js/sensor.js`

### [문제] CSV 다운로드 — 모바일에서 `<a download>` 동작 불안정

- **현상**: 일부 모바일 브라우저에서 CSV 파일이 다운로드되지 않거나 내용이 빈 상태
- **원인**: 모바일 브라우저는 `<a download>` Blob URL 처리가 불안정함
- **해결**: 우선순위 3단계로 처리
  1. 데스크톱: `showSaveFilePicker` (File System Access API)
  2. 모바일: `navigator.share` (Web Share API, iOS 15+/Android)
  3. 폴백: `<a download>` (구형 브라우저)
- **파일**: `assets/js/export.js`

---

## Cycle 3 — Activity 3 (주파수 분석 — 스펙트로그램)

### [문제] Android CSV 유효숫자 1개 (0.1 m/s² 단위 양자화)

- **현상**: Android Chrome에서 측정한 CSV의 acc_z 값이 0.1, -0.1, 0.0 등 1자리 유효숫자만 기록
- **원인**: W3C Device Orientation and Motion 표준의 **지문 방지(fingerprinting prevention) 정책**
  - Chrome은 `DeviceMotionEvent`의 `acceleration`과 `accelerationIncludingGravity` 모두 0.1 m/s² 단위로 반올림
  - 이는 Chrome의 독자 정책이 아니라 W3C 표준에 명시된 사항
  - iOS Safari도 동일 표준을 따르나 구현 방식에 따라 약간의 차이 있음
- **조사**: `acceleration`과 `accelerationIncludingGravity` 둘 다 동일한 제한을 받음 — 소스 변경으로는 해결 불가
- **해결**: **Generic Sensor API (`Accelerometer` 클래스) 우선 사용 구현**
  - Chrome 67+ Android에서 하드웨어 ADC 직접 접근, 브라우저 반올림 없음
  - `typeof Accelerometer !== 'undefined'` 체크로 지원 여부 판단 후 우선 사용
  - 지원 불가 시 DeviceMotionEvent fallback
- **파일**: `assets/js/sensor.js`

### [문제] CSV 소수점 정밀도 손실 (`parseFloat` + `toFixed` 이중 적용)

- **현상**: Generic Sensor API 사용 시에도 CSV에서 소수점이 잘려 나옴 (예: 0.1 instead of 0.100000)
- **원인**: 두 곳에서 정밀도 손실 발생
  1. `sensor.js`에서 `parseFloat(x.toFixed(6))` — float64 → 문자열(6자리) → 다시 float64 변환 시 trailing zero 제거
  2. `export.js`에서 JS 기본 `number.toString()` 사용 시 trailing zero 제거
- **해결**:
  - `sensor.js`에서 `parseFloat(toFixed(6))` 래퍼 제거 → 원시 float64 그대로 전달
  - `export.js`의 CSV 직렬화에서 `toFixed(6)` 포매터 추가
- **파일**: `assets/js/sensor.js`, `assets/js/export.js`

### [문제] Generic Sensor API NotAllowedError 시 fallback 없이 종료

- **현상**: Android Chrome 설정에서 해당 사이트의 센서를 차단한 경우, 오류 메시지만 표시되고 측정이 불가
- **원인**: 오류 핸들러가 `NotAllowedError` 발생 시 `onError` 호출 후 종료 — DeviceMotionEvent fallback 없음
  ```javascript
  // 버그 코드
  if (e.error.name === 'NotAllowedError') {
      onError('센서 권한이 거부되었습니다.');  // 여기서 종료
  }
  ```
- **해결**: 모든 Generic Sensor 오류에서 DeviceMotionEvent로 fallback
  ```javascript
  _accelSensor.addEventListener('error', () => {
      _accelSensor = null;
      _startDeviceMotion(onError);  // 항상 fallback
  });
  ```
- **파일**: `assets/js/sensor.js`

### [문제] 센서 경로 확인 수단 없음 (진단 불가)

- **현상**: Generic Sensor API와 DeviceMotionEvent 중 어느 경로가 사용 중인지 UI에 표시되지 않아 정밀도 문제 원인 진단 불가
- **해결**: `_onStatus('ready', source)` 콜백에 센서 소스 정보 추가
  - 상태 메시지에 `(Generic Sensor API — 고정밀)` 또는 `(DeviceMotionEvent — 일반)` 표시
- **파일**: `assets/js/sensor.js`, `activity1/index.html`, `activity2/index.html`, `activity3/index.html`

### [문제] 스펙트로그램이 전체적으로 어두워 진동 식별 불가

- **현상**: 스마트폰을 책상에 놓고 측정해도 스펙트로그램이 거의 검은색으로만 표시
- **원인**: LOG 진폭 범위가 `[-4, 0]` (0.0001 ~ 1.0 m/s²)로 강진 수준 기준 설정됨
  - 일상 건물 진동 범위(0.001 ~ 0.1 m/s²)가 전체 색상 범위의 하위 25~75%에만 해당
  - 실제 측정값이 어두운 보라/파랑 영역에 몰려 대비 저하
- **해결**: LOG 범위 `[-3, -1]` (0.001 ~ 0.1 m/s²)로 조정
  - 일상 건물 진동이 전체 색상 스펙트럼(dark → bright yellow) 사용
  - 동일 신호에서 색상 대비 약 4배 향상

  | 진폭 | log10 | 구 범위 t | 신 범위 t |
  |------|-------|----------|----------|
  | 0.001 m/s² | -3 | 0.25 (어두운 파랑) | 0.00 (바닥) |
  | 0.01 m/s²  | -2 | 0.50 (청록)        | 0.50 (중간) |
  | 0.1 m/s²   | -1 | 0.75 (연두)        | 1.00 (최대) |

- **파일**: `assets/js/spectrogram.js`, `activity3/index.html`

### [문제] 파형 그래프가 딱딱하게 계단형으로 표시

- **현상**: Activity 1, 3의 파형 그래프가 계단형으로 나타나 연속적인 진동파처럼 보이지 않음
- **원인**: 하드웨어 센서 양자화 + 인접 샘플 간 직선(`lineTo`) 연결 → 시각적으로 각지고 딱딱함
- **해결**: 중점 기반 quadratic bezier 곡선 렌더링으로 변경
  ```javascript
  // 직선 연결 → 중점 quadratic bezier
  const midX  = (prevPx + px) / 2;
  const midY2 = (prevPy + py) / 2;
  ctx.quadraticCurveTo(prevPx, prevPy, midX, midY2);
  ```
  - **데이터 값은 전혀 수정 없음** — 순수 렌더링 개선
- **파일**: `assets/js/visual.js`

### [문제] Android CSV 정밀도 부족 + 센서 폴백 미흡

- **현상**: LinearAccelerationSensor가 일부 기기(자이로스코프 없음)에서 에러 → DeviceMotionEvent 폴백 → 0.1 m/s² 1자리만 기록
- **추가 문제**:
  - CALIB_SAMPLES=5 (50ms)는 기동 노이즈 포함 위험
  - `new Date().toISOString()`은 JS 이벤트 큐 지연이 포함되어 실제 측정 시점과 오차 발생
- **해결**: 3단계 센서 폴백 + 측정 품질 개선
  1. LinearAccelerationSensor (최고정밀, 자이로 필요) → 2. Accelerometer (고정밀, 자이로 불필요) → 3. DeviceMotionEvent (0.1 m/s² 한계)
  - CALIB_SAMPLES: 5 → 100 (1초 안정화)
  - 타임스탬프: `performance.timeOrigin + performance.now()` 기반으로 변경 (센서 인터럽트 시점)
  - export.js `toFixed(6)` → `toFixed(9)`
- **파일**: `assets/js/sensor.js`, `assets/js/export.js`, activity HTML 3곳

---

## 기술 결정 기록

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| GPS 정확도 모드 | `enableHighAccuracy: false` | 실내 타임아웃 방지 |
| 센서 API 우선순위 | LinearAccelerationSensor → Accelerometer → DeviceMotionEvent | 기기 지원 여부에 따라 최고 정밀도 자동 선택 |
| CSV 다운로드 방식 | Web Share API 우선 (모바일) | 모바일에서 `<a download>` 불안정 |
| FFT 윈도우 함수 | Hann window | 스펙트럼 누설(spectral leakage) 억제 |
| FFT overlap | HOP_SIZE=26 (~90%) | ObsPy 기본값 준수 |
| 스펙트로그램 주파수 상한 | 25 Hz | 건물 진동 신뢰 대역(5~25 Hz) 커버 |
| 스펙트로그램 LOG 범위 | [-3, -1] | 일상 건물 진동(0.001~0.1 m/s²) 최적화 |
