# Seismograph-on-mobile

스마트폰 내장 가속도 센서를 활용하여 지진동 데이터를 실시간 수집하고 시각화하는 웹 플랫폼.
앱 설치 없이 브라우저만으로 동작하며, GitHub Pages를 통해 배포됩니다.

🔗 **[https://bih-lab.github.io/Seismograph-on-mobile/](https://bih-lab.github.io/Seismograph-on-mobile/)**

---

## 사용법

1. 스마트폰 브라우저로 위 링크에 접속합니다.
   - iOS → **Safari** 권장
   - Android → **Chrome** 권장
2. Activity 카드를 선택합니다.
3. **측정 시작** 버튼을 누르고 센서 권한을 허용합니다.
4. 실시간으로 진동 데이터가 그래프에 표시됩니다.

> ⚠️ 센서 API는 **HTTPS 환경**에서만 동작합니다.

---

## Activity 목록

| # | 이름 | 상태 | 설명 |
|---|------|------|------|
| 01 | 지진파 색으로 보기 | 개발 중 | 진폭에 따라 화면 배경색이 변하며 X·Y·Z 파형을 표시 |
| 02 | 신호 비교하기 | 준비중 | 여러 기기의 신호를 함께 분석 |
| 03 | 주시곡선 그리기 | 준비중 | P파·S파 도달 시간으로 진원 탐색 |
| 04 | 진원 찾기 | 준비중 | GPS 위치 정보를 이용해 진원지 역산 |

---

## 기술 스택

- **Vanilla JS** — 빌드 도구 없는 단일 파일 구조
- **Canvas API** — 실시간 파형 그래프
- **DeviceMotionEvent API** — 스마트폰 가속도 센서
- **GitHub Pages** — 정적 웹 배포 (HTTPS 자동 제공)

---

## 파일 구조

```
Seismograph-on-mobile/
├── index.html              # 목차 페이지
├── activity1/
│   └── index.html          # Activity 1 — 지진파 색으로 보기
├── assets/
│   ├── css/style.css       # 공통 스타일 (모바일 퍼스트 다크 테마)
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (iOS/Android 권한 처리)
│       ├── visual.js       # 시각화 모듈 (배경색 + 파형 그래프)
│       └── export.js       # CSV 다운로드 모듈
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── TASK.md
```

---

## 개발 현황 (나선형 개발 방법론)

- [x] Cycle 1 — 1단계: 프로젝트 기초 세팅 (폴더 구조, 목차 페이지, 스타일)
- [x] Cycle 1 — 2단계: 센서 모듈 sensor.js (iOS/Android 권한, 데이터 정규화)
- [ ] Cycle 1 — 3단계: 시각화 모듈 visual.js
- [ ] Cycle 1 — 4단계: 내보내기 모듈 export.js
- [ ] Cycle 1 — 5단계: 목차 완성
- [ ] Cycle 1 — 6단계: 테스트 및 배포 확인

---

## 참고

- [AstroHopper](https://artyom-beilis.github.io/astrohopper.html) — 단일 HTML 기반 웹앱 구조 참고
