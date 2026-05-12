import { Cloud, HardDrive } from "../icons";
import { useEffect, useState } from "react";
import { getRepositoryMode, projectRepository, setRepositoryMode, subscribeRepositoryMode } from "../../db/studioRepository";
import type { CloudIdentity, CloudRole, RepositoryMode } from "../../repositories/cloudTypes";
import {
  getSupabaseConfig,
  readCloudIdentity,
  setCloudRole,
  signInWithPassword,
  signOutCloud,
  signUpWithPassword
} from "../../repositories/supabaseClient";
import { useDawStore } from "../../store/useDawStore";

function modeLabel(mode: RepositoryMode) {
  if (mode === "supabase") return "Supabase";
  return mode === "mockCloud" ? "모의 클라우드" : "로컬";
}

export function RepositorySwitch() {
  const [mode, setMode] = useState<RepositoryMode>(getRepositoryMode());
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [identity, setIdentity] = useState<CloudIdentity | undefined>(() => readCloudIdentity());
  const [email, setEmail] = useState(identity?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CloudRole>(identity?.role ?? "student");
  const supabaseConfigured = getSupabaseConfig().configured;

  useEffect(() => subscribeRepositoryMode(setMode), []);

  async function changeMode(nextMode: RepositoryMode) {
    if (nextMode === mode) return;
    setStatus("syncing");
    try {
      setRepositoryMode(nextMode);
      await projectRepository.saveProject(useDawStore.getState().project);
      setStatus("done");
    } catch {
      setRepositoryMode("local");
      setStatus("error");
    }
  }

  async function signIn(createAccount = false) {
    if (!email.trim() || !password) return;
    setStatus("syncing");
    try {
      const nextIdentity = createAccount
        ? await signUpWithPassword(email.trim(), password, role, email.trim())
        : await signInWithPassword(email.trim(), password, role);
      setCloudRole(role);
      setIdentity(nextIdentity ?? readCloudIdentity());
      setPassword("");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function signOut() {
    signOutCloud();
    setIdentity(undefined);
    setRepositoryMode("local");
  }

  return (
    <div className="rounded-lg border border-white/10 bg-studio-900/80 p-1">
      <div className="grid grid-cols-3 gap-1">
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition ${
            mode === "local" ? "bg-meter-cyan text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => void changeMode("local")}
          title="로컬 저장소 사용"
        >
          <HardDrive size={13} />
          로컬
        </button>
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition ${
            mode === "mockCloud" ? "bg-meter-amber text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => void changeMode("mockCloud")}
          title="모의 클라우드 저장소 사용"
        >
          <Cloud size={13} />
          모의
        </button>
        <button
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition ${
            mode === "supabase" ? "bg-meter-green text-studio-950" : "text-slate-300 hover:bg-white/[0.08]"
          }`}
          onClick={() => void changeMode("supabase")}
          disabled={!supabaseConfigured}
          title={supabaseConfigured ? "Supabase 저장소 사용" : "Supabase 환경 변수가 필요합니다"}
        >
          <Cloud size={13} />
          서버
        </button>
      </div>

      <div className="mt-1 truncate px-1 text-[10px] font-semibold text-slate-500">
        {status === "syncing"
          ? "전환 중..."
          : status === "error"
            ? "전환 실패 - 로컬 저장소로 복귀"
            : `${modeLabel(mode)} 저장소`}
      </div>

      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
        <div className="grid grid-cols-2 gap-1">
          <select
            className="h-7 rounded border border-white/10 bg-studio-950 px-2 text-[11px] font-bold text-slate-100 outline-none"
            value={role}
            onChange={(event) => {
              const nextRole = event.target.value === "teacher" ? "teacher" : "student";
              setRole(nextRole);
              setCloudRole(nextRole);
            }}
          >
            <option value="student">학생</option>
            <option value="teacher">교사</option>
          </select>
          {identity ? (
            <button className="studio-button h-7 text-[11px]" onClick={signOut}>
              로그아웃
            </button>
          ) : (
            <button className="studio-button h-7 text-[11px]" onClick={() => void signIn(false)} disabled={!supabaseConfigured}>
              로그인
            </button>
          )}
        </div>
        {identity ? (
          <div className="truncate px-1 text-[10px] font-semibold text-slate-500">
            {identity.displayName} · {identity.role === "teacher" ? "교사" : "학생"}
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
            <input
              className="h-7 min-w-0 rounded border border-white/10 bg-studio-950 px-2 text-[11px] text-slate-100 outline-none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="이메일"
            />
            <input
              className="h-7 min-w-0 rounded border border-white/10 bg-studio-950 px-2 text-[11px] text-slate-100 outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              type="password"
            />
            <button className="studio-button h-7 px-2 text-[11px]" onClick={() => void signIn(true)} disabled={!supabaseConfigured}>
              가입
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
