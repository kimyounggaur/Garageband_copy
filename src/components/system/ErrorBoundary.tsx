import { Component, type ErrorInfo, type ReactNode } from "react";
import { loadLastProject } from "../../db/studioRepository";
import { useDawStore } from "../../store/useDawStore";
import { logError } from "../../utils/logger";

type Props = {
  children: ReactNode;
  areaLabel?: string;
};

type State = {
  hasError: boolean;
  loading: boolean;
  message: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, loading: false, message: "" };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, loading: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
    if (!import.meta.env.DEV) logError(`ErrorBoundary.${this.props.areaLabel ?? "앱"}`, { error, componentStack: info.componentStack });
  }

  private retry = () => {
    this.setState({ hasError: false, loading: false, message: "" });
  };

  private loadSavedProject = async () => {
    this.setState({ loading: true, message: "" });
    try {
      const project = await loadLastProject();
      if (!project) {
        this.setState({ loading: false, message: "마지막으로 저장한 프로젝트가 없습니다." });
        return;
      }
      useDawStore.getState().loadProject(project);
      this.retry();
    } catch (error) {
      logError("ErrorBoundary.loadSavedProject", error);
      this.setState({ loading: false, message: "저장한 프로젝트를 불러오지 못했어요." });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section role="alert" className="panel flex h-full min-h-[140px] flex-col items-center justify-center gap-3 rounded-lg p-4 text-center text-ink-high">
        <h2 className="text-sm font-bold">{this.props.areaLabel ?? "화면"}에서 오류가 발생했어요.</h2>
        <p className="text-xs text-ink-body">작업을 계속하려면 다시 시도하거나 마지막 저장 프로젝트를 불러오세요.</p>
        {this.state.message ? <p className="text-xs text-rose-200">{this.state.message}</p> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="studio-button" onClick={this.retry} disabled={this.state.loading}>다시 시도</button>
          <button type="button" className="studio-button" onClick={() => void this.loadSavedProject()} disabled={this.state.loading}>
            마지막 저장 프로젝트 불러오기
          </button>
        </div>
      </section>
    );
  }
}
