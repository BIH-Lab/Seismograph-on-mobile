# Seismograph-on-mobile

스마트폰 내장 가속도 센서를 활용하여 지진동 데이터를 실시간 수집·시각화·주파수 분석하는 연구/교육용 웹 플랫폼.
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

> ⚠️ 센서 API와 GPS API는 **HTTPS 환경**에서만 동작합니다.

### Activity 1 (지진파 색으로 보기)

- 측정 시작 → 3초 워밍업 → 자동 캘리브레이션 → 실시간 진도 표시
- **실시간/고정 토글**: 실시간 모드는 현재 진도, 고정 모드는 측정 이후 최대 진도(피크 홀드) 표시
- **리뷰 모드**: 측정 정지 후 전체 파형을 드래그하여 1초 구간별 진도 확인. 하단에 실제 관측 시각(HH:MM:SS.mmm) 표시
- **진도 안내**: 하단 버튼 → KMA 2018 수정 메르칼리 진도 11단계 기준표 팝업

### Activity 3 (주파수 분석)

**3가지 분석 탭**: 스펙트로그램 / PSD / HVSR

**센서 모드:**
- 측정 시작 → 실시간 파형 + 3가지 분석 동시 실행
- 탭을 전환하며 분석 결과 확인
- 측정 정지 후 스펙트로그램 탭에서 드래그·핀치로 탐색 가능

**파일 선택 모드:**
- Activity 2에서 저장한 CSV 파일을 드래그 앤 드롭(PC) 또는 파일 선택(모바일)
- **분석 시작** 버튼 클릭 → 3모듈 일괄 계산 → 탭 전환으로 각 결과 확인
- 3축 CSV(`acc_x, acc_y, acc_z`): 스펙트로그램·PSD·HVSR 모두 활성화
- Z축 전용 CSV(`acc_z`): 스펙트로그램·PSD만 활성화, HVSR 탭 비활성화

---

## Activity 목록

| # | 이름 | 상태 | 설명 |
|---|------|------|------|
| 01 | 지진파 색으로 보기 | ✅ 완료 | KMA 2018 수정 메르칼리 진도(11단계)에 따라 화면 배경색 변화 + 실시간 파형 + 리뷰 모드 |
| 02 | 지진파 기록하기 | ✅ 완료 | GPS 좌표 + Z축 가속도를 시간별로 기록하고 CSV로 다운로드 |
| 03 | 주파수 분석 | ✅ 완료 | 스펙트로그램·PSD·HVSR 3가지 주파수 분석 — 실시간 센서 + CSV 파일 모드 |
| 04 | 신호 비교하기 | 준비중 | 여러 기기의 CSV를 불러와 파형·통계 비교 |
| 05 | 주시곡선·진원 찾기 | 준비중 | P파·S파 도달 시간 및 GPS 위치로 진원지 역산 |

---

## 주파수 분석 도구 (Activity 3)

### 스펙트로그램

시간에 따른 주파수 성분의 변화를 색으로 표현하는 가로 워터폴 그래프.

- **X축**: 시간 (왼쪽=과거 → 오른쪽=현재) — 파형과 동일 방향, 직접 비교 가능
- **Y축**: 주파수 (0Hz 하단 ~ Nyquist 상단)
- **색상**: Viridis-style 컬러맵 (보라=약 → 노랑=강)
- **파라미터**: FFT_SIZE=256, HOP_SIZE=26 (ObsPy 기준 ~90% 오버랩), Hann 윈도우

### PSD (전력 스펙트럼 밀도)

Welch's method로 각 주파수 성분이 가진 에너지 분포를 dB 단위로 표시.

- **알고리즘**: `PSD[f] = mean(|FFT|²) / (sr × FFT_size)` → `dB = 10 × log₁₀(PSD)`
- **표시**: 주파수(로그 스케일, 0.5~50 Hz) vs 파워(-120~-20 dB)
- **실시간**: 최근 16개 FFT 프레임 rolling average
- **활용**: 배경 노이즈 수준 평가, Peterson NLNM/NHNM 모델 비교

### HVSR (수평/수직 스펙트럼 비율)

Nakamura(1989) 방법으로 부지의 **공진 주파수(f₀)**를 찾는 분석. 3축 데이터 필요.

- **공식**: `HVSR(f) = H(f) / V(f)`,  `H = √((|FFT_x|² + |FFT_y|²) / 2)`,  `V = |FFT_z|`
- **표시**: 주파수(로그 스케일, 0.5~20 Hz) vs H/V 비율(0~10)
- **f₀ 탐지**: 1~10 Hz 범위 H/V 최대값 → 수직 점선 + 레이블 표시 (H/V > 1.5 기준)
- **신뢰도**: 50 윈도우 미만 시 경고 표시 (약 10분 이상 측정 권장)
- **활용**: 부지 증폭 특성 추정, 퇴적층 두께 추정 (정희옥 외, 2010; SESAME, 2004)

---

## CSV 데이터 포맷 (Activity 2)

```
# station_id: STN-01
# latitude: 37.491234
# longitude: 127.012345
# accuracy: 12m
# sample_rate: 100 Hz
timestamp,acc_z
2026-03-09T10:00:00.123Z,0.003421869
2026-03-09T10:00:00.133Z,-0.001205437
...
```

| 항목 | 설명 |
|------|------|
| `# station_id` | 관측소 번호 (첫 화면에서 입력, localStorage 저장) |
| `# latitude` / `# longitude` | GPS 위도·경도 (측정 시작 시 1회 고정) |
| `# accuracy` | GPS 수평 정확도 (단위: m) |
| `# sample_rate` | 실제 샘플링 레이트 (측정 종료 시 재계산, 단위: Hz) |
| `timestamp` | ISO 8601 UTC 타임스탬프 (`performance.timeOrigin + performance.now()`) |
| `acc_z` | Z축 가속도 변화량 (단위: m/s², 캘리브레이션 기준값 대비 Δ, `toFixed(9)`) |

> **Activity 3 HVSR 사용 시**: `acc_x, acc_y, acc_z` 3축 컬럼이 모두 포함된 CSV가 필요합니다.
> SAC 헤더 대응: `station_id→KSTNM`, `latitude→STLA`, `longitude→STLO`, `sample_rate(Hz)→1/DELTA`

---

## 기술 스택

- **Vanilla JS** — 빌드 도구 없는 단일 파일 구조, 외부 라이브러리 없음
- **Canvas API** — 실시간 파형 그래프 + 스펙트로그램·PSD·HVSR 렌더링
- **Cooley-Tukey FFT** — 순수 JS 구현 (Hann 윈도우, Viridis-style LUT)
- **DeviceMotionEvent / Generic Sensor API** — 스마트폰 가속도 센서 (3단계 자동 폴백)
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
│   └── index.html          # Activity 3 — 주파수 분석 (스펙트로그램·PSD·HVSR)
├── assets/
│   ├── css/style.css       # 공통 스타일 (모바일 퍼스트 다크 테마)
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (3단계 폴백 + 캘리브레이션)
│       ├── visual.js       # 시각화 모듈 (배경색 + 파형 그래프 + MMI)
│       ├── review.js       # 리뷰 모드 모듈 (Activity 1 전용)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       ├── export.js       # CSV 다운로드 모듈
│       ├── spectrogram.js  # 가로 워터폴 스펙트로그램 (FFT → Canvas)
│       ├── psd.js          # Welch PSD 모듈 (전력 스펙트럼 밀도)
│       └── hvsr.js         # Nakamura HVSR 모듈 (부지 공진 주파수)
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── TASK.md
```

---

## 개발 현황 (나선형 개발 방법론)

- [x] Cycle 1 완료 — Activity 1: 지진파 색으로 보기 (KMA 2018 MMI 11단계, 리뷰 모드, 피크 홀드)
- [x] Cycle 2 완료 — Activity 2: 지진파 기록하기 (GPS + Z축 + CSV 다운로드)
- [x] Cycle 3 완료 — Activity 3: 주파수 분석 (스펙트로그램·PSD·HVSR — 센서 + 파일 모드)
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

## 참고 문헌

- Nakamura, Y. (1989). A method for dynamic characteristics estimation of subsurface using microtremor on the ground surface. *QR of RTRI*, 30(1), 25–33.
- SESAME European Research Project (2004). *Guidelines for the implementation of the H/V spectral ratio technique on ambient vibrations.* WP12 — Deliverable D23.12.
- 정희옥, 이희권, 최인길 (2010). 상시미동 H/V 스펙트럼비를 이용한 한반도 서남부 지역의 지반 특성 연구. *한국지구과학회지*, 31(7), 757–771.
- [AstroHopper](https://artyom-beilis.github.io/astrohopper.html) — 단일 HTML 기반 웹앱 구조 참고
