# ARCHITECTURE.md

## 설계 철학
- 서버 없이 브라우저 단독으로 동작 (Cycle 2까지)
- 단일 HTML 기반으로 시작, 각 Activity가 독립 폴더로 구성
- GitHub Pages로 무료 배포, 오픈소스 공개
- 각 Cycle의 산출물이 index.html 목차에 누적되는 구조

---

## 전체 파일 구조 (Cycle 1 기준)

```
project-root/
├── index.html              # 목차 페이지 (플랫폼 진입점)
├── activity1/
│   └── index.html          # Activity 1 - 지진파 색으로 보기
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈
│       ├── visual.js       # 시각화 모듈
│       └── export.js       # CSV 내보내기 모듈 (Activity 2 이후 활용 예정)
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
- 각 Activity를 카드 형태로 나열
- 완성된 Activity는 활성화, 미완성은 "준비중" 표시
- GitHub 링크, 사용법 버튼 포함

### activity1/index.html — 지진파 색으로 보기
- 센서 권한 요청 및 수집 시작/정지
- 화면 배경색 실시간 변화 (Z축 진폭 → 색상 매핑)
- Z축 실시간 파형 표시 (슬라이딩 윈도우 10초)
- CSV 다운로드 없음 (Activity 1은 시각화 확인 목적)

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

### export.js
```
역할  : 수집된 데이터 메모리 저장 및 CSV 변환/다운로드
출력  : timestamp, acc_x, acc_y, acc_z, magnitude
현황  : Activity 1에서는 미사용, Activity 2 이후 활용 예정
다운로드 우선순위:
  1. File System Access API (showSaveFilePicker) — 저장 위치 선택
  2. Web Share API — iOS/Android 공유 시트
  3. <a download> — 폴백
```

---

## 기술 스택 (Cycle 1)

| 항목 | 선택 | 이유 |
|------|------|------|
| 언어 | Vanilla JS | 빌드 도구 불필요, 단순 |
| 스타일 | CSS (단일 파일) | 외부 라이브러리 없음 |
| 그래프 | Canvas API | 외부 라이브러리 없이 파형 구현 |
| 배포 | GitHub Pages | 무료, HTTPS 자동 제공 |
| 센서 | DeviceMotionEvent | 브라우저 내장 Web API |

---

## 향후 Cycle 확장 방향

```
Cycle 2  →  activity2/ 추가 (다중 CSV 드롭 + 기본 시각화 + 통계)
Cycle 3  →  activity2 심화 (FFT 스펙트로그램)
Cycle 4  →  activity3/ (주시곡선), activity4/ (GPS 진원 찾기)
Cycle 5  →  실시간 다중 기기 — 서버 필요 여부 재검토 후 결정
```

---

## 브라우저 호환성

| 브라우저 | 센서 권한 | 비고 |
|----------|-----------|------|
| Android Chrome | 자동 허용 | accelerationIncludingGravity null 시 acceleration으로 폴백 |
| iOS Safari 13+ | 사용자 제스처 후 요청 필수 | 버튼 클릭 후 requestPermission() 호출 |
| iOS Safari 12- | 설정에서 수동 허용 | 안내 메시지 필요 |
