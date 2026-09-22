// The app has one display language. Keep shared UI terms here while leaving
// persisted values, keyboard notes, and instrument names in their original form.
export const uiText = {
  common: {
    loop: "루프",
    track: "트랙",
    take: "테이크",
    mixer: "믹서",
    master: "마스터",
    bus: "버스",
    tempo: "템포",
    cycle: "반복 구간",
    quantize: "정렬",
    play: "재생",
    stop: "정지",
    preview: "미리 듣기",
    write: "클립에 입력",
    writeOn: "클립 입력 켜짐",
    writeOff: "클립 입력 꺼짐",
    clear: "지우기",
    drummer: "드러머",
    pianoRoll: "피아노롤"
  },
  drumLane: {
    kick: "킥",
    snare: "스네어",
    hat: "하이햇",
    clap: "클랩",
    tom: "탐",
    fill: "필인"
  }
} as const;
