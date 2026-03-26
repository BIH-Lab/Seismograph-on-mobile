# TASK.md
> Claude Code가 작업 시작 전 반드시 확인하는 파일입니다.
> 작업 완료 시 체크박스를 업데이트해주세요.

---

## 현재 단계
**Cycle 3 완료 + QA 개선 완료, Cycle 4 진입 준비 중** (2026-03-26)
- Cycle 1 완료 (2026-03-08) + Activity 1 추가 개선 완료 (2026-03-22)
- Cycle 2 완료 (2026-03-09)
- Cycle 3 완료 (2026-03-10) + QA 개선 완료 (2026-03-11) + 재구성 완료 (2026-03-23)
- Cycle 3 후속 수정 완료 (2026-03-23): psd.js v2.2, hvsr.js v1.2, 파일 모드 재설계
- Cycle 3 추가 QA 개선 완료 (2026-03-26): 스펙트로그램 포화·컬러맵·오토스케일·NTP
- Cycle 4 진입 준비 완료

---

## Cycle 3 추가 QA 개선 (2026-03-26 완료)

### index.html (root) — NTP 시계 동기화 저장 기능
- [x] 시계 동기화 확인 모달 추가 (ntpBtn → 서버 시간 비교)
- [x] "동기화 저장" 버튼 — offset을 localStorage(`ntp_offset_ms`, `ntp_synced_at`)에 저장
- [x] 저장 후 footer 버튼 텍스트에 ✅ 표시 (_updateFooterBadge)
- [x] 저장된 동기화 상태 표시 (.sync-status — 저장일시 + offset ms)
- [x] sensor.js NTP offset 자동 적용 (측정 시작 시 타임스탬프 보정)

### spectrogram.js v3.1 — 스펙트로그램 포화 해소
- [x] LOG 범위 확장: LOG_MIN=-3→-5, LOG_MAX=-1→0 (5 디케이드, 0.00001~1.0 m/s²)
- [x] 일반 손떨림 수준 신호도 부분 포화 없이 표시

### spectrogram.js v3.2 — Seismic jet 컬러맵
- [x] Viridis-style LUT → Seismic-style jet LUT (7 stops)
- [x] 검정(무신호) → 파랑 → 시안 → 녹색 → 노랑 → 주황 → 빨강(최대)
- [x] 지진학 표준 (ObsPy, MATLAB seismic toolbox 동일 계열)

### psd.js v2.3 — Y축 오토스케일
- [x] `_dispDbMax` 상태 변수 추가 (sticky: 데이터 최대값 기반 상향 갱신만)
- [x] `dispMax = _dispDbMax`, `dispMin = dispMax - 100` (항상 100 dB 범위)
- [x] 강한 신호가 뷰 밖으로 나가지 않도록 자동 조정
- [x] `reset()`에 `_dispDbMax = DB_MAX` 추가

### hvsr.js v1.3 → v1.4 — Y축 오토스케일 + HV_MAX 제거
- [x] `HV_MAX = 10` 고정 상수 제거
- [x] `_hvDispMax` 상태 변수 추가 (최솟값 4, 데이터 기반 상향 갱신)
- [x] H/V > 10 인 강한 공진도 클리핑 없이 표시
- [x] `reset()`에 `_hvDispMax = 4` 추가

### activity3/index.html — 정지 후 인터랙션 개선
- [x] 스펙트로그램 정지 후 스크롤 버그 수정: 초기 뷰 30초→10초 (팬 공간 확보)
- [x] 센서 모드 정지 후 파형 리뷰 추가: `_sensorSnapshot`, `_drawSensorWave()`, `_attachWaveEvents(canvasEl)`
- [x] 정지 후 스펙트로그램+파형 동기 드래그·핀치 가능
- [x] 상태 메시지: "측정 정지됨. 드래그·핀치로 파형과 스펙트로그램을 탐색하세요."

---

## Cycle 3 재구성 — 스펙트로그램·PSD·HVSR 3분석 모드 (2026-03-23 완료)

### spectrogram.js v3.0 — 가로 워터폴 전면 재구성
- [x] 레이아웃 변경: 수직(Y=시간) → 수평(X=시간, Y=주파수) ObsPy 표준
- [x] colData 기반 히스토리 저장 (Uint8ClampedArray DH×4 per frame)
- [x] 오프스크린 1×DH 캔버스 + drawImage로 효율적 컬럼 스케일링
- [x] 왼쪽 주파수 축(FREQ_AXIS_W=30px), 아래 시간 축(TIME_AXIS_H=12px)
- [x] 리뷰 모드: setView(offset, cols) — 수평 팬/핀치 탐색

### psd.js v2.2 — Welch PSD 모듈 (신규 + 수정)
- [x] v1.0: 신규 구현 — Welch rolling average(N_AVG=16), 로그 X축(0.5~50Hz), dB Y축(-120~-20)
- [x] v2.0: DC offset 제거(per-window mean subtraction), Hann 에너지 보정(÷sum_w2), 단측 ×2, FFT_SIZE 256→1024, F_MIN 0.5→0.1Hz
- [x] v2.1: 롤링 평균(N_AVG=16) → 전체 누적 평균(_sumPow, _nWin)으로 변경
- [x] v2.2: computeFromRows() _powerBuf ReferenceError 수정

### hvsr.js v1.2 — Nakamura HVSR 모듈 (신규 + 수정)
- [x] v1.0: 신규 구현 — Nakamura(1989) HVSR = H/V, 3축 누적 평균, ±2-bin 스무딩, f₀ 탐지, 신뢰도 경고
- [x] v1.1: DC offset 제거 (_accumulateWindow + computeFromRows 양쪽)
- [x] v1.2: F_MAX 20Hz → 50Hz (Nyquist 한계까지 표시)

### activity3/index.html — 3분석 탭 UI 재구성 + 파일 모드 재설계
- [x] 분석 탭: 스펙트로그램 / PSD / HVSR (센서·파일 모드 공통)
- [x] 센서 모드: 3모듈 동시 실시간 업데이트
- [x] 리뷰 모드: 수평 드래그·핀치 — _reviewCanvas 변수로 캔버스 동적 참조
- [x] 파일 모드: 분석 완료 후 파형(#fileWaveChart) 표시
- [x] 파일 모드: 파형을 주 조작면으로 지정 — 드래그·핀치로 _reviewOffset/_reviewCols 제어
- [x] 파일 모드: 스펙트로그램은 passive display — _syncWave()로 파형 뷰포트 추종
- [x] 파일 모드: 분석 시작 시 3모듈 일괄 계산 (PSD·HVSR computeFromRows)
- [x] Z전용 CSV → HVSR 탭 disabled 처리
- [x] 숨겨진 캔버스 lazy init (show briefly 방식)

### style.css — .analysis-tabs 스타일 + 패널 레이아웃 추가
- [x] .analysis-tabs, .analysis-tabs__btn, --active, :disabled
- [x] #panel-sensor, #panel-file: flex:1, flex-direction:column — activity-main 잔여 공간 점유
- [x] #drop-zone: flex:1, min-height:30vh — 파일 로드 전후 레이아웃 일관성 확보

---

## Cycle 3 작업 목록 (초기 구현)

### 1단계 : spectrogram.js 수정
- [x] Cooley-Tukey FFT 순수 JS 구현
- [x] Hann 윈도우 함수 적용
- [x] Viridis-style 컬러 LUT
- [x] Canvas 스크롤 렌더링 (push 방식)
- [x] HOP_SIZE 8 → 26 조정 (ObsPy 기준 90% 오버랩)

### 2단계 : activity3/index.html 전면 재작성
두 가지 모드 탭:
- [x] **센서 모드**: 파형 + 스펙트로그램 실시간 표시
  - [x] 측정 시작/정지/초기화 UX
- [x] **파일 선택 모드**: CSV 로드 → 전처리 → 7초 애니메이션
  - [x] 드래그 앤 드롭 (PC) + 파일 선택 버튼 (모바일)
  - [x] CSV 파서 (# 메타데이터 + 데이터 행)
  - [x] 전처리: 모든 FFT 컬럼 사전 계산
  - [x] requestAnimationFrame 고정 7초 애니메이션
  - [x] 파일 정보 표시 (이름, 길이, 샘플레이트)

### 3단계 : style.css 추가
- [x] `.mode-tabs` / `.mode-tabs__btn--active`
- [x] `.drop-zone` / `.drop-zone--hover`
- [x] `.csv-file-info`

### 4단계 : index.html 카드 활성화
- [x] Activity 3 카드 `card--disabled` → `card--active`로 변경

### 5단계 : 테스트
- [x] PC Chrome 드래그 앤 드롭 테스트
- [x] Android Chrome 테스트 (센서 모드 + 파일 선택) — 정밀도 한계 확인 (Chrome 정책)
- [x] Android Firefox 테스트 (센서 모드) — 9자리 정밀도 확인 ✅ → Android 권장 브라우저로 변경
- [x] iOS Safari 테스트 — 9자리 정밀도 확인 ✅
- [x] GitHub Pages 배포

---

## Cycle 2 작업 목록

### 1단계 : activity2/ 페이지 기본 세팅
- [x] activity2/ 폴더 및 index.html 생성
- [x] index.html 목차에서 Activity 2 카드 활성화

### 2단계 : GPS 모듈 (gps.js)
- [x] navigator.geolocation.getCurrentPosition() 구현
- [x] iOS / Android 권한 요청 처리
- [x] 좌표 취득 실패 시 오류 메시지 표시
- [x] 측정 시작 시 좌표 1회 고정 (이동 추적 아님)

### 3단계 : 센서 + GPS 통합 수집
- [x] sensor.js 재사용 (캘리브레이션 포함)
- [x] 수집 데이터: timestamp, latitude, longitude, acc_z
- [ ] (보류) acc_x, acc_y 추가 여부 추후 결정

### 4단계 : 실시간 그래프
- [x] visual.js 재사용
- [x] Z축 파형 실시간 표시 (슬라이딩 윈도우 10초)
- [x] 현재 GPS 좌표 화면에 표시

### 5단계 : CSV 다운로드
- [x] export.js 재사용 (컬럼 자동 생성으로 범용화)
- [x] CSV 컬럼: timestamp, latitude, longitude, acc_z
- [x] 다운로드 버튼 (측정 정지 후 활성화)

### 6단계 : UX 개선 및 테스트
- [x] 정지 버튼에 초기화 통합 — 1차 클릭: 정지+그래프 유지, 2차 클릭: 초기화
- [x] Android 모바일에서 CSV 다운로드 방식 개선 (showSaveFilePicker → Web Share API 우선)
- [x] CSV 포맷 개선 — GPS 좌표를 메타데이터 헤더(# key: value)로 이동, 데이터 행 경량화
- [x] 관측소 번호(station_id) 입력 — index.html에 입력 바 추가, localStorage 저장
- [x] activity2에서 station_id를 CSV 메타데이터에 자동 포함
- [x] Android Chrome 테스트
- [x] iOS Safari 테스트
- [x] GPS 권한 요청 동작 확인
- [x] CSV 다운로드 동작 확인
- [x] GitHub Pages 배포

---

## Cycle 3 QA 개선 (2026-03-11 완료)

- [x] **Issue 2** : PC 레이아웃 최적화 — `style.css` 768px+ 미디어 쿼리 추가
- [x] **Issue 3** : index.html 모달 브라우저 안내 수정 (Android: Firefox 명시)
- [x] **Issue 4** : Firefox Android GPS timeout 20초 / maximumAge 300초 (`gps.js`)
- [x] **Issue 5** : 캘리브레이션 진행률 표시 — `(state, arg1, arg2)` 콜백으로 통일 (activity1/2/3)
- [x] **Issue 6** : 가속도 수치 소수점 6자리 표시 — `toFixed(6)` (`visual.js`)
- [x] **Issue 7** : 스펙트로그램 워터폴 — 위→아래 스크롤, MAX_FREQ=100Hz, 히스토리 기반 재렌더
- [x] **Issue 8** : 파형 시간 축 레이블 — 2초 간격 경과 시간 표시 (`visual.js`)
- [x] 스펙트로그램 시간 레이블 wall-clock 기반으로 변경 (Firefox Android interval 오보고 대응)
- [x] Firefox Android `_sr` 오인식 버그 수정 — 50~250Hz 범위 필터 (`activity3/index.html`)

### 알려진 미해결 이슈
- [ ] 스펙트로그램 센서 모드 시간 스케일 미세 조정 (추후 개선 예정)

---

## Activity 1 추가 개선 (2026-03-22 완료)

- [x] MMI 진도 안내 모달 — 버튼 클릭 시 KMA 수정 메르칼리 진도 표 팝업 (lazy 빌드)
- [x] MMI 기반 배경색 — HSL 선형 매핑 → KMA MMI 고정 색상으로 교체
- [x] **KMA 2018 MMI 기준 전면 교체** — 기존 출처 불명 값 → 기상청 2018.11.28 고시 기준 (1%g = 0.0981 m/s²), 11단계(I~XI+)
- [x] **진도 안내 모달 설명 문구** — 단순 명칭 → KMA 공식 설명 문구 전체 교체
- [x] **실시간 진도 표시 간소화** — "진도 IV 경진" → "진도 IV"만 표시, 폰트 크고 굵게
- [x] 실시간/고정 토글 스위치 — 버튼 위 독립 행으로 이동·가운데 정렬, 피크 MMI 고정/실시간 전환
- [x] **고정 모드 버그 수정** — 새 피크 발생 시 화면 미갱신 버그 수정 (isNewPeak 분기 추가)
- [x] 리뷰 모드 — 측정 정지 후 전체 파형 드래그 탐색, 1초 중앙 구간 진도 표시
- [x] **리뷰 시작 위치** — 마지막 데이터 → 처음 1초 구간에서 시작하도록 변경
- [x] **리뷰 구간 관측 시각 표시** — 캔버스 하단에 "관측 시간" 레이블 + HH:MM:SS.mmm (bold)
- [x] 구간 시간 표시 제거 — "구간: 0.0s ~ 1.0s" 텍스트 삭제
- [x] startBtn 먹통 버그 수정 — 캐시 버스팅(v=4.1) + MMI 테이블 lazy 빌드
- [x] 비대칭 EMA → 300ms 슬라이딩 윈도우 PGA 교체 (지진학적 정확도 개선)
- [x] 3초 워밍업 딜레이 — 터치 진동이 캘리브레이션에 포함되는 오차 제거 (activity1~3 공통)
- [x] activity1 sensor.js 캐시 버전 v4.1 → v4.2 갱신

---

## 완료된 작업
- **Cycle 3 후속 수정 완료 (2026-03-23)**
  - psd.js v2.2: Welch 정규화 보정(DC offset, Hann 에너지 보상, FFT_SIZE 1024), 누적 평균, computeFromRows 버그 수정
  - hvsr.js v1.2: DC offset 제거, F_MAX 20→50Hz 확장
  - activity3 파일 모드: 파형 표시 추가, 파형-primary 드래그·핀치 재설계, _reviewCanvas 동적 참조
  - style.css: #panel-sensor/#panel-file flex:1, #drop-zone flex:1+min-height:30vh
- **Cycle 3 재구성 완료 (2026-03-23)**
  - Activity 3: 스펙트로그램·PSD·HVSR 3분석 모드 재구성
  - spectrogram.js v3.0: 가로 워터폴 전면 재작성
  - psd.js v1.0: Welch PSD 신규 모듈
  - hvsr.js v1.0: Nakamura HVSR 신규 모듈 (정희옥 외 2010 참고)
- Cycle 3 전체 완료 (2026-03-10)
  - Activity 3: 주파수 분석 스펙트로그램 (실시간 FFT + CSV 파일 재생)
  - sensor.js 정밀도 개선: 3단계 폴백, CALIB_SAMPLES=100, performance.now() 타임스탬프, toFixed(9)
  - Android Firefox 검증: 9자리 정밀도 확인 → Android 권장 브라우저 Firefox로 변경
- Cycle 2 전체 완료 (2026-03-09)
  - Activity 2: 지진파 기록하기 (GPS + Z축 가속도 + CSV 다운로드)
  - Android Chrome / iOS Safari 테스트 완료
- Cycle 1 전체 완료 (2026-03-08)
  - Activity 1: 지진파 색으로 보기 (Z축 진폭 → 배경색, 실시간 그래프)

---

---

## 다음 Cycle 예정 (지금 건드리지 않음)
- Cycle 4 : Activity 4 (다중 CSV 드롭 + 신호 비교 + 기본 통계)
- Cycle 5 : Activity 5 (주시곡선 + GPS 진원 역산)
- Cycle 6 : 실시간 다중 기기 — 서버 필요 여부 재검토 후 결정

---

## 알려진 이슈 / 주의사항
- iOS에서 DeviceMotionEvent는 반드시 사용자 버튼 클릭 이후에 권한 요청할 것
- GPS(Geolocation)도 마찬가지로 사용자 제스처 이후에 요청할 것
- HTTPS 없이는 센서 API, GPS API 모두 동작 안 함 (GitHub Pages는 자동 HTTPS)
- 데이터는 메모리에만 저장 (페이지 새로고침 시 초기화)
- **Android 권장 브라우저: Firefox** — Chrome은 `RoundSensorReading()` 정책으로 0.01~0.1 m/s² 정밀도 한계
  - sensor.js는 3단계 폴백 자동 처리: `LinearAccelerationSensor` → `Accelerometer` → `DeviceMotionEvent`
  - Firefox Android는 Generic Sensor API 미지원 → `DeviceMotionEvent` 경로 사용, 9자리 정밀도
- 측정 시작 후 3초 워밍업 구간에는 기기를 움직이지 않는 것이 권장 (워밍업 종료 후 캘리브레이션 시작)
- GPS 정밀도는 기기/환경에 따라 수 미터 ~ 수십 미터 오차 발생 가능
- iOS GPS: enableHighAccuracy=true는 GPS 하드웨어 강제 사용 → 실내에서 타임아웃 발생
  → enableHighAccuracy=false(WiFi/셀 위치)로 변경, 2~3초 내 응답, 정확도 10~100m (관측소 위치 기록 용도로 충분)
