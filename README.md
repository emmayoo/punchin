# Punchin

근무 체크인/체크아웃, 주간 스케줄 관리, 이력 조회, 기간 통계를 제공하는 PWA 기반 웹앱입니다.

## 기술 스택

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- PWA (`manifest.webmanifest`, `sw.js`)

## 주요 기능

- 인증/온보딩 흐름
- 대시보드: 오늘 근무/이벤트 요약
- 스케줄:
  - 주간 타임라인(월~일, 00:00~24:00)
  - 스케줄 추가/수정/삭제
  - 겹치는 근무 구간 분할 렌더링
  - 주간 스케줄 복사
  - 스케줄 영역 PNG 다운로드
  - 직원(이름/핸드폰/색상) 등록 및 수정/삭제
- 이력: 달력 및 일자 상세
- 통계:
  - 기간(시작일~종료일) 설정
  - 직원별 실제 근무시간 집계 (`HH:MM:SS`)
  - 직원 행 토글 시 상세 근무 내역 노출

## 로컬 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 스크립트

- `pnpm dev` - 개발 서버 실행
- `pnpm build` - 프로덕션 빌드
- `pnpm start` - 빌드 결과 실행
- `pnpm lint` - 린트 실행

## 현재 데이터 저장 방식

현재는 브라우저 `localStorage` 기반으로 동작합니다.  
다음 단계로 Supabase 연동 및 실제 배포 환경 전환을 계획하고 있습니다.

## 배포

- 권장: Vercel + Supabase
- 배포 전 필수 점검:
  - PWA 아이콘/manifest 설정 확인
  - 서비스워커 업데이트 전략 확인
  - 환경변수/보안 정책(RLS) 적용
