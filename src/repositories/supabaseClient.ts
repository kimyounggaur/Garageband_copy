import type { CloudIdentity, CloudRole } from "./cloudTypes";

type SupabaseSessionResponse = {
  access_token: string;
  expires_at?: number;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      displayName?: string;
      display_name?: string;
      role?: CloudRole;
    };
  };
};

const IDENTITY_KEY = "webband.supabase.identity";
const ROLE_KEY = "webband.supabase.role";

function envValue(key: string) {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key]?.trim() ?? "";
}

export function getSupabaseConfig() {
  const url = envValue("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = envValue("VITE_SUPABASE_ANON_KEY");
  const audioBucket = envValue("VITE_SUPABASE_AUDIO_BUCKET") || "audio-assets";
  return { url, anonKey, audioBucket, configured: Boolean(url && anonKey) };
}

export function readCloudIdentity(): CloudIdentity | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as CloudIdentity) : undefined;
  } catch {
    return undefined;
  }
}

function writeCloudIdentity(identity?: CloudIdentity) {
  if (!identity) {
    globalThis.localStorage?.removeItem(IDENTITY_KEY);
    return;
  }
  globalThis.localStorage?.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export function getCloudRole(): CloudRole {
  const stored = globalThis.localStorage?.getItem(ROLE_KEY);
  if (stored === "teacher" || stored === "student") return stored;
  return readCloudIdentity()?.role ?? "student";
}

export function setCloudRole(role: CloudRole) {
  globalThis.localStorage?.setItem(ROLE_KEY, role);
  const identity = readCloudIdentity();
  if (identity) writeCloudIdentity({ ...identity, role });
}

function requireConfig() {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error("Supabase URL과 anon key가 설정되지 않았습니다.");
  }
  return config;
}

function authHeaders(json = true) {
  const config = requireConfig();
  const identity = readCloudIdentity();
  const token = identity?.accessToken || config.anonKey;
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

export function supabaseRestUrl(path: string) {
  const config = requireConfig();
  return `${config.url}/rest/v1/${path.replace(/^\/+/, "")}`;
}

export function supabaseStorageUrl(path: string) {
  const config = requireConfig();
  return `${config.url}/storage/v1/object/${path.replace(/^\/+/, "")}`;
}

export async function supabaseJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(supabaseRestUrl(path), {
    ...init,
    headers: {
      ...authHeaders(true),
      Prefer: "return=representation",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Supabase 요청 실패: ${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function supabaseUpload(path: string, blob: Blob, contentType: string) {
  const response = await fetch(supabaseStorageUrl(path), {
    method: "PUT",
    headers: {
      ...authHeaders(false),
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: blob
  });
  if (!response.ok) throw new Error(`Supabase Storage 업로드 실패: ${response.status}`);
}

export async function supabaseDownload(path: string) {
  const response = await fetch(supabaseStorageUrl(path), {
    headers: authHeaders(false)
  });
  if (!response.ok) throw new Error(`Supabase Storage 다운로드 실패: ${response.status}`);
  return response.blob();
}

export async function supabaseDeleteObject(path: string) {
  const config = requireConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${path.replace(/^\/+/, "")}`, {
    method: "DELETE",
    headers: authHeaders(false)
  });
  if (!response.ok && response.status !== 404) throw new Error(`Supabase Storage 삭제 실패: ${response.status}`);
}

function identityFromSession(session: SupabaseSessionResponse, fallbackRole?: CloudRole): CloudIdentity {
  const metadata = session.user.user_metadata ?? {};
  const role = metadata.role === "teacher" || metadata.role === "student" ? metadata.role : fallbackRole ?? getCloudRole();
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: metadata.displayName || metadata.display_name || session.user.email || "사용자",
    role,
    accessToken: session.access_token,
    expiresAt: session.expires_at ? session.expires_at * 1000 : undefined
  };
}

export async function signInWithPassword(email: string, password: string, role: CloudRole = getCloudRole()) {
  const config = requireConfig();
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error(`로그인 실패: ${response.status}`);
  const identity = identityFromSession((await response.json()) as SupabaseSessionResponse, role);
  writeCloudIdentity(identity);
  setCloudRole(identity.role);
  return identity;
}

export async function signUpWithPassword(email: string, password: string, role: CloudRole, displayName?: string) {
  const config = requireConfig();
  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      data: { role, displayName: displayName || email }
    })
  });
  if (!response.ok) throw new Error(`가입 실패: ${response.status}`);
  const body = (await response.json()) as Partial<SupabaseSessionResponse>;
  if (body.access_token && body.user) {
    const identity = identityFromSession(body as SupabaseSessionResponse, role);
    writeCloudIdentity(identity);
    setCloudRole(identity.role);
    return identity;
  }
  setCloudRole(role);
  return undefined;
}

export function signOutCloud() {
  writeCloudIdentity(undefined);
}
