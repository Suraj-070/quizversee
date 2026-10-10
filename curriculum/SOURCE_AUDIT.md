# Nepal Grades 9–12 curriculum source audit (working notes)

Status: **research only — not approved for import**. The importer reads only `curriculum/nepal-grades-9-12.plan.json`; this file does not modify Supabase.

## Primary CDC source catalogues
- Grade 9 textbooks: https://lib.moecdc.gov.np/catalog/opac_css/index.php?id=19+title%3D&lvl=etagere_see
- Grade 10 textbooks: https://lib.moecdc.gov.np/catalog/opac_css/index.php?id=20&lvl=etagere_see
- Grade 9 Mathematics English Translation (2022, 384 pp): https://lib.moecdc.gov.np/catalog/opac_css/index.php?id=13786&lvl=notice_display
- Grade 10 Mathematics (2079 BS): https://lib.moecdc.gov.np/catalog/opac_css/index.php?id=15108&lvl=notice_display
- Grade 10 Science & Technology teacher guide (2081 BS): https://lib.moecdc.gov.np/catalog/opac_css/index.php?id=14008&lvl=notice_display
- Grade 9–10 Optional Mathematics curriculum (2081 BS): https://lib.moecdc.gov.np/catalog/opac_css/index.php?id=12&lvl=titre_uniforme_see

## Grade 9 Science & Technology: candidate chapter headings (NOT YET VERIFIED AGAINST CDC TEXTBOOK)
A school-produced lesson plan lists these 19 units:
Source: https://eastpoleschool.edu.np/media/pdfs/LP_Class_9_Science.pdf

1. Scientific Study
2. Classification of Living Beings
3. Life Cycle
4. Evolution [school lesson plan appears to say "Evaluation"; verify exact textbook title]
5. Physical Structure and Life Process
6. Nature and Environment
7. Force and Motion
8. Machine
9. Energy
10. Waves
11. Electricity
12. The Universe
13. Information and Communication Technology
14. Atomic Structure and Chemical Bond
15. Chemical Reaction
16. Gases
17. Metals and Non-Metals
18. Carbon and Its Compounds
19. Materials Used in Daily Life

**Do not copy these into the import manifest yet.** Verify names, order, medium, and edition from the CDC book contents page. Grade 9 Mathematics has materially different editions (2075 BS and 2022 translation), so do not mix their contents.

## Remaining verification tasks
- Grade 9: Science, Compulsory Mathematics, Optional Mathematics, Computer Science
- Grade 10: Science, Compulsory Mathematics, Optional Mathematics, Computer Science
- Grade 11: Physics, Chemistry, Biology, Mathematics, Computer Science, English, Nepali
- Grade 12: Physics, Chemistry, Biology, Mathematics, Computer Science, English, Nepali

## Publication gate
For each subject, record a direct CDC source URL, edition/year, and chapter order. Mark `chapterVerification: "verified"` only after checking the table of contents. Then run `npx tsx scripts/import-curriculum.ts` (dry run) before any approved `--apply`.
