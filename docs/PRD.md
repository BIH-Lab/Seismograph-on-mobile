# PRD.md — Product Requirements Document
> 최종 업데이트: 2026-04-14 (Activity 4 v1 완료 — Cycle 4 기준)

---

## 제품 목적

스마트폰 내장 가속도 센서를 활용해 지진동 데이터를 실시간 수집하고,
웹 플랫폼에서 시각화·주파수 분석·CSV 내보내기까지 가능한 연구/교육용 계측 시스템.

- **앱 설치 불필요** — 브라우저만으로 동작
- **서버 불필요** — 정적 HTML/CSS/JS, GitHub Pages 배포
- **나선형 개발** — Activity 단위로 기능을 점진적으로 추가 (Boehm, 1986)

---

## 사용자

| 유형 | 사용 목적 |
|------|-----------|
| 연구자 | 다지점 동시 계측, CSV 수집 후 phyphox/ObsPy 등 외부 툴 연동 |
| 교사/학생 | 지구과학 교육 현장에서 지진파 개념 체험 |

---

## 권장 환경

| OS | 권장 브라우저 | 이유 |
|----|--------------|------|
| iOS | **Safari** | DeviceMotionEvent 고정밀(9자리), requestPermission() 지원 |
| Android | **Firefox** | Chrome의 `RoundSensorReading()` 정책 미적용 → 9자리 정밀도 확보 |
| PC | Chrome / Firefox | 파일 선택 모드(Activity 3) 드래그 앤 드롭 지원 |

> **Android Chrome 주의**: Chromium `platform_sensor_util.cc`의 `RoundSensorReading()` 정책으로
> DeviceMotionEvent 및 Generic Sensor API 모두 0.01~0.1 m/s² 수준으로 반올림됨.
> PWA 설치 및 Generic Sensor API 우선 사용으로도 우회 불가 (플랫폼 정책).

---

## 완료된 기능 (Cycle 1–4)

### Cycle 1 — Activity 1 : 지진파 색으로 보기 ✅

| 기능 | 설명 |
|------|------|
| 센서 권한 요청 | iOS: requestPermission() / Android: 자동 (사용자 제스처 후) |
| 3단계 센서 폴백 | LinearAccelerationSensor → Accelerometer → DeviceMotionEvent 자동 선택 |
| 3초 워밍업 | 측정 시작 후 3초간 데이터 폐기 — 터치 진동이 캘리브레이션에 포함되는 오차 제거 |
| 캘리브레이션 | 워밍업 후 100샘플(≈1초) 평균을 기준값으로 설정, 이후 Δ값 출력 |
| 캘리브레이션 진행률 | "측정 준비 중... (3초 후 시작)" → "기준값 설정 중... (43/100)" |
| 센서 소스 표시 | 측정 시작 후 어떤 API를 사용 중인지 상태 메시지로 안내 |
| MMI 배경색 시각화 | 300ms 슬라이딩 윈도우 PGA → KMA 2018 수정 메르칼리 진도 11단계(I~XI+) 색상 매핑 |
| KMA 2018 기준 | 기상청 2018.11.28 고시, 1%g = 0.0981 m/s² 변환 적용 (I: <0.00687 ~ XI+: ≥30.80 m/s²) |
| 진도 레벨 표시 | 현재 진도 등급 실시간 표시 (예: 진도 III), 폰트 크고 굵게 — 상세 설명은 안내 모달 참고 |
| 실시간/고정 토글 | 버튼 위 독립 행에 배치. 고정 모드: 새 피크 발생 시에만 갱신(피크 홀드) |
| MMI 진도 안내 모달 | 버튼 클릭 시 KMA MMI 11단계 색상·기준값·공식 설명 문구 표 팝업 |
| 실시간 파형 그래프 | Z축 슬라이딩 윈도우 10초, Quadratic Bezier 곡선 렌더링 |
| 자동 Y축 스케일 | 즉시 확장 / 천천히 축소 (decay 0.997), 최소 범위 ±0.5 m/s² |
| 시간 축 레이블 | 파형 하단 2초 간격 눈금 표시 (경과 시간) |
| PGA 수치 표시 | 300ms 슬라이딩 윈도우 최대값 소수점 6자리 표시 (m/s²) |
| 리뷰 모드 | 측정 정지 후 전체 파형 드래그 탐색, 처음 1초 구간에서 시작 |
| 리뷰 관측 시각 | 드래그 구간의 실제 관측 시각 캔버스에 표시 (HH:MM:SS.mmm) |
| 1차/2차 정지 | 1차: 센서 중단 + 리뷰 모드 진입 / 2차: 전체 초기화 |

### Cycle 2 — Activity 2 : 지진파 기록하기 ✅

Activity 1 기능 전부 + 아래 추가:

| 기능 | 설명 |
|------|------|
| GPS 좌표 수집 | 측정 시작 시 위도·경도 1회 취득, 이후 고정 (이동 추적 아님) |
| Firefox GPS 최적화 | timeout 20초, maximumAge 5분 캐시 재사용 |
| GPS 좌표 화면 표시 | 위도·경도·수평 정확도(m) 실시간 표시 |
| 관측소 번호 | index.html에서 입력 → localStorage 저장 → CSV 메타데이터 자동 포함 |
| Z축 시계열 기록 | timestamp + acc_z 실시간 버퍼 수집 |
| 샘플레이트 측정 | 측정 종료 시 실제 interval_ms 기반 Hz 재계산 → 메타데이터 갱신 |
| CSV 다운로드 | 메타데이터 헤더(# key: value) + timestamp, acc_z 데이터 행 |
| 다운로드 우선순위 | 모바일: Web Share API → `<a download>` / PC: showSaveFilePicker → Web Share API → `<a download>` |
| iOS 제스처 복구 | `SensorModule.start()` 동기 컨텍스트에서 먼저 호출, NTP·GPS는 백그라운드 병렬 처리 |

**CSV 포맷**:
```
# station_id: STN-01
# latitude: 37.491234
# longitude: 127.012345
# accuracy: 12m
# sample_rate: 100 Hz
timestamp,acc_z
2026-03-09T10:00:00.010000000Z,0.000123456
```
- 타임스탬프: `performance.timeOrigin + performance.now()` 기반 ISO 8601 UTC, `toFixed(9)`
- SAC 헤더 대응: station_id→KSTNM, latitude→STLA, longitude→STLO, sample_rate(Hz)→1/DELTA

### Cycle 3 — Activity 3 : 주파수 분석 (스펙트로그램·PSD·HVSR) ✅

**3가지 주파수 분석 도구**를 센서 모드와 파일 모드 양쪽에서 제공.

| 기능 | 설명 |
|------|------|
| 모드 탭 | 센서 측정 / 파일 선택 탭으로 전환 |
| 분석 탭 | 스펙트로그램 / PSD / HVSR 탭으로 전환 |
| **센서 모드** | 실시간 파형 + 3가지 분석 동시 실행 (탭으로 전환 표시); 측정 정지 후 리뷰 모드 진입 |
| **파일 선택 모드** | CSV 드래그 앤 드롭(PC) + 파일 선택(모바일) → 파형 표시 + 드래그·핀치로 뷰포트 제어 → 분석 시작 시 3모듈 일괄 계산 |
| FFT 알고리즘 | Cooley-Tukey radix-2 DIT (순수 JS, 외부 라이브러리 없음) |
| 윈도우 함수 | Hann window (스펙트럼 누설 억제) |
| 컨트롤 배치 | 그래프 패널 외부 `graph-controls` 영역 — 그래프 캔버스 가림 없음 |

#### 스펙트로그램 (spectrogram.js v3.2)

| 항목 | 내용 |
|------|------|
| 레이아웃 | **가로 워터폴** — X축=시간(왼쪽=과거, 오른쪽=현재), Y축=주파수(0Hz↓~MAX_FREQ↑) |
| 컬러맵 | Seismic jet LUT — 검정→파랑→시안→녹색→노랑→주황→빨강 (지진학 표준) |
| 진폭 스케일 | log₁₀: LOG_MIN=-5 ~ LOG_MAX=0 (5 디케이드, 0.00001~1.0 m/s²) |
| FFT 파라미터 | FFT_SIZE=256, HOP_SIZE=26 (~90% 오버랩) |
| 히스토리 | WINDOW_SEC=30초, colData(DH×4 px) per frame |
| 리뷰 모드 | 측정 정지 후 수평 드래그·핀치 탐색 (X방향), 초기 뷰 10초 |
| 피크 주파수 | 현재 프레임 최강 주파수 Hz 실시간 표시 |
| 설명 버튼 | ? 버튼 → 알고리즘·파라미터 설명 모달 팝업 |

#### PSD — 전력 스펙트럼 밀도 (psd.js v3.6)

| 항목 | 내용 |
|------|------|
| 알고리즘 | Welch's method — `PSD[b] = 2 × |FFT_b|² / (sr × Σhann²)` (Hann 에너지 보정, 단측 스펙트럼 ×2) |
| 단위 | (m/s²)²/Hz → dB 변환: `10 × log₁₀(PSD)` |
| 렌더링 모드 | **실시간**: 최신 윈도우 단일 청록 라인 / **누적(밀도 히트맵)**: 전체 윈도우 분포를 파랑→빨강 밀도로 표시 |
| 토글 | 센서 모드: 측정 정지 버튼 위 "실시간 ↔ 누적" 버튼 / 파일 모드: 분석 시작 전 선택 가능 |
| 평균선 | Welch 평균선 — 흰색 1px (두 모드 공통) |
| FFT 파라미터 | FFT_SIZE=1024 (Δf≈0.098Hz), HOP_SIZE=26, DC offset 제거 (per-window mean subtraction) |
| X축 | 주파수 로그 스케일, **0.2~50Hz** |
| Y축 | 오토스케일(_dispDbMax): 데이터 최대값 기반 상향 갱신, 항상 100 dB 범위 표시 |
| 설명 버튼 | ? 버튼 → 알고리즘·단위·활용 설명 모달 팝업 |

> **Peterson NLNM/NHNM 참조선 제외 근거**: 스마트폰 가속도 센서의 자기 노이즈 레벨이
> Peterson(1993) High Noise Model(NHNM)보다 수십 dB 높아 비교 의미가 없음.
> 참조선이 표시될 경우 데이터가 항상 NHNM을 크게 초과하여 교육적 혼란을 유발.
> psd.js v3.6에서 코드 전체 제거.

#### HVSR — 수평/수직 스펙트럼 비율 (hvsr.js v2.1)

| 항목 | 내용 |
|------|------|
| 알고리즘 | Nakamura(1989) + SESAME 2004 가이드라인 준수 |
| 공식 | `H(f) = √((|FFT_x|²+|FFT_y|²)/2)`, `HVSR(f) = mean[H(f)/V(f)]` per-window |
| 평균 방식 | **per-window H/V 비율 계산 후 평균** (SESAME-correct) |
| 스무딩 | **없음** — 스무딩(KO·MA) 적용 시 스마트폰 데이터의 고주파 노이즈가 평탄화되어 f₀ 판독을 오히려 왜곡 |
| FFT 파라미터 | FFT_SIZE=1024, HOP_SIZE=26(센서) / 128(파일, 87.5% 오버랩) |
| 정상성 필터 | RMS가 [0.5×, 2×]×중앙값 범위 벗어나는 윈도우 제거 |
| f₀ 탐색 | 0.2–20Hz, H/V ≥ 2.0 시 피크 마커 표시 |
| X축 | 주파수 로그 스케일, 0.2~50Hz |
| Y축 | 오토스케일(_hvDispMax): 데이터 최대값 기반 자동 조정 (최솟값 4) |
| 신뢰도 | N < 50 윈도우 시 주황 경고 표시 |
| 필요 축 | 3축(X·Y·Z) — Z전용 CSV 파일은 HVSR 탭 비활성화 |
| 설명 버튼 | ? 버튼 → 알고리즘·SESAME 기준·해석 방법 설명 모달 팝업 |
| 참고 문헌 | Nakamura(1989), SESAME(2004), 정희옥 외(2010) |

#### PNG 내보내기 (export-image.js v1.0)

| 항목 | 내용 |
|------|------|
| 기능 | 각 분석 결과를 PNG 이미지로 저장 |
| 버튼 | 센서/파일 모드 각각: "↓ 파형" / "↓ 스펙트로그램" / "↓ PSD" / "↓ HVSR" (총 8개) |
| 헤더 | ObsPy 스타일 메타데이터 — 관측소·위치·샘플레이트·분석 파라미터 |
| 파일명 | `seismo_{type}_{station}_{date}.png` |
| 최소 너비 | 800px (캔버스 크기 부족 시 보정) |

#### 기타 Activity 3 기능

| 기능 | 설명 |
|------|------|
| 파일 모드 절대 시각 | CSV timestamp 기반 실제 측정 시각(HH:MM:SS) 파형 X축 표시 |
| 설명 모달 | 활성 탭에 맞는 알고리즘 설명 팝업 (? 버튼, 닫기 버튼 또는 배경 클릭) |

### Cycle 4 — Activity 4 : 주시곡선 (굴절법 탐사) ✅

굴절법 탄성파 탐사 데이터(다지점 스마트폰 동시 계측)에서 주시곡선을 그리고
P파 속도(V1/V2)와 표층 두께(h)를 계산하는 3탭 분석 도구.

**배경**: 스마트폰 간 내부 시계 오차(50~200ms)로 인해 주시곡선이 보이지 않는 문제 →
Tab 2 시간 조정으로 수동 보정.

#### Tab 1 — 파싱/거리

| 기능 | 설명 |
|------|------|
| 다중 CSV 로드 | 드래그 앤 드롭 + 파일 선택, station_id·GPS 좌표·샘플레이트 자동 파싱 |
| 거리 계산 | GPS 좌표 기반 Haversine 거리 자동 계산 |
| 거리 수동 수정 | 계산된 거리 인라인 편집 가능 |
| 진원 지정 | 스테이션 목록에서 진원(해머 타격 지점) 선택 |

#### Tab 2 — 시간 조정 (Record Section)

| 기능 | 설명 |
|------|------|
| Record Section 캔버스 | 전체 트레이스를 거리순으로 정렬, 공통 5초 시간 윈도우, 청록색 파형 |
| 빨간 기준선 | 드래그 이동 가능한 수직 점선 — 신호 도달 정렬 기준점 |
| 오프셋 슬라이더 | 스테이션별 ±2000ms 범위, 슬라이더 ↔ 숫자 입력 양방향 동기화 |
| 즉시 반영 | 오프셋 변경 시 캔버스 즉시 재렌더 |
| 데시메이션 | `stride = ceil(rows / (PW×2))` — 대용량 CSV 성능 최적화 |

#### Tab 3 — 픽킹/주시곡선

| 기능 | 설명 |
|------|------|
| 파형 카드 | 스테이션별 Z축 파형 + 클릭으로 P파 도달 시각 픽킹 |
| 시간 오프셋 반영 | `t = (s.pickTime + s.timeOffset) - (src.pickTime + src.timeOffset)` |
| 자동 회귀 모드 | 분할점 슬라이더 → 직접파(V1) / 굴절파(V2) 자동 선형 회귀 |
| 수동 선 모드 | V₁/V₂ 선 개별 추가, 양 끝 핸들 드래그 → 속도 실시간 계산 |
| 층 계산 | `h = (ti × V1 × V2) / (2 × √(V2²−V1²))`, 교차거리 xc 자동 표시 |
| 결과 저장 | CSV 내보내기 (`time_offset_ms` 컬럼 포함) |

#### hodochron.js v1.1

| 항목 | 내용 |
|------|------|
| `_getTransforms()` | dist↔canvasX / t↔canvasY 양방향 좌표 변환 헬퍼 |
| `setMode()` | `'auto'` \| `'manual'` 전환 |
| `addLine(role)` | `'direct'`(V₁, 파랑) / `'refracted'`(V₂, 주황), 역할당 1개 |
| `clearLines()` | 수동 선 전체 초기화 |
| `onManualUpdate(cb)` | 드래그 중 `{V1, V2, h, xc}` 콜백 |
| 포인터 이벤트 | hit radius 14px(터치 대응), setPointerCapture, init() 재호출 시 리스너 교체 |

---

## 비기능 요구사항

| 항목 | 요구사항 |
|------|----------|
| 브라우저 지원 | iOS Safari 13+, Android Firefox, PC Chrome/Firefox |
| HTTPS | 센서·GPS API 동작 조건 (GitHub Pages 자동 제공) |
| 서버 | Cycle 4까지 불필요 (정적 파일만) |
| 샘플링 레이트 | 목표 100 Hz |
| 가속도 정밀도 | 소수점 9자리 (Firefox/iOS Safari); Chrome Android는 플랫폼 정책으로 ~2자리 |
| CSV 정밀도 | `toFixed(9)` — SAC/ObsPy 연동 수준 |
| 코드 규모 | 빌드 도구 없음, 외부 라이브러리 없음 |
| 반응형 | 모바일 퍼스트, PC 768px+ 레이아웃 최적화 |

---

## 예정 기능 (Cycle 5–6)

### Cycle 5 — Activity 5 : 추가 예정

| 기능 | 설명 |
|------|------|
| P파·S파 도달 시간 픽킹 | 복수 관측소 CSV에서 위상 마킹 |
| GPS 위치 기반 역산 | 관측소 좌표 + 도달 시간 차이로 진원지(위도·경도) 추정 |
| 진원 거리 계산 | Haversine + Vp/Vs 가정 거리 계산 |

### Cycle 6 — 실시간 다중 기기 (검토 중)

- 서버 필요 여부 재검토 후 결정
- 여러 기기가 동시에 데이터를 WebSocket으로 전송

---

## 제외 범위 (논문 범위 밖)

- 푸시 알림 / 조기 경보 시스템
- 지진 자동 감지 알고리즘
- 네이티브 앱 (iOS App Store / Google Play)
