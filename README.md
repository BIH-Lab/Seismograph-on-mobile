# Seismograph-on-mobile

스마트폰 내장 가속도 센서를 활용하여 지진동 데이터를 실시간 수집하고 시각화하는 웹 플랫폼.
앱 설치 없이 브라우저만으로 동작하며, GitHub Pages를 통해 배포됩니다.

🔗 **[https://bih-lab.github.io/Seismograph-on-mobile/](https://bih-lab.github.io/Seismograph-on-mobile/)**

---

## 사용법

1. 스마트폰 브라우저로 위 링크에 접속합니다.
   - iOS → **Safari** 권장
   - Android → **Firefox** 권장 (Chrome은 센서 정밀도 제한 있음 — [아래 참고](#android-chrome-센서-정밀도-제한))
2. 첫 화면에서 **관측소 번호**를 입력하고 저장합니다 (CSV 메타데이터에 자동 포함).
3. Activity 카드를 선택합니다.
4. **측정 시작** 버튼을 누르고 센서·GPS 권한을 허용합니다.
5. 실시간으로 진동 데이터가 그래프에 표시됩니다.
6. **측정 정지** 버튼을 누르면 측정이 멈추고 그래프가 유지됩니다.
7. CSV 다운로드 버튼으로 데이터를 저장하거나, 다시 **초기화** 버튼을 눌러 리셋합니다.

**Activity 1 (지진파 색으로 보기) 주요 기능:**

- 측정 시작 → 3초 워밍업 → 자동 캘리브레이션 → 실시간 진도 표시
- **실시간/고정 토글**: 실시간 모드는 현재 진도, 고정 모드는 측정 이후 최대 진도를 누적 표시
- **리뷰 모드**: 측정 정지 후 전체 파형을 드래그하여 1초 구간별 진도 확인. 하단에 실제 관측 시각(HH:MM:SS.mmm) 표시
- **진도 안내**: 하단 버튼 → KMA 2018 수정 메르칼리 진도 11단계 기준표 팝업

**Activity 3 (주파수 분석) 추가 사용법:**

- **센서 모드**: 위와 동일하게 측정 시작 → 파형과 스펙트로그램 동시 표시
- **파일 선택 모드**: Activity 2에서 저장한 CSV 파일을 드래그 앤 드롭(PC) 또는 파일 선택 버튼(모바일)으로 불러온 후 **분석 시작** 버튼을 누르면 약 7초 애니메이션으로 스펙트로그램 재생

> ⚠️ 센서 API와 GPS API는 **HTTPS 환경**에서만 동작합니다.

---

## Activity 목록

| # | 이름 | 상태 | 설명 |
|---|------|------|------|
| 01 | 지진파 색으로 보기 | ✅ 완료 | KMA 2018 수정 메르칼리 진도(11단계)에 따라 화면 배경색 변화, 실시간 파형 그래프 + 리뷰 모드 |
| 02 | 지진파 기록하기 | ✅ 완료 | GPS 좌표 + Z축 가속도를 시간별로 기록하고 CSV로 다운로드 |
| 03 | 주파수 분석 (스펙트로그램) | ✅ 완료 | 실시간 FFT 스펙트로그램 + CSV 파일 로드 후 7초 재생 애니메이션 |
| 04 | 신호 비교하기 | 준비중 | 여러 기기의 CSV를 불러와 파형·통계 비교 |
| 05 | 주시곡선·진원 찾기 | 준비중 | P파·S파 도달 시간 및 GPS 위치로 진원지 역산 |

---

## CSV 데이터 포맷 (Activity 2)

측정 후 다운로드되는 CSV 파일의 구조입니다.

```
# station_id: STN-01
# latitude: 37.491234
# longitude: 127.012345
# accuracy: 12m
# sample_rate: 100 Hz
timestamp,acc_z
2026-03-09T10:00:00.123Z,0.003421
2026-03-09T10:00:00.133Z,-0.001205
...
```

| 항목 | 설명 |
|------|------|
| `# station_id` | 관측소 번호 (첫 화면에서 입력, localStorage 저장) |
| `# latitude` / `# longitude` | GPS 위도·경도 (측정 시작 시 1회 고정) |
| `# accuracy` | GPS 수평 정확도 (단위: m) |
| `# sample_rate` | 실제 샘플링 레이트 (측정 종료 시 재계산) |
| `timestamp` | ISO 8601 UTC 타임스탬프 |
| `acc_z` | Z축 가속도 변화량 (단위: m/s², 기준값 대비 Δ) |

> Activity 3의 파일 선택 모드에서 이 CSV를 직접 불러와 스펙트로그램을 재생할 수 있습니다.

---

## 기술 스택

- **Vanilla JS** — 빌드 도구 없는 단일 파일 구조
- **Canvas API** — 실시간 파형 그래프 + 스펙트로그램
- **DeviceMotionEvent API** — 스마트폰 가속도 센서
- **Geolocation API** — GPS 좌표 수집
- **GitHub Pages** — 정적 웹 배포 (HTTPS 자동 제공)

---

## 파일 구조

```
Seismograph-on-mobile/
├── index.html              # 목차 페이지
├── activity1/
│   └── index.html          # Activity 1 — 지진파 색으로 보기
├── activity2/
│   └── index.html          # Activity 2 — 지진파 기록하기
├── activity3/
│   └── index.html          # Activity 3 — 주파수 분석 (스펙트로그램)
├── assets/
│   ├── css/style.css       # 공통 스타일 (모바일 퍼스트 다크 테마)
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (iOS/Android 권한 처리)
│       ├── visual.js       # 시각화 모듈 (배경색 + 파형 그래프)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       ├── export.js       # CSV 다운로드 모듈
│       └── spectrogram.js  # FFT 스펙트로그램 모듈 (Hann 윈도우, Viridis 컬러맵)
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── TASK.md
```

---

## 개발 현황 (나선형 개발 방법론)

- [x] Cycle 1 완료 — Activity 1: 지진파 색으로 보기 (KMA 2018 MMI 11단계, 리뷰 모드, 피크 홀드 등 개선 완료)
- [x] Cycle 2 완료 — Activity 2: 지진파 기록하기 (GPS + CSV 다운로드, Android/iOS 테스트 완료)
- [x] Cycle 3 완료 — Activity 3: 주파수 분석 (실시간 FFT 스펙트로그램 + CSV 파일 재생)
- [ ] Cycle 4 예정 — Activity 4: 신호 비교하기 (다중 CSV 비교·통계)
- [ ] Cycle 5 예정 — Activity 5: 주시곡선·진원 찾기

---

## Android Chrome 센서 정밀도 제한

Android Chrome은 모든 센서 API(`DeviceMotionEvent` 및 `Generic Sensor API` 포함)에 **개인정보 보호 목적의 반올림 정책**을 적용합니다.
이로 인해 가속도 값이 0.01 ~ 0.1 m/s² 단위로 양자화되어 지진파 분석에 필요한 정밀도를 얻기 어렵습니다.

| 브라우저 | 가속도 정밀도 | 비고 |
|----------|--------------|------|
| iOS Safari | ~9자리 유효숫자 (`-0.005296172` 수준) | Apple이 반올림 정책 미적용 |
| Android **Firefox** | ~9자리 유효숫자 | Mozilla가 반올림 정책 미적용 ✅ |
| Android Chrome | ~1~2자리 (`0.17` 수준) | `RoundSensorReading()` 적용 ⚠️ |

Chrome의 반올림은 PWA 설치, COOP/COEP 헤더 등으로 우회할 수 없는 **플랫폼 수준 정책**입니다.

**관련 레퍼런스**
- [Chromium — `platform_sensor_util.h` (RoundSensorReading 정책)](https://source.chromium.org/chromium/chromium/src/+/main:services/device/public/cpp/generic_sensor/platform_sensor_util.h)
- [W3C Generic Sensor API — Security and Privacy 고려사항](https://www.w3.org/TR/generic-sensor/#security-and-privacy)
- [W3C DeviceOrientation Event 명세](https://www.w3.org/TR/orientation-event/)

---

## 커뮤니티

사용 후기, 활용 사례, 아이디어는 **[GitHub Discussions](https://github.com/BIH-Lab/Seismograph-on-mobile/discussions)** 에서 공유해주세요.

---

## 참고

- [AstroHopper](https://artyom-beilis.github.io/astrohopper.html) — 단일 HTML 기반 웹앱 구조 참고
