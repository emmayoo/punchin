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

## 환경 변수

프로젝트 루트에 `.env.local`을 만들고 아래 값을 채웁니다. (예시는 `.env.example` 참고)

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (브라우저·앱) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon(public) 키 (브라우저·앱) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 롤 키 (`pnpm storage:empty` 등 스크립트용, **클라이언트에 노출 금지**) |

두 `NEXT_PUBLIC_*` 값이 없으면 앱 화면 대신 Supabase 설정 안내가 표시됩니다.

## Supabase DB·Storage 초기 설정

스키마는 `supabase/` SQL 파일이 단일 소스입니다. Supabase 대시보드 **SQL Editor**에서 순서대로 실행합니다.

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 (선택) | `reset.sql` | `public` 테이블 전부 DROP — **기존 데이터 전부 삭제** |
| 2 | `schema.sql` | 테이블·인덱스·RLS·트리거 |
| 3 | `storage.sql` | `media` 버킷·Storage 정책 |

Storage 파일까지 비우려면 스키마 반영 전후로:

```bash
pnpm storage:empty
```

(`.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 필요)

데이터만 비우고 구조는 유지할 때는 `truncate.sql`을 사용합니다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local   # 값을 채운 뒤
pnpm dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 스크립트

- `pnpm dev` - 개발 서버 실행
- `pnpm build` - 프로덕션 빌드
- `pnpm start` - 빌드 결과 실행
- `pnpm lint` - 린트 실행
- `pnpm storage:empty` - `media` 버킷 객체 전부 삭제 (서비스 롤 키 필요)

## 데이터 저장 방식

앱 데이터는 **Supabase**(PostgreSQL + Auth + Storage)에 저장됩니다.

## 배포

- 권장: Vercel + Supabase
- 배포 전 필수 점검:
  - PWA 아이콘/manifest 설정 확인
  - 서비스워커 업데이트 전략 확인
  - 환경변수/보안 정책(RLS) 적용
