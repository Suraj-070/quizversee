# Quizverse UX stabilization — staging implementation
Updated 2026-10-11. **Staging only: not merged, released, or deployed.**

## Implemented
- Refresh does not force a browser-stored quiz to open. Home remains Home.
- Home fetches *eligible* unfinished attempts from the authenticated student API. Continue reconstructs question and submitted-answer state from the server's already-redacted attempt response, including question images. This can recover across devices.
- No quiz questions, images, or answer state are stored in localStorage. Obsolete `quizverse-quiz-session` data is purged on bootstrap; signing out clears in-memory quiz state.
- Resume safely distinguishes submitted choices from default placeholders; it does not reveal exam correctness or explanations.
- Answered exam questions cannot be edited or re-submitted when resuming, including after the last question.
- Topic/subject quiz setup supports any custom integer size from 1 through the published-question count. Presets and exact-bank option use one unit-tested availability helper.
- Admin Settings can choose small presets and a default feedback mode. Both quiz setup screens honor that default.
- Student Profile loads saved class and subjects and permits changes; updates are atomic at the database layer. Changing display name updates header without forcing a refresh.
- Onboarding no longer shows an indefinite spinner for empty subject lists, permits choosing another class, and avoids a full-page refresh at completion.
- Student Home shows saved subjects and links to My Learning and subject management.
- My Learning shows every selected subject, including ones with zero published questions.
- New completed quiz reviews explicitly show unanswered questions as unanswered, not as placeholder answer A. Results separate Correct / Incorrect / Skipped. Historical completed attempt reviews remain compatible.
- Wrong-answer repeat-practice excludes skipped questions for new attempts, preserving legacy behavior.
- `package-lock.json` was regenerated and committed to the staging branch; CI reverted to strict `npm ci`.
- GitHub Actions verifies unit tests, TypeScript, a standalone production Next.js build, PostgreSQL integration, and authenticated HTTP flows against a disposable `qai_test` database.
- Reference green CI: [run 38114211711](https://github.com/Suraj-070/quizversee/actions/runs/38114211711) — 27 unit tests passed and production build successful. **Subsequent commits need independent green confirmation**.

- [Green authenticated HTTP verification](https://github.com/Suraj-070/quizversee/actions/runs/38114415212) confirms test-student login, subject saving, one-question exam, answer secrecy, duplicate rejection, completion, cross-user attempt isolation, and profile subject replacement.
- Quiz-set start now returns question/option images consistently with topic and subject quizzes.

## Still required before deployment
1. Verify the **latest commit** passes both CI jobs including Next.js production build.
2. Browser-based acceptance tests on a real isolated staging deployment, desktop and mobile:
   - New student chooses class/subjects, reloads, and sees the same subjects on Home, My Learning, and Profile.
   - Change class/subjects in Profile, reload, and verify server-persisted selection.
   - Start, answer, complete and review a single-question topic and subject quiz.
   - Navigate Home during an unfinished exam, refresh, then explicitly Continue.
   - Refresh after recording the last exam answer but before completion; finish without duplicate submission.
   - Repeat with a different account and a separate browser/device; no cross-account answer exposure.
   - Complete while skipping a question; review and results should say Unanswered / Skipped.
   - Admin changes presets and default feedback; student sees updated setup.
   - Test zero published questions, empty onboarding subjects, slow responses and errors.
3. The authenticated HTTP smoke test now passes in disposable CI. Still required: true **concurrent HTTP submission/completion race tests**, and visual browser acceptance tests (including navigation and keyboard controls).
4. Check accessibility: keyboard navigation, focus order, mobile widths, form validation, visible loading/errors, contrast and assistive labels.
5. Resume question ordering can differ from initial randomized order because existing schema does not record original sequence; improving exact order would require an approved additive data change.
6. Confirm compatibility with the local `migrate/supabase` branch before merging. Do not overwrite untracked local files.

**No changes were made to production application deployment, QAI activation flag, or existing Supabase data in this UX phase.**
