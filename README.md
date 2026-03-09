# Seismograph-on-mobile

스마트폰 내장 가속도 센서를 활용하여 지진동 데이터를 실시간 수집하고 시각화하는 웹 플랫폼.
앱 설치 없이 브라우저만으로 동작하며, GitHub Pages를 통해 배포됩니다.

🔗 **[https://bih-lab.github.io/Seismograph-on-mobile/](https://bih-lab.github.io/Seismograph-on-mobile/)**

---

## 사용법

1. 스마트폰 브라우저로 위 링크에 접속합니다.
   - iOS → **Safari** 권장
   - Android → **Chrome** 권장
2. 첫 화면에서 **관측소 번호**를 입력하고 저장합니다 (CSV 메타데이터에 자동 포함).
3. Activity 카드를 선택합니다.
4. **측정 시작** 버튼을 누르고 센서·GPS 권한을 허용합니다.
5. 실시간으로 진동 데이터가 그래프에 표시됩니다.
6. **측정 정지** 버튼을 누르면 측정이 멈추고 그래프가 유지됩니다.
7. CSV 다운로드 버튼으로 데이터를 저장하거나, 다시 **초기화** 버튼을 눌러 리셋합니다.

> ⚠️ 센서 API와 GPS API는 **HTTPS 환경**에서만 동작합니다.

---

## Activity 목록

| # | 이름 | 상태 | 설명 |
|---|------|------|------|
| 01 | 지진파 색으로 보기 | ✅ 완료 | Z축 진폭에 따라 화면 배경색이 변하고 실시간 파형 그래프 표시 |
| 02 | 지진파 기록하기 | 🔄 진행 중 | GPS 좌표 + Z축 가속도를 시간별로 기록하고 CSV로 다운로드 |
| 03 | 신호 비교하기 | 준비중 | 여러 기기의 CSV를 불러와 파형·통계 비교 |
| 04 | 주시곡선·진원 찾기 | 준비중 | P파·S파 도달 시간 및 GPS 위치로 진원지 역산 |

---

## 기술 스택

- **Vanilla JS** — 빌드 도구 없는 단일 파일 구조
- **Canvas API** — 실시간 파형 그래프
- **DeviceMotionEvent API** — 스마트폰 가속도 센서
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
├── assets/
│   ├── css/style.css       # 공통 스타일 (모바일 퍼스트 다크 테마)
│   └── js/
│       ├── sensor.js       # 센서 수집 모듈 (iOS/Android 권한 처리)
│       ├── visual.js       # 시각화 모듈 (배경색 + 파형 그래프)
│       ├── gps.js          # GPS 좌표 수집 모듈
│       └── export.js       # CSV 다운로드 모듈
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── TASK.md
```

---

## 개발 현황 (나선형 개발 방법론)

- [x] Cycle 1 완료 — Activity 1: 지진파 색으로 보기 (센서·그래프·배경색 시각화)
- [x] Cycle 2 진행 중 — Activity 2: 지진파 기록하기 (GPS + CSV 다운로드)
  - [x] GPS 모듈, 센서 통합 수집, 실시간 그래프, CSV 다운로드
  - [ ] 스펙트로그램 (실시간 FFT) — 테스트 완료 후 추가 예정
- [ ] Cycle 3 예정 — Activity 3: 신호 비교하기 (다중 CSV 비교·통계)
- [ ] Cycle 4 예정 — Activity 4: 주시곡선·진원 찾기

---

## 참고

- [AstroHopper](https://artyom-beilis.github.io/astrohopper.html) — 단일 HTML 기반 웹앱 구조 참고
