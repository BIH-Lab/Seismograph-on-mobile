# CLAUDE.md
> Claude Code가 이 프로젝트를 열면 가장 먼저 읽는 파일입니다.

## 프로젝트 개요
스마트폰 브라우저의 가속도 센서(DeviceMotionEvent)를 활용하여
실시간 지진동 데이터를 수집하고, 웹에서 시각화·분석·다운로드할 수 있는
연구/교육용 웹 플랫폼입니다.

연구 결과물로 제작되며, 나선형 개발 방법론(Boehm, 1986)을 따릅니다.

## 기술 스택 (현재 — Cycle 4 진행 중)
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
│   └── index.html          # Activity 3 - 주파수 분석 (스펙트로그램·PSD·HVSR)
├── activity4/
│   └── index.html          # Activity 4 - 주시곡선 탐사 (굴절법)
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (3단계 폴백, CALIB_SAMPLES=100)
│       ├── visual.js       # 시각화 모듈 (파형 그래프 + MMI 색상)
│       ├── review.js       # 리뷰 모드 모듈 (activity1 전용)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       ├── export.js       # CSV 내보내기 모듈 (toFixed(9))
│       ├── spectrogram.js  # 가로 워터폴 스펙트로그램 v3.2 (FFT → Canvas, Seismic jet 컬러맵)
│       ├── psd.js          # Welch PSD 모듈 v3.6 (실시간/누적 히트맵 토글, Y축 오토스케일)
│       ├── hvsr.js         # Nakamura HVSR 모듈 v2.1 (스무딩 없음, FILE_HOP=128, Y축 오토스케일)
│       ├── export-image.js # PNG 내보내기 모듈 v1.0 (ObsPy 스타일 헤더 + canvas toDataURL)
│       └── hodochron.js    # 주시곡선 모듈 v1.1 (자동 회귀 + 수동 선 그리기)
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── TASK.md
└── README.md
```

## 코딩 컨벤션
- 언어      : 주석 및 변수명 영어, UI 텍스트 한국어
- 함수명    : camelCase
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
**Cycle 4 진행 중** — TASK.md 참고
- Cycle 1 완료: Activity 1 (지진파 색으로 보기 + KMA MMI + 리뷰 모드)
- Cycle 2 완료: Activity 2 (GPS + Z축 + CSV, Android/iOS 테스트 완료)
- Cycle 3 완료: Activity 3 (스펙트로그램·PSD·HVSR 3분석 — 센서 + 파일 모드)
  - 센서 모드: 실시간 파형 + 3분석 모듈 동시 실행 (탭 전환)
  - 파일 선택 모드: CSV 로드 → 파형 표시 + 드래그·핀치 뷰포트 제어 → 3모듈 일괄 계산
  - 드래그·핀치: 파형이 주 조작면, 스펙트로그램은 passive display로 연동
  - PC 드래그 앤 드롭 지원, Android Firefox 검증 완료
- Cycle 3 QA 개선 완료 (2026-03-26):
  - 스펙트로그램 포화 해소 (LOG 범위 5 디케이드) + Seismic jet 컬러맵
  - PSD/HVSR Y축 오토스케일 (_dispDbMax, _hvDispMax)
  - 정지 후 스펙트로그램 스크롤 버그 수정, 센서 파형 리뷰 인터랙션 추가
  - NTP 시계 동기화 저장 기능 (root index.html)
- Activity 3 PNG 내보내기 완료 (2026-04-04):
  - export-image.js v1.0: ObsPy 스타일 메타데이터 헤더 + canvas 캡처 → PNG 다운로드
  - 8개 PNG 버튼: "↓ 파형" / "↓ 스펙트로그램" / "↓ PSD" / "↓ HVSR" × 센서/파일 모드
  - 파일명 형식: `seismo_{type}_{station}_{date}.png`
- Activity 2 iOS 버그 수정 (2026-04-08):
  - 시작 버튼 핸들러 async 제거, SensorModule.start() 제스처 컨텍스트 안에서 먼저 호출
  - NTP·GPS 백그라운드 병렬 처리로 이동
- psd.js v3.2~3.4 완료 (2026-04-08):
  - 밀도 히트맵 (파랑→빨강), 저주파 빈칸 수정, 평균선 흰색 1px
- hvsr.js v2.1 완료 (2026-04-08):
  - 스무딩(KO·MA) 제거, FILE_HOP 512→128 (87.5% 오버랩)
- psd.js v3.5~3.6 완료 (2026-04-13):
  - v3.5: 실시간/누적 토글 (`setDensityMode`): OFF=최신 윈도우 청록 라인, ON=밀도 히트맵
  - v3.6: Peterson NLNM/NHNM 참조선 완전 제거 (고노이즈 환경 활용 불가)
- Activity 3 UX 개선 완료 (2026-04-13):
  - 컨트롤(버튼) 그래프 패널 외부로 분리 (graph-controls) → 그래프 가림 해소
  - 실시간↔누적 토글: PSD 탭 활성 시 측정 정지 버튼 위 가운데 표시 (센서 모드)
  - PNG 버튼 레이블 명확화: "↓ PNG" → "↓ 파형" / "↓ 스펙트로그램" / "↓ PSD" / "↓ HVSR"
- Activity 4 v1 완료 (2026-04-14):
  - 3탭 구조 (파싱/거리 · 시간조정 · 픽킹/분석)
  - Tab 2 Record Section: 트레이스 거리순 정렬, 빨간 기준선 드래그, ±2000ms 오프셋 슬라이더
  - Tab 3 주시곡선: 자동 회귀 모드 + 수동 선 그리기 모드 (드래그 핸들 → V1/V2/xc/h 실시간)
  - hodochron.js v1.1: _getTransforms(), addLine/clearLines/setMode/onManualUpdate API
- Cycle 5 예정: Activity 5 — P파·S파 위상 픽킹 + GPS 진원 역산

## 스펙트로그램 파라미터 (ObsPy 기준)
- spectrogram.js v3.2: FFT_SIZE=256, HOP_SIZE=26 (오버랩 ~90%), MAX_FREQ=100Hz, WINDOW_SEC=30s
  - 컬러맵: Seismic jet (검정→파랑→시안→녹색→노랑→주황→빨강), LOG_MIN=-5, LOG_MAX=0
- psd.js v3.6: FFT_SIZE=1024, HOP_SIZE=26, F_MIN=0.2Hz, 밀도 히트맵(파랑→빨강), 평균선(흰색 1px), 실시간/누적 토글, Y축 오토스케일(_dispDbMax)
- hvsr.js v2.1: FFT_SIZE=1024, HOP_SIZE=26(센서)/128(파일), F_MAX=50Hz, SESAME 준수, 스무딩 없음, 정상성 필터, Y축 오토스케일(_hvDispMax)
- 공통: Hann 윈도우, 히스토리 기반 전체 재렌더
- 알려진 이슈: Firefox Android DeviceMotionEvent.interval 오보고(100ms) → activity3에서 50~250Hz 범위 체크로 필터링
