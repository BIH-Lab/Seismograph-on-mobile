# CLAUDE.md
> Claude Code가 이 프로젝트를 열면 가장 먼저 읽는 파일입니다.

## 프로젝트 개요
스마트폰 브라우저의 가속도 센서(DeviceMotionEvent)를 활용하여
실시간 지진동 데이터를 수집하고, 웹에서 시각화·분석·다운로드할 수 있는
연구/교육용 웹 플랫폼입니다.

석사학위논문 연구 결과물로 제작되며, 나선형 개발 방법론(Boehm, 1986)을 따릅니다.

## 기술 스택 (현재 — Cycle 3 완료)
- Frontend : Vanilla JS + CSS (빌드 도구 없음)
- 그래프   : Canvas API (외부 라이브러리 없음)
- 센서 API : Generic Sensor API (`LinearAccelerationSensor` → `Accelerometer`) + `DeviceMotionEvent` (3단계 자동 폴백)
- 위치 API : Geolocation API (Web API)
- 배포      : GitHub Pages (HTTPS 자동 제공)

> Cycle 4 이후 서버 필요 여부를 재검토하여 기술 스택을 확장할 예정

## 폴더 구조
```
project-root/
├── index.html              # 목차 페이지 (플랫폼 진입점)
├── activity1/
│   └── index.html          # Activity 1 - 지진파 색으로 보기
├── activity2/
│   └── index.html          # Activity 2 - 지진파 기록하기
├── activity3/
│   └── index.html          # Activity 3 - 주파수 분석 (스펙트로그램)
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (3단계 폴백, CALIB_SAMPLES=100)
│       ├── visual.js       # 시각화 모듈 (파형 그래프)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       ├── export.js       # CSV 내보내기 모듈 (toFixed(9))
│       └── spectrogram.js  # 스펙트로그램 모듈 (FFT → Canvas)
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── TASK.md
└── README.md
```

## 코딩 컨벤션
- 언어      : 주석 및 변수명 영어, UI 텍스트 한국어
- 함수명    : camelCase
- 파일당 라인 수 : 300줄 이하 유지
- 모듈 패턴 : IIFE + 클로저 (const Module = (() => { ... })())

## 주의사항
- iOS Safari에서 DeviceMotionEvent 사용 시 반드시 사용자 제스처 후 권한 요청 필요
- GPS(Geolocation)도 사용자 제스처 이후에 요청할 것
- 센서 API / GPS API는 반드시 HTTPS 환경에서만 동작 (localhost 제외)
- **Android 권장 브라우저: Firefox** — Chrome은 모든 센서 API에 `RoundSensorReading()` 반올림 적용 (0.01~0.1 m/s² 한계, 우회 불가)
- Android Firefox는 Generic Sensor API 미지원 → `DeviceMotionEvent` 경로 사용, 반올림 없이 9자리 정밀도
- 센서 우선순위: `LinearAccelerationSensor` → `Accelerometer` → `DeviceMotionEvent` (sensor.js 자동 처리)
- 새 기능 추가 전 반드시 TASK.md 확인

## 현재 개발 단계
**Cycle 3 완료, Cycle 4 준비 중** — TASK.md 참고
- Cycle 1 완료: Activity 1 (지진파 색으로 보기)
- Cycle 2 완료: Activity 2 (GPS + Z축 + CSV, Android/iOS 테스트 완료)
- Cycle 3 완료: Activity 3 (주파수 분석 스펙트로그램)
  - 센서 모드: 실시간 FFT 스펙트로그램 + 피크 주파수 표시
  - 파일 선택 모드: CSV 로드 → 전처리 → 7초 애니메이션
  - PC 드래그 앤 드롭 지원
  - Android Firefox 검증 완료 (9자리 정밀도)
- Cycle 4 예정: Activity 4 — 신호 비교하기

## 스펙트로그램 파라미터 (ObsPy 기준)
- FFT_SIZE = 256, HOP_SIZE = 26 (오버랩 ~90%), MAX_FREQ = 25 Hz
- 윈도우: Hann, 컬러맵: Viridis-style (log10 진폭 스케일)
