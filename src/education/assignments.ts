import { getLessonById } from "./lessons";
import type { Rubric } from "./types";

export const DEFAULT_ASSIGNMENT_RUBRIC: Rubric = {
  criteria: [
    {
      id: "readiness",
      title: "제출 준비",
      levels: [
        { label: "시작", description: "기본 아이디어가 있습니다." },
        { label: "성장", description: "곡 길이와 트랙 구성이 갖춰집니다." },
        { label: "완성", description: "반복과 직접 만든 요소가 어울립니다." }
      ]
    },
    {
      id: "balance",
      title: "균형",
      levels: [
        { label: "시작", description: "한 역할이 들립니다." },
        { label: "성장", description: "두 역할 이상이 함께 들립니다." },
        { label: "완성", description: "드럼, 베이스, 멜로디 또는 녹음이 어울립니다." }
      ]
    },
    {
      id: "craft",
      title: "정리",
      levels: [
        { label: "시작", description: "클립이 배치되어 있습니다." },
        { label: "성장", description: "짧게 쉰 클립과 빈 트랙을 확인합니다." },
        { label: "완성", description: "제출 전 체크를 통과합니다." }
      ]
    }
  ]
};

export function rubricForLesson(lessonId?: string) {
  return getLessonById(lessonId)?.rubric ?? DEFAULT_ASSIGNMENT_RUBRIC;
}
