import { getLessonById } from "./lessons";
import type { Rubric } from "./types";

export const DEFAULT_ASSIGNMENT_RUBRIC: Rubric = {
  criteria: [
    {
      id: "readiness",
      title: "제출 준비",
      levels: [
        { label: "시작", description: "기본 아이디어가 있다." },
        { label: "성장", description: "길이와 트랙 구성이 갖춰진다." },
        { label: "완성", description: "반복과 직접 만든 요소가 들린다." }
      ]
    },
    {
      id: "balance",
      title: "균형",
      levels: [
        { label: "시작", description: "한 역할이 들린다." },
        { label: "성장", description: "두 역할 이상이 함께 들린다." },
        { label: "완성", description: "드럼, 베이스, 멜로디 또는 녹음이 어울린다." }
      ]
    },
    {
      id: "craft",
      title: "정리",
      levels: [
        { label: "시작", description: "클립이 배치되어 있다." },
        { label: "성장", description: "짧게 잘린 클립과 빈 트랙을 확인했다." },
        { label: "완성", description: "제출 전 체크를 끝냈다." }
      ]
    }
  ]
};

export function rubricForLesson(lessonId?: string) {
  return getLessonById(lessonId)?.rubric ?? DEFAULT_ASSIGNMENT_RUBRIC;
}
