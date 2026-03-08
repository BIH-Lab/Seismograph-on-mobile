# ARCHITECTURE.md

## 설계 철학
- 서버 없이 브라우저 단독으로 동작 (Cycle 1 기준)
- AstroHopper처럼 단일 HTML 기반 PWA로 시작
- GitHub Pages로 무료 배포, 오픈소스 공개
- 각 Cycle의 산출물이 index.html 목차에 누적되는 구조

---

## 전체 파일 구조 (Cycle 1 기준)

```
project-root/
├── index.html          # 목차 페이지 (플랫폼 진입점)
├── activity1/
│   └── index.html      # Activity 1 - 지진파 색으로 보기
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── sensor.js   # 센서 수집 모듈
│       ├── visual.js   # 시각화 모듈
│       └── export.js   # CSV 다운로드 모듈
├── docs/               # .md 문서 모음
│   ├── CLAUDE.md
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── TASK.md
└── README.md           # GitHub 오픈소스 소개 페이지
```

---

## 페이지별 역할

### index.html — 목차 페이지
- 플랫폼 소개 및 제작 의도 표시
- 각 Activity를 카드 형태로 나열
- 완성된 Activity는 활성화, 미완성은 "준비중" 표시
- GitHub 링크, 사용법, 의견 보내기 버튼 포함

### activity1/index.html — 지진파 색으로 보기
- 센서 권한 요청 및 수집 시작/정지
- 화면 배경색 실시간 변화 (진폭 → 색상 매핑)
- 실시간 파형 표시 (X·Y·Z축)
- CSV 다운로드

---

## 모듈 설계

### sensor.js
```
역할  : DeviceMotionEvent 수신 및 데이터 정규화
입력  : 브라우저 센서 이벤트
출력  : { timestamp, acc_x, acc_y, acc_z, magnitude }
주의  : iOS 권한 요청 처리 포함
```

### visual.js
```
역할  : 센서 데이터를 시각화
기능1 : 진폭(magnitude) → 배경색 매핑
        (낮음: 파랑 → 높음: 빨강, HSL 색상 공간 활용)
기능2 : Canvas 기반 실시간 파형 그래프
```

### export.js
```
역할  : 수집된 데이터 CSV 변환 및 다운로드
출력 형식 :
  timestamp, acc_x, acc_y, acc_z, magnitude
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

## 향후 Cycle 확장 방향 (메모)

```
Cycle 2  →  activity2/ 추가 (다중 기기 신호 비교)
             이 시점에서 서버 필요 여부 재검토
Cycle 3  →  activity3/ 추가 (주시곡선)
Cycle 4  →  activity4/ 추가 (GPS 진원 찾기)
```

---

## 브라우저 호환성 주의사항

| 브라우저 | 센서 권한 | 비고 |
|----------|-----------|------|
| Android Chrome | 자동 허용 | 별도 처리 불필요 |
| iOS Safari 13+ | 사용자 제스처 후 요청 필수 | 버튼 클릭 후 requestPermission() 호출 |
| iOS Safari 12- | 설정에서 수동 허용 | 안내 메시지 필요 |