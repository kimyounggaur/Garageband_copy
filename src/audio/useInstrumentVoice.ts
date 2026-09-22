import { useCallback, useEffect, useRef } from "react";
import * as Tone from "tone";
import { createInstrumentVoice, type InstrumentVoice } from "./instrumentVoice";

export function useInstrumentVoice(instrumentId?: string) {
  const voiceRef = useRef<InstrumentVoice | null>(null);
  const pendingRef = useRef<Promise<InstrumentVoice> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      pendingRef.current = null;
      voiceRef.current?.dispose();
      voiceRef.current = null;
    };
  }, [instrumentId]);

  return useCallback(() => {
    if (voiceRef.current) return Promise.resolve(voiceRef.current);
    if (pendingRef.current) return pendingRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const pending = (async () => {
      await Tone.start();
      if (controller.signal.aborted) throw new DOMException("악기 미리듣기를 취소했습니다.", "AbortError");
      const voice = await createInstrumentVoice(instrumentId, undefined, controller.signal);
      if (controller.signal.aborted) {
        voice.dispose();
        throw new DOMException("악기 미리듣기를 취소했습니다.", "AbortError");
      }
      voiceRef.current = voice;
      return voice;
    })();
    pendingRef.current = pending;
    void pending.finally(() => {
      if (pendingRef.current === pending) pendingRef.current = null;
    }).catch(() => undefined);
    return pending;
  }, [instrumentId]);
}
