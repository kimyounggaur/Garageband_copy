# 클라우드/서버 스키마 초안

실제 서버는 Supabase 또는 Node/PostgreSQL 중 하나로 붙일 수 있습니다. 프론트엔드는 `src/db/repositories.ts`의 repository 인터페이스만 바라보도록 유지합니다.

## 권장 테이블

### teachers

- `id` uuid primary key
- `name` text not null
- `email` text
- `created_at` timestamptz
- `updated_at` timestamptz

### students

- `id` uuid primary key
- `name` text not null
- `student_code` text
- `email` text
- `created_at` timestamptz
- `updated_at` timestamptz

### classes

- `id` uuid primary key
- `title` text not null
- `code` text not null unique
- `description` text
- `teacher_id` uuid references teachers(id)
- `created_at` timestamptz
- `updated_at` timestamptz

### enrollments

- `id` uuid primary key
- `class_id` uuid references classes(id)
- `student_id` uuid references students(id)
- `joined_at` timestamptz

### lessons

- `id` uuid primary key
- `title` text not null
- `goal` text
- `difficulty` text
- `estimated_minutes` integer
- `template_project` jsonb not null
- `missions` jsonb not null
- `rubric` jsonb not null
- `custom` boolean default true
- `author_id` uuid references teachers(id)
- `created_at` timestamptz
- `updated_at` timestamptz

### assignments

- `id` uuid primary key
- `title` text not null
- `description` text
- `lesson_id` uuid
- `class_id` uuid references classes(id)
- `teacher_id` uuid references teachers(id)
- `assigned_student_ids` jsonb
- `due_date` timestamptz
- `rubric` jsonb not null
- `created_at` timestamptz
- `updated_at` timestamptz

### projects

- `id` uuid primary key
- `owner_id` uuid
- `class_id` uuid references classes(id)
- `student_id` uuid references students(id)
- `assignment_id` uuid references assignments(id)
- `lesson_id` uuid
- `name` text not null
- `payload` jsonb not null
- `created_at` timestamptz
- `updated_at` timestamptz

### audio_assets

- `id` uuid primary key
- `project_id` uuid references projects(id)
- `name` text not null
- `mime_type` text
- `duration_seconds` numeric
- `storage_path` text not null
- `created_at` timestamptz

### submissions

- `id` uuid primary key
- `assignment_id` uuid references assignments(id)
- `class_id` uuid references classes(id)
- `student_id` uuid references students(id)
- `student_name` text
- `project_id` uuid references projects(id)
- `status` text
- `attempt_number` integer
- `review_snapshot` jsonb not null
- `package_file_names` jsonb
- `wav_export_name` text
- `teacher_feedback` text
- `teacher_feedback_updated_at` timestamptz
- `submitted_at` timestamptz

## API 엔드포인트

- `GET /projects`, `PUT /projects`, `GET /projects/:id`, `DELETE /projects/:id`
- `GET /audio-assets/:id`, `PUT /audio-assets`, `GET /projects/:id/audio-assets`
- `GET /classes`, `PUT /classes`, `GET /classes/:id`, `DELETE /classes/:id`
- `GET /students`, `PUT /students`, `GET /students/:id`, `DELETE /students/:id`
- `GET /teachers`, `PUT /teachers`, `GET /teachers/:id`, `DELETE /teachers/:id`
- `GET /enrollments`, `PUT /enrollments`, `DELETE /enrollments/:id`
- `GET /lessons`, `PUT /lessons`, `GET /lessons/:id`, `DELETE /lessons/:id`
- `GET /assignments`, `PUT /assignments`, `GET /assignments/:id`, `DELETE /assignments/:id`
- `GET /submissions`, `PUT /submissions`, `PATCH /submissions/:id/feedback`

## 실패 처리 원칙

- 네트워크 실패는 앱 전체 오류로 번지지 않게 패널 단위 오류로 표시합니다.
- 프로젝트 편집 중 저장 실패가 나면 로컬 저장소에 임시 백업하는 흐름을 추가합니다.
- 오디오 Blob은 DB에 직접 넣기보다 object storage에 업로드하고 metadata만 DB에 둡니다.
