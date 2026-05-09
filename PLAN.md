# 교육용 웹 음악 제작 스튜디오 장기 발전 설계

## Summary
현재 앱은 루프 기반 Web DAW MVP입니다. 앞으로는 “전문가용 DAW 복제”보다 **초보자와 학생이 음악을 만들며 배우는 교육용 창작툴**로 발전시키는 것이 가장 적합합니다. 목표 제품은 브라우저에서 바로 열어 루프 배치, 피아노롤, 녹음, 과제 수행, 피드백, 공유까지 할 수 있는 **음악 수업용 WebBand Studio**입니다.

장기 로드맵은 3~6개월 기준으로 잡습니다.

1. **Studio 안정화**: 현재 편집기 완성도, 반응형, Undo/Redo, 프로젝트 버전 관리
2. **Lesson Mode**: 단계별 미션, 템플릿, 음악 이론 힌트, 완료 체크
3. **Recording & Sampler**: 마이크 녹음, 샘플 업로드, 간단한 오디오 편집
4. **Education Layer**: 과제 제출, 루브릭, 학생/교사용 보기
5. **Creative Assist**: 코드 진행 추천, 드럼 패턴 제안, 자동 피드백

## Key Changes
- 현재 `Project`, `Track`, `Clip`, `MidiNote` 타입에 교육용 메타데이터를 추가합니다.
  - `Project.lessonId?: string`
  - `Project.assignmentId?: string`
  - `Project.version: number`
  - `Clip.locked?: boolean`
  - `Clip.instructions?: string`
  - `Track.role?: "beat" | "bass" | "melody" | "harmony" | "recording"`
- 새 도메인 모델을 추가합니다.
  - `Lesson`: 제목, 목표, 난이도, 템플릿 프로젝트, 단계별 미션
  - `Mission`: 설명, 검사 조건, 힌트, 완료 상태
  - `Rubric`: 리듬, 멜로디, 구조, 창의성 평가 기준
- 화면은 기존 DAW 화면을 유지하되 상단에 모드 전환을 추가합니다.
  - `Studio`: 자유 편집
  - `Lesson`: 단계별 안내와 잠금/힌트
  - `Review`: 제출 전 체크와 피드백
- 저장은 당분간 IndexedDB 유지, 스키마 버전 필드를 추가합니다.
- 클라우드/교사용 대시보드는 v2에서 Supabase 또는 Node/PostgreSQL로 추가합니다.

## Implementation Plan
- 1단계: 편집기 기반 강화
  - Undo/Redo 히스토리 추가
  - 프로젝트 이름 변경, Duplicate, Template에서 시작 기능 추가
  - 클립 겹침 방지 옵션, 마디 스냅 옵션, 확대/축소 추가
  - GitHub Pages 배포 흐름은 유지

- 2단계: Lesson Mode
  - `src/education` 모듈 추가
  - 기본 레슨 5개 제공: 드럼 만들기, 베이스 추가, 멜로디 만들기, A/B 구조 만들기, 녹음 추가
  - 레슨 선택 시 템플릿 프로젝트를 생성
  - 미션 조건 예: “드럼 트랙에 8마디 이상 클립 배치”, “멜로디 노트 6개 이상 입력”
  - 완료 상태를 프로젝트와 함께 저장

- 3단계: Recording & Sampler
  - `MediaRecorder` 기반 마이크 녹음 추가
  - 녹음 파일을 IndexedDB Blob으로 저장
  - 오디오 클립 파형 표시
  - Trim, split, normalize, fade in/out은 최소 기능으로 구현
  - Export WAV에 녹음 클립 포함

- 4단계: 교육용 피드백
  - Review 패널에서 루브릭 체크 표시
  - 자동 피드백은 규칙 기반으로 먼저 구현
  - 예: 빈 트랙 경고, 너무 짧은 곡 경고, 드럼/베이스/멜로디 균형 체크
  - 제출용 `.webband.json` export와 WAV export 제공

- 5단계: AI 창작 보조
  - 코드 진행 추천
  - 드럼 패턴 생성
  - 멜로디 이어쓰기
  - “왜 이렇게 들리는지” 설명하는 학습 피드백
  - AI 기능은 핵심 저장/재생 구조와 분리된 `src/assist` 모듈로 구현

## Test Plan
- `npm run build`가 항상 통과해야 합니다.
- 브라우저에서 확인할 핵심 시나리오:
  - 새 레슨 시작 → 미션 표시 → 클립 추가 → 미션 완료
  - MIDI 노트 추가/이동/삭제 → 저장 후 새로고침 복원
  - 마이크 녹음 → 오디오 클립 생성 → WAV export
  - 학생용 Review에서 부족한 항목 표시
  - GitHub Pages 배포 URL에서 앱 정상 로드
- 데이터 호환성:
  - 기존 프로젝트는 `version`이 없어도 자동으로 현재 스키마로 보정
  - 저장된 기존 IndexedDB 프로젝트가 깨지지 않아야 함

## Vibe Coding Prompt
```text
너는 시니어 프론트엔드 엔지니어이자 Web Audio API, 음악 교육 UX, React/TypeScript 아키텍처에 능숙한 개발자다.

현재 프로젝트는 React + TypeScript + Vite + Tailwind + Zustand + Tone.js + Dexie 기반의 WebBand Studio다. 이미 트랙, 클립, 루프 라이브러리, 피아노롤, 로컬 저장, WAV export, GitHub Pages 배포가 구현되어 있다.

이 앱을 전문가용 DAW 복제가 아니라 “교육용 웹 음악 제작 스튜디오”로 발전시켜라. 목표 사용자는 음악을 처음 배우는 학생, 교사, 음악학원이다. 첫 화면은 계속 실제 편집기여야 하며, 랜딩 페이지를 만들지 마라.

핵심 방향:
1. Studio Mode: 자유롭게 음악을 만드는 기존 DAW 화면
2. Lesson Mode: 단계별 미션, 힌트, 잠금된 템플릿 클립, 완료 체크
3. Review Mode: 제출 전 자동 점검과 교육용 피드백
4. Recording: 마이크 녹음과 오디오 클립 편집
5. Assist: 이후 코드/드럼/멜로디 추천을 붙일 수 있는 독립 모듈

먼저 기존 타입과 상태 구조를 보존하면서 확장해라.
- Project에 version, lessonId, assignmentId를 추가
- Clip에 locked, instructions를 추가
- Track에 role을 추가
- Lesson, Mission, Rubric 타입을 새로 정의
- 기존 저장 프로젝트가 깨지지 않도록 마이그레이션/보정 함수를 만든다

구현 순서:
1. src/education에 Lesson, Mission, Rubric 타입과 기본 레슨 데이터 5개 추가
2. LessonPanel 컴포넌트를 만들어 현재 미션, 힌트, 완료 상태를 보여준다
3. AppShell에 Studio/Lesson/Review 모드 전환을 추가한다
4. 레슨 시작 시 템플릿 Project를 생성하고 Zustand store에 로드한다
5. 프로젝트 상태를 분석해서 미션 완료 여부를 계산하는 evaluateMission 함수를 만든다
6. ReviewPanel에서 곡 길이, 트랙 구성, 빈 트랙, 미완료 미션을 표시한다
7. 기존 IndexedDB 저장/불러오기와 호환되게 한다
8. npm run build를 통과시킨다

UI 원칙:
- 전문 DAW처럼 밀도 있고 실용적인 화면을 유지한다
- 교육용 안내는 편집을 방해하지 않는 오른쪽/하단 패널로 제공한다
- 카드 남발, 마케팅 히어로, 설명 페이지를 만들지 않는다
- 모든 주요 컨트롤은 실제 작동해야 한다
- GitHub Pages에서도 정상 작동해야 한다

완료 기준:
- 사용자가 레슨을 선택해 새 프로젝트를 시작할 수 있다
- 미션 완료 상태가 프로젝트 변경에 따라 즉시 갱신된다
- 기존 자유 편집 기능은 깨지지 않는다
- 저장 후 새로고침해도 레슨 상태가 복원된다
- Review Mode에서 제출 전 피드백을 볼 수 있다
- npm run build가 성공한다
```

## Follow-up Prompts
```text
1단계로 교육용 데이터 모델을 추가해줘. 기존 Project/Track/Clip 타입과 IndexedDB 저장 프로젝트가 깨지지 않게 versioned migration을 설계하고 구현해줘.
```

```text
2단계로 Lesson Mode를 구현해줘. 기본 레슨 5개, LessonPanel, 미션 완료 평가 함수, 레슨 템플릿 프로젝트 생성 기능을 추가해줘.
```

```text
3단계로 Review Mode를 구현해줘. 곡 길이, 트랙 구성, 미션 완료, 빈 트랙, 클립 부족 여부를 자동 점검하고 학생에게 짧은 피드백을 보여줘.
```

```text
4단계로 마이크 녹음 기능을 추가해줘. MediaRecorder로 녹음하고, 오디오 클립으로 타임라인에 배치하며, IndexedDB에 Blob을 저장하고, WAV export에도 포함해줘.
```

```text
5단계로 음악 이론 보조 기능을 추가해줘. 선택한 MIDI 클립의 노트를 분석해서 사용된 음, 반복 패턴, 음역, 간단한 개선 힌트를 Review Mode에 표시해줘.
```

## Assumptions
- 제품 방향은 교육용 창작툴로 고정합니다.
- 개발 범위는 3~6개월 장기 로드맵으로 잡습니다.
- 당장은 로그인/교사용 서버 없이 로컬 저장 기반으로 확장합니다.
- Apple GarageBand의 이름, UI, 샘플, 브랜드 자산은 사용하지 않습니다.
- AI 기능은 핵심 편집기 안정화 이후 선택 기능으로 붙입니다.
