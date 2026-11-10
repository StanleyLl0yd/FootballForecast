# M3-A3 two missing CC0 season reference: 480-fixture public audit

Preliminary matching source: [RSSSF 2021/22](https://www.rsssf.org/tablesr/rus2022.html) and [RSSSF 2022/23](https://www.rsssf.org/tablesr/rus2023.html), season-specific only. The publisher's first serving UTC cannot be inferred from these retrospective pages.

* The purely functional parser requires **30 consecutive rounds × 8 unique directed fixtures = 240 games per year**, exact 16-club roster, valid dates, goal totals 359+280 (2021/22) and 411+319 (2022/23), and isolates the retrospectively awarded Pari NN–Torpedo **0:3** from the actual **1:1** played outcome.
* The GitHub Actions workflow makes only **two fixed HTTPS GETs**, one per development season, and prints **public-safe aggregate hashes and coverage**. No year-2025/26 feed, Supabase, secrets, private IDs, raw match exports, model training or public predictions. Live source hash/graph hash lets us pin a reviewed snapshot later.
* If parser assertions fail, the audit is **inconclusive**, not 480 certified played training rows. Never call RSSSF retrospective official score 0:3 played goals; no historical strict-as-of claim.
* Follow-up: in a separate reviewed owner-only SELECT-only correlation, join the 480 public season-specific fixtures to 480 private development rows using candidate seven-season club identities, dates, sides and played-score roles; output aggregate agreement/rejection counts and a result digest only. Preserve 2025/26 once-consumed holdout, original M2 escrow and FORCE RLS.
* This step adds concrete missing-season per-match **reference availability** and fail-closed reproducibility; **M3 remains OPEN 2/8 until all A3 conditions are verified**.

The owner's #271 decision to use accessible sources broadly is in effect. Source attribution is recorded without delaying internal experiments to seek hypothetical permissions; known real restrictions must still be respected.
