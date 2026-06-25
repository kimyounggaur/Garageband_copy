import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "output", "quickstart");
const assetsDir = join(outDir, "assets");
const htmlPath = join(outDir, "garageband-quickstart-user-manual.html");
const svgPath = join(outDir, "garageband-quickstart-user-manual.svg");
const pdfPath = join(outDir, "garageband-quickstart-user-manual.pdf");
const screenshotPath = join(assetsDir, "app-overview.png");

mkdirSync(assetsDir, { recursive: true });

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lines(items, x, y, options = {}) {
  const size = options.size ?? 22;
  const fill = options.fill ?? "#e5edf7";
  const weight = options.weight ?? 800;
  const gap = options.gap ?? size * 1.45;
  return items
    .map((item, index) => `<text x="${x}" y="${y + index * gap}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(item)}</text>`)
    .join("");
}

function wrapText(text, chars = 26) {
  const words = text.split(/\s+/);
  const out = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > chars && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

function arrow(x1, y1, x2, y2, color = "#38bdf8") {
  return `
    <path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
    <path d="M ${x2 - 13} ${y2 - 8} L ${x2} ${y2} L ${x2 - 13} ${y2 + 8}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function stageBadge(x, y, n, label, color) {
  return `
    <circle cx="${x}" cy="${y}" r="32" fill="${color}"/>
    <text x="${x}" y="${y + 11}" text-anchor="middle" font-size="28" font-weight="900" fill="#07111c">${n}</text>
    <text x="${x + 48}" y="${y + 8}" font-size="25" font-weight="900" fill="#f8fafc">${esc(label)}</text>
  `;
}

function panel(inner, title = "", width = 920, height = 430) {
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#141b28"/>
          <stop offset="1" stop-color="#0a0f18"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="22" fill="url(#bg)"/>
      ${inner}
    </svg>
  `;
}

function figure(title, body, art, caption = "") {
  return `
    <figure class="figure">
      <div class="figure-title">${esc(title)}</div>
      ${body ? `<p>${esc(body)}</p>` : ""}
      <div class="art">${art}</div>
      ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
    </figure>
  `;
}

function steps(items) {
  return `<ol class="steps">${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function tip(title, body, tone = "blue") {
  return `<aside class="tip ${tone}"><strong>${esc(title)}</strong><span>${body}</span></aside>`;
}

function quickMap() {
  const stages = [
    ["1", "설정", "BPM, Key, 박자표를 먼저 정합니다.", "#38bdf8"],
    ["2", "루프", "드럼과 베이스 루프를 배치합니다.", "#818cf8"],
    ["3", "편집", "MIDI, Touch, Drummer로 멜로디를 만듭니다.", "#5ec26b"],
    ["4", "녹음", "Audio 트랙을 Arm하고 녹음합니다.", "#f59e0b"],
    ["5", "믹스", "볼륨, 팬, FX, Automation을 정리합니다.", "#fb7185"],
    ["6", "공유", "Mix, Stems ZIP, Project 파일을 내보냅니다.", "#e879f9"]
  ];
  const items = stages
    .map(([n, title, body, color], index) => {
      const x = 64 + index * 248;
      return `
        <g transform="translate(${x} 292)">
          <rect width="210" height="260" rx="26" fill="#111827" stroke="#334155" stroke-width="2"/>
          <circle cx="54" cy="58" r="34" fill="${color}"/>
          <text x="54" y="69" text-anchor="middle" font-size="28" font-weight="900" fill="#07111c">${n}</text>
          <text x="102" y="67" font-size="30" font-weight="900" fill="#f8fafc">${esc(title)}</text>
          ${lines(wrapText(body, 12), 30, 132, { size: 21, fill: "#dbeafe", gap: 31 })}
          <rect x="30" y="214" width="150" height="13" rx="7" fill="#253348"/>
          <rect x="30" y="214" width="${60 + index * 18}" height="13" rx="7" fill="${color}"/>
        </g>
      `;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="930" viewBox="0 0 1600 930" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GarageBand Copy 퀵스타트 지도">
  <rect width="1600" height="930" fill="#0a0f18"/>
  <text x="64" y="108" font-size="60" font-weight="900" fill="#f8fafc">GarageBand Copy 퀵스타트</text>
  <text x="64" y="158" font-size="28" font-weight="800" fill="#9fb3c8">처음 실행부터 WAV와 프로젝트 백업까지 10분 루틴</text>
  <rect x="64" y="204" width="1472" height="58" rx="22" fill="#111827" stroke="#334155"/>
  <text x="100" y="242" font-size="24" font-weight="900" fill="#38bdf8">핵심 순서</text>
  <text x="250" y="242" font-size="24" font-weight="900" fill="#f8fafc">설정 -> 루프 -> 편집 -> 녹음 -> 믹스 -> 공유</text>
  ${items}
</svg>`;
}

function screenMapSvg() {
  return panel(`
    <rect x="42" y="52" width="836" height="50" rx="13" fill="#111827" stroke="#334155"/>
    ${stageBadge(80, 77, "A", "상단 Transport", "#38bdf8")}
    <rect x="42" y="124" width="560" height="210" rx="16" fill="#0b111b" stroke="#334155"/>
    <rect x="42" y="124" width="112" height="210" rx="16" fill="#111827" stroke="#334155"/>
    <rect x="178" y="168" width="224" height="36" rx="8" fill="#818cf8"/>
    <rect x="178" y="230" width="224" height="36" rx="8" fill="#818cf8"/>
    <rect x="406" y="288" width="162" height="36" rx="8" fill="#5ec26b"/>
    ${stageBadge(88, 370, "B", "Timeline", "#818cf8")}
    <rect x="626" y="124" width="252" height="210" rx="16" fill="#111827" stroke="#334155"/>
    ${lines(["Studio Panel", "Loops / Library", "Audio / Smart"], 654, 170, { size: 24, fill: "#e5f2ff", gap: 44 })}
    ${stageBadge(654, 370, "C", "오른쪽 재료함", "#5ec26b")}
  `, "퀵스타트 화면 지도");
}

function settingsSvg() {
  return panel(`
    ${stageBadge(72, 74, "1", "곡 설정", "#38bdf8")}
    <rect x="78" y="134" width="760" height="100" rx="18" fill="#111827" stroke="#334155"/>
    ${["Tempo 120", "4/4", "Key C", "Metro", "Count-in"].map((label, index) => {
      const x = 110 + index * 142;
      return `<rect x="${x}" y="164" width="112" height="42" rx="12" fill="${index === 0 ? "#06291f" : "#0b111b"}" stroke="#38bdf8"/><text x="${x + 56}" y="191" text-anchor="middle" font-size="18" font-weight="900" fill="#dbeafe">${esc(label)}</text>`;
    }).join("")}
    ${arrow(210, 274, 712, 274, "#38bdf8")}
    ${lines(["추천 시작값", "Tempo 100-130", "Key C 또는 Am", "Count-in 1 bar"], 132, 332, { size: 24, fill: "#dbeafe", gap: 34 })}
  `, "곡 설정");
}

function loopSvg() {
  return panel(`
    ${stageBadge(72, 74, "2", "루프 배치", "#818cf8")}
    <rect x="62" y="130" width="246" height="240" rx="18" fill="#111827" stroke="#334155"/>
    ${lines(["Loop Browser", "검색: drum", "카테고리: Drums", "미리듣기"], 94, 178, { size: 22, fill: "#dbeafe", gap: 42 })}
    <rect x="430" y="130" width="420" height="240" rx="18" fill="#0b111b" stroke="#334155"/>
    <rect x="466" y="174" width="250" height="42" rx="9" fill="#818cf8"/>
    <rect x="466" y="238" width="210" height="42" rx="9" fill="#818cf8"/>
    <rect x="466" y="302" width="280" height="42" rx="9" fill="#5ec26b"/>
    ${arrow(310, 235, 466, 194, "#818cf8")}
    ${lines(["드래그하거나 + 버튼", "드럼 -> 베이스 -> 코드 순서"], 384, 370, { size: 20, fill: "#f8fafc", gap: 27 })}
  `, "루프 배치");
}

function editSvg() {
  return panel(`
    ${stageBadge(72, 74, "3", "MIDI 편집", "#5ec26b")}
    <rect x="58" y="124" width="804" height="244" rx="18" fill="#0b111b" stroke="#334155"/>
    ${Array.from({ length: 10 }, (_, i) => `<line x1="${136 + i * 70}" y1="146" x2="${136 + i * 70}" y2="344" stroke="#273244"/>`).join("")}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="88" y1="${160 + i * 30}" x2="842" y2="${160 + i * 30}" stroke="#273244"/>`).join("")}
    <rect x="182" y="286" width="96" height="22" rx="6" fill="#5ec26b"/>
    <rect x="314" y="226" width="96" height="22" rx="6" fill="#5ec26b"/>
    <rect x="446" y="196" width="138" height="22" rx="6" fill="#5ec26b"/>
    <rect x="628" y="166" width="96" height="22" rx="6" fill="#5ec26b"/>
    ${lines(["Piano Roll", "Touch", "Drummer"], 650, 248, { size: 26, fill: "#dbeafe", gap: 34 })}
  `, "MIDI 편집");
}

function recordSvg() {
  const wave = Array.from({ length: 64 }, (_, i) => {
    const h = 14 + Math.abs(Math.sin(i * 0.5)) * 82;
    return `<rect x="${158 + i * 10}" y="${230 - h / 2}" width="5" height="${h}" rx="2" fill="#f59e0b"/>`;
  }).join("");
  return panel(`
    ${stageBadge(72, 74, "4", "오디오 녹음", "#f59e0b")}
    <rect x="86" y="138" width="748" height="180" rx="18" fill="#0b111b" stroke="#334155"/>
    ${wave}
    <circle cx="146" cy="229" r="34" fill="#fb7185"/>
    <text x="146" y="239" text-anchor="middle" font-size="22" font-weight="900" fill="#fff">REC</text>
    ${lines(["Audio 탭", "Track 추가", "Record enable", "Record 버튼"], 112, 360, { size: 22, fill: "#dbeafe", gap: 1 })}
  `, "오디오 녹음");
}

function mixSvg() {
  return panel(`
    ${stageBadge(72, 74, "5", "믹스", "#fb7185")}
    ${["Beat", "Bass", "Keys", "Vox", "Master"].map((label, index) => {
      const x = 86 + index * 158;
      const level = [70, 110, 86, 96, 120][index];
      return `<rect x="${x}" y="126" width="112" height="232" rx="16" fill="#111827" stroke="#334155"/><text x="${x + 56}" y="160" text-anchor="middle" font-size="18" font-weight="900" fill="#f8fafc">${label}</text><rect x="${x + 48}" y="190" width="16" height="130" rx="8" fill="#263244"/><rect x="${x + 48}" y="${320 - level}" width="16" height="${level}" rx="8" fill="${index === 4 ? "#5ec26b" : "#fb7185"}"/><circle cx="${x + 34}" cy="338" r="12" fill="#38bdf8"/><circle cx="${x + 78}" cy="338" r="12" fill="#a78bfa"/>`;
    }).join("")}
    ${lines(["볼륨 -> 팬 -> FX -> Automation", "Master Limiter 확인"], 152, 398, { size: 22, fill: "#dbeafe", gap: 1 })}
  `, "믹스");
}

function exportSvg() {
  return panel(`
    ${stageBadge(72, 74, "6", "공유", "#e879f9")}
    <rect x="246" y="94" width="430" height="280" rx="24" fill="#111827" stroke="#465568"/>
    ${lines(["Share"], 290, 142, { size: 34, fill: "#f8fafc" })}
    ${["WAV", "MP3", "Full", "Cycle"].map((label, index) => {
      const x = 290 + (index % 2) * 150;
      const y = 168 + Math.floor(index / 2) * 54;
      return `<rect x="${x}" y="${y}" width="120" height="36" rx="10" fill="#0b111b" stroke="#38bdf8"/><text x="${x + 60}" y="${y + 24}" text-anchor="middle" font-size="18" font-weight="900" fill="#dbeafe">${label}</text>`;
    }).join("")}
    ${["Mix", "Stems ZIP", "Project", "Import"].map((label, index) => {
      const x = 290 + (index % 2) * 150;
      const y = 286 + Math.floor(index / 2) * 46;
      return `<rect x="${x}" y="${y}" width="120" height="32" rx="9" fill="${index === 0 ? "#5ec26b" : "#172033"}" stroke="#465568"/><text x="${x + 60}" y="${y + 22}" text-anchor="middle" font-size="16" font-weight="900" fill="${index === 0 ? "#07111c" : "#e5f2ff"}">${label}</text>`;
    }).join("")}
    ${lines(["Mix = 완성 WAV", "Stems ZIP = 트랙별 파일", "Project = 백업/이동"], 62, 334, { size: 20, fill: "#dbeafe", gap: 28 })}
  `, "공유");
}

function rescueSvg() {
  return panel(`
    ${stageBadge(72, 74, "?", "문제 해결", "#fbbf24")}
    ${[
      ["소리 없음", "Mute/Solo, Master, 브라우저 탭 음소거 확인", "#fb7185"],
      ["녹음 안 됨", "마이크 권한, Audio 트랙, Record enable 확인", "#fbbf24"],
      ["Export 이상", "Full/Cycle 범위와 Project 백업 확인", "#a78bfa"]
    ].map(([title, body, color], index) => {
      const x = 78 + index * 282;
      return `<rect x="${x}" y="146" width="236" height="172" rx="18" fill="#111827" stroke="${color}"/><text x="${x + 26}" y="196" font-size="25" font-weight="900" fill="${color}">${esc(title)}</text>${lines(wrapText(body, 14), x + 26, 242, { size: 18, fill: "#dbeafe", gap: 26 })}`;
    }).join("")}
    ${lines(["먼저 Save, 그 다음 Project 파일로 백업하세요."], 168, 374, { size: 24, fill: "#fde68a" })}
  `, "문제 해결");
}

function htmlManual() {
  const screenshot = existsSync(screenshotPath)
    ? `<figure class="figure screenshot"><div class="figure-title">실제 앱 화면 한눈에 보기</div><img src="assets/app-overview.png" alt="GarageBand Copy 앱 전체 화면"/><figcaption>퀵스타트에서는 상단 Transport, 중앙 Timeline, 오른쪽 Loops, 하단 Clip Editor 네 곳만 먼저 익히면 됩니다.</figcaption></figure>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>GarageBand Copy 퀵스타트 사용자 설명서</title>
  <style>
    :root { --bg:#0a0f18; --panel:#111827; --ink:#e5edf7; --muted:#8ea3b8; --line:#29364a; --blue:#38bdf8; --green:#5ec26b; --yellow:#fbbf24; --rose:#fb7185; }
    * { box-sizing: border-box; }
    html { background: var(--bg); color: var(--ink); font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif; line-height: 1.62; }
    body { margin: 0; background: radial-gradient(circle at 15% 0%, rgba(56,189,248,.16), transparent 30%), var(--bg); }
    .page { max-width: 1040px; margin: 0 auto; padding: 46px 28px 72px; }
    .cover { min-height: 660px; display: grid; align-content: center; gap: 18px; border-bottom: 1px solid var(--line); }
    .eyebrow { color: var(--blue); font-size: 15px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(42px, 7vw, 80px); line-height: 1.06; letter-spacing: 0; }
    h2 { margin: 54px 0 18px; padding-bottom: 10px; border-bottom: 1px solid var(--line); font-size: 32px; line-height: 1.2; }
    h3 { margin: 26px 0 10px; font-size: 22px; }
    p { margin: 0 0 13px; color: #cbd5e1; }
    .lead { max-width: 820px; font-size: 22px; color: #dbeafe; }
    .route { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 24px 0; }
    .route div { min-height: 74px; border: 1px solid var(--line); border-radius: 12px; background: rgba(17,24,39,.84); padding: 12px; font-weight: 900; color: #f8fafc; }
    .route span { display: block; color: var(--blue); font-size: 13px; margin-bottom: 4px; }
    .figure { margin: 24px 0; border: 1px solid var(--line); border-radius: 16px; background: rgba(17,24,39,.86); padding: 16px; break-inside: avoid; }
    .figure-title { font-weight: 900; font-size: 18px; color: #f8fafc; margin-bottom: 4px; }
    .art { margin-top: 12px; overflow: hidden; border-radius: 14px; }
    .art svg { width: 100%; height: auto; display: block; }
    figcaption { margin-top: 9px; color: var(--muted); font-size: 13px; }
    .screenshot img { width: 100%; display: block; border: 1px solid var(--line); border-radius: 12px; }
    .steps { margin: 16px 0 22px; padding: 0; list-style: none; counter-reset: step; }
    .steps li { position: relative; margin: 9px 0; padding: 13px 16px 13px 54px; border: 1px solid var(--line); border-radius: 12px; background: rgba(15,23,42,.72); color: #dbeafe; break-inside: avoid; }
    .steps li::before { counter-increment: step; content: counter(step); position: absolute; left: 15px; top: 13px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--blue); color: #07111c; font-weight: 900; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .card { border: 1px solid var(--line); border-radius: 13px; background: rgba(17,24,39,.72); padding: 16px; break-inside: avoid; }
    .card strong { display: block; color: #f8fafc; font-size: 18px; margin-bottom: 6px; }
    .tip { display: grid; gap: 6px; margin: 18px 0; padding: 15px; border-radius: 14px; border: 1px solid; break-inside: avoid; }
    .tip strong { font-size: 17px; }
    .tip span { color: #dbeafe; }
    .blue { border-color:#38bdf8aa; background:#082f494f; }
    .green { border-color:#5ec26baa; background:#102a1a80; }
    .yellow { border-color:#fbbf24aa; background:#2a210a80; }
    .rose { border-color:#fb7185aa; background:#2a111780; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    th, td { border-bottom: 1px solid var(--line); padding: 11px; text-align: left; vertical-align: top; }
    th { background: #111827; color: #f8fafc; }
    td { color: #cbd5e1; }
    code { border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; background: #0b111b; color: #bfdbfe; }
    .footer { margin-top: 52px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); }
    @media print {
      @page { size: A4; margin: 13mm; }
      body { background:#fff; color:#0f172a; }
      .page { max-width:none; padding:0; }
      .cover { min-height:250mm; }
      h1, h2, h3, .figure-title, .card strong { color:#0f172a; }
      p, td, .steps li, .tip span, .lead, figcaption { color:#334155 !important; }
      .eyebrow { color:#0284c7 !important; }
      .route div { color:#0f172a !important; }
      .route div span { color:#0284c7 !important; }
      .figure, .card, .steps li, .route div { background:#fff; border-color:#cbd5e1; }
      .tip { background:#fff !important; }
      .figure { page-break-inside: avoid; }
      h2 { break-before: page; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div class="eyebrow">Quick Start User's Manual - Korean</div>
      <h1>GarageBand Copy<br/>퀵스타트 설명서</h1>
      <p class="lead">처음 실행한 사용자가 10분 안에 루프를 놓고, MIDI/오디오를 조금 편집하고, 믹스 후 WAV와 프로젝트 파일을 받을 수 있도록 만든 초단기 안내서입니다.</p>
      <div class="route">
        <div><span>01</span>설정</div>
        <div><span>02</span>루프</div>
        <div><span>03</span>편집</div>
        <div><span>04</span>녹음</div>
        <div><span>05</span>믹스</div>
        <div><span>06</span>공유</div>
      </div>
    </section>

    ${screenshot}
    ${figure("퀵스타트 화면 지도", "처음에는 이 세 영역만 기억하세요. 위는 조종석, 가운데는 편곡판, 오른쪽은 소리 재료함입니다.", screenMapSvg(), "하단 Clip Editor는 클립을 클릭한 뒤 세부 편집할 때 사용합니다.")}

    <h2>1. 30초 준비: 프로젝트 기본값 정하기</h2>
    ${figure("그림 1. 곡 설정 체크", "Transport Bar에서 곡의 속도와 기준 조성을 먼저 정합니다.", settingsSvg(), "처음에는 Tempo 120, 4/4, Key C로 시작해도 충분합니다.")}
    ${steps([
      "<code>New</code>를 눌러 새 프로젝트를 만듭니다.",
      "프로젝트 이름을 클릭해 곡 제목을 입력합니다.",
      "<code>Tempo</code>를 100-130 사이로 정합니다.",
      "박자표는 <code>4/4</code>, Key는 <code>C</code> 또는 <code>Am</code>으로 시작합니다.",
      "녹음할 계획이 있으면 <code>Metro</code>와 <code>Count-in 1 bar</code>를 켭니다."
    ])}
    ${tip("빠른 선택", "EDM/Pop 느낌은 120 BPM, 발라드 느낌은 80-100 BPM, 힙합 느낌은 85-100 BPM으로 시작하면 무난합니다.", "blue")}

    <h2>2. 2분: 드럼과 베이스 루프 배치</h2>
    ${figure("그림 2. Loop Browser에서 Timeline으로", "Loops 탭에서 드럼과 베이스를 골라 곡의 기본 리듬을 만듭니다.", loopSvg(), "미리듣기 후 + 버튼을 누르거나 Timeline으로 직접 드래그합니다.")}
    ${steps([
      "오른쪽 Studio Panel에서 <code>Loops</code> 탭을 엽니다.",
      "검색창에 <code>drum</code>을 입력하고 마음에 드는 루프를 미리 듣습니다.",
      "<code>+</code> 버튼을 누르거나 Timeline의 비트 트랙으로 드래그합니다.",
      "검색창에 <code>bass</code>를 입력하고 베이스 루프를 두 번째 트랙에 놓습니다.",
      "드럼과 베이스 클립의 시작 위치와 길이를 맞춥니다."
    ])}
    ${tip("처음 곡 구조", "4마디 드럼 + 4마디 베이스 + 4마디 코드만 있어도 곡의 뼈대가 생깁니다.", "green")}

    <h2>3. 2분: MIDI 또는 Drummer로 멜로디 추가</h2>
    ${figure("그림 3. MIDI 편집 빠른 흐름", "Piano Roll, Touch, Drummer 중 하나만 써도 멜로디나 리듬 변화를 만들 수 있습니다.", editSvg(), "수업/초보자용으로는 Touch의 Chord Strips나 Drummer가 가장 빠릅니다.")}
    ${steps([
      "Timeline에서 악기 트랙을 선택합니다.",
      "하단 Clip Editor에서 <code>미디 클립</code>을 눌러 새 MIDI 클립을 만듭니다.",
      "<code>Piano Roll</code>에서 노트를 클릭해 입력하거나 <code>Touch</code>를 눌러 키보드/코드 스트립을 사용합니다.",
      "드럼 패턴을 빠르게 만들려면 Timeline 상단 <code>Drummer</code> 버튼을 누릅니다.",
      "노트가 어긋나면 Quantize를 적용하고, Key에 맞추려면 Scale Lock을 사용합니다."
    ])}

    <h2>4. 선택 사항 2분: 오디오 녹음</h2>
    ${figure("그림 4. Audio 트랙 녹음", "마이크 녹음이 필요할 때만 이 단계를 진행합니다.", recordSvg(), "브라우저가 마이크 권한을 물으면 허용해야 녹음할 수 있습니다.")}
    ${steps([
      "오른쪽 <code>Audio</code> 탭을 엽니다.",
      "<code>Track</code> 버튼으로 오디오 트랙을 추가합니다.",
      "녹음할 트랙의 <code>Record enable</code>을 켭니다.",
      "상단 Record 버튼을 눌러 녹음하고, Stop으로 끝냅니다.",
      "하단 파형 편집에서 Trim, Fade, Normalize를 적용합니다."
    ])}

    <h2>5. 2분: 들리게 믹스하기</h2>
    ${figure("그림 5. 최소 믹스 체크", "퀵스타트에서는 볼륨, 팬, 마스터 리미터만 먼저 확인해도 충분합니다.", mixSvg(), "멋진 사운드보다 트랙 간 균형이 먼저입니다.")}
    ${steps([
      "오른쪽 <code>Smart</code> 탭을 엽니다.",
      "드럼이 너무 크면 비트 트랙 fader를 조금 내립니다.",
      "베이스는 중앙에 두고, 건반/신스는 살짝 좌우로 펼칩니다.",
      "보컬/녹음 트랙은 다른 악기보다 조금 앞에 들리게 둡니다.",
      "Master Limiter를 켜고 전체 피크가 너무 강하지 않은지 확인합니다.",
      "필요하면 Timeline 트랙의 <code>A</code> 버튼으로 Automation Lane을 열어 볼륨 변화를 만듭니다."
    ])}

    <h2>6. 1분: WAV와 프로젝트 백업 받기</h2>
    ${figure("그림 6. Share Export", "상단 Export 버튼은 Mix, Stems ZIP, Project 파일, Import를 한 번에 처리하는 Share 모달을 엽니다.", exportSvg(), "MP3를 선택해도 현재 엔진은 WAV로 안전 폴백할 수 있습니다.")}
    ${steps([
      "상단 오른쪽 <code>Export</code>를 누릅니다.",
      "<code>Format</code>은 WAV로 둡니다. 특정 반복 구간만 필요하면 Cycle을 켠 뒤 Range를 Cycle로 선택합니다.",
      "<code>Mix</code>를 눌러 완성 WAV를 받습니다.",
      "협업이나 교사용 피드백이 필요하면 <code>Stems ZIP</code>도 받습니다.",
      "나중에 이어서 작업하려면 <code>Project</code>를 눌러 <code>.webband.json</code> 백업을 저장합니다."
    ])}

    <h2>7. 막힐 때 바로 확인</h2>
    ${figure("그림 7. 문제 해결 미니맵", "퀵스타트 중 가장 자주 만나는 문제 세 가지입니다.", rescueSvg(), "문제가 생기면 먼저 Project 파일로 백업하고 새로고침하세요.")}
    <div class="grid">
      <div class="card"><strong>소리가 안 나요</strong>트랙 Mute/Solo, Master volume, 브라우저 탭 음소거, 시스템 출력 장치를 확인합니다.</div>
      <div class="card"><strong>녹음이 안 돼요</strong>마이크 권한, Audio 트랙 존재 여부, Record enable, Count-in 상태를 확인합니다.</div>
      <div class="card"><strong>Export가 짧아요</strong>Range가 Cycle인지 확인합니다. 전체 곡은 Full로 내보냅니다.</div>
      <div class="card"><strong>작업을 옮기고 싶어요</strong>Export -> Project로 <code>.webband.json</code>을 저장하고, 다른 브라우저에서 Import합니다.</div>
    </div>

    <h2>8. 퀵스타트 체크리스트</h2>
    <table>
      <thead><tr><th>완료</th><th>확인 항목</th><th>위치</th></tr></thead>
      <tbody>
        <tr><td>□</td><td>BPM, 박자표, Key를 정했다</td><td>상단 Transport</td></tr>
        <tr><td>□</td><td>드럼 루프와 베이스 루프를 배치했다</td><td>Loops -> Timeline</td></tr>
        <tr><td>□</td><td>MIDI 또는 Drummer 클립을 추가했다</td><td>Timeline / Clip Editor</td></tr>
        <tr><td>□</td><td>필요한 경우 오디오를 녹음했다</td><td>Audio 탭</td></tr>
        <tr><td>□</td><td>트랙 볼륨과 Master Limiter를 확인했다</td><td>Smart 탭</td></tr>
        <tr><td>□</td><td>Mix WAV와 Project 백업을 받았다</td><td>Export -> Share</td></tr>
      </tbody>
    </table>
    <p class="footer">생성 산출물: <code>garageband-quickstart-user-manual.html</code>, <code>garageband-quickstart-user-manual.pdf</code>, <code>garageband-quickstart-user-manual.svg</code></p>
  </main>
</body>
</html>`;
}

function findChrome() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].find((candidate) => existsSync(candidate));
}

writeFileSync(svgPath, quickMap(), "utf8");
writeFileSync(htmlPath, htmlManual(), "utf8");

const chrome = findChrome();
if (!chrome) {
  console.warn("Chrome/Edge not found. HTML and SVG were generated, but PDF was skipped.");
  process.exit(0);
}

const result = spawnSync(
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

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Generated:\n- ${htmlPath}\n- ${svgPath}\n- ${pdfPath}`);
