/**
 * Client-side view store (Zustand).
 *
 * The sandbox exposes a single Next.js route (`/`), so we navigate between
 * the Student app and the Admin portal via this store instead of URL routes.
 *
 * The shape mirrors what an App Router version would look like, so porting
 * to multi-route is straightforward:
 *
 *   { name: 'student-subjects', classId }  ≈  /student/classes/[classId]/subjects
 *
 * For Phase 1 we only need auth + student-home + admin-dashboard. Subsequent
 * phases will extend the discriminated union.
 */

import { create } from "zustand";

export type View =
  // auth
  | { name: "login" }
  | { name: "register" }
  // student
  | { name: "student-home" }
  | { name: "student-classes" }
  | { name: "student-subjects"; classId: string }
  | { name: "student-topics"; classId: string; subjectId: string }
  | { name: "student-quiz-sets"; classId?: string }
  | { name: "student-flagged" }
  | { name: "student-progress" }
  | { name: "student-profile" }
  | { name: "quiz-setup"; topicId: string }
  | { name: "subject-quiz-setup"; subjectId: string }
  | { name: "quiz-set-setup"; quizSetId: string }
  | { name: "quiz-active"; attemptId: string }
  | { name: "quiz-results"; attemptId: string }
  | { name: "quiz-review"; attemptId: string }
  | { name: "student-history" }
  // admin
  | { name: "admin-dashboard" }
  | { name: "admin-classes" }
  | { name: "admin-subjects" }
  | { name: "admin-topics" }
  | { name: "admin-questions" }
  | { name: "admin-quiz-sets" }
  | { name: "admin-quiz-set-detail"; quizSetId: string }
  | { name: "admin-imports" }
  | { name: "admin-users" }
  | { name: "admin-user-detail"; userId: string }
  | { name: "admin-attempts" }
  | { name: "admin-analytics" }
  | { name: "admin-announcements" }
  | { name: "admin-site-content" }
  | { name: "admin-settings" }
  | { name: "admin-activity-log" }
  | { name: "admin-archive" };

type ViewState = {
  view: View;
  history: View[];
  setView: (view: View) => void;
  goBack: () => void;
  reset: () => void;
};

export const useViewStore = create<ViewState>((set, get) => ({
  view: { name: "login" },
  history: [],
  setView: (view) =>
    set((state) => ({
      history: [...state.history, state.view].slice(-20), // cap history
      view,
    })),
  goBack: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const history = [...state.history];
      const prev = history.pop()!;
      return { view: prev, history };
    }),
  reset: () => set({ view: { name: "login" }, history: [] }),
}));
