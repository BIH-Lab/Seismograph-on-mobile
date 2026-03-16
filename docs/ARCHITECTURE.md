# ARCHITECTURE.md

## 설계 철학
- 서버 없이 브라우저 단독으로 동작 (Cycle 3까지)
- 단일 HTML 기반으로 시작, 각 Activity가 독립 폴더로 구성
- GitHub Pages로 무료 배포, 오픈소스 공개
- 각 Cycle의 산출물이 index.html 목차에 누적되는 구조

---

## 전체 파일 구조 (Cycle 3 + Activity 1 개선 기준)

```
project-root/
├── index.html              # 목차 페이지 (플랫폼 진입점)
├── activity1/
│   └── index.html          # Activity 1 - 지진파 색으로 보기
├── activity2/
│   └── index.html          # Activity 2 - 지진파 기록하기
├── activity3/
│   └── index.html          # Activity 3 - 주파수 분석 (스펙트로그램)  [Cycle 3]
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (3초 워밍업 + 캘리브레이션)
│       ├── visual.js       # 시각화 모듈 (파형 그래프 + MMI 색상)
│       ├── review.js       # 리뷰 모드 모듈 (드래그 탐색, activity1 전용)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       ├── export.js       # CSV 내보내기 모듈 (컬럼 자동 생성)
│       └── spectrogram.js  # 스펙트로그램 모듈 (실시간 FFT → Canvas)  [Cycle 3]
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
- 센서 권한 요청 및 수집 시작/정지
- 화면 배경색: 300ms 슬라이딩 윈도우 PGA → KMA MMI 10단계 색상 실시간 변화
- 진도 레벨 텍스트 표시 (예: 진도 III 약진)
- 실시간/고정 토글 스위치: 배경색 피크 고정 또는 실시간 갱신
- MMI 진도 안내 모달 (하단 고정 버튼, lazy 빌드)
- Z축 실시간 파형 표시 (슬라이딩 윈도우 10초)
- 정지 버튼 1차: 센서 중단 + 리뷰 모드 진입 (전체 파형 드래그 탐색, 1초 구간 진도)
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
### activity3/index.html — 주파수 분석 (스펙트로그램)  [Cycle 3]
- 두 가지 모드 탭: 센서 측정 / 파일 선택
- **센서 모드**: sensor.js 재사용, 실시간 파형 + 스펙트로그램 워터폴 + 피크 주파수 표시
- **파일 선택 모드**: CSV 드래그 앤 드롭(PC) + 파일 선택(모바일) → 7초 애니메이션 재생
- 주파수 범위: 0~100 Hz (MAX_FREQ=100), 진폭: Viridis-style 컬러맵 (log 스케일)
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
기능1 : 300ms 슬라이딩 윈도우 PGA → KMA MMI 10단계 배경색 매핑 (I~X+)
기능2 : Canvas 기반 Z축 실시간 파형 그래프
        - 왼쪽 앵커 → 슬라이딩 윈도우 전환 (10초)
        - Y축 자동 스케일: 즉시 확장, 천천히 축소 (decay 0.997)
기능3 : 색 고정 모드 (setColorLock), 리뷰 스냅샷 반환 (startReview)
API   : update(data), reset(), setColorLock(bool), getMmiColor(z), getMmiInfo(z), getMmiLevels(), startReview()
```

### review.js
```
역할  : Activity 1 측정 후 리뷰 모드 (activity1 전용)
입력  : visual.js의 _fullBuffer 스냅샷
기능  : 10초 뷰포트 드래그 탐색, 1초 중앙 구간 하이라이트
출력  : onRegion(maxAbsZ, level, name, timeLabel) 콜백
API   : init(canvasEl, data, onRegion), destroy()
```

### gps.js
```
역할  : GPS 좌표 1회 취득
출력  : { latitude, longitude, accuracy }
특이  : HTTPS 필수, 측정 시작 시 좌표 고정 (이동 추적 아님)
```

### spectrogram.js  [Cycle 3]
```
역할  : 실시간 FFT 계산 및 스펙트로그램 Canvas 렌더링
입력  : 센서 데이터 버퍼 (acc_z 배열)
출력  : Canvas에 시간-주파수-진폭 2D 워터폴 컬러맵 (최신 데이터 상단)
알고리즘 : Cooley-Tukey FFT (Vanilla JS 순수 구현)
주파수 범위 : 0 ~ min(100Hz, sr/2) — X축, 캔버스 하단 10Hz 간격 레이블
시간 범위 : WINDOW_SEC=10초 — Y축, 2초 간격 경과 시간 레이블 (wall-clock 기반)
윈도우 함수 : Hann window (스펙트럼 누설 억제)
색상 매핑 : 로그 스케일 진폭 → Viridis-style (어두운 보라 → 노랑)
렌더링 : 히스토리 배열 기반 전체 재렌더 (push-scroll 방식 대비 시간 축 정확)
주의 : Firefox Android DeviceMotionEvent.interval 오보고 → activity3에서 50~250Hz 범위 필터링
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

## 기술 스택 (Cycle 3)

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
Cycle 3 완료  →  activity3/ (실시간 FFT 스펙트로그램 + CSV 파일 재생)

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
