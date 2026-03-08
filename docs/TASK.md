# TASK.md
> Claude Code가 작업 시작 전 반드시 확인하는 파일입니다.
> 작업 완료 시 체크박스를 업데이트해주세요.

---

## 현재 단계
**Cycle 2 — Activity 2 : 지진파 기록하기**

목표 : GPS 좌표 + 시간별 Z축 가속도를 기록하고
       CSV로 다운로드할 수 있는 페이지 완성

---

## Cycle 2 작업 목록

### 1단계 : activity2/ 페이지 기본 세팅
- [ ] activity2/ 폴더 및 index.html 생성
- [ ] index.html 목차에서 Activity 2 카드 활성화

### 2단계 : GPS 모듈 (gps.js)
- [ ] navigator.geolocation.getCurrentPosition() 구현
- [ ] iOS / Android 권한 요청 처리
- [ ] 좌표 취득 실패 시 오류 메시지 표시
- [ ] 측정 시작 시 좌표 1회 고정 (이동 추적 아님)

### 3단계 : 센서 + GPS 통합 수집
- [ ] sensor.js 재사용 (캘리브레이션 포함)
- [ ] 수집 데이터: timestamp, latitude, longitude, acc_z
- [ ] (보류) acc_x, acc_y 추가 여부 추후 결정

### 4단계 : 실시간 그래프
- [ ] visual.js 재사용 또는 activity2 전용 canvas 구현
- [ ] Z축 파형 실시간 표시 (슬라이딩 윈도우 10초)
- [ ] 현재 GPS 좌표 화면에 표시

### 5단계 : CSV 다운로드
- [ ] export.js 재사용
- [ ] CSV 컬럼: timestamp, latitude, longitude, acc_z
- [ ] 다운로드 버튼 (측정 정지 후 활성화)

### 6단계 : 테스트 및 배포
- [ ] Android Chrome 테스트
- [ ] iOS Safari 테스트
- [ ] GPS 권한 요청 동작 확인
- [ ] CSV 다운로드 동작 확인
- [ ] GitHub Pages 배포

---

## 완료된 작업
- Cycle 1 전체 완료 (2026-03-08)
  - Activity 1: 지진파 색으로 보기 (Z축 진폭 → 배경색, 실시간 그래프)

---

## 다음 Cycle 예정 (지금 건드리지 않음)
- Cycle 3 : Activity 2 심화 또는 Activity 3 (여러 CSV 불러와서 신호 비교)
- Cycle 4 : FFT 스펙트로그램
- Cycle 5 : 주시곡선 + GPS 진원 역산
- Cycle 6 : 실시간 다중 기기 — 서버 필요 여부 재검토 후 결정

---

## 알려진 이슈 / 주의사항
- iOS에서 DeviceMotionEvent는 반드시 사용자 버튼 클릭 이후에 권한 요청할 것
- GPS(Geolocation)도 마찬가지로 사용자 제스처 이후에 요청할 것
- HTTPS 없이는 센서 API, GPS API 모두 동작 안 함 (GitHub Pages는 자동 HTTPS)
- 데이터는 메모리에만 저장 (페이지 새로고침 시 초기화)
- Android 일부 기기에서 accelerationIncludingGravity가 null → acceleration으로 자동 폴백
- 측정 시작 시 스마트폰을 평평하게 놓은 상태에서 버튼 눌러야 캘리브레이션 기준값이 정확함
- GPS 정밀도는 기기/환경에 따라 수 미터 ~ 수십 미터 오차 발생 가능
