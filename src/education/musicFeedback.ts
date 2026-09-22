import type { Clip, MidiNote, Project, ProjectScale, Track } from "../types/project";
import { barLengthBeats } from "../utils/meterMath";
import { isPitchInScale, normalizePianoRollScale } from "../utils/pianoRoll";

type PlacedNote = Pick<MidiNote, "pitch" | "startBeat" | "durationBeats">;

export type OptionalMusicMetrics = {
  noteCount: number;
  scale: {
    key: string;
    mode: ProjectScale;
    inScale: number;
    total: number;
  };
  rhythm: {
    eighthGridBeats: 0.5;
    aligned: number;
    total: number;
  };
  rangeSemitones: number;
  adjacentMotion: {
    steps: number;
    pairs: number;
  };
  sections?: {
    aRoles: string[];
    bRoles: string[];
    aNotes: number;
    bNotes: number;
    aRange: number;
    bRange: number;
    barBeats: number;
  };
};

function isMelodicTrack(track: Track) {
  return track.type !== "drum" && track.role !== "beat";
}

function notesForSelection(project: Project, selectedClipId?: string): PlacedNote[] {
  const selected = project.tracks
    .filter(isMelodicTrack)
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === selectedClipId && clip.type === "midi");
  const clips = selected
    ? [selected]
    : project.tracks.filter(isMelodicTrack).flatMap((track) => track.clips).filter((clip) => clip.type === "midi");
  return clips.flatMap((clip) => (clip.notes ?? []).map((note) => ({
    pitch: note.pitch,
    startBeat: clip.startBeat + note.startBeat,
    durationBeats: note.durationBeats
  }))).sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

function roleOf(track: Track) {
  return track.role ?? (track.type === "drum" ? "beat" : track.type === "audio" ? "recording" : "melody");
}

function roleLabel(role: string) {
  return ({
    beat: "비트",
    bass: "베이스",
    harmony: "화성",
    melody: "멜로디",
    recording: "녹음"
  } as Record<string, string>)[role] ?? role;
}

function overlaps(clip: Clip, start: number, end: number) {
  return clip.startBeat < end && clip.startBeat + clip.lengthBeats > start;
}

function sectionProfile(project: Project, start: number, end: number) {
  const roles = new Set<string>();
  const pitches: number[] = [];
  let notes = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!overlaps(clip, start, end)) continue;
      roles.add(roleOf(track));
      if (clip.type !== "midi" || !isMelodicTrack(track)) continue;
      for (const note of clip.notes ?? []) {
        const absoluteBeat = clip.startBeat + note.startBeat;
        if (absoluteBeat < start || absoluteBeat >= end) continue;
        notes += 1;
        pitches.push(note.pitch);
      }
    }
  }
  return {
    roles: [...roles].sort(),
    notes,
    range: pitches.length > 0 ? Math.max(...pitches) - Math.min(...pitches) : 0
  };
}

/** Transport beats are quarter notes; an eighth-note grid is 0.5 beat in every supported meter. */
export function analyzeOptionalMusic(project: Project, selectedClipId?: string): OptionalMusicMetrics {
  const notes = notesForSelection(project, selectedClipId);
  const mode = normalizePianoRollScale(project.scale, project.key);
  const key = project.key ?? "C";
  const inScale = notes.filter((note) => isPitchInScale(note.pitch, key, mode)).length;
  const aligned = notes.filter((note) => Math.abs(note.startBeat / 0.5 - Math.round(note.startBeat / 0.5)) <= 0.08).length;
  const pitches = notes.map((note) => note.pitch);
  const rangeSemitones = pitches.length > 0 ? Math.max(...pitches) - Math.min(...pitches) : 0;
  let steps = 0;
  let pairs = 0;
  for (let index = 1; index < notes.length; index += 1) {
    if (Math.abs(notes[index].startBeat - notes[index - 1].startBeat) < 0.001) continue;
    pairs += 1;
    if (Math.abs(notes[index].pitch - notes[index - 1].pitch) <= 2) steps += 1;
  }
  const barBeats = barLengthBeats(project.timeSignature);
  const sectionBeats = barBeats * 4;
  const projectEnd = project.tracks.flatMap((track) => track.clips)
    .reduce((end, clip) => Math.max(end, clip.startBeat + clip.lengthBeats), 0);
  const sections = projectEnd >= sectionBeats * 2
    ? (() => {
        const a = sectionProfile(project, 0, sectionBeats);
        const b = sectionProfile(project, sectionBeats, sectionBeats * 2);
        return {
          aRoles: a.roles,
          bRoles: b.roles,
          aNotes: a.notes,
          bNotes: b.notes,
          aRange: a.range,
          bRange: b.range,
          barBeats
        };
      })()
    : undefined;
  return {
    noteCount: notes.length,
    scale: { key, mode, inScale, total: notes.length },
    rhythm: { eighthGridBeats: 0.5, aligned, total: notes.length },
    rangeSemitones,
    adjacentMotion: { steps, pairs },
    sections
  };
}

export function optionalMusicFeedback(project: Project, selectedClipId?: string) {
  const metrics = analyzeOptionalMusic(project, selectedClipId);
  if (metrics.noteCount === 0) {
    return {
      scale: "멜로디 미디 음이 아직 없습니다. 음을 몇 개 입력하면 조성과 리듬을 살펴볼 수 있어요.",
      rhythm: "음이 들어오면 8분음표 격자와의 위치를 보여드립니다.",
      range: "음역을 살펴볼 음이 아직 없습니다.",
      motion: "이어지는 음의 이동을 살펴볼 음이 아직 없습니다.",
      sections: "A/B 구간에 클립을 배치하면 참여 악기와 음의 밀도를 비교할 수 있어요."
    };
  }
  const { scale, rhythm, adjacentMotion, sections } = metrics;
  const scaleText = scale.mode === "chromatic"
    ? "반음계 모드입니다. 음을 조성 밖이라는 이유로 틀렸다고 판단하지 않습니다."
    : `${scale.key} ${scale.mode === "minor" ? "단조" : "장조"} 음에 ${scale.inScale}/${scale.total}개가 들어갑니다. 다른 음은 경과음이나 의도한 색채일 수 있으니 직접 들어보세요.`;
  const sectionText = !sections
    ? "8마디 분량이 되면 앞 4마디와 뒤 4마디의 악기 참여·음 밀도를 비교할 수 있어요."
    : `A/B 각 4마디(마디당 ${sections.barBeats}박): 참여 악기 역할 ${sections.aRoles.map(roleLabel).join("·") || "없음"}→${sections.bRoles.map(roleLabel).join("·") || "없음"}, 미디 음 ${sections.aNotes}→${sections.bNotes}개, 음역 ${sections.aRange}→${sections.bRange}반음입니다. 차이를 더 주고 싶다면 한 구간의 악기나 리듬을 바꿔 들어보세요.`;
  return {
    scale: scaleText,
    rhythm: `8분음표 격자(0.5박)에 가까운 음 시작은 ${rhythm.aligned}/${rhythm.total}개입니다. 엇박도 표현이므로 소리를 들으며 위치를 선택하세요.`,
    range: `음역은 ${metrics.rangeSemitones}반음입니다. 다음 시도에서 한 옥타브 안팎으로 좁히거나 넓혀 느낌을 비교해 보세요.`,
    motion: adjacentMotion.pairs > 0
      ? `서로 다른 시점의 음 이동 ${adjacentMotion.pairs}번 중 ${adjacentMotion.steps}번이 2반음 이내입니다. 한 구간에 도약을 넣어 앞뒤를 비교해 보세요.`
      : "이어지는 음이 한 시점에만 있습니다. 다음 음을 다른 위치에 놓고 움직임을 들어보세요.",
    sections: sectionText
  };
}
