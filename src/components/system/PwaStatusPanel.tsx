import { useEffect, useRef, useState } from "react";

type SampleCacheStatus = { cachedCount: number; cachedBytes: number; totalApproved: number };

type Props = {
  prepareForRefresh: () => Promise<boolean>;
};

function validSampleStatus(value: unknown): value is SampleCacheStatus {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SampleCacheStatus>;
  return [state.cachedCount, state.cachedBytes, state.totalApproved]
    .every((item) => Number.isFinite(item) && Number(item) >= 0);
}

export function PwaStatusPanel({ prepareForRefresh }: Props) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [samples, setSamples] = useState<SampleCacheStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const userRequestedRef = useRef(false);
  const prepareForRefreshRef = useRef(prepareForRefresh);
  prepareForRefreshRef.current = prepareForRefresh;

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;

    const syncWaiting = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
    };
    const onInstalled = (event: Event) => {
      if ((event.target as ServiceWorker).state === "installed") {
        syncWaiting();
        window.setTimeout(syncWaiting, 0);
      }
    };
    const onUpdateFound = () => {
      const installing = registration?.installing;
      installing?.addEventListener("statechange", onInstalled);
      if (installing?.state === "installed") syncWaiting();
    };
    const onControllerChange = () => {
      if (userRequestedRef.current) {
        void prepareForRefreshRef.current().then((safe) => {
          if (safe) {
            window.location.reload();
            return;
          }
          userRequestedRef.current = false;
          setRefreshing(false);
          setMessage("새로고침 직전에 저장하지 못한 작업을 확인했습니다. 저장한 뒤 다시 접속해 주세요.");
        }).catch(() => {
          userRequestedRef.current = false;
          setRefreshing(false);
          setMessage("저장 확인에 실패해 자동 새로고침을 중단했습니다. 저장한 뒤 다시 접속해 주세요.");
        });
      } else void requestSampleStatus();
    };
    const onConnectionChange = () => {
      setOnline(navigator.onLine);
      void requestSampleStatus();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void registration?.update().then(syncWaiting).catch(() => {});
    };

    async function requestSampleStatus() {
      const active = registration?.active ?? navigator.serviceWorker.controller;
      if (!active) return;
      const channel = new MessageChannel();
      const status = await new Promise<SampleCacheStatus | null>((resolve) => {
        const timeout = window.setTimeout(() => resolve(null), 3000);
        channel.port1.onmessage = (event: MessageEvent<unknown>) => {
          window.clearTimeout(timeout);
          resolve(validSampleStatus(event.data) ? event.data : null);
        };
        active.postMessage({ type: "GET_SAMPLE_STATUS" }, [channel.port2]);
      });
      channel.port1.close();
      if (!disposed && status) setSamples(status);
    }

    window.addEventListener("online", onConnectionChange);
    window.addEventListener("offline", onConnectionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    const workerUrl = new URL("./sw.js", document.baseURI);
    void navigator.serviceWorker.register(workerUrl.href, {
      scope: new URL("./", workerUrl).href,
      updateViaCache: "none"
    }).then((ready) => {
      if (disposed) return;
      registration = ready;
      ready.addEventListener("updatefound", onUpdateFound);
      syncWaiting();
      void requestSampleStatus();
      void ready.update().then(syncWaiting).catch(() => {});
    }).catch(() => {
      if (!disposed) setMessage("오프라인 앱 준비에 실패했습니다. 온라인에서 다시 접속해 주세요.");
    });

    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
      window.removeEventListener("online", onConnectionChange);
      window.removeEventListener("offline", onConnectionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  async function refreshWhenSaved() {
    if (!waiting || refreshing) return;
    setRefreshing(true);
    setMessage("");
    try {
      if (!(await prepareForRefresh())) {
        setMessage("저장하지 못한 작업이나 보관할 녹음 원본이 있습니다. 저장·원본 내려받기를 마친 뒤 다시 시도해 주세요.");
        return;
      }
      if (waiting.state === "activated") {
        window.location.reload();
        return;
      }
      userRequestedRef.current = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => {
        if (userRequestedRef.current) {
          userRequestedRef.current = false;
          setMessage("갱신이 지연되고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.");
          setRefreshing(false);
        }
      }, 12000);
    } catch {
      setMessage("저장에 실패해 새로고침을 보류했습니다. 프로젝트 저장을 다시 시도해 주세요.");
    } finally {
      if (!userRequestedRef.current) setRefreshing(false);
    }
  }

  const sampleText = online
    ? "승인된 샘플 다운로드 시도 가능"
    : samples?.totalApproved
      ? `오프라인 샘플 ${samples.cachedCount}/${samples.totalApproved}개 · 미저장 샘플 다운로드 불가`
      : "오프라인에서 새 샘플을 다운로드할 수 없습니다";

  return (
    <aside className="pointer-events-none fixed bottom-3 left-3 z-[90] max-w-[min(420px,calc(100vw-24px))] space-y-2" aria-label="연결 및 앱 갱신 상태">
      <div className="pointer-events-auto rounded-lg border border-graphite-700 bg-graphite-950/95 px-3 py-2 text-[11px] font-bold text-ink-body shadow-lg" role="status">
        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${online ? "bg-meter-green" : "bg-meter-rose"}`} aria-hidden="true" />
        <span className="text-ink-body">{online ? "온라인" : "오프라인"}</span>
        <span className="mx-2 text-graphite-500">·</span>
        <span>{sampleText}</span>
      </div>
      {waiting ? (
        <div className="pointer-events-auto rounded-lg border border-accent-sel/60 bg-graphite-950 p-3 text-xs text-ink-body shadow-xl" role="status">
          <p className="font-black text-ink-high">새 버전이 준비되었습니다.</p>
          <p className="mt-1">저장 상태를 확인한 뒤 원하는 때에 새로고침할 수 있습니다.</p>
          <button type="button" className="studio-button mt-2" disabled={refreshing} onClick={() => void refreshWhenSaved()}>
            {refreshing ? "저장 확인 중…" : "지금 새로고침"}
          </button>
        </div>
      ) : null}
      {message ? <p className="pointer-events-auto rounded-lg border border-meter-rose/50 bg-graphite-950 px-3 py-2 text-xs font-semibold text-ink-body" role="alert">{message}</p> : null}
    </aside>
  );
}
