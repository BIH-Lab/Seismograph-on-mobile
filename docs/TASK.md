# TASK.md
> Claude Code가 작업 시작 전 반드시 확인하는 파일입니다.
> 작업 완료 시 체크박스를 업데이트해주세요.

---

## 현재 단계
**Cycle 1 — Activity 1 : 지진파 색으로 보기**

목표 : 서버 없이 스마트폰 한 대로 완전히 동작하는
       지진동 시각화 페이지 완성

---

## Cycle 1 작업 목록

### 1단계 : 프로젝트 기초 세팅
- [ ] 폴더 구조 생성 (ARCHITECTURE.md 참고)
- [ ] index.html 목차 페이지 기본 레이아웃
- [ ] activity1/ 폴더 및 index.html 생성
- [ ] assets/css/style.css 기본 스타일 (모바일 퍼스트)

### 2단계 : 센서 모듈 (sensor.js)
- [ ] DeviceMotionEvent 수신 기본 구현
- [ ] iOS Safari 권한 요청 처리 (requestPermission)
- [ ] Android Chrome 자동 허용 처리
- [ ] 데이터 정규화 (magnitude 계산 = √(x²+y²+z²))
- [ ] 측정 시작 / 정지 기능

### 3단계 : 시각화 모듈 (visual.js)
- [ ] 진폭 → 배경색 매핑 구현 (HSL 색상 공간)
      낮음(파랑) → 중간(초록) → 높음(빨강)
- [ ] Canvas 기반 실시간 파형 그래프 (X·Y·Z축)
- [ ] 그래프 시간축 스크롤 (최근 10초 표시)

### 4단계 : 데이터 내보내기 (export.js)
- [ ] 수집 데이터 메모리 저장 (배열)
- [ ] CSV 변환 함수
      (timestamp, acc_x, acc_y, acc_z, magnitude)
- [ ] 다운로드 버튼 구현

### 5단계 : index.html 목차 완성
- [ ] Activity 1 카드 활성화
- [ ] Activity 2·3·4 카드 "준비중" 표시
- [ ] 플랫폼 소개 문구
- [ ] GitHub 링크 버튼
- [ ] 사용법 안내 버튼

### 6단계 : 테스트 및 배포
- [ ] Android Chrome 테스트
- [ ] iOS Safari 테스트
- [ ] GitHub Pages 배포 설정
- [ ] HTTPS 동작 확인

---

## 완료된 작업
(없음 — Cycle 1 시작 전)

---

## 다음 Cycle 예정 (지금 건드리지 않음)
- Cycle 2 : Activity 2 기초 (다중 CSV 드롭 + 기본 시각화 + 통계)
- Cycle 3 : Activity 2 심화 (FFT 스펙트로그램)
- Cycle 4 : Activity 2 완성 (주시곡선 + GPS 진원 역산)
- Cycle 5 : Activity 3~ 실시간 다중 기기 — 서버 필요 여부 재검토 후 결정

---

## 알려진 이슈 / 주의사항
- iOS에서 DeviceMotionEvent는 반드시 사용자 버튼 클릭 이후에 권한 요청할 것
- HTTPS 없이는 센서 API 동작 안 함 (GitHub Pages는 자동 HTTPS)
- 데이터는 메모리에만 저장 (페이지 새로고침 시 초기화됨, Cycle 1 범위)