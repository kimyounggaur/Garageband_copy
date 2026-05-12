# 클라우드 서버 스키마

웹밴드 스튜디오는 실제 서버로 **Supabase**를 우선 사용합니다. 브라우저 앱에서 인증, PostgREST, Storage를 바로 사용할 수 있고, 기존 repository abstraction을 유지한 채 로컬/모의/서버 저장소를 같은 UI에서 전환할 수 있습니다.

## 환경 변수

`.env.local`에 아래 값을 설정합니다.

```bash
VITE_SUPABASE_URL=https://프로젝트-ref.supabase.co
VITE_SUPABASE_ANON_KEY=Supabase anon public key
VITE_SUPABASE_AUDIO_BUCKET=audio-assets
```

Supabase Storage에는 `audio-assets` 버킷을 생성합니다. 수업 MVP 검증은 공개 버킷으로 시작할 수 있지만, 실제 운영 전에는 RLS 정책을 켜서 로그인 사용자만 접근하도록 바꿉니다.

## 데이터베이스 생성 SQL

Supabase SQL Editor에서 실행합니다.

```sql
create table if not exists teachers (
  id uuid primary key,
  name text not null,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key,
  name text not null,
  student_code text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key,
  title text not null,
  code text not null unique,
  description text,
  teacher_id uuid references teachers(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists enrollments (
  id uuid primary key,
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  joined_at timestamptz default now()
);

create table if not exists lessons (
  id uuid primary key,
  title text not null,
  goal text,
  difficulty text,
  estimated_minutes integer,
  template_project jsonb not null,
  missions jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '{"criteria":[]}'::jsonb,
  custom boolean default true,
  author_id uuid references teachers(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists assignments (
  id uuid primary key,
  title text not null,
  description text,
  lesson_id uuid references lessons(id) on delete set null,
  class_id uuid references classes(id) on delete set null,
  teacher_id uuid references teachers(id) on delete set null,
  assigned_student_ids jsonb not null default '[]'::jsonb,
  due_date timestamptz,
  rubric jsonb not null default '{"criteria":[]}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key,
  owner_id uuid references auth.users(id) on delete set null,
  class_id uuid references classes(id) on delete set null,
  student_id uuid references students(id) on delete set null,
  assignment_id uuid references assignments(id) on delete set null,
  lesson_id uuid references lessons(id) on delete set null,
  name text not null,
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists audio_assets (
  id uuid primary key,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  mime_type text,
  duration_seconds numeric,
  storage_path text not null,
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key,
  assignment_id uuid references assignments(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  student_id uuid references students(id) on delete set null,
  student_name text,
  project_id uuid references projects(id) on delete set null,
  status text,
  attempt_number integer,
  review_snapshot jsonb not null,
  package_file_names jsonb not null default '[]'::jsonb,
  wav_export_name text,
  teacher_feedback text,
  teacher_feedback_updated_at timestamptz,
  submitted_at timestamptz default now()
);

create index if not exists projects_updated_at_idx on projects(updated_at desc);
create index if not exists projects_owner_id_idx on projects(owner_id);
create index if not exists audio_assets_project_id_idx on audio_assets(project_id);
create index if not exists assignments_class_id_idx on assignments(class_id);
create index if not exists submissions_assignment_id_idx on submissions(assignment_id);
create index if not exists enrollments_class_id_idx on enrollments(class_id);
```

## 인증과 역할

Supabase Auth 이메일/비밀번호 로그인을 사용합니다. 앱은 가입 시 `user_metadata.role`에 `student` 또는 `teacher`를 저장하고, 클라이언트에서는 이 값을 기준으로 학생/교사 흐름을 구분합니다.

초기 MVP에서는 빠른 검증을 위해 테이블 RLS를 끈 상태로 시작할 수 있습니다. 실제 운영 전에는 RLS를 켜고 다음 정책을 추가합니다.

- 학생은 본인의 프로젝트와 제출물을 생성/조회할 수 있습니다.
- 교사는 본인이 만든 반, 과제, 레슨, 해당 반의 제출물을 조회/수정할 수 있습니다.
- 오디오 파일은 해당 프로젝트 소유자 또는 담당 교사만 접근할 수 있습니다.

## 앱 연결 구조

앱의 `서버` 저장소 모드는 `src/repositories/supabaseRepositories.ts`를 통해 아래 Supabase 실제 엔드포인트에 연결됩니다.

- 인증: `/auth/v1/signup`, `/auth/v1/token?grant_type=password`
- 데이터: `/rest/v1/projects`, `/rest/v1/classes`, `/rest/v1/students`, `/rest/v1/teachers`, `/rest/v1/enrollments`, `/rest/v1/lessons`, `/rest/v1/assignments`, `/rest/v1/submissions`, `/rest/v1/audio_assets`
- 오디오 Blob: `/storage/v1/object/audio-assets/{projectId}/{assetId}`

기존 `Api*Repository`는 Node/PostgreSQL 같은 별도 REST 서버를 붙일 때 사용할 수 있도록 유지합니다. 실제 Supabase 연결은 PostgREST/Storage 규칙에 맞춘 `Supabase*Repository`가 담당합니다.

## 실패 처리 원칙

- 서버 환경 변수가 없으면 `서버` 저장소 버튼을 비활성화합니다.
- 서버 요청이 실패해도 로컬 저장소가 계속 동작해야 합니다.
- 오디오 Blob은 DB에 직접 넣지 않고 Storage에 업로드하며, DB에는 `storage_path`와 메타데이터만 저장합니다.
- 운영 전에는 백업/내보내기 흐름을 유지해 수업 중 네트워크 장애가 있어도 프로젝트를 잃지 않게 합니다.
