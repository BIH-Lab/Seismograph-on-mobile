# PRD.md — Product Requirements Document
> 최종 업데이트: 2026-03-23 (Cycle 3 후속 수정 완료 기준)

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

## 완료된 기능 (Cycle 1–3)

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
| FFT 파라미터 | FFT_SIZE=256, HOP_SIZE=26 (~90% overlap, ObsPy 기준) |

#### 스펙트로그램 (spectrogram.js v3.0)

| 항목 | 내용 |
|------|------|
| 레이아웃 | **가로 워터폴** — X축=시간(왼쪽=과거, 오른쪽=현재), Y축=주파수(0Hz↓~MAX_FREQ↑) |
| 컬러맵 | Viridis-style LUT (보라→파랑→청록→초록→노랑) |
| 진폭 스케일 | log₁₀: LOG_MIN=-3 (0.001 m/s²) ~ LOG_MAX=-1 (0.1 m/s²) |
| 히스토리 | WINDOW_SEC=30초, colData(DH×4 px) per frame |
| 리뷰 모드 | 측정 정지 후 수평 드래그·핀치 탐색 (X방향) |
| 피크 주파수 | 현재 프레임 최강 주파수 Hz 실시간 표시 |

#### PSD — 전력 스펙트럼 밀도 (psd.js v2.2)

| 항목 | 내용 |
|------|------|
| 알고리즘 | Welch's method — `PSD[b] = 2 × |FFT_b|² / (sr × Σhann²)` (Hann 에너지 보정, 단측 스펙트럼 ×2) |
| 단위 | (m/s²)²/Hz → dB 변환: `10 × log₁₀(PSD)` |
| 누적 | 전체 윈도우 누적 평균 (_sumPow / _nWin) — 프레임이 쌓일수록 더 안정적인 추정 |
| FFT | FFT_SIZE=1024 (Δf≈0.098Hz), DC offset 제거 (per-window mean subtraction) |
| 표시 | X축=주파수(로그, 0.1~50Hz), Y축=파워(-120~-20 dB), cyan 선 그래프 |
| 활용 | 배경 노이즈 수준 평가, Peterson NLNM/NHNM 비교 |

#### HVSR — 수평/수직 스펙트럼 비율 (hvsr.js v1.2)

| 항목 | 내용 |
|------|------|
| 알고리즘 | Nakamura(1989) 방법 |
| 공식 | `HVSR(f) = √((|FFT_x|²+|FFT_y|²)/2) / |FFT_z|` |
| 스무딩 | ±2-bin 이동 평균, DC offset 제거 (per-window mean subtraction) |
| 표시 | X축=주파수(로그, 0.5~50Hz), Y축=H/V 비율(0~10) |
| f₀ 피크 | 1~10Hz 범위 최대 H/V 지점 표시 (H/V > 1.5 시 기준선·레이블) |
| 신뢰도 | N < 50 윈도우 시 경고 표시 (약 10분 측정 권장) |
| 필요 축 | 3축(X·Y·Z) — Z전용 CSV 파일은 HVSR 탭 비활성화 |
| 활용 | 부지 공진 주파수(f₀) 탐지, 지반 증폭 특성 추정 (정희옥 외, 2010) |

---

## 비기능 요구사항

| 항목 | 요구사항 |
|------|----------|
| 브라우저 지원 | iOS Safari 13+, Android Firefox, PC Chrome/Firefox |
| HTTPS | 센서·GPS API 동작 조건 (GitHub Pages 자동 제공) |
| 서버 | Cycle 3까지 불필요 (정적 파일만) |
| 샘플링 레이트 | 목표 100 Hz |
| 가속도 정밀도 | 소수점 9자리 (Firefox/iOS Safari); Chrome Android는 플랫폼 정책으로 ~2자리 |
| CSV 정밀도 | `toFixed(9)` — SAC/ObsPy 연동 수준 |
| 코드 규모 | 빌드 도구 없음, 외부 라이브러리 없음 |
| 반응형 | 모바일 퍼스트, PC 768px+ 레이아웃 최적화 |

---

## 예정 기능 (Cycle 4–6)

### Cycle 4 — Activity 4 : 신호 비교하기

| 기능 | 설명 |
|------|------|
| 다중 CSV 드롭 | 여러 CSV 파일 동시 로드 |
| 다중 파형 오버레이 | 여러 기기 신호를 색상별로 겹쳐 비교 |
| 기본 통계 | 최대값·최소값·RMS·샘플링 레이트 자동 계산 |

### Cycle 5 — Activity 5 : 주시곡선·진원 찾기

| 기능 | 설명 |
|------|------|
| P파·S파 도달 시간 입력 | 복수 관측소 데이터에서 위상 피킹 |
| 주시곡선 그리기 | 거리-시간 그래프 렌더링 |
| 진원 역산 | GPS 위치 + 도달 시간으로 진원지 추정 |

### Cycle 6 — 실시간 다중 기기 (검토 중)

- 서버 필요 여부 재검토 후 결정
- 여러 기기가 동시에 데이터를 WebSocket으로 전송

---

## 제외 범위 (논문 범위 밖)

- 푸시 알림 / 조기 경보 시스템
- 지진 자동 감지 알고리즘
- 네이티브 앱 (iOS App Store / Google Play)
