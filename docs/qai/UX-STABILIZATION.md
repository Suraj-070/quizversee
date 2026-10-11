# Quizverse UX stabilization — staging implementation
Updated 2026-10-11. **Staging only: not merged or deployed.**

## Implemented
- Refresh no longer forces an old quiz; Home offers an explicit Continue action.
- Continue action verifies the persisted attempt is still unfinished and owned by the signed-in user before showing it.
- Student sign-out clears local quiz-session persistence.
- Topic and subject quiz pickers support custom integer counts from 1 to the number of published questions, including one-question topics; server already validates bounds.
- Published question counts include a one-question preset and a matching available-pool choice.
- Student Profile now loads class/subject choices, preselects the saved selections, and saves changes.
- Academic save uses one database transaction rather than separate class and subject writes.
- Onboarding distinguishes loading, empty, and failed subject fetches; broken one-subject skip handler removed.
- Admin Settings adds smaller quantity presets and persisted default quiz feedback mode; topic/subject setup API exposes that default.
- Added an explicit default-mode preference in both quiz setup forms.

## Required pre-release QA — **not yet proven by source-level review**
1. GitHub Actions unit, TypeScript and ephemeral PostgreSQL jobs must pass on the *latest* commit.
2. Browser smoke test on an isolated staging environment (desktop and mobile):
   - New student registers, picks class + two subjects, reloads and sees selections.
   - Student changes class and subjects in Profile; reload and confirm changed content.
   - Student launches a 1-question quiz, answers, completes, and reviews result.
   - Student starts a longer quiz, navigates Home, reloads, stays on Home, and explicitly resumes.
   - Sign out and sign into a different student; no prior user's Continue Quiz card.
   - Admin saves question presets and default feedback, student quiz setup reflects new settings.
   - Subject with zero available topics shows an empty state rather than indefinite spinner.
3. Recover from cross-device or stale local browser sessions; current resume still uses client-persisted questions (not server-reconstructed in-progress quiz).
4. Check color contrast, focus order, keyboard flow, screen reader labels, loading/error states, and narrow mobile widths.
5. Normalize npm lockfile and restore reproducible `npm ci` in CI. CI currently uses a temporary `npm install` workaround.
6. Authenticated route integration and concurrency checks remain required before merging QAI.

No production deploy, feature flag activation, or destructive DB action was performed by this UX work.
