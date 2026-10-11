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

## Verified staging acceptance
- Authenticated HTTP concurrency checks now cover simultaneous answer claim, double completion, and mastery exactly once, and have passed in disposable CI.
- [Chromium desktop/mobile run 38115594829](https://github.com/Suraj-070/quizversee/actions/runs/38115594829) passed both full student journeys (onboarding, profile subject persistence, one-question quiz, refresh Home, resume, finish), with desktop/mobile screenshots.
- Screenshots have been reviewed at 1280px and 390px. Navigation now resets scroll on screen changes; captures wait for animation completion.
- Hard-coded demo-login shortcuts are no longer displayed on the sign-in page.
- Additional logout/cross-account browser isolation and stable display-order checks have been added; **confirm the latest CI run** before sign-off.

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
3. Authenticated concurrent HTTP submissions and duplicate completion checks pass in disposable CI. Staging deployment on an independently hosted URL, production-style environment variables, broader accessibility, and manual keyboard/screen-reader review are still worthwhile release checks.
4. Check accessibility: keyboard navigation, focus order, mobile widths, form validation, visible loading/errors, contrast and assistive labels.
5. Question ordering is now stable across start/resume, sorting each attempt by its persisted UserAnswer IDs. This requires no additional database field. Verify on the latest browser run.
6. Confirm compatibility with the local `migrate/supabase` branch before merging. Do not overwrite untracked local files.

**No changes were made to production application deployment, QAI activation flag, or existing Supabase data in this UX phase.**

## Final visual-review refinements
- Inspected CI Chromium images for Home, Profile, Quiz Setup, Results and Resumed Quiz at desktop (1280px) and phone (390px) sizes.
- Replaced smooth route scroll reset with immediate scroll in `AppShell` to keep quiz headings from hiding under sticky mobile navigation.
- Added accessible labels to icon-only student header, dismiss-announcement, and name-save actions.
- Admin preset tiles now expose `aria-pressed` and no longer nest a Switch button inside a button.
- Added a real-browser sign-out/switch-account isolation check.
- **Prior verified all-green CI**: [38115962196](https://github.com/Suraj-070/quizversee/actions/runs/38115962196). Confirm latest commits separately.
- Full manual assistive-technology testing and a deployed preview review are not replaced by headless Chromium automation.

## Integration limitation
Only `main` and `qai/answer-integrity-postgres` exist as remote branches; the owner's `migrate/supabase` worktree branch and its untracked files are local-only. This staging work must not be merged into `main` or deployed until the local PostgreSQL migration branch is reconciled. Production QAI remains off.
