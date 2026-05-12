# TASK.md
> Claude Code가 작업 시작 전 반드시 확인하는 파일입니다.
> 작업 완료 시 체크박스를 업데이트해주세요.

---

## 현재 단계
**Cycle 4 완료** (2026-05-13)
- Cycle 1 완료 (2026-03-08) + Activity 1 추가 개선 완료 (2026-03-22)
- Cycle 2 완료 (2026-03-09)
- Cycle 3 완료 (2026-03-10) + QA 개선 완료 (2026-03-11) + 재구성 완료 (2026-03-23)
- Cycle 3 후속 수정 완료 (2026-03-23): psd.js v2.2, hvsr.js v1.2, 파일 모드 재설계
- Cycle 3 추가 QA 개선 완료 (2026-03-26): 스펙트로그램 포화·컬러맵·오토스케일·NTP
- Cycle 3 학술 개선 + UX 추가 완료 (2026-03-27): hvsr.js v2.0 SESAME 준수, 설명 모달, 절대 시각 표시
- psd.js v3.1 완료 (2026-04-04): 다중 윈도우 누적 표시, Peterson NLNM/NHNM 토글, X축 0.2Hz 통일
- Activity 3 PNG 내보내기 완료 (2026-04-04): export-image.js v1.0, 8개 PNG 버튼
- activity2 iOS 버그 수정 (2026-04-08): 제스처 컨텍스트 복구, 센서 먼저 시작 후 NTP·GPS 백그라운드 처리
- psd.js v3.2~v3.4 완료 (2026-04-08): 밀도 히트맵 (파랑→빨강), 저주파 빈칸 수정, 평균선 흰색 1px
- hvsr.js v2.1 완료 (2026-04-08): 스무딩 제거 + FILE_HOP 512→128 (87.5% 오버랩)
- psd.js v3.5~v3.6 완료 (2026-04-13): 실시간/누적 토글, Peterson 참조선 제거
- Activity 3 UX 개선 완료 (2026-04-13): 컨트롤 외부 배치, 토글 스위치, PNG 버튼 레이블
- Activity 4 v1 완료 (2026-04-14): 3탭 구조 + 시간조정 탭 + 수동 주시곡선
- Activity 4 후속 개선 완료 (2026-05-13): 시간 기준 재설계·진원 선택 선택적화·split slider·유효수자·UX

---

## Activity 4 후속 개선 (2026-05-13 완료)

### 시간 기준 재설계 + 진원 선택 선택적화
- [x] `srcT = _refLineT` 로 변경 — Step 2 빨간 기준선이 t=0 기준 (이전: 진원 스테이션 pickTime)
  - 원인: Step 2에서 클릭-to-스냅으로 맞춘 발진 시각이 Step 3 주시 계산에 반영되지 않던 구조적 버그
- [x] `_sourceIdx = -1` 지원 — 진원 스테이션 없이 거리 수동 입력 가능
- [x] Step 2 설명 문구: "충격 순간을 클릭 → 기준선으로 스냅 (기준선 = 발진 시각)"

### Step 2 줌인/아웃
- [x] 마우스 휠 줌 (커서 Y 위치 기준), 핀치 줌 (터치 2포인트)
- [x] 줌 버튼 3개: `[− 축소] [전체 보기] [+ 확대]`
- [x] `_viewStartMs` / `_viewRangeMs` 상태 변수, 범위 [200ms, _windowMs] 클램프
- [x] 줌 시 globalMaxAbs도 뷰 내 데이터만으로 재계산 (진폭 자동 스케일)

### Step 3 피킹 카드 개선
- [x] 카드별 줌인/아웃 + 핀치 줌 (X축)
- [x] `_drawWave()` 좌상단 `±maxAbs` 진폭 스케일 레이블 (줌 시 자동 갱신)

### hodochron.js v1.1 → v1.2 — split slider 회귀선 수정
- [x] `_points.length < 4` 조건 제거 — partial 결과 지원
  - g1 ≥ 2: V1 파랑 회귀선 + V1 값 표시
  - g1·g2 ≥ 2 + 물리 조건: 완전 결과 (V1/V2/h/xc)
  - 미충족 시 `partial: true` 반환 → "V₁만 계산됨" 경고
- [x] `_redraw()` `_r1`/`_r2` null guard — V2 없어도 V1 선 단독 표시
- [x] 결과 미달 시 `_applyResults()` 안내 메시지 (회색 → 주황 → 없음)
- [x] `negWarn` dataset flag — 음수 시간 경고가 슬라이더 안내로 덮이지 않도록 보호

### 결과 정밀도 + 레이블
- [x] V1/V2/h/xc 소수점 2자리 표시 (`parseFloat(...toFixed(2))`)
- [x] 자동 회귀 + 수동 모드 모두 동일 적용
- [x] 레이블: "기반층 P파 속도 V₂" → "하부층 P파 속도 V₂"

---

## Activity 4 v1 — 주시곡선 (굴절법 탐사) (2026-04-14 완료)

### 탭 구조 재편 (4단계 → 3탭)
- [x] Step nav 4단계(`파일·거리·픽킹·결과`) → 3탭(`파싱/거리·시간조정·픽킹/분석`)
- [x] `_showStep()` 이터레이션 `[1,2,3,4]` → `[1,2,3]`

### Tab 1 — 파싱/거리 (기존 Steps 1+2 병합)
- [x] 파일 로드 완료 시 거리 설정 서브패널 인라인 표시
- [x] `_stations[]`에 `timeOffset: 0` 상태 추가
- [x] `parseCSV()`, `haversine()`, `_computeDistances()` 기존 코드 보존

### Tab 2 (신규) — 시간 조정 (Record Section)
- [x] Record Section 캔버스: 트레이스 거리순 정렬, 공통 5초 시간 윈도우
  - 데시메이션: rows.length > PW×2 이면 stride 계산으로 렌더링 최적화
- [x] 빨간 점선 기준선: `_refLineT`, 포인터 드래그 이동 가능 (setPointerCapture)
- [x] 스테이션별 오프셋 컨트롤: 범위 ±2000ms, 슬라이더 ↔ 숫자 입력 양방향 동기화
- [x] 오프셋 변경 즉시 캔버스 재렌더

### Tab 3 — 픽킹/주시곡선
- [x] 기존 픽킹 카드 그대로 유지
- [x] `timeOffset` 반영: `t = (s.pickTime + s.timeOffset) - (src.pickTime + src.timeOffset)`
- [x] 주시곡선 모드 토글 추가 (`자동 회귀` / `수동 선 그리기`)
  - 자동 모드: 기존 슬라이더 회귀선
  - 수동 모드: "V₁ 선 추가" / "V₂ 선 추가" → 드래그 핸들 → 속도 실시간 계산
  - 두 선 모두 있으면 xc(교차거리)·h(표층두께) 자동 계산·표시
- [x] `onManualUpdate` 콜백 → `manual-vel-display` + `results-grid` 실시간 갱신
- [x] 결과 저장 CSV에 `time_offset_ms` 컬럼 추가

### hodochron.js v1.0 → v1.1
- [x] `_getTransforms()` 좌표 변환 헬퍼 추출 (dist↔canvasX, t↔canvasY 양방향)
- [x] `setMode('auto'|'manual')` API 추가
- [x] `addLine(role)`: 역할당 1개, 초기 위치 자동 배치
- [x] `clearLines()`: 수동 선 전체 초기화
- [x] `onManualUpdate(cb)`: 드래그 시 속도 계산 결과 콜백
- [x] 포인터 이벤트: hit radius 14px(터치 대응), setPointerCapture, init() 재호출 시 리스너 교체
- [x] `_computeManual()`: slope → V, y절편 → ti → h, xc 계산
- [x] 수동 선 렌더링: 핸들(원+흰 테두리), 연장 점선, xc 수직선, 범례

### style.css 추가
- [x] `.recsec-wrap`, `.offset-row`, `.offset-slider`, `.offset-num`
- [x] `.hodo-mode-toggle`, `.hodo-mode-btn`, `.manual-line-ctrl`, `.manual-vel-display`

---

## Activity 2 iOS 센서 권한 버그 수정 (2026-04-08 완료)

### activity2/index.html — 제스처 컨텍스트 복구
- [x] 시작 버튼 핸들러 `async () =>` → 동기 `() =>` 변경
- [x] `SensorModule.start()` 클릭 직후 제스처 컨텍스트 안에서 먼저 호출
- [x] NTP 동기화: `await _syncNtp()` → `.then()` 백그라운드 처리
- [x] GPS: `GpsModule.get()` 백그라운드 병렬 처리 (센서 시작 후)
- [x] 저장된 NTP 오프셋 즉시 적용 (백그라운드 갱신 전 fallback)
- 원인: iOS Safari는 `DeviceMotionEvent.requestPermission()`을 동기 제스처 컨텍스트에서만 허용.
  `await` 이후 호출 시 팝업 없이 `'denied'` 반환 → 측정 불가

---

## psd.js v3.5~v3.6 + Activity 3 UX 개선 (2026-04-13 완료)

### psd.js v3.5 — 실시간/누적 히트맵 토글
- [x] `_densityMode` 상태 변수 추가 (false=실시간, true=누적 히트맵)
- [x] `setDensityMode(val)` 공개 API 추가
- [x] OFF 모드: 최신 FFT 윈도우 1개를 청록 라인으로 표시 (`live · N frames` 레이블)
- [x] ON 모드: 기존 밀도 히트맵 + 흰색 평균선 (`N frames avg` 레이블)

### psd.js v3.6 — Peterson 참조선 완전 제거
- [x] NLNM·NHNM 상수 배열 삭제 (~25줄)
- [x] `_petersonDb()`, `_drawPetersonLine()` 함수 삭제
- [x] `_showPeterson` 상태 변수 삭제
- [x] `_redraw()` 내 Layer 1 Peterson 블록 삭제
- [x] `setShowPeterson()` 공개 함수 삭제
- 이유: 스마트폰 센서 노이즈 레벨(-60~-40 dB)이 NLNM(-180 dB)보다 훨씬 높아 활용 불가

### Activity 3 UX 개선
- [x] 모든 그래프 컨트롤을 `.spectrogram-panel` 밖으로 분리 (`graph-controls` class)
  - 패널 `overflow:hidden` + `canvas height:100%`로 인한 버튼 가림 문제 완전 해소
  - 탭 전환/파일 로드/리셋 시 패널과 컨트롤 동기화
- [x] "누적 히트맵" 버튼 → `mmi-toggle` 스위치 (실시간 ↔ 누적)로 교체
- [x] 센서 모드 토글을 측정 정지 버튼 위 가운데(`#sensor-density-row`)로 이동
  - PSD 탭 활성 시에만 표시
- [x] "참조선 표시" 버튼 UI 제거 (`_petersonOn` 핸들러 포함)
- [x] PNG 버튼 레이블 명확화: "↓ PNG" → "↓ 파형" / "↓ 스펙트로그램" / "↓ PSD" / "↓ HVSR"

---

## psd.js 시각화 개선 (2026-04-08 완료)

### psd.js v3.2 — 밀도 히트맵
- [x] Layer 2 교체: 반투명 빨간 선 묶음 → 픽셀별 밀도 히트맵 (ObsPy PPSD 스타일)
- [x] 밀도 낮음: 파랑·시안 / 중간: 노랑 / 높음: 빨강
- [x] 로그 정규화로 윈도우 수에 무관하게 색상 차이 가시화

### psd.js v3.3 — 저주파 빈칸 수정
- [x] 히트맵 순회 방향: 빈→픽셀 → 픽셀→빈 역방향으로 변경
- [x] 분수 빈 인덱스 선형 보간 (전력 도메인) 추가
- [x] 저주파 로그 픽셀 간격 > 빈 간격으로 발생하던 빈칸 제거

### psd.js v3.4 — 평균선 색상·굵기
- [x] Welch 평균선: `#00d2d3` (시안) → `rgba(255,255,255,0.9)` (흰색)
- [x] lineWidth: 2 → 1
- [x] 히트맵 전 구간에서 평균선 대비 보장

---

## hvsr.js 파일 모드 개선 (2026-04-08 완료)

### hvsr.js v2.1 — 스무딩 제거 + FILE_HOP 512→128
- [x] `_koSmooth()` (Konno-Ohmachi b=40) 삭제
- [x] `_maSmooth()` (±2-bin MA) 삭제
- [x] `_computeHvsr()`: 평균값 직접 반환 (스무딩 없음)
- [x] `KO_BW`, `SMOOTH_HALF`, `_useKO` 상수·변수 삭제 (65줄 감소)
- [x] `FILE_HOP`: 512 (50% 오버랩) → 128 (87.5% 오버랩)
- 이유: FILE_HOP=512 시 60초@100Hz → 10개 윈도우로 평균 자체가 노이즈;
  KO b=40은 저주파에서 대역폭이 좁아 오히려 각져 보임.
  hop=128으로 39개 윈도우 확보 → 스무딩 없이도 자연스럽게 부드러운 곡선

---

## Activity 3 PNG 내보내기 (2026-04-04 완료)

### export-image.js v1.0 + activity3/index.html + style.css
- [x] `assets/js/export-image.js` 신규 모듈 — `ImageExportModule.download(canvas, meta)`
- [x] 오프스크린 캔버스: 다크 헤더(56px) + 그래프 본체 합성, 최소 800px 폭 스케일 업
- [x] 헤더 1행: `STN-01  ·  Z-axis  ·  100 Hz` (스테이션·축·샘플레이트)
- [x] 헤더 2행: `PSD (Welch)  ·  2026-04-04T12:34:56Z  ·  0.1–50 Hz` (그래프종류·시각·주파수범위)
- [x] `canvas.toDataURL('image/png')` → `<a download>` 트리거
- [x] 파일명 형식: `seismo_{type}_{station}_{date}.png`
- [x] "↓ PNG" 버튼 8개 추가 (파형·스펙트로그램·PSD·HVSR × 센서/파일 모드)
- [x] PSD 패널: 기존 `.psd-controls` 행에 버튼 추가
- [x] 나머지 패널: `.export-row` 신규 div 추가
- [x] `style.css` `.export-row` 스타일 추가
- [x] `_fileMeta` 변수 추가 — CSV 메타데이터(`station_id` 등) 보존
- [x] `_buildExportMeta(graphType, mode)` 헬퍼 함수

---

## psd.js 학술 시각화 개선 (2026-04-04 완료)

### psd.js v2.3 → v3.1 — 다중 윈도우 누적 + Peterson 참조선 + X축 통일
- [x] 개별 윈도우 PSD 곡선 `_windows[]`에 누적 저장 → 반투명 빨간 선으로 렌더링
- [x] Welch 평균선(청록, lineWidth=2)과 2층 렌더링
- [x] 파일 모드 `FILE_HOP=512` (50% 오버랩) 적용 — 10분 CSV ≈ 117개 윈도우
- [x] Peterson (1993) NLNM/NHNM 참조선 내장 (SEIZMO 검증 계수)
- [x] "참조선 표시/숨기기" 토글 버튼 (센서·파일 패널 각각, 상태 동기화)
- [x] `setShowPeterson(bool)` API 공개
- [x] `F_MIN 0.1Hz → 0.2Hz` — HVSR과 X축 범위 통일
- [x] `.psd-controls` CSS 추가
- [x] cache busting: `psd.js?v=2.3 → v=3.0 → v=3.1`

---

## Cycle 3 학술 개선 + UX 추가 (2026-03-27 완료)

### hvsr.js v1.7 → v2.0 — SESAME 2004 준수 전면 개선
- [x] 평균 방식 교체: 파워 누적(_sumH2/_sumV2) → per-window H/V 비율 누적(_sumHV) (SESAME-correct)
- [x] 파일 모드 오버랩: HOP_SIZE=26(97.5%) → FILE_HOP=512(50%) — 통계적 독립성 확보
- [x] 파일 모드 스무딩: ±2-bin MA → Konno-Ohmachi(b=40) (_koSmooth 신규 구현)
- [x] 정상성 필터: Pass 1 RMS 계산 → 중앙값 기반 [0.5×, 2×] 범위 밖 윈도우 제거 (Pass 2)
- [x] f₀ 탐색 범위 확장: 1~10Hz → 0.2~20Hz
- [x] f₀ 임계값 강화: H/V ≥ 1.5 → 2.0
- [x] 표시 주파수 범위 확장: F_MIN 0.5Hz → 0.2Hz
- [x] cache busting: hvsr.js?v=1.7 → v=2.0

### activity3/index.html — 분석 설명 모달 추가
- [x] 분석 탭 우측 `?` 버튼 추가 (센서·파일 모드 각 1개, `.analysis-info-btn`)
- [x] 스펙트로그램·PSD·HVSR 설명 모달 3개 추가 (`#modal-spectro`, `#modal-psd`, `#modal-hvsr`)
- [x] `_openInfoModal(activeTab)` — 활성 탭에 맞는 모달 자동 선택
- [x] 배경 클릭·닫기 버튼으로 모달 닫기
- [x] style.css `.analysis-info-btn` 스타일 추가

### activity3/index.html — 파일 모드 절대 시각 표시
- [x] `_fileStartTime` 상태 변수 추가 (rows[0].timestamp epoch ms, 0 if unavailable)
- [x] `fmtAbsTime(sec)` 헬퍼 추가 — `_fileStartTime + sec×1000` 기반 HH:MM:SS 포맷
- [x] `_drawFileWave()` X축 레이블: 상대 시간 → `fmtAbsTime(t)` 절대 시각
- [x] `_updateSelInfo()` 구간 안내문: 상대 시간 → 절대 시각
- [x] `loadFile()` Stage 1, `filePlayBtn` 완료 블록에서 `_fileStartTime` 설정
- [x] `fileResetBtn` 핸들러에서 `_fileStartTime = 0` 초기화
- [x] timestamp 없는 CSV → `fmtTime()` 폴백으로 하위 호환

### 버그 수정 (2026-03-27)
- [x] `switchTab('file')` 누락된 `_detachWaveEvents()` 호출 추가 — 센서 리뷰 중 파일 탭 전환 시 이벤트 리스너 누수 해결

---

## Cycle 3 추가 QA 개선 (2026-03-26 완료)

### index.html (root) — NTP 시계 동기화 저장 기능
- [x] 시계 동기화 확인 모달 추가 (ntpBtn → 서버 시간 비교)
- [x] "동기화 저장" 버튼 — offset을 localStorage(`ntp_offset_ms`, `ntp_synced_at`)에 저장
- [x] 저장 후 footer 버튼 텍스트에 ✅ 표시 (_updateFooterBadge)
- [x] 저장된 동기화 상태 표시 (.sync-status — 저장일시 + offset ms)
- [x] sensor.js NTP offset 자동 적용 (측정 시작 시 타임스탬프 보정)

### spectrogram.js v3.1 — 스펙트로그램 포화 해소
- [x] LOG 범위 확장: LOG_MIN=-3→-5, LOG_MAX=-1→0 (5 디케이드, 0.00001~1.0 m/s²)
- [x] 일반 손떨림 수준 신호도 부분 포화 없이 표시

### spectrogram.js v3.2 — Seismic jet 컬러맵
- [x] Viridis-style LUT → Seismic-style jet LUT (7 stops)
- [x] 검정(무신호) → 파랑 → 시안 → 녹색 → 노랑 → 주황 → 빨강(최대)
- [x] 지진학 표준 (ObsPy, MATLAB seismic toolbox 동일 계열)

### psd.js v2.3 — Y축 오토스케일
- [x] `_dispDbMax` 상태 변수 추가 (sticky: 데이터 최대값 기반 상향 갱신만)
- [x] `dispMax = _dispDbMax`, `dispMin = dispMax - 100` (항상 100 dB 범위)
- [x] 강한 신호가 뷰 밖으로 나가지 않도록 자동 조정
- [x] `reset()`에 `_dispDbMax = DB_MAX` 추가

### hvsr.js v1.3 → v1.4 — Y축 오토스케일 + HV_MAX 제거
- [x] `HV_MAX = 10` 고정 상수 제거
- [x] `_hvDispMax` 상태 변수 추가 (최솟값 4, 데이터 기반 상향 갱신)
- [x] H/V > 10 인 강한 공진도 클리핑 없이 표시
- [x] `reset()`에 `_hvDispMax = 4` 추가

### activity3/index.html — 정지 후 인터랙션 개선
- [x] 스펙트로그램 정지 후 스크롤 버그 수정: 초기 뷰 30초→10초 (팬 공간 확보)
- [x] 센서 모드 정지 후 파형 리뷰 추가: `_sensorSnapshot`, `_drawSensorWave()`, `_attachWaveEvents(canvasEl)`
- [x] 정지 후 스펙트로그램+파형 동기 드래그·핀치 가능
- [x] 상태 메시지: "측정 정지됨. 드래그·핀치로 파형과 스펙트로그램을 탐색하세요."

---

## Cycle 3 재구성 — 스펙트로그램·PSD·HVSR 3분석 모드 (2026-03-23 완료)

### spectrogram.js v3.0 — 가로 워터폴 전면 재구성
- [x] 레이아웃 변경: 수직(Y=시간) → 수평(X=시간, Y=주파수) ObsPy 표준
- [x] colData 기반 히스토리 저장 (Uint8ClampedArray DH×4 per frame)
- [x] 오프스크린 1×DH 캔버스 + drawImage로 효율적 컬럼 스케일링
- [x] 왼쪽 주파수 축(FREQ_AXIS_W=30px), 아래 시간 축(TIME_AXIS_H=12px)
- [x] 리뷰 모드: setView(offset, cols) — 수평 팬/핀치 탐색

### psd.js v2.2 — Welch PSD 모듈 (신규 + 수정)
- [x] v1.0: 신규 구현 — Welch rolling average(N_AVG=16), 로그 X축(0.5~50Hz), dB Y축(-120~-20)
- [x] v2.0: DC offset 제거(per-window mean subtraction), Hann 에너지 보정(÷sum_w2), 단측 ×2, FFT_SIZE 256→1024, F_MIN 0.5→0.1Hz
- [x] v2.1: 롤링 평균(N_AVG=16) → 전체 누적 평균(_sumPow, _nWin)으로 변경
- [x] v2.2: computeFromRows() _powerBuf ReferenceError 수정

### hvsr.js v1.2 — Nakamura HVSR 모듈 (신규 + 수정)
- [x] v1.0: 신규 구현 — Nakamura(1989) HVSR = H/V, 3축 누적 평균, ±2-bin 스무딩, f₀ 탐지, 신뢰도 경고
- [x] v1.1: DC offset 제거 (_accumulateWindow + computeFromRows 양쪽)
- [x] v1.2: F_MAX 20Hz → 50Hz (Nyquist 한계까지 표시)

### activity3/index.html — 3분석 탭 UI 재구성 + 파일 모드 재설계
- [x] 분석 탭: 스펙트로그램 / PSD / HVSR (센서·파일 모드 공통)
- [x] 센서 모드: 3모듈 동시 실시간 업데이트
- [x] 리뷰 모드: 수평 드래그·핀치 — _reviewCanvas 변수로 캔버스 동적 참조
- [x] 파일 모드: 분석 완료 후 파형(#fileWaveChart) 표시
- [x] 파일 모드: 파형을 주 조작면으로 지정 — 드래그·핀치로 _reviewOffset/_reviewCols 제어
- [x] 파일 모드: 스펙트로그램은 passive display — _syncWave()로 파형 뷰포트 추종
- [x] 파일 모드: 분석 시작 시 3모듈 일괄 계산 (PSD·HVSR computeFromRows)
- [x] Z전용 CSV → HVSR 탭 disabled 처리
- [x] 숨겨진 캔버스 lazy init (show briefly 방식)

### style.css — .analysis-tabs 스타일 + 패널 레이아웃 추가
- [x] .analysis-tabs, .analysis-tabs__btn, --active, :disabled
- [x] #panel-sensor, #panel-file: flex:1, flex-direction:column — activity-main 잔여 공간 점유
- [x] #drop-zone: flex:1, min-height:30vh — 파일 로드 전후 레이아웃 일관성 확보

---

## Cycle 3 작업 목록 (초기 구현)

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
- [x] PC Chrome 드래그 앤 드롭 테스트
- [x] Android Chrome 테스트 (센서 모드 + 파일 선택) — 정밀도 한계 확인 (Chrome 정책)
- [x] Android Firefox 테스트 (센서 모드) — 9자리 정밀도 확인 ✅ → Android 권장 브라우저로 변경
- [x] iOS Safari 테스트 — 9자리 정밀도 확인 ✅
- [x] GitHub Pages 배포

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

## Cycle 3 QA 개선 (2026-03-11 완료)

- [x] **Issue 2** : PC 레이아웃 최적화 — `style.css` 768px+ 미디어 쿼리 추가
- [x] **Issue 3** : index.html 모달 브라우저 안내 수정 (Android: Firefox 명시)
- [x] **Issue 4** : Firefox Android GPS timeout 20초 / maximumAge 300초 (`gps.js`)
- [x] **Issue 5** : 캘리브레이션 진행률 표시 — `(state, arg1, arg2)` 콜백으로 통일 (activity1/2/3)
- [x] **Issue 6** : 가속도 수치 소수점 6자리 표시 — `toFixed(6)` (`visual.js`)
- [x] **Issue 7** : 스펙트로그램 워터폴 — 위→아래 스크롤, MAX_FREQ=100Hz, 히스토리 기반 재렌더
- [x] **Issue 8** : 파형 시간 축 레이블 — 2초 간격 경과 시간 표시 (`visual.js`)
- [x] 스펙트로그램 시간 레이블 wall-clock 기반으로 변경 (Firefox Android interval 오보고 대응)
- [x] Firefox Android `_sr` 오인식 버그 수정 — 50~250Hz 범위 필터 (`activity3/index.html`)

### 알려진 미해결 이슈
- [ ] 스펙트로그램 센서 모드 시간 스케일 미세 조정 (추후 개선 예정)

---

## Activity 1 추가 개선 (2026-03-22 완료)

- [x] MMI 진도 안내 모달 — 버튼 클릭 시 KMA 수정 메르칼리 진도 표 팝업 (lazy 빌드)
- [x] MMI 기반 배경색 — HSL 선형 매핑 → KMA MMI 고정 색상으로 교체
- [x] **KMA 2018 MMI 기준 전면 교체** — 기존 출처 불명 값 → 기상청 2018.11.28 고시 기준 (1%g = 0.0981 m/s²), 11단계(I~XI+)
- [x] **진도 안내 모달 설명 문구** — 단순 명칭 → KMA 공식 설명 문구 전체 교체
- [x] **실시간 진도 표시 간소화** — "진도 IV 경진" → "진도 IV"만 표시, 폰트 크고 굵게
- [x] 실시간/고정 토글 스위치 — 버튼 위 독립 행으로 이동·가운데 정렬, 피크 MMI 고정/실시간 전환
- [x] **고정 모드 버그 수정** — 새 피크 발생 시 화면 미갱신 버그 수정 (isNewPeak 분기 추가)
- [x] 리뷰 모드 — 측정 정지 후 전체 파형 드래그 탐색, 1초 중앙 구간 진도 표시
- [x] **리뷰 시작 위치** — 마지막 데이터 → 처음 1초 구간에서 시작하도록 변경
- [x] **리뷰 구간 관측 시각 표시** — 캔버스 하단에 "관측 시간" 레이블 + HH:MM:SS.mmm (bold)
- [x] 구간 시간 표시 제거 — "구간: 0.0s ~ 1.0s" 텍스트 삭제
- [x] startBtn 먹통 버그 수정 — 캐시 버스팅(v=4.1) + MMI 테이블 lazy 빌드
- [x] 비대칭 EMA → 300ms 슬라이딩 윈도우 PGA 교체 (지진학적 정확도 개선)
- [x] 3초 워밍업 딜레이 — 터치 진동이 캘리브레이션에 포함되는 오차 제거 (activity1~3 공통)
- [x] activity1 sensor.js 캐시 버전 v4.1 → v4.2 갱신

---

## 완료된 작업
- **Cycle 3 후속 수정 완료 (2026-03-23)**
  - psd.js v2.2: Welch 정규화 보정(DC offset, Hann 에너지 보상, FFT_SIZE 1024), 누적 평균, computeFromRows 버그 수정
  - hvsr.js v1.2: DC offset 제거, F_MAX 20→50Hz 확장
  - activity3 파일 모드: 파형 표시 추가, 파형-primary 드래그·핀치 재설계, _reviewCanvas 동적 참조
  - style.css: #panel-sensor/#panel-file flex:1, #drop-zone flex:1+min-height:30vh
- **Cycle 3 재구성 완료 (2026-03-23)**
  - Activity 3: 스펙트로그램·PSD·HVSR 3분석 모드 재구성
  - spectrogram.js v3.0: 가로 워터폴 전면 재작성
  - psd.js v1.0: Welch PSD 신규 모듈
  - hvsr.js v1.0: Nakamura HVSR 신규 모듈 (정희옥 외 2010 참고)
- Cycle 3 전체 완료 (2026-03-10)
  - Activity 3: 주파수 분석 스펙트로그램 (실시간 FFT + CSV 파일 재생)
  - sensor.js 정밀도 개선: 3단계 폴백, CALIB_SAMPLES=100, performance.now() 타임스탬프, toFixed(9)
  - Android Firefox 검증: 9자리 정밀도 확인 → Android 권장 브라우저 Firefox로 변경
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
- **Android 권장 브라우저: Firefox** — Chrome은 `RoundSensorReading()` 정책으로 0.01~0.1 m/s² 정밀도 한계
  - sensor.js는 3단계 폴백 자동 처리: `LinearAccelerationSensor` → `Accelerometer` → `DeviceMotionEvent`
  - Firefox Android는 Generic Sensor API 미지원 → `DeviceMotionEvent` 경로 사용, 9자리 정밀도
- 측정 시작 후 3초 워밍업 구간에는 기기를 움직이지 않는 것이 권장 (워밍업 종료 후 캘리브레이션 시작)
- GPS 정밀도는 기기/환경에 따라 수 미터 ~ 수십 미터 오차 발생 가능
- iOS GPS: enableHighAccuracy=true는 GPS 하드웨어 강제 사용 → 실내에서 타임아웃 발생
  → enableHighAccuracy=false(WiFi/셀 위치)로 변경, 2~3초 내 응답, 정확도 10~100m (관측소 위치 기록 용도로 충분)
