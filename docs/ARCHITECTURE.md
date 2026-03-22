
# ARCHITECTURE.md

## 설계 철학
- 서버 없이 브라우저 단독으로 동작 (Cycle 3까지)
- 단일 HTML 기반으로 시작, 각 Activity가 독립 폴더로 구성
- GitHub Pages로 무료 배포, 오픈소스 공개
- 각 Cycle의 산출물이 index.html 목차에 누적되는 구조

---

## 전체 파일 구조 (Cycle 3 완료 + 후속 수정 기준)

```
project-root/
├── index.html              # 목차 페이지 (플랫폼 진입점)
├── activity1/
│   └── index.html          # Activity 1 - 지진파 색으로 보기
├── activity2/
│   └── index.html          # Activity 2 - 지진파 기록하기
├── activity3/
│   └── index.html          # Activity 3 - 주파수 분석 (스펙트로그램·PSD·HVSR)  [Cycle 3]
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (3초 워밍업 + 캘리브레이션)
│       ├── visual.js       # 시각화 모듈 (파형 그래프 + MMI 색상)
│       ├── review.js       # 리뷰 모드 모듈 (드래그 탐색, activity1 전용)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       ├── export.js       # CSV 내보내기 모듈 (컬럼 자동 생성)
│       ├── spectrogram.js  # 가로 워터폴 스펙트로그램 (FFT → Canvas)  [Cycle 3]
│       ├── psd.js          # Welch PSD 모듈 (전력 스펙트럼 밀도)       [Cycle 3]
│       └── hvsr.js         # Nakamura HVSR 모듈 (부지 공진 주파수)     [Cycle 3]
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── TASK.md
├── CLAUDE.md               # Claude Code 참조 파일 (프로젝트 루트)
└── README.md               # GitHub 오픈소스 소개 페이지
```

---

## 페이지별 역할

### index.html — 목차 페이지
- 플랫폼 소개 및 제작 의도 표시
- 관측소 번호 입력 바: 텍스트 입력 → localStorage 저장/불러오기
- 각 Activity를 카드 형태로 나열
- 완성된 Activity는 활성화, 미완성은 "준비중" 표시
- GitHub 링크, 사용법 버튼 포함

### activity1/index.html — 지진파 색으로 보기
- 센서 권한 요청 및 수집 시작/정지 (3초 워밍업 + 100샘플 캘리브레이션)
- 화면 배경색: 300ms 슬라이딩 윈도우 PGA → KMA 2018 MMI 11단계 색상 실시간 변화
- 진도 레벨 텍스트 표시 (예: 진도 III), 크고 굵은 폰트
- 실시간/고정 토글 스위치: 버튼 위 독립 행 배치, 피크 홀드(고정) 또는 실시간 갱신
- MMI 진도 안내 모달: KMA 공식 설명 문구 + 기준값(m/s²) 표 (lazy 빌드)
- Z축 실시간 파형 표시 (슬라이딩 윈도우 10초)
- 정지 버튼 1차: 센서 중단 + 리뷰 모드 진입
  - 처음 1초 구간에서 시작, 전체 파형 드래그 탐색
  - 1초 중앙 구간 진도 표시 + 실제 관측 시각(HH:MM:SS.mmm) 캔버스 표시
- 정지 버튼 2차: 전체 초기화
- CSV 다운로드 없음 (시각화 확인 목적)

### activity2/index.html — 지진파 기록하기
- GPS 권한 요청 → 위도·경도 1회 고정
- 센서 캘리브레이션 후 Z축 가속도 실시간 수집
- Z축 파형 그래프 + GPS 좌표 화면 표시
- 정지 버튼: 센서 중단 + 그래프 초기화 + CSV 다운로드 버튼 표시
- CSV 다운로드 (timestamp, acc_z)
  - 메타데이터 헤더(# key: value): station_id, latitude, longitude, accuracy, sample_rate
  - 모바일: Web Share API → `<a download>` 폴백
  - 데스크톱: showSaveFilePicker → Web Share API → `<a download>` 폴백
### activity3/index.html — 주파수 분석 (스펙트로그램·PSD·HVSR)  [Cycle 3]
- 상위 모드 탭: 센서 측정 / 파일 선택
- 분석 탭: 스펙트로그램 / PSD / HVSR (탭 전환으로 결과 비교)
- **센서 모드**: 실시간 파형 + 3모듈 동시 업데이트 (탭에 무관하게 백그라운드 누적)
  - 측정 정지 후 스펙트로그램 리뷰 모드 진입 (수평 드래그·핀치)
  - _reviewCanvas 변수로 활성 캔버스 동적 참조
- **파일 선택 모드**: CSV 드래그 앤 드롭(PC) + 파일 선택(모바일)
  - 파일 로드 후 파형(#fileWaveChart) 표시 — 파형이 주 조작면
  - 드래그·핀치: 파형 캔버스에서 _reviewOffset/_reviewCols 제어
  - 스펙트로그램은 passive display — _syncWave()로 파형 뷰포트 추종
  - "분석 시작" 클릭 시 3모듈 일괄 계산 → 탭 전환으로 각 결과 확인
  - Z전용 CSV: HVSR 탭 disabled, 3축 CSV: 모든 탭 활성화
- Firefox Android interval 오보고 대응: 50~250Hz 범위 필터로 샘플레이트 오인식 방지

---

## 모듈 설계

### sensor.js
```
역할  : 가속도 센서 수집, 워밍업, 캘리브레이션
입력  : 브라우저 센서 이벤트 (Generic Sensor API 또는 DeviceMotionEvent)
출력  : { timestamp(ISO), acc_x, acc_y, acc_z, magnitude, interval_ms }
흐름  : 3초 워밍업(터치 진동 폐기) → 100샘플 baseline 평균 계산 → Δ값 스트리밍
콜백  : onStatus('warmup', 남은초) | ('calibrating', n, 100) | ('ready', 소스) | ('unavailable')
소스  : LinearAccelerationSensor → Accelerometer → DeviceMotionEvent (자동 폴백)
특이  : iOS 13+ requestPermission() 처리
```

### visual.js
```
역할  : Activity 1 센서 데이터 시각화
기능1 : 300ms 슬라이딩 윈도우 PGA → KMA 2018 MMI 11단계 배경색 매핑 (I~XI+)
        - 기상청 2018.11.28 고시 기준, 1%g = 0.0981 m/s² 변환
        - MMI_LEVELS: { level, name, desc(KMA 공식 설명), pgaMin, pgaMax, color }
기능2 : Canvas 기반 Z축 실시간 파형 그래프
        - 왼쪽 앵커 → 슬라이딩 윈도우 전환 (10초)
        - Y축 자동 스케일: 즉시 확장, 천천히 축소 (decay 0.997)
기능3 : 색 고정 모드 (setColorLock) — 피크 홀드 방식, 새 피크 발생 시에만 갱신
기능4 : 리뷰 스냅샷 반환 (startReview), RAF 일시정지 (_renderingPaused)
API   : update(data), reset(), setColorLock(bool), getMmiColor(z), getMmiInfo(z), getMmiLevels(), startReview()
```

### review.js
```
역할  : Activity 1 측정 후 리뷰 모드 (activity1 전용)
입력  : visual.js의 _fullBuffer 스냅샷 [{ts, z}] (ts = Date.now() ms)
기능  : 10초 뷰포트 드래그 탐색, 1초 중앙 구간 하이라이트
        - 리뷰 시작 위치: 처음 1초 구간 (data[0].ts + REGION_SEC*500)
        - 드래그 구간 실제 관측 시각 캔버스 하단 표시 (HH:MM:SS.mmm)
출력  : onRegion(maxAbsZ, level, name) 콜백
API   : init(canvasEl, data, onRegion), destroy()
```

### gps.js
```
역할  : GPS 좌표 1회 취득
출력  : { latitude, longitude, accuracy }
특이  : HTTPS 필수, 측정 시작 시 좌표 고정 (이동 추적 아님)
```

### spectrogram.js  v3.0  [Cycle 3]
```
역할  : 가로 워터폴 스펙트로그램 Canvas 렌더링 (ObsPy 표준 레이아웃)
입력  : push(acc_z, sr) — HOP_SIZE마다 FFT 계산
출력  : X=시간(왼쪽=과거→오른쪽=최신), Y=주파수(0Hz 하단~MAX_FREQ 상단)
레이아웃 : 왼쪽 FREQ_AXIS_W=30px 주파수 레이블, 아래 TIME_AXIS_H=12px 시간 레이블
저장 포맷 : colData = Uint8ClampedArray(DH×4) per frame, _history[0]=최신
렌더링 : 오프스크린 1×DH 캔버스 + drawImage(imageSmoothingEnabled=false) 컬럼 스케일링
알고리즘 : Cooley-Tukey FFT (Vanilla JS), Hann 윈도우, Viridis-style LUT
파라미터 : FFT_SIZE=256, HOP_SIZE=26, WINDOW_SEC=30초, LOG_MIN=-3, LOG_MAX=-1
리뷰 모드 : startReview() / setView(offset, cols) — 수평 팬/핀치 탐색
API   : init(canvasEl, sr, onPeakHz), push(z, sr), reset(), startReview(), setView(offset, cols), historyLength()
```

### psd.js  v2.2  [Cycle 3]
```
역할  : Welch's method 기반 전력 스펙트럼 밀도 (PSD) Canvas 렌더링
입력  : push(acc_z, sr) 또는 computeFromRows(rows, sr, axis)
출력  : X=주파수(로그 스케일, 0.1~50Hz), Y=파워(-120~-20 dB) 선 그래프
알고리즘 : PSD[b] = 2 × |FFT_b|² / (sr × Σhann²)  →  dB = 10 × log₁₀(PSD)
          DC offset 제거(per-window mean subtraction), Hann 에너지 보정(÷sum_w2), 단측 ×2
파라미터 : FFT_SIZE=1024, HOP_SIZE=26, F_MIN=0.1Hz
누적  : _sumPow[] + _nWin — 전체 윈도우 누적 평균 (롤링 아님)
파일 모드 : computeFromRows()로 전체 윈도우 평균 계산 후 즉시 렌더
API   : init(canvasEl, sr), push(z, sr), reset(), computeFromRows(rows, sr, axis)
활용  : 배경 노이즈 수준 평가, 관측소 품질 판단 (Peterson NLNM/NHNM 비교 기준)
```

### hvsr.js  v1.2  [Cycle 3]
```
역할  : Nakamura(1989) 수평/수직 스펙트럼 비율 (HVSR) Canvas 렌더링
입력  : push(acc_x, acc_y, acc_z, sr) 또는 computeFromRows(rows, sr)  ← 3축 필수
출력  : X=주파수(로그 스케일, 0.5~50Hz), Y=H/V 비율(0~10) 선 그래프
공식  : H(f) = √((|FFT_x|²+|FFT_y|²)/2),  V(f) = |FFT_z|,  HVSR(f) = H/V
누적  : _sumH2[], _sumV2[] 모든 윈도우 합산 → _nWin 개수로 평균
DC offset : per-window mean subtraction (_accumulateWindow + computeFromRows 양쪽)
스무딩 : ±2-bin 이동 평균 (SMOOTH_HALF=2)
피크  : 1~10Hz 범위 최대 H/V → f₀ 수직 점선 + 레이블 표시 (H/V > 1.5 기준)
신뢰도 : _nWin < MIN_WINDOWS(50) → 주황색 경고 (약 10분 측정 권장)
API   : init(canvasEl, sr), push(x, y, z, sr), reset(), windowCount(), computeFromRows(rows, sr)
참고  : 정희옥 외(2010) 한반도 서남부 HVSR 분석, SESAME guidelines(2004)
```

### export.js
```
역할  : 수집된 데이터 메모리 저장 및 CSV 변환/다운로드
특이  : 첫 번째 row의 키를 자동으로 CSV 컬럼으로 사용 (범용)
현황  : Activity 2에서 사용 중

CSV 포맷:
  메타데이터 헤더 (# key: value 형식, 파일 상단):
    # station_id   : 관측소 번호 (localStorage 저장값)
    # latitude     : GPS 위도 (소수점 6자리)
    # longitude    : GPS 경도 (소수점 6자리)
    # accuracy     : GPS 수평 정확도 (단위 m)
    # sample_rate  : 실제 샘플링 레이트 (측정 종료 시 재계산, 단위 Hz)
  데이터 컬럼:
    timestamp      : ISO 8601 UTC (예: 2026-03-09T10:00:00.123Z)
    acc_z          : Z축 가속도 변화량 (단위 m/s², 캘리브레이션 기준값 대비 Δ)

  SAC 헤더 대응:
    station_id → KSTNM,  latitude → STLA,  longitude → STLO
    sample_rate(Hz) → 1/DELTA,  timestamp → 참조 시각
    * channel(KCMPNM: HNZ), unit(IDEP: m/s²) — Activity 3 시점에 추가 예정

다운로드 우선순위:
  모바일(Android/iOS): 1. Web Share API — 공유 시트  2. <a download> — 폴백
  데스크톱:           1. showSaveFilePicker — 저장 위치 선택  2. Web Share API  3. <a download>
```

---

## 기술 스택 (Cycle 3 재구성 기준)

| 항목 | 선택 | 이유 |
|------|------|------|
| 언어 | Vanilla JS | 빌드 도구 불필요, 단순 |
| 스타일 | CSS (단일 파일) | 외부 라이브러리 없음 |
| 그래프 | Canvas API | 외부 라이브러리 없이 파형/스펙트로그램 구현 |
| 배포 | GitHub Pages | 무료, HTTPS 자동 제공 |
| 센서 | DeviceMotionEvent | 브라우저 내장 Web API |
| 위치 | Geolocation API | 브라우저 내장 Web API |

---

## 향후 Cycle 확장 방향

```
Cycle 1 완료  →  activity1/ (지진파 색으로 보기 + MMI 시각화 + 리뷰 모드)
Cycle 2 완료  →  activity2/ (GPS + Z축 + CSV)
Cycle 3 완료  →  activity3/ (스펙트로그램·PSD·HVSR 3분석 — 센서+파일 모드)

Cycle 4  →  activity4/ (다중 CSV 드롭 + 신호 비교 + 기본 통계)
Cycle 5  →  activity5/ (주시곡선 + GPS 진원 역산)
Cycle 6  →  실시간 다중 기기 — 서버 필요 여부 재검토 후 결정
```

---

## 브라우저 호환성

| 브라우저 | 센서 권한 | GPS 권한 | 비고 |
|----------|-----------|----------|------|
| Android Chrome | 자동 허용 | 브라우저 팝업 | accelerationIncludingGravity null 시 폴백 |
| iOS Safari 13+ | 사용자 제스처 후 요청 필수 | 브라우저 팝업 | requestPermission() 호출 필요 |
| iOS Safari 12- | 설정에서 수동 허용 | 브라우저 팝업 | 안내 메시지 필요 |
