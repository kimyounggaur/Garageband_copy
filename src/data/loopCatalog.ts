import type { LoopDefinition, LoopStep } from "../types/project";

type NoteSpec = [beat: number, note: string, duration: number, velocity?: number];
type DrumSpec = [beat: number, drum: NonNullable<LoopStep["drum"]>, velocity?: number];

const notes = (events: NoteSpec[]): LoopStep[] =>
  events.map(([beat, note, durationBeats, velocity = 0.7]) => ({ beat, note, durationBeats, velocity }));
const drums = (events: DrumSpec[]): LoopStep[] =>
  events.map(([beat, drum, velocity = 0.7]) => ({ beat, drum, velocity }));
const chords = (events: Array<[beat: number, notes: string[], duration: number, velocity?: number]>): LoopStep[] =>
  events.flatMap(([beat, pitches, duration, velocity = 0.56]) => pitches.map((note) => ({ beat, note, durationBeats: duration, velocity })));

// Every pattern has a distinct rhythmic or harmonic purpose. All beat positions
// use quarter-note units, including the 3/4 and 6/8 patterns.
export const CURATED_LOOPS: LoopDefinition[] = [
  {
    id: "drums-rock-backbeat", name: "록 뒷박", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Rock", mood: ["Steady", "Energetic"], bpm: 96, timeSignature: [4, 4], lengthBeats: 4, color: "#38bdf8",
    description: "2박과 4박 스네어가 곡의 중심을 잡는 기본 록 리듬입니다.",
    pattern: drums([[0,"kick",.94],[.5,"hat",.5],[1,"snare",.84],[1,"hat",.48],[1.5,"hat",.52],[2,"kick",.86],[2,"hat",.53],[2.5,"hat",.48],[3,"snare",.88],[3,"hat",.51],[3.5,"hat",.55]])
  },
  {
    id: "drums-funk-offbeat", name: "펑크 엇박", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Funk", mood: ["Energetic", "Steady"], bpm: 105, timeSignature: [4, 4], lengthBeats: 4, color: "#38bdf8",
    description: "킥이 엇박에 들어와 몸을 움직이게 하는 펑크 리듬입니다.",
    pattern: drums([[0,"kick",.95],[0,"hat",.55],[.5,"hat",.42],[.75,"kick",.69],[1,"snare",.78],[1,"hat",.54],[1.5,"hat",.43],[2,"kick",.84],[2,"hat",.55],[2.5,"kick",.61],[2.5,"hat",.45],[3,"snare",.82],[3,"hat",.58],[3.5,"hat",.43]])
  },
  {
    id: "drums-half-time", name: "느린 힙합", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Hip Hop", mood: ["Dark", "Steady"], bpm: 80, timeSignature: [4, 4], lengthBeats: 4, color: "#38bdf8",
    description: "3박 스네어와 넓은 쉼표로 여유를 만든 하프타임 비트입니다.",
    pattern: drums([[0,"kick",.94],[0,"hat",.42],[.5,"hat",.34],[1,"hat",.48],[1.5,"kick",.65],[1.5,"hat",.36],[2,"snare",.92],[2,"hat",.5],[2.5,"hat",.36],[3,"kick",.73],[3,"hat",.44],[3.5,"hat",.34]])
  },
  {
    id: "drums-disco-four", name: "디스코 네 박", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Electronic", mood: ["Bright", "Energetic"], bpm: 122, timeSignature: [4, 4], lengthBeats: 4, color: "#38bdf8",
    description: "매 박 킥과 박 사이 하이햇이 일정하게 이어지는 춤 리듬입니다.",
    pattern: drums([[0,"kick",.9],[.5,"hat",.55],[1,"kick",.86],[1,"clap",.76],[1.5,"hat",.55],[2,"kick",.9],[2.5,"hat",.57],[3,"kick",.87],[3,"clap",.8],[3.5,"hat",.61]])
  },
  {
    id: "bass-walking-c", name: "걷는 베이스", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "C",
    genre: "Jazz", mood: ["Smooth", "Steady"], bpm: 112, timeSignature: [4, 4], lengthBeats: 8, color: "#f59e0b",
    description: "한 박에 한 음씩 걸으며 다음 코드로 자연스럽게 이어집니다.",
    pattern: notes([[0,"C2",.8,.78],[1,"E2",.8,.64],[2,"G2",.8,.7],[3,"A2",.8,.62],[4,"F2",.8,.76],[5,"A2",.8,.65],[6,"G2",.8,.69],[7,"B1",.8,.58]])
  },
  {
    id: "bass-funk-e", name: "튀는 펑크 베이스", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "Em",
    genre: "Funk", mood: ["Energetic", "Dark"], bpm: 105, timeSignature: [4, 4], lengthBeats: 4, color: "#f59e0b",
    description: "짧은 음과 쉼표가 드럼의 엇박에 답하는 베이스입니다.",
    pattern: notes([[0,"E2",.35,.85],[.75,"E2",.22,.68],[1.25,"G2",.25,.66],[2,"B1",.4,.78],[2.75,"D2",.22,.65],[3.25,"E2",.5,.83]])
  },
  {
    id: "bass-root-fifths-g", name: "으뜸음과 다섯째음", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "G",
    genre: "Pop", mood: ["Steady", "Warm"], bpm: 100, timeSignature: [4, 4], lengthBeats: 8, color: "#f59e0b",
    description: "G와 D, E와 B처럼 코드의 뿌리와 다섯째음을 오갑니다.",
    pattern: notes([[0,"G1",.85,.8],[1,"D2",.75,.61],[2,"D2",.8,.74],[3,"A1",.75,.59],[4,"E2",.8,.76],[5,"B1",.75,.6],[6,"C2",.8,.75],[7,"G1",.75,.61]])
  },
  {
    id: "bass-blues-a", name: "블루스 베이스 걸음", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "Am",
    genre: "Blues", mood: ["Warm", "Steady"], bpm: 92, timeSignature: [4, 4], lengthBeats: 8, color: "#f59e0b",
    description: "A 블루스 음계를 따라 오르내리는 연습용 베이스입니다.",
    pattern: notes([[0,"A1",.7,.81],[1,"C2",.7,.67],[2,"D2",.7,.7],[3,"D#2",.65,.57],[4,"E2",.7,.78],[5,"G2",.7,.63],[6,"E2",.7,.69],[7,"C2",.7,.62]])
  },
  {
    id: "chords-pop-c", name: "C장조 I-V-vi-IV", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "C",
    genre: "Pop", mood: ["Bright", "Warm"], bpm: 100, timeSignature: [4, 4], lengthBeats: 16, color: "#a78bfa",
    description: "도, 솔, 라단조, 파 코드를 네 마디에 걸쳐 듣습니다.", progression: "I-V-vi-IV",
    pattern: chords([[0,["C4","E4","G4"],3.75],[4,["G3","B3","D4"],3.75],[8,["A3","C4","E4"],3.75],[12,["F3","A3","C4"],3.75]])
  },
  {
    id: "chords-minor-a", name: "라단조 순환 화음", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "Am",
    genre: "Pop", mood: ["Dark", "Warm"], bpm: 90, timeSignature: [4, 4], lengthBeats: 16, color: "#a78bfa",
    description: "라단조에서 파, 도, 솔로 이어지는 네 마디 화음입니다.", progression: "i-VI-III-VII",
    pattern: chords([[0,["A3","C4","E4"],3.75],[4,["F3","A3","C4"],3.75],[8,["C4","E4","G4"],3.75],[12,["G3","B3","D4"],3.75]])
  },
  {
    id: "chords-jazz-f", name: "재즈 둘-다섯-하나", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "F",
    genre: "Jazz", mood: ["Smooth", "Warm"], bpm: 108, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "솔단조7, 도7, 파장조7로 긴장이 풀리는 화음을 익힙니다.", progression: "ii7-V7-Imaj7",
    pattern: chords([[0,["G3","A#3","D4","F4"],1.75],[2,["C4","E4","G4","A#4"],1.75],[4,["F3","A3","C4","E4"],3.75]])
  },
  {
    id: "chords-dreamy-d", name: "꿈꾸는 D장조", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "D",
    genre: "Pop", mood: ["Dreamy", "Bright"], bpm: 76, timeSignature: [4, 4], lengthBeats: 16, color: "#a78bfa",
    description: "레, 시단조, 솔, 라 화음을 길게 펼치는 느린 진행입니다.", progression: "I-vi-IV-V",
    pattern: chords([[0,["D4","F#4","A4"],3.8,.48],[4,["B3","D4","F#4"],3.8,.5],[8,["G3","B3","D4"],3.8,.5],[12,["A3","C#4","E4"],3.8,.52]])
  },
  {
    id: "chords-stabs-g", name: "짧은 솔 화음", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "G",
    genre: "Funk", mood: ["Energetic", "Bright"], bpm: 110, timeSignature: [4, 4], lengthBeats: 4, color: "#a78bfa",
    description: "짧은 솔장조 화음을 엇박에 찍어 리듬을 만듭니다.",
    pattern: chords([[.5,["G3","B3","D4"],.22,.65],[1.5,["G3","B3","D4"],.22,.48],[2.5,["G3","B3","D4"],.22,.66],[3.5,["G3","B3","D4"],.22,.52]])
  },
  {
    id: "chords-sus-e", name: "미단조 열린 화음", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "Em",
    genre: "Cinematic", mood: ["Dreamy", "Tense"], bpm: 84, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "미단조 화음에 라 음을 더해 열린 느낌을 만듭니다.",
    pattern: chords([[0,["E3","B3","E4","A4"],3.7,.48],[4,["C3","G3","C4","E4"],3.7,.5]])
  },
  {
    id: "melody-pentatonic-g", name: "솔 오음계", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "G",
    genre: "Pop", mood: ["Bright", "Steady"], bpm: 112, timeSignature: [4, 4], lengthBeats: 4, color: "#a78bfa",
    description: "솔, 라, 시, 레, 미 다섯 음으로 만든 따라 부르기 쉬운 선율입니다.",
    pattern: notes([[0,"G4",.45,.63],[.5,"A4",.45,.58],[1,"B4",.8,.67],[2,"D5",.45,.7],[2.5,"E5",.45,.64],[3,"D5",.8,.62]])
  },
  {
    id: "melody-call-d", name: "묻고 답하는 레 선율", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "D",
    genre: "Pop", mood: ["Bright", "Warm"], bpm: 104, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "앞의 짧은 물음에 뒤의 선율이 답하는 두 마디입니다.",
    pattern: notes([[0,"D4",.45,.62],[.5,"F#4",.45,.65],[1,"A4",.8,.72],[2.5,"F#4",.7,.54],[4,"A4",.45,.64],[4.5,"F#4",.45,.59],[5,"E4",.8,.57],[6,"D4",1.6,.69]])
  },
  {
    id: "melody-minor-a", name: "라단조 짧은 후크", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "Am",
    genre: "Hip Hop", mood: ["Dark", "Tense"], bpm: 92, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "라, 도, 미를 짧게 반복하다 솔로 마무리하는 후크입니다.",
    pattern: notes([[0,"A4",.3,.71],[.75,"C5",.3,.61],[1.5,"E5",.55,.73],[2.5,"C5",.35,.58],[3,"A4",.65,.68],[4,"A4",.3,.7],[4.75,"C5",.3,.6],[5.5,"E5",.55,.74],[6.5,"G5",.3,.65],[7,"E5",.75,.62]])
  },
  {
    id: "melody-ballad-f", name: "느린 파 선율", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "F",
    genre: "Pop", mood: ["Warm", "Smooth"], bpm: 72, timeSignature: [4, 4], lengthBeats: 4, color: "#a78bfa",
    description: "길게 이어지는 세 음으로 쉼과 여운을 연습합니다.",
    pattern: notes([[0,"F4",1.4,.52],[1.5,"A4",.9,.56],[2.5,"C5",1.4,.61]])
  },
  {
    id: "drums-trap-hats", name: "촘촘한 트랩 하이햇", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Hip Hop", mood: ["Dark", "Energetic"], bpm: 70, timeSignature: [4, 4], lengthBeats: 4, color: "#38bdf8",
    description: "하이햇을 16분음표로 쪼개고 3박 스네어를 강조합니다.",
    pattern: drums([[0,"kick",.94],[0,"hat",.43],[.25,"hat",.32],[.5,"hat",.47],[.75,"hat",.31],[1,"hat",.48],[1.25,"hat",.31],[1.5,"hat",.44],[1.75,"kick",.57],[1.75,"hat",.32],[2,"snare",.86],[2,"hat",.48],[2.25,"hat",.31],[2.5,"hat",.46],[2.75,"hat",.32],[3,"hat",.49],[3.25,"hat",.32],[3.5,"kick",.61],[3.5,"hat",.44],[3.75,"hat",.33]])
  },
  {
    id: "drums-latin-clave", name: "라틴 클라베", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Latin", mood: ["Energetic", "Bright"], bpm: 108, timeSignature: [4, 4], lengthBeats: 8, color: "#38bdf8",
    description: "두 마디에 걸친 3대2 클라베 느낌을 킥과 클랩으로 익힙니다.",
    pattern: drums([[0,"kick",.82],[0,"hat",.39],[1.5,"clap",.68],[2,"hat",.43],[3,"kick",.7],[3.5,"hat",.37],[4,"kick",.84],[4,"hat",.41],[5,"clap",.7],[5.5,"hat",.39],[6.5,"kick",.66],[7,"hat",.46]])
  },
  {
    id: "bass-reggae-c", name: "쉼표 많은 레게 베이스", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "C",
    genre: "Reggae", mood: ["Warm", "Steady"], bpm: 78, timeSignature: [4, 4], lengthBeats: 4, color: "#f59e0b",
    description: "첫 박을 비우고 짧게 답하는 레게 베이스입니다.",
    pattern: notes([[.5,"C2",.55,.78],[1.75,"G1",.35,.61],[2.5,"C2",.55,.75],[3.5,"E2",.35,.58]])
  },
  {
    id: "blues-twelve-bar", name: "열두 마디 A 블루스", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "A",
    genre: "Blues", mood: ["Warm", "Steady"], bpm: 96, timeSignature: [4, 4], lengthBeats: 48, color: "#a78bfa",
    description: "A7, D7, E7로 이루어진 열두 마디 블루스 화음 전체를 연주합니다.",
    progression: "I7-I7-I7-I7-IV7-IV7-I7-I7-V7-IV7-I7-V7",
    pattern: chords([[0,["A3","C#4","E4","G4"],3.75],[4,["A3","C#4","E4","G4"],3.75],[8,["A3","C#4","E4","G4"],3.75],[12,["A3","C#4","E4","G4"],3.75],
      [16,["D3","F#3","A3","C4"],3.75],[20,["D3","F#3","A3","C4"],3.75],[24,["A3","C#4","E4","G4"],3.75],[28,["A3","C#4","E4","G4"],3.75],
      [32,["E3","G#3","B3","D4"],3.75],[36,["D3","F#3","A3","C4"],3.75],[40,["A3","C#4","E4","G4"],3.75],[44,["E3","G#3","B3","D4"],3.75]])
  },
  {
    id: "chords-reggae-offbeat", name: "레게 엇박 화음", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "C",
    genre: "Reggae", mood: ["Warm", "Steady"], bpm: 78, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "박 사이에 짧은 화음을 찍어 레게의 빈 공간을 살립니다.",
    pattern: chords([[.5,["C4","E4","G4"],.25,.58],[1.5,["C4","E4","G4"],.25,.48],[2.5,["C4","E4","G4"],.25,.59],[3.5,["C4","E4","G4"],.25,.49],
      [4.5,["F3","A3","C4"],.25,.58],[5.5,["F3","A3","C4"],.25,.48],[6.5,["F3","A3","C4"],.25,.6],[7.5,["F3","A3","C4"],.25,.49]])
  },
  {
    id: "melody-blues-a", name: "A 블루스 응답", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "Am",
    genre: "Blues", mood: ["Warm", "Tense"], bpm: 96, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "블루스 음계의 꺾이는 음을 넣어 질문과 답을 만듭니다.",
    pattern: notes([[0,"A4",.7,.71],[1,"C5",.45,.63],[1.5,"D5",.45,.67],[2,"D#5",.3,.54],[2.5,"E5",.8,.73],[4,"G5",.45,.62],[4.5,"E5",.45,.65],[5.5,"D5",.5,.59],[6.5,"C5",.4,.6],[7,"A4",.8,.7]])
  },
  {
    id: "melody-latin-f", name: "파 장조 라틴 선율", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "F",
    genre: "Latin", mood: ["Bright", "Energetic"], bpm: 108, timeSignature: [4, 4], lengthBeats: 8, color: "#a78bfa",
    description: "박 사이를 건너뛰는 짧은 음으로 라틴 리듬에 답합니다.",
    pattern: notes([[0,"F4",.45,.65],[.75,"A4",.35,.61],[1.5,"C5",.45,.69],[2.5,"A4",.4,.6],[3.25,"G4",.55,.57],[4,"F4",.4,.66],[4.75,"A4",.35,.6],[5.5,"C5",.45,.7],[6.5,"D5",.4,.62],[7.25,"C5",.65,.64]])
  },
  {
    id: "drums-waltz-three", name: "왈츠 세 박", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Classical", mood: ["Warm", "Steady"], bpm: 90, timeSignature: [3, 4], lengthBeats: 6, color: "#38bdf8",
    description: "첫 박 킥과 두세 박의 가벼운 스네어로 왈츠의 셈여림을 익힙니다.",
    pattern: drums([[0,"kick",.88],[1,"snare",.46],[2,"snare",.41],[3,"kick",.82],[4,"snare",.44],[5,"snare",.38]])
  },
  {
    id: "drums-six-eight", name: "여섯 여덟박 흔들림", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Folk", mood: ["Warm", "Steady"], bpm: 84, timeSignature: [6, 8], lengthBeats: 3, color: "#38bdf8",
    description: "여섯 8분음표를 두 묶음으로 느끼며 첫째와 넷째를 강조합니다.",
    pattern: drums([[0,"kick",.9],[0,"hat",.54],[.5,"hat",.37],[1,"hat",.41],[1.5,"kick",.76],[1.5,"hat",.51],[2,"hat",.36],[2.5,"hat",.43]])
  },
  {
    id: "drums-ballad-three", name: "느린 삼박 발라드", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Pop", mood: ["Dreamy", "Warm"], bpm: 66, timeSignature: [3, 4], lengthBeats: 6, color: "#38bdf8",
    description: "첫 박을 낮게 두고 마지막 박의 하이햇으로 다음 마디를 이끕니다.",
    pattern: drums([[0,"kick",.75],[.5,"hat",.32],[1,"snare",.4],[2,"hat",.4],[2.5,"hat",.34],[3,"kick",.79],[4,"snare",.37],[4.5,"hat",.32],[5,"hat",.43],[5.5,"hat",.34]])
  },
  {
    id: "drums-rock-six-eight", name: "육팔박 록", category: "Drums", musicalRole: "drums", type: "midi", trackType: "drum",
    genre: "Rock", mood: ["Energetic", "Tense"], bpm: 112, timeSignature: [6, 8], lengthBeats: 6, color: "#38bdf8",
    description: "두 번째 세 음 묶음의 스네어와 킥이 힘 있게 부딪히는 록 리듬입니다.",
    pattern: drums([[0,"kick",.96],[0,"hat",.54],[.5,"hat",.39],[1,"kick",.62],[1,"hat",.42],[1.5,"snare",.88],[1.5,"hat",.56],[2,"hat",.4],[2.5,"hat",.45],[3,"kick",.92],[3,"hat",.54],[3.5,"hat",.39],[4,"hat",.45],[4.5,"snare",.91],[4.5,"hat",.55],[5,"kick",.65],[5,"hat",.43],[5.5,"hat",.47]])
  },
  {
    id: "bass-waltz-f", name: "파장조 왈츠 베이스", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "F",
    genre: "Classical", mood: ["Warm", "Steady"], bpm: 90, timeSignature: [3, 4], lengthBeats: 6, color: "#f59e0b",
    description: "한 마디마다 으뜸음과 다섯째음을 짚어 왈츠 화음의 바탕을 만듭니다.",
    pattern: notes([[0,"F2",.85,.78],[1,"C3",.55,.49],[2,"C3",.55,.46],[3,"C2",.85,.75],[4,"G2",.55,.48],[5,"G2",.55,.45]])
  },
  {
    id: "bass-six-eight-d", name: "레장조 육팔 베이스", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "D",
    genre: "Folk", mood: ["Bright", "Steady"], bpm: 96, timeSignature: [6, 8], lengthBeats: 6, color: "#f59e0b",
    description: "한 마디를 둘로 나눠 첫째와 넷째 8분음표에 베이스를 놓습니다.",
    pattern: notes([[0,"D2",1.2,.82],[1.5,"A1",1.2,.67],[3,"G2",1.2,.79],[4.5,"D2",1.2,.66]])
  },
  {
    id: "bass-minor-six-eight-e", name: "미단조 육팔 물결", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "Em",
    genre: "Cinematic", mood: ["Dark", "Dreamy"], bpm: 72, timeSignature: [6, 8], lengthBeats: 6, color: "#f59e0b",
    description: "길게 울리는 미 음 사이에 시와 레를 넣어 어두운 흐름을 만듭니다.",
    pattern: notes([[0,"E2",1.35,.73],[1.5,"B1",.9,.53],[2.5,"D2",.4,.48],[3,"C2",1.3,.7],[4.5,"G1",1.1,.56]])
  },
  {
    id: "bass-jazz-three-bb", name: "내림시 재즈 삼박", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "Bb",
    genre: "Jazz", mood: ["Smooth", "Steady"], bpm: 118, timeSignature: [3, 4], lengthBeats: 6, color: "#f59e0b",
    description: "세 박을 한 음씩 걸으며 내림시와 미플랫 화음 사이를 잇습니다.",
    pattern: notes([[0,"A#1",.78,.75],[1,"D2",.72,.55],[2,"F2",.72,.64],[3,"D#2",.78,.73],[4,"G2",.72,.55],[5,"A#1",.72,.62]])
  },
  {
    id: "bass-folk-three-g", name: "솔장조 포크 삼박", category: "Bass", musicalRole: "bass", type: "midi", trackType: "instrument", key: "G",
    genre: "Folk", mood: ["Warm", "Bright"], bpm: 104, timeSignature: [3, 4], lengthBeats: 3, color: "#f59e0b",
    description: "첫 박 솔에서 세 번째 박 레로 건너뛰는 간결한 포크 베이스입니다.",
    pattern: notes([[0,"G2",1.2,.78],[2,"D2",.8,.57]])
  },
  {
    id: "chords-waltz-g", name: "솔장조 왈츠 화음", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "G",
    genre: "Classical", mood: ["Warm", "Steady"], bpm: 90, timeSignature: [3, 4], lengthBeats: 6, color: "#a78bfa",
    description: "솔과 레 화음을 각 마디 두세 박에서 짧게 눌러 왈츠 반주를 만듭니다.", progression: "I-V",
    pattern: chords([[1,["G3","B3","D4"],.62,.5],[2,["G3","B3","D4"],.62,.46],[4,["A3","D4","F#4"],.62,.51],[5,["A3","D4","F#4"],.62,.46]])
  },
  {
    id: "chords-six-eight-d", name: "레장조 육팔 아르페지오", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "D",
    genre: "Folk", mood: ["Bright", "Warm"], bpm: 96, timeSignature: [6, 8], lengthBeats: 6, color: "#a78bfa",
    description: "레와 솔 화음의 세 음을 8분음표로 펼쳐 두 마디를 채웁니다.", progression: "I-IV",
    pattern: notes([[0,"D4",.46,.55],[.5,"F#4",.46,.48],[1,"A4",.46,.52],[1.5,"F#4",.46,.49],[2,"A4",.46,.5],[2.5,"F#4",.46,.47],[3,"G3",.46,.55],[3.5,"B3",.46,.48],[4,"D4",.46,.52],[4.5,"B3",.46,.49],[5,"D4",.46,.5],[5.5,"B3",.46,.47]])
  },
  {
    id: "chords-folk-three-d", name: "레장조 포크 삼박", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "D",
    genre: "Folk", mood: ["Warm", "Steady"], bpm: 104, timeSignature: [3, 4], lengthBeats: 6, color: "#a78bfa",
    description: "레 화음을 펼친 뒤 라 화음으로 답하는 두 마디 포크 반주입니다.", progression: "I-V",
    pattern: chords([[0,["D4","F#4","A4"],1.3,.48],[2,["F#4","A4"],.7,.42],[3,["A3","C#4","E4"],1.3,.5],[5,["C#4","E4"],.7,.43]])
  },
  {
    id: "chords-six-eight-am", name: "라단조 육팔 화음", category: "Synth", musicalRole: "harmony", type: "midi", trackType: "instrument", key: "Am",
    genre: "Cinematic", mood: ["Dreamy", "Tense"], bpm: 74, timeSignature: [6, 8], lengthBeats: 6, color: "#a78bfa",
    description: "세 박씩 호흡하는 라단조와 파장조 화음으로 긴장을 만듭니다.", progression: "i-VI",
    pattern: chords([[0,["A3","C4","E4"],1.35,.48],[1.5,["A3","C4","E4"],1.35,.38],[3,["F3","A3","C4"],1.35,.5],[4.5,["F3","A3","C4"],1.35,.39]])
  },
  {
    id: "melody-waltz-c", name: "도장조 왈츠 선율", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "C",
    genre: "Classical", mood: ["Warm", "Bright"], bpm: 90, timeSignature: [3, 4], lengthBeats: 6, color: "#a78bfa",
    description: "첫 박의 긴 음과 뒤의 두 짧은 음으로 왈츠의 셈여림을 노래합니다.",
    pattern: notes([[0,"C5",1.3,.68],[1.5,"E5",.45,.53],[2,"G5",.85,.61],[3,"F5",1.2,.64],[4.5,"D5",.45,.52],[5,"C5",.85,.67]])
  },
  {
    id: "melody-six-eight-g", name: "솔장조 육팔 노래", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "G",
    genre: "Folk", mood: ["Bright", "Warm"], bpm: 96, timeSignature: [6, 8], lengthBeats: 6, color: "#a78bfa",
    description: "여섯 개의 8분음표를 두 묶음으로 따라 부르는 민요풍 선율입니다.",
    pattern: notes([[0,"G4",.45,.63],[.5,"A4",.45,.54],[1,"B4",.45,.57],[1.5,"D5",.9,.68],[2.5,"B4",.45,.55],[3,"A4",.45,.59],[3.5,"B4",.45,.55],[4,"D5",.45,.6],[4.5,"G5",.9,.7],[5.5,"D5",.45,.57]])
  },
  {
    id: "melody-folk-three-d", name: "레장조 삼박 질문", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "D",
    genre: "Folk", mood: ["Bright", "Steady"], bpm: 104, timeSignature: [3, 4], lengthBeats: 6, color: "#a78bfa",
    description: "첫 마디의 올라가는 질문에 다음 마디의 내려가는 음이 답합니다.",
    pattern: notes([[0,"D4",.7,.62],[1,"F#4",.7,.58],[2,"A4",.8,.67],[3,"B4",.7,.62],[4,"A4",.7,.59],[5,"F#4",.8,.63]])
  },
  {
    id: "melody-six-eight-e", name: "미단조 육팔 그림자", category: "Synth", musicalRole: "melody", type: "midi", trackType: "instrument", key: "Em",
    genre: "Cinematic", mood: ["Dark", "Dreamy"], bpm: 72, timeSignature: [6, 8], lengthBeats: 6, color: "#a78bfa",
    description: "긴 미 음 뒤로 솔과 시가 따라오며 어두운 여운을 남깁니다.",
    pattern: notes([[0,"E4",1.3,.58],[1.5,"G4",.45,.52],[2,"B4",.8,.6],[3,"C5",1.2,.61],[4.5,"B4",.45,.52],[5,"G4",.8,.56]])
  }
];
