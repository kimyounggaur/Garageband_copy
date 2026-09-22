# 웹밴드 스튜디오 개선·보완 바이브코딩 프롬프트: 검증 기반 실행안

> 작성 기준: 2026-09-22 · 배포 URL: https://kimyounggaur.github.io/Garageband_copy/ · 저장소 기준 SHA: ceaafb52025f3fd06e03da76bc00522edd174cef
> 이 문서는 기존 설계서를 참고해 다시 작성한 개발 프롬프트 모음이다. 현재 앱의 구현·배포 완료 보고서가 아니다.

## 1. 증거를 구분해서 읽기

| 기준 | 확인한 내용 | 해석 |
|---|---|---|
| 배포 앱 | GitHub Pages가 HTTP 200으로 응답하고 index-809Cd5Fr.js, index-6C6OGl2m.css를 제공한다. 2026-09-22 인앱 브라우저 1280×720에서 직접 조작했다. | 아래의 재현 결과는 배포본에 대한 것이다. |
| 저장소 main | Project 스키마 버전은 12이고 재생·내보내기·교육·로컬 저장 경로가 존재한다. | 코드 근거는 확인한 SHA의 구조를 기준으로 한다. 실행 시 HEAD를 다시 확인해야 한다. |
| 현재 작업 트리 | 이전 작업에서 Vitest 테스트 43개, 오류 경계, 로거, CI, docs 정리가 커밋되지 않은 상태로 추가됐다. 중첩 미추적 Garageband/ 폴더도 있다. | 새 에이전트는 Phase 0을 중복 구현하거나 미추적 파일을 삭제하면 안 된다. 배포본에는 이 변경이 아직 반영되지 않았다. |

### 배포 앱 실사용 관찰

- 초기 화면은 편집기다. 기본 프로젝트에 3트랙과 루프·MIDI 클립이 있고 루프 브라우저에는 6개 항목이 보인다.
- 1280×720에서 헤더의 일부 조작이 서로 겹친다. 측정 예: Undo x211–243과 Student x192–272, LCD x298–446과 Teacher x276–356.
- 눈금자를 눌러 LCD가 002|1|120인 상태에서 Play를 누르면 001|1|140으로 돌아갔다. Pause를 누르면 001|1|000으로 돌아갔다.
- Share에서 MP3→Mix를 선택하면 MP3 인코딩이 없어서 WAV로 바꿨다는 영어 문구가 나온다.
- 기본 프로젝트 재생 직후 브라우저 콘솔에 “Start time must be strictly greater than previous start time” 오류가 한 차례 기록됐다. 발생 조건과 청각적 영향은 아직 분리 검증하지 못했다.
- 390×844 뷰포트 에뮬레이션에서 innerWidth는 390인데 문서 scrollWidth는 840이었다. 가로 넘침은 확인됐고 실제 태블릿·휴대전화의 시각 품질은 별도 확인이 필요하다.
- 루프 카테고리 필터와 추가, Undo, Drummer·MIDI 클립 생성, Lesson의 5개 기본 레슨, 교사·학생 보기의 주요 패널은 열리고 조작됐다. 오디오 녹음은 브라우저 권한·실제 마이크가 없어 완주 검증하지 못했다. 모바일 실기기 조작도 확인하지 못했다.

| 사용자 흐름 | 이번 확인 | 후속 시험이 필요한 부분 |
|---|---|---|
| 루프·편집 | Bass 필터는 6개 중 2개를 표시했고 루프 추가는 기존 클립 뒤 8박에 배치됐다. Undo, Drummer, 악기 트랙·MIDI 클립 생성은 동작했다. | 실제 청각 결과와 복잡한 프로젝트의 충돌·저장 복원 |
| 레슨·교사·학생 | 기본 레슨 5개와 미션/루브릭을 확인했다. 교사 보기에는 반·학생·과제·레슨 빌더·CSV, 학생 보기에는 과제·제출·창작 보조가 있다. | 레슨 시작이 현재 프로젝트를 교체하므로 저장 선택 UX, 실제 제출·재제출과 교사 평가 완주 |
| 라이브 루프·믹서 | Live Loops의 4개 씬과 믹서 조작을 확인했다. Smart 슬라이더는 방향키로 값이 변했다. | 오디오 트리거, 자동화·센드·내보내기 결과의 청각 일치 |
| 녹음·반응형 | 녹음 트랙 뒤 상단 Record를 눌러도 검사 브라우저에서는 권한 창이나 Ready 상태 변화가 없었다. 390px 에뮬레이션은 가로 넘침을 보였다. | 실제 마이크·모바일 실기기에서 권한, 캡처, 저장, WAV, 손가락 조작 |

### 코드에서 확정된 문제와 아직 가설인 문제

| 분류 | 내용 | 주요 파일 |
|---|---|---|
| 확정 | play()가 현재 beat를 받지 않고 Transport.position을 0 또는 반복 시작으로 설정한다. Pause 분기는 stop() 후 beat=0을 쓴다. | src/audio/AudioEngine.ts, src/components/layout/AppShell.tsx |
| 확정 | 오디오 클립은 clip.startBeat에만 예약돼 중간 탐색 시작에 별도 처리가 필요하다. | src/audio/AudioEngine.ts, src/audio/clipAudioMath.ts |
| 확정 | MP3 선택지가 있지만 내보내기 결과는 WAV다. | src/components/layout/AppShell.tsx, src/audio/exportProject.ts |
| 확정 | 상단 Record는 녹음 상태와 재생을 켜고, 마이크 MediaRecorder는 RecorderPanel의 별도 버튼에서 시작한다. | src/components/transport/TransportBar.tsx, src/components/recording/RecorderPanel.tsx |
| 확정 | 녹음은 audio:true·기본 MediaRecorder·Date.now 길이를 사용한다. | src/components/recording/RecorderPanel.tsx |
| 측정 필요 | rAF beat/meter 갱신이 전체 화면 성능에 얼마나 영향을 주는지, 1초 디바운스 저장의 실제 비용과 저장 순서 역전 여부. | src/audio/AudioEngine.ts, src/components/layout/AppShell.tsx |

### 기존 설계서의 수정 사항

1. Stop 버튼은 이미 있다. 새로 추가하지 말고 상태 전이와 한국어 레이블을 고친다.
2. docs/index.html은 빌드가 덮어쓴다. 메타 태그는 원본 index.html에 추가한다.
3. docs/assets는 HTML의 직접 참조 두 개만 남기면 동적 import를 잃는다. dist/assets와 집합이 같아야 한다. 일반적인 파일 삭제만으로 Git pack 용량이 줄어드는 것도 아니다.
4. 200ms마다 React 상태에 기록하면서 8초 동안 커밋 10회 미만을 요구하지 않는다. 대상 컴포넌트와 측정 환경을 먼저 정한다.
5. beforeunload에서 비동기 IndexedDB 저장이 반드시 끝난다고 약속하지 않는다. [IndexedDB 문서](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [페이지 수명주기](https://developer.chrome.com/docs/web-platform/page-lifecycle-api/).
6. MediaRecorder.onstart 시각은 실제 마이크 입력 지연값이 아니다. 장치별 측정 없이 손뼉 정렬 20ms 이내를 합격 기준으로 삼지 않는다. [녹음 명세](https://www.w3.org/TR/mediastream-recording/).
7. lengthBeats는 4분음표 단위로 먼저 정의한다. 4/4 한 마디=4, 3/4 한 마디=3, 6/8 한 마디=3, 4/4의 12마디 블루스=48이다. 6/8 강박과 메트로놈은 별도로 확인한다.
8. WCAG 2.2 AA의 대상 크기 기준은 24×24 CSS px 또는 간격 예외이고, 44×44는 AAA다. 태블릿 주요 버튼에 44×44를 제품 목표로 둘 수 있다. [W3C AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [W3C AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).
9. Philharmonia 음원은 샘플 또는 샘플러 악기로 재배포할 수 없어 앱 샘플 팩 후보에서 제외한다. Freesound도 파일별 라이선스·출처·재배포 권한이 필요하다. [Philharmonia](https://philharmonia.co.uk/resources/sound-samples/), [Freesound](https://freesound.org/help/faq/).

## 2. 실행 방식

각 단계의 프롬프트에는 먼저 아래 공통 계약을 붙인다. 한 단계의 자동·수동 게이트를 기록한 뒤 다음 단계로 간다. 기존 사용자 데이터와 작업 중 변경을 보존한다. 시험하지 못한 마이크·Safari·모바일 결과를 “통과”라고 쓰지 않는다.

~~~text
[웹밴드 스튜디오 공통 작업 계약]
- 이 제품은 한국 초·중등 음악 수업용 웹 DAW다. 첫 화면은 실제 편집기다. Apple의 이름·화면·아이콘·샘플·브랜드 자산을 복제하지 않는다.
- 시작할 때 git status --short, git rev-parse HEAD, 관련 코드와 기존 테스트를 읽는다. 다른 사람이 만든 변경·미추적 파일을 보존하고 범위 밖 파일을 임의 정리하지 않는다.
- Project/Track/Clip/MidiNote의 기존 영속 필드를 삭제·이름 변경·의미 변경하지 않는다. 영속 스키마 변경 시 CURRENT_PROJECT_VERSION과 projectMigration.ts를 함께 바꾸고 과거 프로젝트 열기를 시험한다.
- 실시간 AudioEngine과 OfflineAudioContext 내보내기는 별도 경로다. 오디오 의미가 달라지면 두 경로를 검증한다.
- 새 사용자 문구는 한국어다. 예외를 조용히 삼키지 않고, 저장·가져오기·내보내기·녹음 실패는 복구 방법과 함께 표시한다.
- 새 의존성·음원이 필요하면 기존 대안, 번들·성능·라이선스 비용을 비교해 가장 작은 해법을 선택하고 이유를 보고한다. 출처 불명 음원은 추가하지 않는다.
- 단계가 끝나면 변경 파일, 수정 전/후 재현, 자동 시험, 브라우저·장치, 확인하지 못한 항목, 남은 위험, 배포 여부를 표로 보고한다. 실패한 게이트를 성공으로 쓰지 않는다.
~~~

공통 자동 게이트는 아래와 같다. 시작 시 스크립트 존재 여부를 확인한다.

~~~bash
npx tsc -b --noEmit
npm run test:run
npm run build
npm run qa:smoke
npm run qa:themes
npm run qa:shortcuts
npm run qa:manuals
~~~

공통 사용 게이트: 기존 IndexedDB 프로젝트 열기 → 루프 추가 → 재생·정지 → WAV 내보내기 → 새로고침 후 복원; 학생 과제 시작·제출과 교사 보기; 4개 테마; 데스크톱 1280×720과 태블릿 폭. 마이크·Safari·오프라인은 해당 환경이 있을 때만 합격으로 기록한다.

## 3. 단계별 프롬프트

### Phase 0 — 현행 기준선과 미커밋 안전망 확정

목적: 이미 시작된 테스트·오류 경계·CI 변경을 중복하지 않고, 후속 작업의 기준을 확정한다. 기능 동작은 바꾸지 않는다.

~~~text
너는 웹밴드 스튜디오의 회귀 방지 기반을 확정한다. 공통 작업 계약을 적용하라.

1. git status --short와 HEAD SHA를 기록하라. 현재 작업 트리의 Vitest, ErrorBoundary, logger, CI, docs/assets 변경을 확인하고 미추적 Garageband/와 첨부 문서를 건드리지 마라.
2. package.json, vitest.config.ts, tests/, src/components/system/ErrorBoundary.tsx, src/utils/logger.ts, .github/workflows/deploy-pages.yml, scripts/build.mjs를 읽어라. 이미 완료된 요구는 재구현하지 마라.
3. 배포 HTML 자산 해시와 로컬 빌드 해시를 기록하라. 로컬 수정이 라이브에 적용됐다고 추정하지 마라.
4. 7개 순수 모듈(timeline, projectMigration, clipAudioMath, controlMath, evaluateMission, automation, fx)의 테스트가 경계 입력과 저장 데이터 호환성을 다루는지 확인하라. 구현을 그대로 복사한 테스트만 있으면 개선하라.
5. ClipEditor, StudioPanel, 교육 패널의 렌더 오류가 각각 격리되는지 확인하라. 저장 프로젝트 복구 버튼과 최상위 오류 경계도 시험하라.
6. src의 빈 catch·무음 Promise catch를 검색하고 남은 곳만 로거 또는 사용자 오류로 연결하라.
7. docs/assets와 dist/assets의 파일명 집합을 비교하라. docs/manual·docs/samples·문서 파일은 보존하라. Git pack 크기 감소를 합격 조건으로 삼지 마라.
8. 공통 자동 게이트를 실행하라. 테스트용 렌더 throw로 트랜스포트·타임라인 유지 여부를 확인하고 임시 코드는 제거하라. 저장 프로젝트 백업 .webband.json으로 과거 데이터 열기를 시험하라.
9. 변경이 필요 없으면 “기준 충족, 코드 변경 없음”으로 보고하라. 확인하지 못한 브라우저 항목은 미검증으로 남겨라.
~~~

통과 기준: 자동 게이트, 저장 프로젝트 열기, 패널 오류 격리, docs/assets와 dist/assets 일치.

### Phase 1 — 재생 위치·일시정지·정지·탐색

목적: 배포본에서 재현된 핵심 DAW 결함을 수정한다. MP3 문제는 다음 단계로 분리한다.

~~~text
너는 Tone.js 트랜스포트와 오디오 클립 스케줄링을 고친다. 공통 작업 계약을 적용하라.

재현: 배포 앱에서 눈금자를 눌러 2마디 뒤로 이동한 다음 Play를 누르면 1마디로 돌아간다. Play→Pause도 되감긴다. 현재 소스에서 같은 증상을 먼저 재현하고 기록하라.

대상: src/audio/AudioEngine.ts, src/audio/clipAudioMath.ts, src/store/useDawStore.ts, src/components/layout/AppShell.tsx, src/components/transport/TransportBar.tsx, 관련 헬퍼·테스트. 기존 Stop 버튼을 재사용하라.

구현:
1. stopped/playing/paused를 일관되게 표현하는 재생 상태를 만들고, 기존 isPlaying 소비자를 깨지 않게 한다. setPlaying 호출부를 전수 확인해 상태 불일치가 없게 한다.
2. play는 현재 beat에서 시작한다. 반복 중 [cycleStart, cycleEnd) 밖인 경우만 cycleStart로 옮긴다. NaN·음수는 정규화한다.
3. 시작 beat보다 앞선 MIDI 노트는 소급하지 않는다. 오디오 클립 한가운데서 시작하면 trim·playbackRate·원본 길이를 반영해 정확한 소스 오프셋과 남은 구간을 재생한다. fade가 클립 중간에서 불필요하게 처음부터 재시작되지 않게 한다.
4. Pause는 현재 beat를 보존하고 지금 울리는 소리를 실제로 멈춘다. Transport에 동기화되지 않은 Tone.Player는 Tone.Transport.pause()만으로 멈추지 않을 수 있으므로 활성 소스를 처리한다. Resume은 보존 위치를 사용하고 Stop만 0 또는 반복 시작으로 되감는다.
5. 재생 중 스크럽은 화면 위치와 Tone.Transport를 함께 옮긴다. 카운트인 중 Stop/Pause는 예약된 시작·클릭을 취소한다. 반복 두 바퀴에서 오디오 중복이 없어야 한다.
6. Space 재생/일시정지, Shift+Space·Enter 정지 정책을 정리한다. 상단 재생 버튼과 기존 Stop 버튼 레이블을 한국어로 쓴다. Live Loops, MIDI 녹음, 카운트인 회귀를 확인한다.
7. 기본 프로젝트 재생 직후 관찰된 “Start time must be strictly greater than previous start time” 콘솔 오류의 콜스택과 재현 조건을 확인한다. 스케줄 경계가 원인이면 수정하고 재현 테스트를 추가한다. 예외를 catch로 숨기지 않는다.

검증: cycle 경계·오디오 시작/중간/끝·trim·배속·fade 순수 함수 테스트, play→pause→resume/stop 상태 테스트, 실제 브라우저에서 8마디 MIDI·오디오 청취/긴 오디오 Pause/재생 중 스크럽/반복 두 바퀴/카운트인/Live Loops를 확인하고 공통 자동 게이트를 통과하라. 숫자 표시만 보고 오디오 성공이라고 하지 마라.
~~~

통과 기준: Play는 선택 위치, Pause/Resume은 보존 위치, Stop만 되감기; 중간 오디오와 반복·카운트인이 정상이다.

### Phase 2 — 내보내기 형식의 정직성

기본 선택은 MP3를 숨기고 WAV만 제공하는 것이다. 실제 인코더 도입은 별도 작업으로 판단한다.

~~~text
너는 공유/내보내기 UI를 고친다. 공통 작업 계약을 적용하라.

재현: Share에서 MP3→Mix를 누르면 실제 WAV가 내려오고 영어 대체 문구가 나온다. AppShell.tsx와 exportProject.ts의 요청 형식·실제 결과를 먼저 추적하라.

1. MP3 인코더가 없는 현 상태에서는 MP3 버튼과 mp3 요청 타입/폴백 경로를 제거한다. WAV, 트랙별 WAV ZIP, 프로젝트 JSON은 유지한다.
2. Share의 형식·음질·범위·진행·성공·실패 문구를 한국어로 바꾼다. 실제로 지원하지 않는 조합은 숨기거나 이유와 함께 비활성화한다.
3. Full/Cycle, Standard/High가 실제 렌더 설정과 맞는지 확인한다. 파일명 확장자, Blob MIME, RIFF/WAVE 헤더를 테스트한다.
4. 읽을 수 없는 녹음이 포함됐거나 렌더가 실패한 경우 사용자에게 성공이라고 표시하지 않는다. 재생 엔진은 변경하지 않는다.
5. 브라우저에서 실제 다운로드와 재생을 확인하고 공통 자동 게이트를 통과하라.

보고: 표시된 형식, 다운로드 확장자, MIME, 파일 시그니처를 한 표로 제시하라.
~~~

통과 기준: 선택 가능한 형식과 실제 파일이 일치하며 영어 대체 문구가 없다.

### Phase 3 — 상단 녹음과 마이크 캡처를 하나의 흐름으로

목적: 상단 Record가 오디오 트랙에서는 실제 마이크 녹음으로 이어지도록 한다. MIDI 입력 녹음은 유지한다.

~~~text
너는 녹음 사용자 흐름을 통합한다. 공통 작업 계약을 적용하라.

시작: TransportBar.toggleRecord, AppShell의 isRecording/count-in, RecorderPanel.startRecording/stopRecording, TouchInstruments MIDI 입력, AudioAsset 저장·addAudioClip을 읽고 현재 상태 전이도를 그려라. 오디오 트랙과 MIDI 트랙에서 Record가 각각 무엇을 해야 하는지 결정·기록하라.

1. 준비된 오디오 트랙에서 상단 Record를 누르면 권한→카운트인→MediaRecorder 시작→Stop→Blob 저장→선택 트랙 클립 생성으로 이어지게 한다. 일반 Play에는 마이크 권한 요청을 넣지 않는다.
2. 상단과 RecorderPanel이 각자 타이머를 소유하지 않게 한다. 준비/카운트인/녹음/저장/오류 상태를 명시하고 중복 클릭, 권한 거부, 프로젝트 전환, 트랙 삭제, 카운트인 취소를 처리한다.
3. 저장 성공 전 화면에 완성 클립을 남기지 않는다. AudioAsset과 Clip 참조를 일치시킨다. 사이클 테이크·컴핑은 기존 규칙을 보존한다.
4. 녹음 상태 표시가 MediaRecorder의 실제 상태와 맞고 모든 신규 안내·오류가 한국어인지 확인한다.
5. 상태 전이 단위 테스트, 권한 거부·빈 Blob·저장 실패 시험을 추가한다. 실제 마이크 기기에서 오디오 트랙 준비→상단 Record→카운트인→박수→Stop→클립 재생→WAV 내보내기를 완주하라. 마이크가 없으면 수동 시험 미완료로 보고하라. MIDI 녹음 회귀와 공통 자동 게이트를 확인하라.
~~~

통과 기준: 상단 Record로 실제 오디오 트랙 녹음이 생성되고 재생과 WAV에 포함된다. MIDI 녹음은 회귀하지 않는다.

### Phase 4 — 녹음 포맷·디코딩·입력 처리 품질

목적: 녹음 결과를 저장하기 전에 실제 디코딩 가능성과 길이를 확인한다. 장치 지연 보정은 임의의 숫자로 처리하지 않는다.

~~~text
너는 브라우저 오디오 캡처 품질을 개선한다. 공통 작업 계약을 적용하라.

대상: src/components/recording/RecorderPanel.tsx, 오디오 자산 저장·클립 길이 계산 경로, 관련 순수 헬퍼·테스트.

1. getUserMedia에서 echoCancellation:false, noiseSuppression:false, autoGainControl:false를 요청한다. channelCount:1과 sampleRate:48000은 선호값으로 시도한다. 실제 적용값은 getAudioTracks()[0].getSettings()로 확인하고 지원되지 않은 처리에 대해서만 한국어로 짧게 알린다. 브라우저 기본값을 모든 환경에서 동일하다고 단정하지 마라.
2. MediaRecorder.isTypeSupported로 audio/webm;codecs=opus → audio/webm → audio/mp4 → 브라우저 기본값 순으로 선택한다. 실제 recorder.mimeType과 생성 Blob.type을 AudioAsset.mimeType에 일치시키고 지원 가능한 범위에서 audioBitsPerSecond를 128000 이상 요청한다.
3. Blob을 AudioContext.decodeAudioData로 확인해 buffer.duration을 클립 길이로 쓴다. 디코딩 실패 시 오디오 자산을 삭제하지 말고 보관·오류 표시·재시도/가져오기 대안을 제공한다. AudioContext는 finally에서 정리한다.
4. MediaRecorder의 start 이벤트와 AudioContext.currentTime 차이를 실제 입력 지연이라고 이름 붙이지 마라. 캡처 시작 시계, 반주 transport 시계, 실제 오디오 첫 트랜지언트를 분리해 기록한다. 장치 교정 기능은 반복 루프백 측정값이 확보되기 전까지 자동 적용하지 않는다. 수동 보정이 필요하면 원본 Blob을 보존하고 클립 위치·trim의 의미를 명확히 설명한다.
5. Chrome 계열과 Safari에서 MIME·디코딩·WAV 포함을 각각 시험한다. 지원 환경이 없으면 미검증으로 기록한다.

검증: MIME 선택·설정 확인·decode 성공/실패 순수 또는 모의 테스트, 실제 마이크 5초 녹음과 WAV 재생, 권한 거부·기기 없음·저장 용량 부족, 공통 자동 게이트. “20ms 정렬”이나 “펌핑 없음”을 장치 측정 없이 통과했다고 쓰지 마라.
~~~

통과 기준: 저장 길이가 디코딩된 버퍼 길이와 맞고, 녹음 파일이 해당 브라우저에서 재생·WAV 내보내기에 포함된다. 적용되지 않은 입력 처리는 사용자에게 알려준다.

### Phase 5 — 겹치지 않는 반응형 편집기

목적: 1280×720 헤더 겹침과 390px 가로 넘침을 해결한다. 첫 화면은 계속 편집기여야 한다.

~~~text
너는 웹밴드 스튜디오의 반응형 편집 화면을 수정한다. 공통 작업 계약을 적용하라.

재현: 1280×720에서 Undo와 Student, LCD와 Teacher/Studio 조작 영역이 겹친다. 390×844 에뮬레이션에서는 innerWidth 390에 documentElement.scrollWidth 840이다. 작업 전 DOM 경계 상자와 화면 캡처를 보존하라.

대상: TransportBar, AppShell의 grid/flex 배치, 타임라인·하단 편집기의 overflow 규칙, 필요한 CSS. 오디오·스토어 로직은 변경하지 않는다.

1. 헤더의 조작을 기능 그룹별로 줄 바꿈 또는 축약하고 각 그룹의 최소 폭을 명확히 한다. 서로 겹치는 absolute 위치와 과도한 min-width를 찾아 제거한다. 아이콘만 남는 폭에서도 aria-label과 오류 상태를 볼 수 있어야 한다.
2. 좁은 화면은 페이지 전체의 840px 가로 넘침을 없애고, 필요한 타임라인 가로 스크롤은 타임라인 내부에서만 허용한다. 편집기·트랙 추가·재생·저장·Share 진입이 가려지지 않게 한다.
3. 화면 높이가 낮은 환경에서도 편집기의 핵심 영역 하나가 0px로 눌리지 않게 한다. 레슨/교사 패널은 스크롤 가능하게 하되 타임라인과 트랜스포트가 사라지지 않게 한다.
4. 기존 4개 테마와 키보드 포커스 표시를 유지한다. 기능을 감추는 방식으로 레이아웃 문제를 덮지 않는다.

검증: 390×844, 768×1024, 1280×720, 1440×900에서 DOM 상자 교차 여부와 스크린샷을 비교하라. documentElement.scrollWidth ≤ innerWidth가 되어야 하며 타임라인 내부 스크롤은 허용한다. 각 크기에서 재생·트랙 추가·Share·저장 버튼을 실제로 누르고 공통 자동 게이트를 통과하라. 390px 에뮬레이션 결과는 실기기에서 다시 확인할 항목으로 표시하라.
~~~

통과 기준: 상단 조작이 겹치지 않고 페이지 전체 가로 넘침이 없다. 핵심 편집 기능에 손과 키보드로 접근할 수 있다.

### Phase 6 — 저장 순서·실패 복구

목적: 저장의 비용보다 먼저 저장 순서와 실패 인지를 검증한다. 현재 코드는 프로젝트 변경 뒤 1초 디바운스로 전체 프로젝트를 저장한다. “매초 저장”이라는 표현은 정확하지 않다.

~~~text
너는 프로젝트 자동저장과 복구 신뢰성을 개선한다. 공통 작업 계약을 적용하라.

대상: AppShell 자동저장 효과, projectRepository 인터페이스와 로컬 Dexie 구현, 저장 상태 UI, 관련 테스트. Project 기존 필드는 유지한다.

1. 먼저 지연된 저장 Promise 두 개를 모의해 이전 프로젝트 저장이 새 프로젝트 저장보다 늦게 끝날 때 최종 IndexedDB 내용이 어떻게 되는지 시험하라. 실제 재현되면 저장을 직렬화하고 최신 변경만 추가 큐에 남기는 정책으로 고친다.
2. 사용자 편집마다 증가하는 메모리 revision과 마지막 저장 완료 revision을 구분한다. 저장 중 새 편집이 발생하면 완료 표시를 너무 일찍 내지 않는다. “저장 중/저장됨/저장 실패/다시 시도”를 한국어로 표시한다.
3. 디바운스 간격은 임의로 2.5초로 늘리지 않는다. 1초 기준에서 대표 프로젝트의 직렬화 시간과 변경 빈도를 측정한 후 조정한다. 오디오 Blob을 프로젝트 JSON과 매번 같이 쓰는지 확인한다.
4. visibilitychange(hidden)에서 즉시 저장을 시도하되 비동기 완료를 보장한다고 쓰지 않는다. 미완료 변경이 있으면 안전한 내보내기 또는 나가기 경고를 제공한다. beforeunload를 데이터 보존의 유일한 장치로 삼지 않는다.
5. 과거 v1~현재 저장 프로젝트·모의 클라우드·Supabase 어댑터를 열어 호환을 확인한다. 저장 실패 후 사용자가 같은 프로젝트에서 다시 시도할 수 있어야 한다.

검증: Promise 완료 순서 역전, 두 번 빠른 수정, 탭 숨김, 저장 용량 오류, 새로고침 복원 테스트. 실제 IndexedDB에 여러 트랙·녹음 자산이 있는 프로젝트를 저장·복원하고 공통 자동 게이트를 통과하라. “탭을 즉시 닫아도 마지막 한 글자까지 반드시 저장”은 합격 기준으로 쓰지 마라.
~~~

통과 기준: 오래된 저장이 새 저장을 덮지 않고, 실패가 보이며 재시도 가능하다. 저장 완료 표시는 마지막 편집 revision을 반영한다.

### Phase 7 — 계측 후 재생 렌더링 최적화

목적: 재생 중 프레임 갱신 비용을 실제로 측정한 다음 큰 구독 범위만 줄인다. 소리와 화면 의미는 보존한다.

~~~text
너는 React와 Tone.js의 재생 UI 성능을 측정하고 필요한 병목만 수정한다. 공통 작업 계약을 적용하라.

1. 대표 프로젝트 두 개를 준비하라: 기본 프로젝트와 12트랙×30클립 프로젝트. 테스트 기기·브라우저·화면 크기를 기록하고 8초 재생 동안 React Profiler 커밋 수, ArrangementTimeline/TrackLane/ClipBlock 렌더 수, CPU 장시간 작업, 화면 프레임 드롭을 측정하라. 전체 앱이 매 프레임 재렌더된다고 가정하지 마라.
2. 병목이 확인되면 AudioEngine의 beat/level 고빈도 발행과 React 구독 경계를 나눈다. 타임라인 플레이헤드와 미터는 안정적인 구독 또는 ref 기반 transform으로 이동시킬 수 있다. 현재 beat가 클립 추가 위치·녹음 위치에 쓰이므로 스토어 값의 의미와 읽기 시점을 보존한다.
3. TrackLane, ClipBlock, AutomationLane 등의 memo 적용은 props·selector 참조 안정성을 확인한 뒤 한다. 무조건 감싸지 않는다. 프로젝트 전체 구독이 실제 비용 원인이면 트랙별 selector로 좁힌다.
4. 재생 중 스크럽, 반복, 일시정지에서 화면 beat와 실제 Tone beat가 어긋나지 않아야 한다. 60fps는 가능한 화면 목표이지 브라우저·기기 무관한 보증이 아니다.
5. 저장 최적화는 Phase 6에서 다뤘으므로 여기서 다시 구현하지 않는다.

검증: 같은 기기·프로젝트·브라우저에서 작업 전후 수치를 표로 제시하라. 렌더 횟수와 주요 조작 지연이 개선돼야 하며 시각·청각 회귀가 없어야 한다. “React 리렌더 0회”나 고정 커밋 10회는 근거 없는 목표로 쓰지 마라. 공통 자동 게이트를 통과하라.
~~~

통과 기준: 측정된 병목이 감소하고 재생·스크럽·반복·오토메이션 표시가 보존된다. 병목이 작으면 최적화하지 않고 측정 결과를 보고한다.

### Phase 8 — 한국어 사용자 문구와 용어 일관성

목적: 수업 화면의 혼합 언어를 정리한다. BPM·MIDI·WAV 등 합의된 표기는 허용하므로 “영어 문자열 0건”을 기계적 기준으로 삼지 않는다.

~~~text
너는 사용자 화면의 한국어 용어와 오류 안내를 정리한다. 공통 작업 계약을 적용하라.

1. TransportBar, Share, LoopBrowser, InstrumentLibrary, MixerPanel, SmartControls, BeatSequencer, ChordStrips, Keyboard, Drummer, ClipEditor, PianoRoll, ShortcutHelpDialog, 교육 패널의 보이는 문자열과 aria-label/title을 화면별 목록으로 만든다.
2. 용어집을 먼저 확정한다: Loop=루프, Clip=클립, Track=트랙, Take=테이크, Mixer=믹서, Master=마스터, Bus=버스, Tempo=템포, Cycle=반복 구간, Quantize=정렬, Stems=트랙별 음원. BPM/MIDI/WAV와 악기 고유명은 필요할 때 유지한다.
3. 반복되는 문구는 도메인별 타입 안전한 한국어 사전으로 묶되, 단일 언어 앱에 큰 i18n 패키지를 추가하지 않는다. 동적 숫자·프로젝트명·오류 원인과 결합되는 문구는 자연스러운 한국어 문장으로 만든다.
4. 오류는 “실패”만 쓰지 말고 다음 행동을 제시한다. 저장·녹음·권한·내보내기·가져오기 실패와 성공 문구를 우선 처리한다. HTML 언어 선언과 접근성 이름도 확인한다.
5. 기존 내부 식별자·오디오 포맷·영속 데이터 필드를 번역하지 않는다. 브랜드 이름과 URL 변경은 별도 작업으로 다룬다.

검증: 화면별 목록의 모든 항목을 확인하고, 허용한 영어 약어·고유명 목록을 보고하라. 1280×720과 좁은 화면에서 텍스트가 잘리지 않는지 확인하고 공통 자동 게이트를 통과하라.
~~~

통과 기준: 주요 사용자 흐름에 영어 임시 문구가 없고, 용어가 화면 간 일치하며 오류에 복구 안내가 있다.

### Phase 9 — 색상 토큰과 4개 테마

목적: 기본 slate 색 클래스와 테마별 강제 덮어쓰기를 단계적으로 줄인다. 현재 src TSX에서 slate- 약 332회, src/index.css에서 !important 8회가 관찰됐다. 시작 시 다시 센다.

~~~text
너는 웹밴드 스튜디오의 색상 토큰을 정리한다. 공통 작업 계약을 적용하라.

1. dark/light/pretty/cute의 타임라인·믹서·피아노롤·교사 패널 화면을 같은 크기로 캡처하고 텍스트·배경·테두리 토큰의 실제 색과 대비를 기록하라.
2. tailwind.config.ts와 src/index.css에 제목·본문·보조·비활성 텍스트, 표면, 테두리, 선택 상태를 의미 기반 CSS 변수로 정의한다. 기존 색과 대비를 우선 유지한다.
3. TSX 파일을 작은 묶음으로 바꾼다. text-slate-*와 text-white의 알파 변형·조건부 문자열·hover/focus 상태를 각각 검토한다. bg/border도 맞는 표면·테두리 토큰으로 매핑한다. 정규식 일괄 치환은 하지 않는다.
4. 컴포넌트가 새 토큰을 쓰기 시작한 뒤에만 데이터 테마별 !important 색 덮어쓰기를 제거한다. 모양·그림자 효과는 유지해도 된다.
5. WCAG 본문 4.5:1, 큰 글자 3:1 대비를 4개 테마의 대표 조합에서 측정한다. 값이 부족하면 토큰을 조정한다. 시각 회귀와 대비 개선 결과를 분리 보고한다.

검증: qa:themes를 새 토큰 검사에 맞춰 갱신하고 4개 테마 화면·키보드 포커스·선택 상태를 확인하라. 변경 묶음마다 타입 검사와 빌드를 실행하라. 최종적으로 컴포넌트 TSX의 slate-*와 index.css의 !important 사용이 남았다면 위치와 이유를 보고하라. 공통 자동 게이트를 통과하라.
~~~

통과 기준: 색상 값의 출처가 토큰으로 일원화되고, 4개 테마의 주요 정보·포커스·대비가 유지된다.

### Phase 10 — 박자 단위와 3/4·6/8 계산

목적: 현재 4/4 중심의 beat 계산을 먼저 명확히 하고 3박 계열 루프를 추가할 토대를 만든다. UI 눈금, 메트로놈, 카운트인, 루프 반복이 같은 단위를 써야 한다.

~~~text
너는 웹밴드 스튜디오의 박자 계산을 수정한다. 공통 작업 계약을 적용하라.

현행 확인: Project.timeSignature은 [분자, 분모]이고 LoopDefinition에는 개별 박자표가 없다. src/utils/timeline.ts의 formatBarBeatTick/buildRulerTicks와 AudioEngine의 메트로놈·카운트인은 분자만 사용하는 곳이 있다.

1. transport beat의 단위를 4분음표 1개로 정의하고 코드 주석과 테스트에 명시한다. 한 마디 길이는 numerator × (4 / denominator)로 계산한다. 4/4=4, 3/4=3, 6/8=3이다.
2. timeline 눈금, LCD 마디/박 표시, 스냅, 사이클, 카운트인, 메트로놈 강박, Live Loops 양자화에서 이 단위를 공통 헬퍼로 사용한다. 6/8은 3개의 4분음표 길이 안에 6개의 8분음표가 있고 강박은 보통 1·4번째 8분음표라는 점을 UI/클릭에서 구분한다.
3. 이미 저장된 Project.timeSignature과 clip.startBeat/lengthBeats 숫자의 의미를 조용히 바꾸지 않는다. 기존 4/4 프로젝트의 위치가 달라지면 실패다. 영속 데이터 변환이 필요하면 버전·마이그레이션을 추가한다.
4. LoopDefinition에 선택적 timeSignature를 추가할지 검토하라. 추가한다면 기존 6개 루프는 4/4로 해석하고 프로젝트 박자표와 다른 루프에는 명확한 경고 또는 호환 정책을 둔다.

검증: 4/4·3/4·6/8 각 1·2·4마디 위치의 ruler/LCD/cycle/count-in 단위 테스트, 기존 4/4 프로젝트 위치 회귀, 실제 메트로놈 청취와 공통 자동 게이트. 브라우저에서 6/8 강박을 청취하지 못했다면 미검증으로 보고한다.
~~~

통과 기준: 3/4·6/8의 한 마디 길이와 표시·클릭이 일관되며 기존 4/4 프로젝트가 그대로 열린다.

### Phase 11 — 검증 가능한 MIDI 루프 라이브러리

목적: 현재 6개의 패턴을 수업에 쓸 만큼 늘린다. 파일 수만 늘리지 말고 박자·조성·설명·미리듣기를 검증한다. 실제 샘플 파일은 여기서 추가하지 않는다.

~~~text
너는 웹밴드 스튜디오의 MIDI 루프 콘텐츠를 확장한다. 공통 작업 계약을 적용하라. Phase 10의 박자 단위가 통과하지 않았다면 3/4·6/8 루프를 먼저 만들지 마라.

대상: src/data/loops.ts, LoopDefinition 타입, 필터·미리듣기·배치 로직, scripts/qa-loops.mjs와 테스트.

1. 6개에서 먼저 24개까지 드럼/베이스/화성/멜로디를 균형 있게 확장하고 공통 게이트를 통과한 뒤, 서로 다른 사용 목적이 입증되는 패턴을 48개까지 더한다. 겉만 다른 패턴을 숫자 맞추기 위해 복제하지 않는다.
2. 모든 루프에 고유 id, 한국어 이름·학생 눈높이 설명, 일관된 genre/mood, key, bpm, timeSignature, lengthBeats, 정확한 pattern을 기록한다. 드럼의 key는 무의미하면 생략한다.
3. lengthBeats는 4분음표 단위다. 4/4 루프는 4/8/16, 3/4와 6/8은 3/6/12 등이 가능하다. 4/4의 12마디 블루스는 48박으로 허용한다. 3/4를 4박 길이로 저장하거나 12마디 블루스를 8마디로 축약하지 않는다.
4. 코드 진행 이름과 MIDI 음을 대조하는 음악 규칙 테스트를 만든다. 예: C장조 I-V-vi-IV라면 각 화음의 루트와 화음 구성음을 검사한다. 6/8 리듬은 8분음표 위치와 강박을 확인한다.
5. 브라우저에서 다른 key·박자 루프를 무작위로 조합해도 항상 맞는다고 주장하지 않는다. 맞지 않는 조합에는 필터·경고 또는 명시적 변환을 제공한다. 미리듣기와 타임라인 배치에서 같은 패턴이 들려야 한다.
6. qa-loops는 id 유일성, 박자표별 길이, step 범위, drum 값, note 구문, 필터 어휘, 한국어 메타데이터, 코드 진행의 표본 검사를 수행한다. 기존 6개 프로젝트 참조가 깨지지 않아야 한다.

검증: qa-loops 및 공통 자동 게이트, 4/4·3/4·6/8 프로젝트에서 선택·미리듣기·배치·WAV 내보내기. 번들 크기 전후를 측정하라. MIDI 패턴 추가가 “용량 증가 0”이라고 쓰지 마라.
~~~

통과 기준: 최소 24개가 우선 검증되며, 최종 48개까지 각 패턴의 음악적·기술적 기준이 통과한다. 기존 id가 유지된다.

### Phase 12 — 적법한 샘플 인프라와 오디오 팩

목적: 실제 악기 소리를 다룰 준비를 하되 재배포 권한과 실시간/오프라인 동등성을 먼저 확보한다. 콘텐츠가 없으면 샘플러 기능이 검증됐다고 쓰지 않는다.

~~~text
너는 웹밴드 스튜디오의 샘플 기반 악기 경로를 설계·구현한다. 공통 작업 계약을 적용하라.

전제: Apple/GarageBand 자산과 Philharmonia 샘플을 앱의 샘플 팩으로 넣지 않는다. Freesound는 각 파일의 URL·업로더·라이선스 버전·재배포 허용 범위를 별도로 검토한다. 우선 자체 녹음 또는 재배포가 명확히 허용된 파일만 후보로 한다.

1. public/samples/manifest.json과 src/types/samples.ts에 팩 id/name/kind/baseUrl, 파일별 note·velocity layer·mimeType·대체 파일, license/SPDX 또는 원문 URL, 저작자, 출처 URL, 취득일, 재배포 검토 결과를 정의한다. 누락 항목은 검증 실패다.
2. 먼저 배포용 음원 대신 직접 생성한 짧은 테스트 톤 1~2개로 인프라를 검증한다. 테스트 픽스처는 실제 악기 팩이라고 표시하지 않는다. Tone.Sampler 로딩은 악기를 실제 사용할 때 시작하고, 중복 요청·디코딩 캐시·실패·취소를 처리한다.
3. 오프라인 WAV 렌더러에도 같은 원본 버퍼·피치·노트 시작/길이/볼륨 규칙을 적용한다. 필요한 샘플의 로드가 끝나기 전 렌더를 시작하지 않는다. 실패 시 무음으로 성공 처리하지 말고 한국어 오류 또는 명시된 합성음 대체를 제공한다.
4. 오프라인·다운로드 실패 시 기존 합성 패치를 사용할 수 있도록 하되, 사용자에게 대체 사실을 표시한다. 이미 저장된 8개 합성 패치와 기존 프로젝트는 계속 동작해야 한다.
5. 실제 음원 팩의 공개는 별도 콘텐츠 단계로 취급한다. 파일별 권리 증빙, OGG/AAC 또는 브라우저 지원 확인, 압축 크기, 지각 품질, attribution 화면을 충족한 팩만 추가한다. 2MB는 설계 예산이지 음질보다 우선하는 절대 합격선이 아니다.

검증: 매니페스트 누락·잘못된 URL·디코딩 실패·중복 로드·오프라인 대체 테스트. 테스트 톤의 실시간 출력과 WAV 결과를 비교하고, 실제 Chrome/Safari의 포맷 지원을 확인한다. 샘플 파일이 전혀 없으면 “샘플 오디오 내보내기 통과”라고 보고하지 마라. 공통 자동 게이트를 통과하라.
~~~

통과 기준: 권리가 확인된 파일만 매니페스트에 들어가고, 같은 노트가 실시간 재생·WAV 양쪽에서 재생된다. 실패는 사용자에게 보인다.

### Phase 13 — 강요하지 않는 음악 학습 피드백

목적: 기존 레슨의 수량 기반 미션을 유지하면서 선택형 음악 피드백을 추가한다. 모든 곡에 한 가지 음악 규칙을 강제하지 않는다.

~~~text
너는 음악 교육 피드백을 확장한다. 공통 작업 계약을 적용하라.

시작: src/education/evaluateMission.ts, src/education/lessons.ts, src/assist/musicTheory.ts와 creativeAssist.ts를 읽고 실제 재사용 가능한 함수를 나열하라. musicTheory.ts가 이미 기능화성 분석을 제공한다고 가정하지 마라. 현재는 음 종류·음역 힌트 중심이다.

1. 기존 5개 레슨, MissionCheck, 저장된 lessonProgress의 완료 결과를 그대로 유지한다. 새 분석은 새 심화 레슨 또는 선택형 도전 미션에만 쓴다.
2. 기초적인 inScale, 리듬 격자 일관성, 음역, 인접 음 이동 비율은 순수 함수로 만들고 project.key/scale 및 박자 단위를 명시한다. 반음계·경과음·의도적 도약·재즈·국악 등 예외를 “틀림”으로 표시하지 않는다.
3. sectionContrast는 클립 시작점 거리만 쓰지 말고 A/B 구간의 악기 참여, 리듬 밀도, 음역 중 하나 이상의 차이를 설명한다. 화성 기능 분석은 실제 코드 진행 표현·인식 신뢰도가 확보되기 전까지 자동 합격/실패 기준으로 넣지 않는다.
4. 학생 문구는 측정값과 다음 시도 한 가지를 제안한다. “좋은 멜로디는 항상 순차 진행 60%” 같은 보편 규칙이나 등급화는 쓰지 않는다. 교사가 자동 평가 결과를 수정·무시할 수 있어야 한다.
5. 심화 레슨을 추가한다면 조성·리듬·A/B 구조 중 입증된 검사만 사용한다. 기존 템플릿 프로젝트를 열거나 시작할 때 현재 작업이 교체된다면 사용자에게 저장/복제 선택을 제공한다.

검증: 새 검사마다 명확한 통과·실패·경계 사례, C장조·가단조·반음계 사례, 기존 5개 레슨 결과 고정 테스트, 저장된 lessonProgress 복원, 학생·교사 화면 수동 시험과 공통 자동 게이트.
~~~

통과 기준: 기존 과제 진행률이 바뀌지 않고 새 힌트가 구체적이며 교사·학생이 이를 절대적 음악 점수로 오해하지 않는다.

### Phase 14 — 키보드·모달·터치 접근성

목적: 마우스 없이 수업 과제를 완주하게 하고, 태블릿 조작 실수를 줄인다. 이미 되는 Smart 슬라이더 방향키 동작은 보존한다.

~~~text
너는 웹밴드 스튜디오의 키보드와 터치 접근성을 개선한다. 공통 작업 계약을 적용하라.

시작: Share, ShortcutHelpDialog, 트랙 메뉴, ArrangementTimeline, ClipBlock, Knob/Fader, LiveLoopsGrid의 현재 focus 순서와 aria-label을 실제 브라우저에서 기록하라. 390px와 1280px에서 확인하라.

1. Share와 단축키 도움말에 공통 모달 동작을 적용한다. 열릴 때 모달 내부 첫 유효 요소에 포커스, Tab/Shift+Tab 순환, Escape 닫기, 닫힌 뒤 열기 버튼으로 포커스 복귀, 배경 스크롤·보조기술 접근 차단. 폼 입력 중 Escape 동작도 검토한다.
2. AppShell의 하드코딩 키 입력과 src/utils/shortcutOverlay.ts의 설명을 한 레지스트리로 합친다. 키·한글 설명·허용 범위·handler를 한 곳에 둔다. 입력창과 모달 안에서는 충돌하는 전역 단축키를 막는다.
3. 기존 Space/R/Enter/Undo/Redo를 유지하면서 저장, 선택 클립 복제·삭제·이동, 트랙 선택, 플레이헤드 이동, 반복 토글, 도움말을 단계적으로 추가한다. 브라우저·화면 판독기 기본키와 충돌하면 대체 키를 명시한다.
4. 타임라인은 트랙/클립을 Tab과 방향키로 찾아 Enter로 선택·편집한다. 선택 상태와 트랙명·클립명·시작 마디·길이를 보조기술에 읽히게 한다. Space는 재생 제어이므로 클립 선택과 겹치지 않게 한다.
5. WCAG 2.2 AA 최소 대상 24×24 또는 간격 기준을 충족하고, 태블릿 주요 핸들·버튼은 가능하면 44×44 CSS px를 목표로 한다. 시각 모양은 유지하면서 포인터 실제 히트 영역만 넓혀 이웃 핸들과 겹치지 않는지 시험한다.
6. 4개 테마의 포커스 표시·텍스트 대비를 측정한다. 자동 axe 결과와 실제 키보드 사용 결과를 분리 보고한다.

검증: 새 프로젝트→트랙 추가→루프 클립 추가→위치 이동→재생→저장을 키보드만으로 완주한다. 모든 모달 포커스 순환·Escape·포커스 복귀, 트랙 메뉴 방향키, 태블릿 실제 터치, axe critical/serious 결과를 확인한다. 자동 도구를 추가하면 의존성 이유를 기록한다. 공통 자동 게이트를 통과하라.
~~~

통과 기준: 키보드 단독 시나리오 완주, 모달 포커스 관리, 주요 터치 목표와 대비 검사. axe 0건만으로 수동 접근성 검사가 끝났다고 하지 않는다.

### Phase 15 — PWA·배포 버전·메타데이터

목적: 학교 와이파이에서 재방문 시 앱 셸을 사용할 수 있게 한다. 이 단계는 GitHub Pages 경로와 업데이트 안전성이 확인된 뒤에만 완료로 표시한다.

~~~text
너는 웹밴드 스튜디오의 설치·오프라인·배포 갱신 기능을 만든다. 공통 작업 계약을 적용하라.

시작: 현재 GitHub Pages가 Actions의 dist 업로드로 배포되는지 확인하고 실제 URL의 HTML·JS 해시, base 경로 /Garageband_copy/, 서비스워커 scope를 기록하라. docs/ 미러와 실제 배포 경로를 혼동하지 마라.

1. 원본 index.html에 한국어 title/description/theme-color와 적절한 Open Graph 메타를 추가한다. docs/index.html은 빌드 출력이므로 직접 수정하지 않는다. og:image는 실제 편집기 화면을 본인이 제작해 저장하고 배포 URL에서 열리는지 확인한다.
2. 독자 디자인 SVG에서 favicon과 설치 아이콘 192/512 및 maskable 영역을 만든다. Apple/GarageBand 디자인을 모방하지 않는다. public/manifest.webmanifest에 한국어 이름, 상대 start_url/scope, standalone, 테마 색을 설정한다.
3. 서비스워커가 revision이 맞는 앱 HTML·해시 JS/CSS를 한 배포 버전으로 사전 캐시하게 한다. HTML과 해시 청크를 무분별한 StaleWhileRevalidate로 섞지 않는다. Workbox 또는 작은 직접 구현을 비교해 유지보수 위험이 낮은 쪽을 택한다. IndexedDB는 서비스워커에서 건드리지 않는다.
4. 실제 권리가 확인된 샘플만 별도 런타임 캐시 정책을 둔다. 50MB와 30일은 저장 예산·만료 목표이고 브라우저의 절대 저장 보장은 아니다. 오프라인에서 미캐시 팩을 조용히 무음으로 재생하지 않는다.
5. 새 버전이 대기 중이면 한국어 갱신 알림을 보여준다. 미저장 변경과 저장 Promise 상태를 확인하고 사용자가 “지금 새로고침”을 눌렀을 때만 전환한다. 편집 중 자동 skipWaiting/reload를 하지 않는다.
6. 온라인/오프라인 상태와 샘플 다운로드 가능 여부를 UI에 정확히 표시한다. 정적 앱 셸과 사용자 프로젝트 저장의 실패를 구분한다.

검증: 새 프로필에서 최초 접속·설치, 재방문 오프라인 앱 셸, 이전 버전 탭을 열어 둔 상태의 새 배포 갱신, 저장 중 갱신 보류, GitHub Pages 하위 경로의 JS/CSS/아이콘/manifest 응답, 기존 IndexedDB 프로젝트 보존, 공통 자동 게이트. 테스트하지 않은 Safari 설치성은 미검증으로 기록하라.
~~~

통과 기준: 대상 배포 URL에서 설치와 두 번째 방문 오프라인 앱 셸이 동작하며 업데이트가 편집 중 작업을 강제로 없애지 않는다. [Workbox 사전 캐시](https://developer.chrome.com/docs/workbox/modules/workbox-precaching), [업데이트 처리](https://developer.chrome.com/docs/workbox/handling-service-worker-updates).

### Phase 16 — 조건부 스토어 분할

목적: 큰 파일 자체가 아니라 실제 변경 비용과 회귀 위험이 입증될 때 구조를 나눈다. PWA·오디오 버그 수정과 한 PR에 섞지 않는다.

~~~text
너는 Zustand 스토어 구조를 측정·검토한다. 공통 작업 계약을 적용하라.

1. src/store/useDawStore.ts의 현재 줄 수, 액션 그룹별 변경 빈도, 순환 의존, 테스트 부재 영역을 기록하라. “파일당 400줄 이하”는 합격 기준이 아니다. 구체적 유지보수 문제를 못 찾으면 분할하지 않고 근거를 보고하라.
2. 분할 전 create/load/duplicate 프로젝트, track/clip/note/automation CRUD, live loop, selection, undo/redo와 1~현재 버전 마이그레이션 특성 테스트를 만든다. Phase 0의 순수 모듈 테스트만으로 스토어 동작 보존이 증명됐다고 주장하지 마라.
3. 단일 useDawStore 훅과 기존 import 경로를 유지한다. 순수 internal 헬퍼를 먼저 분리하고 빌드·테스트한다. 이어 의존이 적은 selection/history/transport부터 옮기며 단계마다 게이트를 실행한다.
4. 슬라이스 간 액션은 get()으로 연결하고 순환 import를 만들지 않는다. cross-cutting history 기록과 데이터 정규화는 공용 순수 함수로 모은다. 동작 변경과 버그 수정을 섞지 말고 발견한 버그는 목록으로 남긴다.
5. 작업 전후 import 수, 파일별 책임, 테스트 통과, 번들·초기 로드 변화, 실제 수정 사례의 영향 범위를 보고한다.

검증: 각 이동 묶음마다 타입·단위·빌드·QA 및 저장 프로젝트 열기, undo/redo, 녹음 클립, 교사 과제 흐름. useDawStore 소비자의 코드 변경이 정말 불가피한 경우만 이유를 기록하라.
~~~

통과 기준: 외부 동작과 저장 데이터 호환성을 유지하면서 실제 변경 범위가 더 명확해진다. 줄 수 목표만 맞춘 분할은 실패다.

### Phase 17 — 조건부 실행 취소 메모리 개선

목적: 현재 전체 프로젝트 스냅샷 최대 80개의 실제 비용을 측정한 뒤 필요한 경우에만 바꾼다.

~~~text
너는 undo/redo 메모리 사용을 측정한다. 공통 작업 계약을 적용하라.

1. 기본 프로젝트와 12트랙×30클립·녹음 자산이 있는 대표 프로젝트에서 편집 80회 뒤 스냅샷 수, 힙 사용량, 편집 지연, undo/redo 지연을 같은 환경에서 측정하라. 녹음 Blob이 히스토리 스냅샷에 실제로 복제되는지 구분하라.
2. 비용이 작으면 현재 방식을 유지하고 수치를 보고하라. 비용이 큰 경우 먼저 불변 객체의 안전한 구조 공유를 검토한다. 공유 객체를 후속 액션이 제자리 수정해 과거 스냅샷을 오염시키는지 테스트한다.
3. 구조 공유로 충분하지 않을 때만 패치/역연산을 검토한다. 새 라이브러리는 번들·학습 비용과 단순한 대안을 비교해 결정한다.
4. 모든 액션의 undo/redo, 프로젝트 열기, 녹음/테이크, 오토메이션, Live Loops와 저장 데이터 호환을 보존한다. Phase 16의 구조 분할과 동시에 진행하지 않는다.

검증: 동일 프로젝트에서 변경 전후 메모리·지연 표, redo 분기/80개 한도/저장·복원 테스트, 공통 자동 게이트. 근거가 부족하면 코드를 바꾸지 않는 것이 완료다.
~~~

통과 기준: 측정에 비례한 단순한 구현만 채택되고 undo/redo 동작과 과거 프로젝트가 유지된다.

## 4. 실행 우선순위와 단계 종료 보고 형식

| 순서 | 단계 | 이유 |
|---|---|---|
| 즉시 | 0 → 1 → 2 → 5 | 기준선, 재생·형식 거짓, 데스크톱/모바일 조작 막힘을 먼저 해결 |
| 그다음 | 3 → 4 → 6 → 7 | 녹음 실제 흐름과 저장·성능을 측정·수정 |
| 콘텐츠·수업 | 8 → 9 → 10 → 11 → 12 → 13 → 14 | 한국어·테마·박자·루프·샘플·교육·접근성을 순차 검증 |
| 안정화 뒤 | 15 → 16 → 17 | PWA/배포와 선택적 구조·메모리 최적화 |

각 단계 보고서는 다음 표를 반드시 채운다. “통과”는 실행 증거가 있을 때만 쓴다.

| 항목 | 기록할 내용 |
|---|---|
| 기준선 | HEAD SHA, 작업 트리 상태, 배포 URL의 자산 해시, 시험 브라우저·화면 |
| 변경 | 파일 목록과 변경 이유, 영속 스키마/의존성/음원 변경 여부 |
| 재현 | 수정 전 단계, 수정 후 단계, 소리·파일·UI의 관찰 결과 |
| 자동 게이트 | 명령별 종료 코드, 실패 내용, 테스트 수·커버리지(해당 시) |
| 실제 사용 | Chrome/Safari/태블릿/마이크/오프라인 중 확인한 환경과 미확인 환경 |
| 남은 위험 | 데이터 호환, 다른 브라우저, 성능, 라이선스, 배포 여부 |

## 5. 참고 자료

- [배포 앱](https://kimyounggaur.github.io/Garageband_copy/) 및 [공개 저장소](https://github.com/kimyounggaur/Garageband_copy)
- [Tone.js Transport 문서](https://tonejs.github.io/docs/14.7.77/Transport): pause는 Transport에 동기화된 소스의 동작과 함께 검토해야 한다.
- [IndexedDB 사용 안내](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)와 [Chrome 페이지 수명주기](https://developer.chrome.com/docs/web-platform/page-lifecycle-api/): 닫히는 순간의 비동기 저장 보장에 주의한다.
- [W3C MediaStream Recording 명세](https://www.w3.org/TR/mediastream-recording/): start 이벤트는 실제 장치 입력 지연의 측정값이 아니다.
- [W3C WCAG 대상 크기 AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)와 [AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).
- [Philharmonia 샘플 사용 조건](https://philharmonia.co.uk/resources/sound-samples/)과 [Freesound 파일별 라이선스 안내](https://freesound.org/help/faq/).
- [Workbox 사전 캐시](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)와 [서비스워커 갱신](https://developer.chrome.com/docs/workbox/handling-service-worker-updates).
