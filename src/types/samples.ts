export type SampleFile = {
  id: string;
  note: number;
  velocityLayer: { min: number; max: number };
  file: string;
  mimeType: string;
  alternates: Array<{ file: string; mimeType: string }>;
  gain: number;
  licenseSpdx: string;
  licenseUrl: string;
  author: string;
  sourceUrl: string;
  acquiredAt: string;
  redistributionReview: {
    status: "approved";
    reviewedAt: string;
    evidence: string;
  };
};

export type SamplePack = {
  id: string;
  name: string;
  kind: "test-tone" | "instrument";
  baseUrl: string;
  files: SampleFile[];
};

export type SampleManifest = { schemaVersion: 1; packs: SamplePack[] };

export type LoadedSample = { file: SampleFile; buffer: AudioBuffer };
export type LoadedSamplePack = { pack: SamplePack; samples: LoadedSample[] };
