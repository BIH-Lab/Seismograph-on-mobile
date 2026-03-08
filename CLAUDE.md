# CLAUDE.md
> Claude Code가 이 프로젝트를 열면 가장 먼저 읽는 파일입니다.

## 프로젝트 개요
스마트폰 브라우저의 가속도 센서(DeviceMotionEvent)를 활용하여
실시간 지진동 데이터를 수집하고, 다중 사용자가 웹에서 시각화·분석·다운로드할 수 있는
연구용 웹 플랫폼입니다.

석사학위논문 연구 결과물로 제작되며, 나선형 개발 방법론(Boehm, 1986)을 따릅니다.

## 기술 스택
- Frontend : React (Vite 기반)
- Backend  : Python FastAPI
- Database : PostgreSQL
- 배포      : Railway (백엔드), Vercel (프론트엔드)
- 센서 API  : DeviceMotionEvent (Web API)
- 시각화    : Chart.js

## 폴더 구조
```
project-root/
├── frontend/
│   ├── src/
│   │   ├── pages/         # 페이지 컴포넌트
│   │   ├── components/    # 공통 UI 컴포넌트
│   │   ├── hooks/         # 커스텀 훅 (센서, API 호출 등)
│   │   └── utils/         # CSV 변환 등 유틸
│   └── public/
├── backend/
│   ├── app/
│   │   ├── routers/       # API 엔드포인트
│   │   ├── models/        # DB 모델
│   │   ├── schemas/       # Pydantic 스키마
│   │   └── services/      # 비즈니스 로직
│   └── main.py
└── docs/                  # .md 문서 모음
```

## 코딩 컨벤션
- 언어      : 주석 및 변수명 영어, UI 텍스트 한국어
- 함수명    : camelCase (JS), snake_case (Python)
- 컴포넌트  : PascalCase
- 파일당 라인 수 : 300줄 이하 유지
- API 응답  : 항상 { success, data, message } 형태로 통일

## 주의사항
- iOS Safari에서 DeviceMotionEvent 사용 시 반드시 사용자 제스처 후 권한 요청 필요
- 센서 API는 반드시 HTTPS 환경에서만 동작 (localhost 제외)
- 데이터 전송 시 타임스탬프는 항상 ISO 8601 형식 사용
- 새 기능 추가 전 반드시 TASK.md 확인

## 현재 개발 단계
Cycle 1 (MVP) 진행 중 — TASK.md 참고