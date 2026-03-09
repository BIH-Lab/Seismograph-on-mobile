# ARCHITECTURE.md

## 설계 철학
- 서버 없이 브라우저 단독으로 동작 (Cycle 3까지)
- 단일 HTML 기반으로 시작, 각 Activity가 독립 폴더로 구성
- GitHub Pages로 무료 배포, 오픈소스 공개
- 각 Cycle의 산출물이 index.html 목차에 누적되는 구조

---

## 전체 파일 구조 (Cycle 2 기준)

```
project-root/
├── index.html              # 목차 페이지 (플랫폼 진입점)
├── activity1/
│   └── index.html          # Activity 1 - 지진파 색으로 보기
├── activity2/
│   └── index.html          # Activity 2 - 지진파 기록하기
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈
│       ├── visual.js       # 시각화 모듈 (파형 그래프)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       └── export.js       # CSV 내보내기 모듈 (컬럼 자동 생성)
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
- 정지 버튼: 센서 중단 + 그래프 초기화 + 초기 상태 복귀
- 화면 배경색 실시간 변화 (Z축 진폭 → 색상 매핑)
- Z축 실시간 파형 표시 (슬라이딩 윈도우 10초)
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
- 스펙트로그램 패널 추가 예정 (실시간 FFT)

---

## 모듈 설계

### sensor.js
```
역할  : DeviceMotionEvent 수신 및 데이터 정규화
입력  : 브라우저 센서 이벤트
출력  : { timestamp, acc_x, acc_y, acc_z, magnitude }
특이  : iOS 권한 요청 처리, Android null 폴백, 캘리브레이션 5샘플
```

### visual.js
```
역할  : 센서 데이터를 시각화
기능1 : Z축 진폭 → 배경색 매핑 (HSL: 파랑→초록→빨강)
        MAX_Z = 1.5 m/s², 명도 45%, 채도 90%
기능2 : Canvas 기반 Z축 실시간 파형 그래프
        - 왼쪽 앵커 → 슬라이딩 윈도우 전환 (10초)
        - Y축 자동 스케일: 즉시 확장, 천천히 축소 (decay 0.997)
```

### gps.js
```
역할  : GPS 좌표 1회 취득
출력  : { latitude, longitude, accuracy }
특이  : HTTPS 필수, 측정 시작 시 좌표 고정 (이동 추적 아님)
```

### export.js
```
역할  : 수집된 데이터 메모리 저장 및 CSV 변환/다운로드
특이  : 첫 번째 row의 키를 자동으로 CSV 컬럼으로 사용 (범용)
현황  : Activity 2에서 사용 중 (데이터 컬럼: timestamp, acc_z)
        메타데이터: station_id, latitude, longitude, accuracy, sample_rate
다운로드 우선순위:
  모바일(Android/iOS): 1. Web Share API — 공유 시트  2. <a download> — 폴백
  데스크톱:           1. showSaveFilePicker — 저장 위치 선택  2. Web Share API  3. <a download>
```

---

## 기술 스택 (Cycle 2)

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
Cycle 2 진행 중
  → activity2 기본 완료 (GPS + Z축 + CSV)
  → 테스트 후 스펙트로그램(실시간 FFT) activity2에 추가

Cycle 3  →  activity3/ 추가 (다중 CSV 드롭 + 신호 비교 + 기본 통계)
Cycle 4  →  activity4/ (주시곡선), activity5/ (GPS 진원 찾기)
Cycle 5  →  실시간 다중 기기 — 서버 필요 여부 재검토 후 결정
```

---

## 브라우저 호환성

| 브라우저 | 센서 권한 | GPS 권한 | 비고 |
|----------|-----------|----------|------|
| Android Chrome | 자동 허용 | 브라우저 팝업 | accelerationIncludingGravity null 시 폴백 |
| iOS Safari 13+ | 사용자 제스처 후 요청 필수 | 브라우저 팝업 | requestPermission() 호출 필요 |
| iOS Safari 12- | 설정에서 수동 허용 | 브라우저 팝업 | 안내 메시지 필요 |
