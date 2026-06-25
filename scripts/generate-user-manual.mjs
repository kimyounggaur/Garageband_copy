import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "output", "manual");
const assetsDir = join(outDir, "assets");
const htmlPath = join(outDir, "garageband-user-manual.html");
const svgPath = join(outDir, "garageband-user-manual.svg");
const pdfPath = join(outDir, "garageband-user-manual.pdf");
const screenshotPath = join(assetsDir, "app-overview.png");

mkdirSync(assetsDir, { recursive: true });

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textLines(lines, x, y, options = {}) {
  const size = options.size ?? 22;
  const fill = options.fill ?? "#d8e2f0";
  const weight = options.weight ?? 700;
  const gap = options.gap ?? size * 1.45;
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * gap}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeHtml(line)}</text>`)
    .join("");
}

function pill(x, y, w, h, label, color = "#38bdf8", fill = "#111827") {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${color}" stroke-width="2"/>
    <text x="${x + w / 2}" y="${y + h / 2 + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="${color}">${escapeHtml(label)}</text>
  `;
}

function arrow(x1, y1, x2, y2, color = "#38bdf8") {
  return `
    <path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
    <path d="M ${x2 - 14} ${y2 - 9} L ${x2} ${y2} L ${x2 - 14} ${y2 + 9}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function cardSvg(inner, width = 920, height = 430, title = "") {
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panelGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#141b28"/>
          <stop offset="1" stop-color="#0a0f18"/>
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="22" fill="url(#panelGrad)"/>
      ${inner}
    </svg>
  `;
}

function figure(id, title, body, svg, caption) {
  return `
    <figure class="figure" id="${id}">
      <div class="figure-title">${escapeHtml(title)}</div>
      ${body ? `<p class="figure-body">${escapeHtml(body)}</p>` : ""}
      <div class="figure-art">${svg}</div>
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
    </figure>
  `;
}

function steps(items) {
  return `<ol class="steps">${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function callout(title, body, tone = "blue") {
  return `<aside class="callout ${tone}"><strong>${escapeHtml(title)}</strong><span>${body}</span></aside>`;
}

function interfaceMapSvg() {
  return cardSvg(`
    <rect x="34" y="32" width="852" height="52" rx="12" fill="#0e1624" stroke="#273244"/>
    ${pill(54, 45, 126, 26, "Transport", "#5eead4", "#07131b")}
    ${pill(197, 45, 112, 26, "LCD", "#4ade80", "#07131b")}
    ${pill(326, 45, 148, 26, "Tempo / Key", "#fbbf24", "#171104")}
    ${pill(610, 45, 124, 26, "Modes", "#38bdf8", "#07131b")}
    ${pill(750, 45, 110, 26, "Export", "#a78bfa", "#120f1f")}

    <rect x="34" y="112" width="600" height="230" rx="16" fill="#0b111b" stroke="#273244"/>
    <rect x="34" y="112" width="115" height="230" rx="16" fill="#111827" stroke="#273244"/>
    <rect x="149" y="112" width="485" height="34" fill="#111827"/>
    <line x1="149" y1="180" x2="634" y2="180" stroke="#273244"/>
    <line x1="149" y1="248" x2="634" y2="248" stroke="#273244"/>
    <rect x="175" y="168" width="245" height="40" rx="8" fill="#818cf8"/>
    <rect x="175" y="235" width="245" height="40" rx="8" fill="#818cf8"/>
    <rect x="420" y="300" width="185" height="40" rx="8" fill="#5ec26b"/>
    ${textLines(["트랙 헤더", "클립 배치", "재생 위치"], 52, 168, { size: 19, fill: "#c7d2fe", gap: 44 })}
    ${textLines(["Timeline"], 372, 142, { size: 24, fill: "#e5f2ff" })}

    <rect x="654" y="112" width="232" height="230" rx="16" fill="#111827" stroke="#273244"/>
    ${textLines(["오른쪽 Studio 패널", "Library / Loops", "Audio / Smart", "Lesson"], 676, 154, { size: 22, fill: "#e5f2ff", gap: 42 })}
    <rect x="34" y="362" width="852" height="40" rx="14" fill="#111827" stroke="#273244"/>
    ${textLines(["하단 Clip Editor: 선택한 클립을 MIDI, Touch, Drummer, Audio 파형으로 편집"], 62, 389, { size: 22, fill: "#bfdbfe" })}
  `, 920, 430, "화면 구조 지도");
}

function transportSvg() {
  return cardSvg(`
    <rect x="40" y="70" width="840" height="96" rx="18" fill="#0f1724" stroke="#334155"/>
    ${["처음", "재생", "정지", "녹음", "사이클", "Undo", "Redo"].map((label, i) => {
      const x = 65 + i * 88;
      return `<circle cx="${x}" cy="118" r="26" fill="${i === 1 ? "#5ec26b" : i === 3 ? "#fb7185" : "#1f2937"}" stroke="#465568" stroke-width="2"/><text x="${x}" y="160" text-anchor="middle" font-size="16" font-weight="800" fill="#cbd5e1">${label}</text>`;
    }).join("")}
    <rect x="665" y="88" width="180" height="60" rx="14" fill="#06291f" stroke="#2dd4bf"/>
    <text x="755" y="125" text-anchor="middle" font-size="28" font-weight="900" fill="#86efac">001|1|000</text>
    ${textLines(["기본 순서", "1. Tempo / Key 설정", "2. Cycle 또는 Count-in 선택", "3. Record / Play", "4. Save / Export"], 88, 220, { size: 24, fill: "#e2e8f0", gap: 40 })}
    ${arrow(288, 250, 548, 250, "#fbbf24")}
    ${textLines(["상단 바는 프로젝트 전체를 제어하는 콘솔입니다."], 428, 324, { size: 24, fill: "#fde68a" })}
  `, 920, 430, "Transport controls");
}

function timelineSvg() {
  const grid = Array.from({ length: 10 }, (_, i) => `<line x1="${170 + i * 62}" y1="92" x2="${170 + i * 62}" y2="338" stroke="#243041"/>`).join("");
  return cardSvg(`
    <rect x="48" y="70" width="820" height="292" rx="18" fill="#0b111b" stroke="#334155"/>
    <rect x="48" y="70" width="122" height="292" rx="18" fill="#111827" stroke="#334155"/>
    ${grid}
    ${["비트", "베이스", "건반", "오디오"].map((label, i) => `<line x1="48" y1="${132 + i * 58}" x2="868" y2="${132 + i * 58}" stroke="#243041"/><text x="72" y="${112 + i * 58}" font-size="20" font-weight="900" fill="#e5f2ff">${label}</text>`).join("")}
    <rect x="190" y="100" width="250" height="42" rx="9" fill="#818cf8"/>
    <rect x="190" y="158" width="210" height="42" rx="9" fill="#818cf8"/>
    <rect x="452" y="216" width="260" height="42" rx="9" fill="#5ec26b"/>
    <rect x="604" y="274" width="176" height="42" rx="9" fill="#46a7e0"/>
    <line x1="182" y1="70" x2="182" y2="362" stroke="#4ade80" stroke-width="5"/>
    <rect x="360" y="74" width="250" height="22" rx="6" fill="#fbbf2433" stroke="#fbbf24"/>
    ${textLines(["클립은 트랙 위의 색상 블록입니다.", "좌우 핸들로 길이를 조절하고, 드래그로 위치를 바꿉니다.", "노란 Cycle 영역은 반복 재생과 구간 내보내기에 쓰입니다."], 70, 374, { size: 19, fill: "#dbeafe", gap: 24 })}
  `, 920, 430, "Timeline editing");
}

function loopFlowSvg() {
  return cardSvg(`
    <rect x="50" y="82" width="230" height="254" rx="18" fill="#111827" stroke="#334155"/>
    ${textLines(["Loop Browser", "검색", "카테고리", "장르 / 무드"], 78, 126, { size: 22, fill: "#e5f2ff", gap: 48 })}
    <rect x="310" y="82" width="250" height="254" rx="18" fill="#0b111b" stroke="#334155"/>
    <rect x="344" y="130" width="176" height="44" rx="9" fill="#818cf8"/>
    <rect x="344" y="206" width="176" height="44" rx="9" fill="#5ec26b"/>
    ${textLines(["Timeline"], 374, 112, { size: 24, fill: "#bfdbfe" })}
    <rect x="610" y="82" width="250" height="254" rx="18" fill="#0b111b" stroke="#334155"/>
    <rect x="646" y="135" width="180" height="52" rx="12" fill="#38bdf8"/>
    <rect x="646" y="218" width="180" height="52" rx="12" fill="#a78bfa"/>
    ${textLines(["Live Loops", "Scene 1", "Scene 2"], 666, 112, { size: 23, fill: "#e0f2fe", gap: 66 })}
    ${arrow(278, 182, 342, 152, "#38bdf8")}
    ${arrow(278, 238, 646, 244, "#a78bfa")}
    ${textLines(["드래그 앤 드롭", "또는 + 버튼"], 385, 362, { size: 25, fill: "#fde68a", gap: 36 })}
  `, 920, 430, "Loop drag flow");
}

function midiSvg() {
  const keys = Array.from({ length: 10 }, (_, i) => `<rect x="58" y="${78 + i * 29}" width="70" height="28" fill="${i % 2 ? "#111827" : "#1f2937"}" stroke="#334155"/><text x="76" y="${98 + i * 29}" font-size="15" fill="#cbd5e1">${["C5","B4","A4","G4","F4","E4","D4","C4","B3","A3"][i]}</text>`).join("");
  const grid = Array.from({ length: 12 }, (_, i) => `<line x1="${128 + i * 58}" y1="78" x2="${128 + i * 58}" y2="368" stroke="#273244"/>`).join("");
  return cardSvg(`
    <rect x="40" y="48" width="840" height="350" rx="18" fill="#0b111b" stroke="#334155"/>
    ${keys}${grid}
    <rect x="174" y="280" width="92" height="24" rx="6" fill="#5ec26b"/>
    <rect x="290" y="222" width="92" height="24" rx="6" fill="#5ec26b"/>
    <rect x="406" y="164" width="92" height="24" rx="6" fill="#5ec26b"/>
    <rect x="522" y="135" width="160" height="24" rx="6" fill="#5ec26b"/>
    <rect x="720" y="88" width="86" height="24" rx="6" fill="#5ec26b"/>
    ${textLines(["Piano Roll"], 58, 38, { size: 28, fill: "#e5f2ff" })}
    ${textLines(["노트 이동", "길이 조절", "Quantize", "Scale Lock", "Velocity"], 670, 170, { size: 22, fill: "#bfdbfe", gap: 34 })}
  `, 920, 430, "Piano roll");
}

function audioSvg() {
  const wave = Array.from({ length: 70 }, (_, i) => {
    const h = 16 + Math.abs(Math.sin(i * 0.52)) * 92;
    return `<rect x="${88 + i * 10}" y="${206 - h / 2}" width="5" height="${h}" rx="2" fill="#4ade80"/>`;
  }).join("");
  return cardSvg(`
    <rect x="60" y="90" width="800" height="230" rx="18" fill="#0b111b" stroke="#334155"/>
    ${wave}
    <rect x="112" y="105" width="90" height="200" fill="#0ea5e933" stroke="#38bdf8"/>
    <rect x="630" y="105" width="112" height="200" fill="#f59e0b33" stroke="#fbbf24"/>
    ${textLines(["Trim Start"], 108, 344, { size: 20, fill: "#7dd3fc" })}
    ${textLines(["Fade Out"], 630, 344, { size: 20, fill: "#fde68a" })}
    ${textLines(["오디오 클립 편집"], 60, 54, { size: 30, fill: "#e5f2ff" })}
    ${textLines(["Normalize", "Split", "Take Comp", "Gain / Rate / Pitch"], 620, 130, { size: 23, fill: "#dbeafe", gap: 38 })}
  `, 920, 430, "Audio editing");
}

function mixerSvg() {
  return cardSvg(`
    ${["Beat", "Bass", "Keys", "Audio", "Master"].map((label, i) => {
      const x = 56 + i * 164;
      const master = i === 4;
      return `
        <rect x="${x}" y="64" width="126" height="306" rx="16" fill="${master ? "#172033" : "#111827"}" stroke="#334155"/>
        <text x="${x + 63}" y="100" text-anchor="middle" font-size="21" font-weight="900" fill="#e5f2ff">${label}</text>
        <circle cx="${x + 36}" cy="142" r="18" fill="#0b111b" stroke="#38bdf8"/>
        <circle cx="${x + 88}" cy="142" r="18" fill="#0b111b" stroke="#a78bfa"/>
        <rect x="${x + 55}" y="188" width="16" height="128" rx="8" fill="#263244"/>
        <rect x="${x + 55}" y="${master ? 220 : 248}" width="16" height="${master ? 96 : 68}" rx="8" fill="#5ec26b"/>
        <rect x="${x + 22}" y="332" width="82" height="22" rx="8" fill="#0b111b" stroke="#465568"/>
      `;
    }).join("")}
    ${arrow(182, 220, 710, 220, "#fbbf24")}
    ${textLines(["Track FX | Sends | Pan | Volume | Master Limiter"], 70, 408, { size: 22, fill: "#fde68a", gap: 1 })}
  `, 920, 430, "Mixer");
}

function automationSvg() {
  return cardSvg(`
    <rect x="58" y="80" width="804" height="260" rx="18" fill="#0b111b" stroke="#334155"/>
    ${Array.from({ length: 10 }, (_, i) => `<line x1="${80 + i * 80}" y1="105" x2="${80 + i * 80}" y2="318" stroke="#273244"/>`).join("")}
    <path d="M 95 280 C 190 278, 220 120, 320 130 S 520 250, 610 160 S 760 100, 830 130" fill="none" stroke="#5ec26b" stroke-width="6" stroke-linecap="round"/>
    ${[[95,280],[320,130],[610,160],[830,130]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#5ec26b" stroke="#0b111b" stroke-width="4"/>`).join("")}
    ${textLines(["Automation Lane"], 60, 48, { size: 30, fill: "#e5f2ff" })}
    ${textLines(["1. 트랙의 A 버튼", "2. Volume / Pan / Send 선택", "3. 클릭으로 포인트 추가", "4. 드래그로 곡의 움직임 만들기"], 102, 350, { size: 19, fill: "#dbeafe", gap: 24 })}
  `, 920, 430, "Automation lane");
}

function liveLoopsSvg() {
  const cells = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const has = (r + c) % 2 === 0;
      cells.push(`<rect x="${194 + c * 138}" y="${116 + r * 58}" width="118" height="44" rx="10" fill="${has ? ["#818cf8","#5ec26b","#38bdf8","#f59e0b"][(r+c)%4] : "#111827"}" stroke="#334155"/>`);
    }
  }
  return cardSvg(`
    <rect x="54" y="72" width="812" height="300" rx="18" fill="#0b111b" stroke="#334155"/>
    <rect x="54" y="72" width="134" height="300" rx="18" fill="#111827" stroke="#334155"/>
    ${["Scene 1", "Scene 2", "Scene 3", "Scene 4"].map((s,i) => `<rect x="${194 + i * 138}" y="86" width="118" height="38" rx="10" fill="#172033" stroke="#465568"/><text x="${253 + i * 138}" y="111" text-anchor="middle" font-size="17" font-weight="900" fill="#e5f2ff">${s}</text>`).join("")}
    ${["Beat", "Bass", "Keys", "Audio"].map((t,i) => `<text x="84" y="${145 + i * 58}" font-size="20" font-weight="900" fill="#cbd5e1">${t}</text>`).join("")}
    ${cells.join("")}
    <rect x="774" y="86" width="56" height="38" rx="10" fill="#5ec26b"/>
    <text x="802" y="111" text-anchor="middle" font-size="19" font-weight="900" fill="#07111c">Stop</text>
    ${textLines(["셀 클릭: 다음 마디에 큐", "Scene 클릭: 한 열 전체 실행", "빈 셀: Loop 드롭"], 104, 380, { size: 20, fill: "#bfdbfe", gap: 24 })}
  `, 920, 430, "Live loops");
}

function shareSvg() {
  return cardSvg(`
    <rect x="230" y="54" width="460" height="330" rx="22" fill="#111827" stroke="#465568" filter="url(#softShadow)"/>
    ${textLines(["Share"], 268, 102, { size: 34, fill: "#f8fafc" })}
    ${["WAV", "MP3", "Standard", "High", "Full", "Cycle"].map((label, i) => {
      const x = 268 + (i % 2) * 170;
      const y = 132 + Math.floor(i / 2) * 54;
      return pill(x, y, 140, 34, label, i === 1 ? "#a78bfa" : "#38bdf8", "#0b111b");
    }).join("")}
    ${["Mix", "Stems ZIP", "Project", "Import"].map((label, i) => {
      const x = 268 + (i % 2) * 170;
      const y = 304 + Math.floor(i / 2) * 48;
      return `<rect x="${x}" y="${y}" width="140" height="36" rx="10" fill="${i === 0 ? "#5ec26b" : "#172033"}" stroke="#465568"/><text x="${x + 70}" y="${y + 24}" text-anchor="middle" font-size="17" font-weight="900" fill="${i === 0 ? "#07111c" : "#e5f2ff"}">${label}</text>`;
    }).join("")}
    ${textLines(["MP3 선택 시 현재 엔진은 WAV로 안전 폴백합니다.", "프로젝트 파일은 .webband.json으로 저장/복원됩니다."], 82, 392, { size: 19, fill: "#fde68a", gap: 24 })}
  `, 920, 430, "Share export modal");
}

function lessonSvg() {
  return cardSvg(`
    <rect x="52" y="82" width="210" height="230" rx="18" fill="#111827" stroke="#334155"/>
    <rect x="355" y="82" width="210" height="230" rx="18" fill="#111827" stroke="#334155"/>
    <rect x="658" y="82" width="210" height="230" rx="18" fill="#111827" stroke="#334155"/>
    ${textLines(["Lesson", "미션", "힌트", "진도"], 94, 130, { size: 25, fill: "#dbeafe", gap: 42 })}
    ${textLines(["Review", "길이", "균형", "루브릭"], 397, 130, { size: 25, fill: "#fde68a", gap: 42 })}
    ${textLines(["Teacher", "반", "과제", "피드백"], 700, 130, { size: 25, fill: "#f0abfc", gap: 42 })}
    ${arrow(262, 196, 355, 196, "#38bdf8")}
    ${arrow(565, 196, 658, 196, "#a78bfa")}
    ${textLines(["학생은 Lesson에서 만들고 Review로 제출 준비를 확인합니다.", "교사는 Teacher에서 반과 과제를 관리합니다."], 82, 374, { size: 22, fill: "#e5f2ff", gap: 30 })}
  `, 920, 430, "Education workflow");
}

function workflowSvg() {
  return cardSvg(`
    ${["새 프로젝트", "루프 추가", "MIDI 편집", "오디오 녹음", "믹서 조정", "내보내기"].map((label, i) => {
      const x = 52 + i * 138;
      const color = ["#38bdf8", "#818cf8", "#5ec26b", "#f59e0b", "#a78bfa", "#fb7185"][i];
      return `<circle cx="${x + 52}" cy="166" r="46" fill="${color}" opacity="0.95"/><text x="${x + 52}" y="250" text-anchor="middle" font-size="19" font-weight="900" fill="#e5f2ff">${label}</text>`;
    }).join("")}
    ${[0,1,2,3,4].map((i) => arrow(150 + i * 138, 166, 190 + i * 138, 166, "#cbd5e1")).join("")}
    ${textLines(["10분 첫 곡 만들기 루틴"], 58, 64, { size: 34, fill: "#f8fafc" })}
    ${textLines(["1. BPM/Key를 정한다  2. 드럼과 베이스 루프를 놓는다  3. 건반 MIDI를 쓴다", "4. 녹음이 필요하면 Audio 트랙을 Arm한다  5. Mixer에서 밸런스를 맞춘다  6. Share에서 Mix 또는 Stems ZIP"], 74, 332, { size: 21, fill: "#dbeafe", gap: 32 })}
  `, 920, 430, "First song workflow");
}

function troubleshootSvg() {
  return cardSvg(`
    ${pill(70, 62, 230, 48, "소리가 안 나요", "#fb7185", "#1a1014")}
    ${pill(350, 62, 230, 48, "녹음이 안 돼요", "#fbbf24", "#171104")}
    ${pill(630, 62, 230, 48, "Export가 달라요", "#a78bfa", "#130f1f")}
    ${textLines(["트랙 M/S 확인", "Master 볼륨 확인", "브라우저 오디오 허용"], 96, 156, { size: 21, fill: "#fecdd3", gap: 32 })}
    ${textLines(["Audio 트랙 추가", "Record enable", "마이크 권한 허용"], 382, 156, { size: 21, fill: "#fde68a", gap: 32 })}
    ${textLines(["Cycle 범위 확인", "MP3는 WAV 폴백", "프로젝트 저장 후 재시도"], 662, 156, { size: 21, fill: "#ddd6fe", gap: 32 })}
    ${arrow(184, 256, 184, 320, "#fb7185")}
    ${arrow(464, 256, 464, 320, "#fbbf24")}
    ${arrow(744, 256, 744, 320, "#a78bfa")}
    ${textLines(["대부분의 문제는 권한, 선택된 트랙, 사이클 범위, 저장 상태에서 시작합니다."], 96, 380, { size: 23, fill: "#e5f2ff" })}
  `, 920, 430, "Troubleshooting");
}

const figures = {
  interfaceMapSvg,
  transportSvg,
  timelineSvg,
  loopFlowSvg,
  midiSvg,
  audioSvg,
  mixerSvg,
  automationSvg,
  liveLoopsSvg,
  shareSvg,
  lessonSvg,
  workflowSvg,
  troubleshootSvg
};

function quickMapSvg() {
  const panelWidth = 720;
  const panelHeight = 310;
  const gap = 36;
  const names = [
    ["화면 구조", "상단 Transport, 중앙 Timeline, 오른쪽 Studio, 하단 Clip Editor를 한 화면에서 사용합니다."],
    ["작곡 흐름", "BPM/Key 설정 후 루프, MIDI, 오디오를 쌓고 Mixer에서 균형을 잡습니다."],
    ["타임라인", "클립은 색상 블록이며 드래그, 길이 조절, 루프 반복, 사이클 구간을 지원합니다."],
    ["루프와 악기", "Loop Browser와 Library에서 소리를 고르고 드래그하거나 + 버튼으로 배치합니다."],
    ["편집기", "Piano Roll, Touch, Drummer, Audio 파형 편집을 선택 클립에 맞춰 사용합니다."],
    ["믹서와 자동화", "볼륨, 팬, FX, Send, Automation 포인트로 곡의 움직임을 만듭니다."],
    ["Live Loops", "Scene과 Cell 단위로 루프를 큐잉하고 즉흥 연주처럼 실행합니다."],
    ["Share / Export", "Mix, Stems ZIP, Project 파일, Import를 한 모달에서 처리합니다."]
  ];
  const panels = names
    .map(([title, body], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 70 + col * (panelWidth + gap);
      const y = 330 + row * (panelHeight + gap);
      const color = ["#38bdf8", "#5ec26b", "#818cf8", "#f59e0b", "#a78bfa", "#fb7185", "#2dd4bf", "#f0abfc"][index];
      return `
        <g transform="translate(${x} ${y})">
          <rect width="${panelWidth}" height="${panelHeight}" rx="28" fill="#111827" stroke="#334155" stroke-width="2"/>
          <circle cx="70" cy="72" r="36" fill="${color}"/>
          <text x="126" y="68" font-size="34" font-weight="900" fill="#f8fafc">${escapeHtml(title)}</text>
          <text x="126" y="104" font-size="19" font-weight="700" fill="#94a3b8">WebBand Studio</text>
          ${textLines(body.match(/.{1,28}(\s|$)/g)?.map((line) => line.trim()) ?? [body], 54, 168, { size: 24, fill: "#dbeafe", gap: 34 })}
          <rect x="54" y="250" width="${panelWidth - 108}" height="16" rx="8" fill="#243041"/>
          <rect x="54" y="250" width="${120 + index * 48}" height="16" rx="8" fill="${color}"/>
        </g>
      `;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="1840" viewBox="0 0 1600 1840" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GarageBand Copy 사용자 매뉴얼 비주얼 맵">
  <rect width="1600" height="1840" fill="#0a0f18"/>
  <text x="70" y="110" font-size="58" font-weight="900" fill="#f8fafc">GarageBand Copy 사용자 매뉴얼</text>
  <text x="70" y="164" font-size="28" font-weight="700" fill="#94a3b8">작곡, 녹음, 믹싱, 수업, 공유까지 한눈에 보는 비주얼 지도</text>
  <rect x="70" y="214" width="1460" height="56" rx="22" fill="#111827" stroke="#334155"/>
  <text x="106" y="251" font-size="24" font-weight="900" fill="#38bdf8">추천 순서</text>
  <text x="250" y="251" font-size="24" font-weight="800" fill="#e5f2ff">새 프로젝트 -> 루프 배치 -> MIDI/오디오 편집 -> 믹서/자동화 -> Share Export</text>
  ${panels}
</svg>`;
}

function htmlManual() {
  const screenshotMarkup = existsSync(screenshotPath)
    ? `<figure class="figure screenshot"><div class="figure-title">실제 앱 화면: 전체 작업 공간</div><img src="assets/app-overview.png" alt="GarageBand Copy 전체 작업 화면 스크린샷"/><figcaption>상단 Transport, 중앙 Timeline, 오른쪽 Studio 패널, 하단 Clip Editor가 동시에 보이는 기본 화면입니다.</figcaption></figure>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>GarageBand Copy 사용자 설명서</title>
  <style>
    :root {
      --bg: #0a0f18;
      --panel: #111827;
      --ink: #e5edf7;
      --muted: #8fa1b6;
      --line: #263244;
      --blue: #38bdf8;
      --green: #5ec26b;
      --yellow: #fbbf24;
      --purple: #a78bfa;
      --rose: #fb7185;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); color: var(--ink); font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif; line-height: 1.65; }
    body { margin: 0; background: radial-gradient(circle at 22% 0%, rgba(56,189,248,.15), transparent 28%), var(--bg); }
    .page { max-width: 1120px; margin: 0 auto; padding: 48px 28px 80px; }
    .cover { min-height: 760px; display: grid; align-content: center; gap: 22px; border-bottom: 1px solid var(--line); }
    .eyebrow { color: var(--blue); font-size: 15px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; max-width: 980px; font-size: clamp(42px, 7vw, 86px); line-height: 1.05; letter-spacing: 0; }
    h2 { margin: 70px 0 18px; font-size: 34px; line-height: 1.2; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
    h3 { margin: 34px 0 12px; font-size: 24px; color: #f8fafc; }
    p { margin: 0 0 14px; color: #cbd5e1; }
    a { color: var(--blue); }
    .lead { max-width: 860px; font-size: 22px; color: #dbeafe; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 32px; }
    .meta { border: 1px solid var(--line); border-radius: 12px; background: rgba(17,24,39,.82); padding: 16px; }
    .meta strong { display: block; font-size: 13px; color: var(--muted); }
    .meta span { display: block; margin-top: 4px; font-size: 19px; font-weight: 900; color: #f8fafc; }
    .toc { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 28px 0; padding: 0; list-style: none; }
    .toc li { border: 1px solid var(--line); border-radius: 10px; background: rgba(17,24,39,.7); padding: 12px 14px; color: #dbeafe; font-weight: 800; }
    .figure { margin: 28px 0; border: 1px solid var(--line); border-radius: 16px; background: rgba(17,24,39,.86); padding: 16px; break-inside: avoid; }
    .figure-title { font-weight: 900; font-size: 18px; color: #f8fafc; margin-bottom: 4px; }
    .figure-body { color: var(--muted); font-size: 14px; }
    .figure-art { margin-top: 12px; overflow: hidden; border-radius: 14px; }
    .figure svg { width: 100%; height: auto; display: block; }
    figcaption { margin-top: 10px; color: var(--muted); font-size: 13px; }
    .screenshot img { width: 100%; display: block; border-radius: 12px; border: 1px solid var(--line); }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .card { border: 1px solid var(--line); border-radius: 14px; background: rgba(17,24,39,.72); padding: 18px; break-inside: avoid; }
    .card strong { display: block; margin-bottom: 8px; color: #f8fafc; font-size: 18px; }
    .steps { counter-reset: step; margin: 16px 0 24px; padding: 0; list-style: none; }
    .steps li { position: relative; margin: 10px 0; padding: 14px 16px 14px 56px; border: 1px solid var(--line); border-radius: 12px; background: rgba(15,23,42,.7); color: #dbeafe; break-inside: avoid; }
    .steps li::before { counter-increment: step; content: counter(step); position: absolute; left: 16px; top: 14px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--blue); color: #07111c; font-weight: 900; }
    .callout { display: grid; gap: 6px; border-radius: 14px; padding: 16px; margin: 20px 0; border: 1px solid; break-inside: avoid; }
    .callout strong { font-size: 17px; }
    .callout span { color: #dbeafe; }
    .callout.blue { border-color: #38bdf8aa; background: #082f494f; }
    .callout.green { border-color: #5ec26baa; background: #102a1a80; }
    .callout.yellow { border-color: #fbbf24aa; background: #2a210a80; }
    .callout.rose { border-color: #fb7185aa; background: #2a111780; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    th, td { border-bottom: 1px solid var(--line); padding: 12px; text-align: left; vertical-align: top; }
    th { background: #111827; color: #f8fafc; }
    td { color: #cbd5e1; }
    code { border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; background: #0b111b; color: #bfdbfe; }
    .kbd { display: inline-flex; min-width: 28px; height: 24px; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #465568; background: #111827; color: #f8fafc; font-size: 13px; font-weight: 900; padding: 0 7px; }
    .footer-note { margin-top: 70px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); }
    @media print {
      @page { size: A4; margin: 13mm; }
      body { background: #fff; color: #0f172a; }
      .page { max-width: none; padding: 0; }
      .cover { min-height: 250mm; }
      h1, h2, h3, .figure-title, .card strong { color: #0f172a; }
      p, td, .steps li, .callout span { color: #1f2937; }
      .lead, .meta span, .toc li, figcaption, .figure-body { color: #334155 !important; }
      .meta strong, .eyebrow { color: #0284c7 !important; }
      .figure, .card, .steps li, .meta, .toc li { background: #fff; border-color: #cbd5e1; }
      .callout { background: #fff !important; }
      .figure { page-break-inside: avoid; }
      h2 { break-before: page; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div class="eyebrow">User's Manual - Korean Edition</div>
      <h1>GarageBand Copy<br/>사용자 설명서</h1>
      <p class="lead">브라우저에서 작곡, 녹음, 루프 배치, MIDI 편집, 믹싱, 수업/리뷰, Share Export까지 단계적으로 수행하기 위한 시각 중심 매뉴얼입니다.</p>
      <div class="meta-grid">
        <div class="meta"><strong>대상</strong><span>처음 쓰는 사용자</span></div>
        <div class="meta"><strong>형식</strong><span>HTML / PDF / SVG</span></div>
        <div class="meta"><strong>앱 버전</strong><span>Project v12</span></div>
        <div class="meta"><strong>권장 브라우저</strong><span>Chrome / Edge</span></div>
      </div>
    </section>

    <h2>0. 빠른 목차</h2>
    <ul class="toc">
      <li>1. 화면 구조와 기본 개념</li>
      <li>2. Transport와 프로젝트 설정</li>
      <li>3. Timeline에서 클립 배치하기</li>
      <li>4. Loop Browser와 Library</li>
      <li>5. MIDI, Touch, Drummer 편집</li>
      <li>6. 오디오 녹음과 파형 편집</li>
      <li>7. Mixer, Smart Controls, Automation</li>
      <li>8. Live Loops 즉흥 연주</li>
      <li>9. Lesson, Review, Teacher 흐름</li>
      <li>10. Share Export와 파일 관리</li>
      <li>11. 10분 첫 곡 만들기</li>
      <li>12. 단축키와 문제 해결</li>
    </ul>

    ${screenshotMarkup}
    ${figure("fig-interface", "그림 1. 화면 구조 지도", "앱은 상단 제어 영역, 중앙 편곡 영역, 오른쪽 패널, 하단 편집기로 나뉩니다.", figures.interfaceMapSvg(), "작업 흐름은 위에서 시작해 중앙에서 편곡하고, 오른쪽에서 재료를 고르고, 아래에서 세밀하게 편집하는 구조입니다.")}

    <h2>1. 화면 구조와 기본 개념</h2>
    <div class="grid-2">
      <div class="card"><strong>Transport Bar</strong>재생, 정지, 녹음, 사이클, Undo/Redo, BPM, 박자표, Key, 메트로놈, 튜너, 저장, Export가 모여 있는 앱의 조종석입니다.</div>
      <div class="card"><strong>Arrangement Timeline</strong>트랙별로 클립을 놓고 곡의 구조를 만드는 영역입니다. Tracks 보기와 Live Loops 보기를 전환할 수 있습니다.</div>
      <div class="card"><strong>Studio Panel</strong>Library, Loops, Audio, Smart, Lesson 탭이 있으며 소리 선택, 녹음, 믹서, 교육 기능을 제공합니다.</div>
      <div class="card"><strong>Clip Editor</strong>선택한 클립의 세부 편집 영역입니다. MIDI면 Piano Roll/Touch/Drummer, 오디오면 파형 편집이 나타납니다.</div>
    </div>

    <h3>프로젝트, 트랙, 클립의 관계</h3>
    ${steps([
      "프로젝트는 한 곡 전체입니다. BPM, Key, 박자표, 트랙, 클립, 수업 정보, 라이브 루프 정보를 포함합니다.",
      "트랙은 악기나 오디오가 놓이는 줄입니다. 비트, 베이스, 건반, 오디오 트랙처럼 역할을 나눠 씁니다.",
      "클립은 트랙 위에 놓이는 색상 블록입니다. 루프, MIDI, 오디오, Drummer 클립이 있습니다.",
      "클립을 선택하면 하단 Clip Editor가 해당 클립에 맞는 편집 화면으로 바뀝니다."
    ])}

    <h2>2. Transport와 프로젝트 설정</h2>
    ${figure("fig-transport", "그림 2. Transport Bar 조작 순서", "상단 바는 곡 전체의 시간, 재생, 녹음, 저장을 제어합니다.", figures.transportSvg(), "녹음 전에 BPM, 박자표, Key, Count-in, Metronome을 확인하면 이후 편집이 훨씬 안정적입니다.")}
    ${steps([
      "<strong>새 프로젝트</strong>: 오른쪽 상단 <code>New</code>를 누르면 새 곡을 시작합니다.",
      "<strong>프로젝트 이름</strong>: 상단의 프로젝트 이름 입력칸을 클릭해 곡 제목을 바꿉니다.",
      "<strong>Tempo</strong>: 숫자 입력 또는 <code>Tap</code>으로 BPM을 정합니다. 연주하면서 Tap을 누르면 감각적인 템포를 잡을 수 있습니다.",
      "<strong>박자표와 Key</strong>: 드롭다운에서 4/4, 3/4, 6/8 등과 C, Am 같은 조성을 고릅니다.",
      "<strong>Metronome / Count-in</strong>: 녹음 전 박자 안내가 필요하면 Metro와 Count-in을 켭니다.",
      "<strong>튜너</strong>: 마이크 권한을 허용하면 Tuner 모드에서 입력 음정을 확인할 수 있습니다.",
      "<strong>Save</strong>: 로컬 저장소에 현재 프로젝트를 저장합니다. 앱은 자동 저장도 수행하지만 중요한 작업 전후에는 Save를 누르는 습관이 좋습니다."
    ])}
    ${callout("녹음 전 추천 설정", "BPM, Key, Count-in, Metronome, 녹음할 Audio 트랙의 Record enable을 먼저 확인하세요.", "green")}

    <h2>3. Timeline에서 클립 배치하기</h2>
    ${figure("fig-timeline", "그림 3. Timeline 편곡 구조", "트랙 헤더, 룰러, 클립, 재생 헤드, Cycle 영역이 곡의 뼈대를 만듭니다.", figures.timelineSvg(), "노란 Cycle 영역은 반복 재생뿐 아니라 Share Export에서 Cycle 범위를 선택할 때도 사용됩니다.")}
    <h3>트랙 추가와 기본 편곡</h3>
    ${steps([
      "Timeline 상단의 <code>+ 드럼</code>, <code>Drummer</code>, <code>+ 악기</code> 버튼으로 트랙이나 클립을 추가합니다.",
      "오른쪽 Loops 탭에서 루프를 드래그해 원하는 트랙과 마디 위치에 놓습니다.",
      "클립을 클릭하면 선택되고, 드래그하면 위치가 바뀝니다.",
      "클립 왼쪽/오른쪽 핸들을 드래그하면 시작점과 길이가 바뀝니다.",
      "루프 반복 핸들을 사용하면 같은 패턴을 더 길게 반복할 수 있습니다.",
      "스냅 단위를 1/4, 1/2, 1박, 1마디로 바꾸면 이동과 길이 조절이 그리드에 맞춰집니다."
    ])}
    <table>
      <thead><tr><th>버튼/영역</th><th>하는 일</th><th>추천 상황</th></tr></thead>
      <tbody>
        <tr><td>Tracks / Live Loops</td><td>편곡형 타임라인과 라이브 루프 그리드를 전환</td><td>곡 구조를 만들 때 Tracks, 즉흥 트리거는 Live Loops</td></tr>
        <tr><td>겹침 방지</td><td>클립 이동 시 같은 트랙에서 겹치지 않게 보정</td><td>처음 편곡하거나 수업용 과제를 만들 때</td></tr>
        <tr><td>Cycle</td><td>반복 재생 범위 켜기/끄기</td><td>특정 구간 연습, 녹음, 구간 Export</td></tr>
        <tr><td>확대 슬라이더</td><td>Timeline 가로 배율 조절</td><td>세밀한 MIDI/오디오 위치 편집</td></tr>
      </tbody>
    </table>

    <h2>4. Loop Browser와 Library</h2>
    ${figure("fig-loops", "그림 4. 루프를 곡으로 가져오는 방법", "루프는 검색, 필터, 미리듣기 후 Timeline 또는 Live Loops에 배치합니다.", figures.loopFlowSvg(), "루프의 BPM과 Key가 프로젝트와 다르면 앱이 템포/키 매칭 정보를 보여줍니다.")}
    <h3>Loop Browser 사용 절차</h3>
    ${steps([
      "오른쪽 Studio Panel에서 <code>Loops</code> 탭을 엽니다.",
      "검색창에 drum, bass, synth 같은 단어를 입력하거나 카테고리 버튼을 누릅니다.",
      "장르와 무드 드롭다운으로 결과를 좁힙니다.",
      "재생 버튼으로 미리 들어본 뒤 <code>+</code> 버튼을 누르거나 클립을 Timeline으로 드래그합니다.",
      "Live Loops 보기에서는 빈 셀로 드래그해 즉흥 연주용 셀을 만들 수 있습니다."
    ])}

    <h3>Library에서 악기 고르기</h3>
    ${steps([
      "오른쪽 <code>Library</code> 탭을 엽니다.",
      "선택된 트랙의 역할에 맞는 악기 패치를 고릅니다. 드럼 트랙은 Drum Kit, 멜로디/화성 트랙은 Keys나 Synth 계열이 어울립니다.",
      "악기를 바꾸면 이후 MIDI 클립 재생 톤이 바뀝니다.",
      "베이스, 멜로디, 화성 트랙을 분리하면 Mixer에서 밸런스를 잡기 쉽습니다."
    ])}

    <h2>5. MIDI, Touch, Drummer 편집</h2>
    ${figure("fig-midi", "그림 5. Piano Roll 편집", "Piano Roll은 음높이, 시작 위치, 길이, Velocity를 격자에서 직접 조정하는 화면입니다.", figures.midiSvg(), "Scale Lock과 Quantize를 함께 사용하면 수업용 멜로디를 빠르게 정돈할 수 있습니다.")}
    <h3>MIDI 클립 만들기와 편집</h3>
    ${steps([
      "Timeline에서 악기 트랙을 선택하고 하단 Clip Editor의 <code>미디 클립</code> 버튼을 누릅니다.",
      "Piano Roll에서 원하는 위치를 클릭하거나 드래그해 노트를 입력합니다.",
      "노트를 드래그해 음높이와 시작 박자를 조절합니다.",
      "노트 끝을 잡아 길이를 늘리거나 줄입니다.",
      "Quantize를 사용해 애매한 타이밍을 스냅 단위에 맞춥니다.",
      "Scale Lock을 켜면 프로젝트 Key/Scale에 어울리는 음 위주로 작업할 수 있습니다."
    ])}

    <h3>Touch Instruments</h3>
    ${steps([
      "MIDI 클립을 선택한 뒤 하단 편집기에서 <code>Touch</code>를 선택합니다.",
      "Keyboard, Beat Sequencer, Smart Drums, Chord Strips 중 필요한 입력 방식을 고릅니다.",
      "Preview 상태에서는 소리만 확인하고, REC 상태 또는 쓰기 동작에서는 노트가 클립에 기록됩니다.",
      "코드 스트립은 화성 진행을 빠르게 만들 때, Beat Sequencer는 드럼 패턴을 세밀하게 만들 때 유용합니다."
    ])}

    <h3>Drummer 클립</h3>
    ${steps([
      "Timeline 상단 <code>Drummer</code> 버튼을 눌러 Drummer 클립을 만듭니다.",
      "하단 편집기에서 Drummer 모드가 열리면 프리셋, Complexity, Loudness, Swing, Fills를 조정합니다.",
      "설정을 바꾸면 MIDI 드럼 패턴이 재생성됩니다.",
      "수업용 프로젝트에서는 Drummer로 기본 리듬을 만든 뒤 베이스와 멜로디를 얹는 방식이 빠릅니다."
    ])}
    ${callout("MIDI 편집 팁", "드럼은 짧고 반복적인 4마디, 베이스는 루트음을 중심으로 8마디, 멜로디는 2-4마디 모티프를 먼저 만들면 곡 구조를 잡기 쉽습니다.", "blue")}

    <h2>6. 오디오 녹음과 파형 편집</h2>
    ${figure("fig-audio", "그림 6. 오디오 클립과 파형 편집", "오디오 클립은 파형, Trim, Fade, Gain, Playback Rate, Pitch를 조절할 수 있습니다.", figures.audioSvg(), "녹음 후 Normalize와 Fade를 적용하면 갑작스러운 볼륨 차이와 클릭 노이즈를 줄일 수 있습니다.")}
    <h3>오디오 녹음 절차</h3>
    ${steps([
      "오른쪽 Studio Panel에서 <code>Audio</code> 탭을 엽니다.",
      "<code>Track</code> 버튼으로 오디오 트랙을 추가합니다.",
      "녹음할 트랙에서 Record enable을 켭니다. Timeline 트랙 메뉴 또는 Mixer에서도 켤 수 있습니다.",
      "상단 Count-in과 Metronome을 설정합니다.",
      "상단 Record 버튼을 누르면 녹음이 시작됩니다. Stop을 누르면 녹음이 종료되고 오디오 클립이 만들어집니다.",
      "하단 Clip Editor에서 파형을 보며 Trim, Fade, Gain을 조정합니다."
    ])}
    <h3>Take와 Comp</h3>
    ${steps([
      "같은 구간을 여러 번 녹음하면 Take로 관리할 수 있습니다.",
      "각 Take의 좋은 구간을 선택해 Take Section을 구성합니다.",
      "<code>Create Comp</code>를 사용하면 선택된 구간을 하나의 편집 가능한 오디오 클립으로 만들 수 있습니다.",
      "Comp 후에도 Split, Normalize, Fade 편집을 이어서 적용할 수 있습니다."
    ])}

    <h2>7. Mixer, Smart Controls, Automation</h2>
    ${figure("fig-mixer", "그림 7. Mixer 신호 흐름", "각 트랙은 볼륨, 팬, Mute/Solo, Record enable, Send, EQ, Compressor를 거쳐 Master로 모입니다.", figures.mixerSvg(), "먼저 볼륨과 팬으로 균형을 맞추고, 그 다음 EQ/Comp/Send를 조정하세요.")}
    <h3>Mixer 기본 조정</h3>
    ${steps([
      "오른쪽 Studio Panel에서 <code>Smart</code> 탭을 엽니다.",
      "각 Channel Strip에서 Volume fader로 소리 크기를 맞춥니다.",
      "Pan으로 좌우 위치를 정합니다. 베이스와 킥은 중앙에 두는 편이 안정적입니다.",
      "Mute는 잠시 숨기기, Solo는 특정 트랙만 듣기에 사용합니다.",
      "Reverb/Delay Send로 공간감을 더합니다.",
      "Master Limiter를 켜면 Export 시 갑작스러운 피크를 줄이는 데 도움이 됩니다."
    ])}
    ${figure("fig-automation", "그림 8. Automation Lane", "Automation은 곡이 진행되면서 볼륨, 팬, Send 값이 자동으로 변하게 만드는 기능입니다.", figures.automationSvg(), "포인트를 적게 쓰고 큰 흐름을 먼저 만든 뒤, 필요한 부분만 세밀하게 다듬는 편이 좋습니다.")}
    <h3>Automation 작성 절차</h3>
    ${steps([
      "Timeline 트랙 헤더의 <code>A</code> 버튼을 눌러 Automation Lane을 엽니다.",
      "Lane 왼쪽 위 드롭다운에서 Volume, Pan, Send Reverb, Send Delay 중 하나를 선택합니다.",
      "Lane 위를 클릭해 포인트를 추가합니다.",
      "포인트를 드래그해 박자와 값을 조절합니다.",
      "포인트를 삭제하려면 포인트를 선택하거나 보조 클릭 메뉴를 사용합니다.",
      "Export에는 Automation 움직임이 반영됩니다."
    ])}

    <h2>8. Live Loops 즉흥 연주</h2>
    ${figure("fig-live-loops", "그림 9. Live Loops Grid", "Live Loops는 트랙과 Scene의 교차점에 셀을 놓고, 셀 또는 Scene 단위로 루프를 실행하는 화면입니다.", figures.liveLoopsSvg(), "Scene을 누르면 한 열의 셀이 다음 Quantize 경계에 맞춰 같이 시작됩니다.")}
    ${steps([
      "Timeline 상단의 <code>Live Loops</code> 버튼을 눌러 그리드 보기로 전환합니다.",
      "오른쪽 Loops 탭에서 루프를 빈 셀로 드래그합니다.",
      "셀을 클릭하면 해당 루프가 다음 마디 또는 지정된 Quantize 지점에 큐잉됩니다.",
      "Scene 헤더를 클릭하면 같은 열의 셀이 한 번에 큐잉됩니다.",
      "Stop live loops 버튼으로 실행 중인 셀을 모두 멈춥니다.",
      "즉흥으로 좋은 조합을 찾은 뒤 Tracks 보기에서 편곡으로 정리하면 빠르게 곡을 완성할 수 있습니다."
    ])}

    <h2>9. Lesson, Review, Teacher 흐름</h2>
    ${figure("fig-lesson", "그림 10. 교육 모드 흐름", "학생은 Lesson에서 미션을 수행하고 Review에서 제출 가능성을 확인하며, 교사는 Teacher에서 반과 과제를 관리합니다.", figures.lessonSvg(), "상단의 Student/Teacher 토글과 Studio/Lesson/Review 모드 전환을 함께 사용합니다.")}
    <div class="grid-3">
      <div class="card"><strong>Student</strong>학생 프로필, 과제 시작, 제출 흐름을 다룹니다. 수업용 프로젝트는 Lesson 미션과 연결됩니다.</div>
      <div class="card"><strong>Review</strong>곡 길이, 트랙 구성, 밸런스, 루브릭 상태를 점검합니다. 제출 전 체크리스트로 쓰기 좋습니다.</div>
      <div class="card"><strong>Teacher</strong>반, 학생, 과제, 피드백을 관리합니다. 로컬 저장소, Mock Cloud, Supabase 모드를 선택할 수 있습니다.</div>
    </div>

    <h2>10. Share Export와 파일 관리</h2>
    ${figure("fig-share", "그림 11. Share / Export 모달", "Export 버튼은 Mix, Stems ZIP, Project 파일, Import를 한곳에서 처리하는 Share 모달을 엽니다.", figures.shareSvg(), "MP3를 선택해도 현재 오프라인 렌더러는 안전하게 WAV 파일로 폴백합니다. 이 동작은 실패가 아니라 호환성을 위한 설계입니다.")}
    <h3>Mix 내보내기</h3>
    ${steps([
      "상단 오른쪽 <code>Export</code>를 누릅니다.",
      "Format에서 WAV 또는 MP3를 고릅니다. MP3는 현재 WAV 폴백 메시지가 표시될 수 있습니다.",
      "Quality에서 Standard 또는 High를 고릅니다.",
      "Range에서 Full 또는 Cycle을 고릅니다. Cycle은 사이클 영역이 켜져 있어야 사용할 수 있습니다.",
      "<code>Mix</code>를 누르면 전체 믹스 파일을 다운로드합니다."
    ])}
    <h3>Stems ZIP 내보내기</h3>
    ${steps([
      "Share 모달에서 Range를 확인합니다.",
      "<code>Stems ZIP</code>을 누릅니다.",
      "각 트랙이 개별 WAV 파일로 렌더링되어 ZIP 안에 들어갑니다.",
      "외부 DAW에서 믹싱하거나 선생님에게 트랙별 피드백을 받을 때 사용합니다."
    ])}
    <h3>프로젝트 파일 저장/불러오기</h3>
    ${steps([
      "<code>Project</code>를 누르면 현재 프로젝트가 <code>.webband.json</code> 파일로 다운로드됩니다.",
      "다른 브라우저나 다른 컴퓨터에서 이어서 작업하려면 같은 Share 모달의 <code>Import</code>를 누릅니다.",
      "가져오기 전에 현재 프로젝트가 저장되어 자동 백업 역할을 합니다.",
      "불러온 프로젝트는 현재 앱 버전에 맞춰 자동 보정됩니다."
    ])}
    <table>
      <thead><tr><th>파일</th><th>내용</th><th>사용 목적</th></tr></thead>
      <tbody>
        <tr><td>WAV</td><td>전체 믹스 오디오</td><td>제출, 공유, 영상 편집, 마스터 확인</td></tr>
        <tr><td>MP3 선택</td><td>현재는 WAV 폴백</td><td>MP3 UI 흐름 유지, 인코더 미지원 환경 보호</td></tr>
        <tr><td>Stems ZIP</td><td>트랙별 WAV 묶음</td><td>외부 믹싱, 협업, 교사용 피드백</td></tr>
        <tr><td>.webband.json</td><td>프로젝트 구조 데이터</td><td>백업, 이동, 복원, 과제 전달</td></tr>
      </tbody>
    </table>

    <h2>11. 10분 첫 곡 만들기</h2>
    ${figure("fig-workflow", "그림 12. 첫 곡 만들기 루틴", "처음 사용자는 아래 순서대로 따라 하면 한 곡의 뼈대를 빠르게 만들 수 있습니다.", figures.workflowSvg(), "완성도보다 흐름을 먼저 만들고, 나중에 Mixer와 Automation으로 다듬는 방식이 가장 빠릅니다.")}
    ${steps([
      "New로 새 프로젝트를 만들고 이름을 정합니다.",
      "BPM 100-130 사이에서 하나를 정하고 Key를 C 또는 Am으로 시작합니다.",
      "Loops 탭에서 드럼 루프를 찾아 첫 번째 트랙에 놓습니다.",
      "베이스 루프를 두 번째 트랙에 놓고 드럼과 길이를 맞춥니다.",
      "악기 트랙을 만들고 MIDI 클립 또는 코드 스트립으로 간단한 코드 진행을 추가합니다.",
      "필요하면 Audio 탭에서 보컬이나 악기를 녹음합니다.",
      "Smart 탭에서 트랙별 볼륨을 조정하고 Master Limiter를 확인합니다.",
      "Review에서 제출 가능성을 확인합니다.",
      "Export -> Mix로 WAV를 받고, 백업용 Project 파일도 저장합니다."
    ])}

    <h2>12. 단축키와 문제 해결</h2>
    <table>
      <thead><tr><th>단축키</th><th>동작</th><th>사용 팁</th></tr></thead>
      <tbody>
        <tr><td><span class="kbd">Space</span></td><td>재생/일시정지</td><td>입력창에 커서가 없을 때 동작합니다.</td></tr>
        <tr><td><span class="kbd">R</span></td><td>녹음 시작/종료</td><td>녹음할 오디오 트랙의 Record enable을 먼저 켜세요.</td></tr>
        <tr><td><span class="kbd">Enter</span></td><td>재생 위치를 처음으로 이동</td><td>반복 확인 전 빠르게 처음으로 돌아갈 때 씁니다.</td></tr>
        <tr><td><span class="kbd">Ctrl</span> + <span class="kbd">Z</span></td><td>Undo</td><td>트랙/클립/노트/믹서 편집을 되돌립니다.</td></tr>
        <tr><td><span class="kbd">Ctrl</span> + <span class="kbd">Y</span></td><td>Redo</td><td>Undo한 작업을 다시 적용합니다.</td></tr>
      </tbody>
    </table>
    ${figure("fig-troubleshooting", "그림 13. 자주 생기는 문제 해결 흐름", "소리, 녹음, 내보내기 문제는 대부분 권한, 선택 상태, 사이클 범위, 저장 상태에서 시작합니다.", figures.troubleshootSvg(), "문제가 반복되면 먼저 Save와 Project export로 백업을 만든 뒤 새로고침하세요.")}
    ${callout("소리가 안 날 때", "Master volume, 트랙 Mute/Solo, 브라우저 탭 음소거, 시스템 출력 장치, 클립 위치를 차례로 확인하세요.", "rose")}
    ${callout("녹음이 안 될 때", "마이크 권한을 허용했는지, Audio 트랙이 있는지, 해당 트랙의 Record enable이 켜져 있는지 확인하세요.", "yellow")}
    ${callout("Export가 예상과 다를 때", "Cycle 범위가 켜져 있으면 Range가 Cycle일 수 있습니다. Full로 바꾸거나 사이클을 끄고 다시 내보내세요.", "blue")}

    <p class="footer-note">이 설명서는 앱 소스 기준으로 생성되었습니다. 최종 업데이트 산출물: <code>garageband-user-manual.html</code>, <code>garageband-user-manual.pdf</code>, <code>garageband-user-manual.svg</code>.</p>
  </main>
</body>
</html>`;
}

function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

writeFileSync(svgPath, quickMapSvg(), "utf8");
writeFileSync(htmlPath, htmlManual(), "utf8");

const chrome = findChrome();
if (!chrome) {
  console.warn("Chrome/Edge not found. HTML and SVG were generated, but PDF was skipped.");
  process.exit(0);
}

const pdfResult = spawnSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--allow-file-access-from-files",
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href
  ],
  { stdio: "inherit" }
);

if (pdfResult.error) throw pdfResult.error;
if (pdfResult.status !== 0) process.exit(pdfResult.status ?? 1);

console.log(`Generated:\n- ${htmlPath}\n- ${svgPath}\n- ${pdfPath}`);
