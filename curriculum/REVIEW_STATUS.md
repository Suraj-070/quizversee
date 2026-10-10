# Quizverse Grades 9–12 Curriculum Review — Batch Audit

**Status:** research and candidate indexing complete for **22 of 22 subject banks**. This is NOT certification that the latest official editions were fully verified. The import manifest `curriculum/nepal-grades-9-12.plan.json` remains deliberately unchanged.

## What is prepared
- Grade 9: Science and Technology (19), Compulsory Mathematics (0), Optional Mathematics (6), Computer Science (0)
- Grade 10: Science and Technology (19), Compulsory Mathematics (14), Optional Mathematics (8), Computer Science (0)
- Grade 11: Physics (26), Chemistry (17), Biology (10), Mathematics (18), Computer Science (8), English (20), Nepali (12)
- Grade 12: Physics (25), Chemistry (21), Biology (10), Mathematics (23), Computer Science (7), English (0), Nepali (10)

**Total:** 22 review files; 273 candidate headings; four source-blocked banks with zero candidates; no chapter headings certified for import. **Note:** several candidate files are partial, or use syllabus-unit headings rather than literal textbook chapters. The sum is a research-inventory count, not a completeness or verification score.

## Outstanding high-priority source gaps
1. Grade 9 compulsory mathematics — find official latest edition table of contents.
2. Grades 9 and 10 elective Computer Science — verify CDC 2082 textbook contents.
3. Grade 12 English — different study websites report 45 vs 46 headings; resolve language vs literature counting and actual textbook edition.
4. Grade 11 English — literature section is not yet in candidate file.
5. Grade 12 Nepali — currently only first ten sourced chapters.
6. Grades 9–10 Optional Mathematics and Grade 9 Science — identify currently prescribed edition vs old guides; avoid mixing older/newer textbooks.
7. Remaining Grades 11–12 Sciences/Math — inspect original CDC syllabus/book indexes and validate precise titles.

## Safety gates
- Every review JSON is `importReady:false` and every chapter `verified:false`.
- Only promote a subject to the live manifest if verified against its current *official* source and complete where required.
- Use `npx tsx scripts/import-curriculum.ts` to dry-run. Do not use `--apply` until reviewed by the repository owner.
- No existing Prisma records, student attempts or question banks should be deleted or overwritten.

## Data model caveat
The current `Topic` model is a flat subject->topic relation. Subject data represented by sections and units (English Language Development/Literature, Biology Botany/Zoology) should use unambiguous topic labels or an explicitly approved nested hierarchy design before importing subchapters.
