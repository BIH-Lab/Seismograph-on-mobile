# TASK.md
> Claude Code가 작업 시작 전 반드시 확인하는 파일입니다.
> 작업 완료 시 체크박스를 업데이트해주세요.

---

## 현재 단계
**Cycle 3 — Activity 3 : 주파수 분석 (스펙트로그램)**

목표 : 실시간 FFT로 진동 신호의 주파수 성분을 스펙트로그램으로 시각화

---

## Cycle 3 작업 목록

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
- [ ] PC Chrome 드래그 앤 드롭 테스트
- [ ] Android Chrome 테스트 (센서 모드 + 파일 선택)
- [ ] iOS Safari 테스트
- [ ] GitHub Pages 배포

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

## 완료된 작업
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
- Android 일부 기기에서 accelerationIncludingGravity가 null → acceleration으로 자동 폴백
- 측정 시작 시 스마트폰을 평평하게 놓은 상태에서 버튼 눌러야 캘리브레이션 기준값이 정확함
- GPS 정밀도는 기기/환경에 따라 수 미터 ~ 수십 미터 오차 발생 가능
- iOS GPS: enableHighAccuracy=true는 GPS 하드웨어 강제 사용 → 실내에서 타임아웃 발생
  → enableHighAccuracy=false(WiFi/셀 위치)로 변경, 2~3초 내 응답, 정확도 10~100m (관측소 위치 기록 용도로 충분)
