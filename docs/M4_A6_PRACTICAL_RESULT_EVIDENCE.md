# M4-A6 practical result evidence standard (owner approved 2026-11-24)

Refs [#304](https://github.com/StanleyLl0yd/FootballForecast/issues/304#issuecomment-7124534842),
[#333](https://github.com/StanleyLl0yd/FootballForecast/issues/333#issuecomment-7124534238).
This clarification supersedes any interpretation requiring a universal publisher
digital signature or proof that no future administrative decision can occur.

- Official league protocol **or sufficient independently published official
  corroboration** of actual play/full time, exact directed A5 identity, kickoff,
  season and score agreement with the existing two provider observations.
- Publisher provenance and permitted source usage must still be reviewed.
  GitHub OIDC authenticates runner observation time/digest, not original
  publication time. Do not manufacture unavailable timestamps or statuses.
- Review issued RFS/KDK decisions as of settlement, not permanent finality.
  Preserve a scoped dated review, unresolved proceedings and later revisions.
  Known relevant pending or ambiguous cases stay blocked. Append revisions
  and invalidate stale evaluations; never modify original forecasts.
- Unresolvable contradictory/incomplete evidence excludes the match from
  metrics. ABSTAIN never enters scoring.

## Candidate discovery (not authenticated)

Opposing-club official report locators now exist for five of eight fixtures.
The following are references for future reviewed source extraction, not new
network permissions. Do not crawl general match details with historical H2H.

| Fixture | Additional candidate reference |
| --- | --- |
| Rostov – Krylya | https://pfcks.ru/news/novosti_5155.html |
| Orenburg – Baltika | https://fcorenburg.ru/matchs/2026-2027/rossijskaya-premer-liga/15-tur.html |
| Akron – Fakel | https://fakelfc.ru/index.php/news/view/10420-obygrali-akron |
| CSKA – Akhmat | https://fc-akhmat.ru/news/fc-akhmat/novosti-osnovy/akhmat-obygral-na-vyezde-moskovskiy-tsska/ |
| Dynamo Moscow – Krasnodar | https://fcdynamo.ru/news/dynamovcy-sygrali-vniciu-s-krasnodarom-i-vozglavili-turnirnuiu-tablicu/ |

Krylya also has a club archive protocol reference:
https://old.pfcks.ru/cgi-bin/protokol.cgi?game=c-83-15 .
The league-branded PDF #114 remains the separate pinned reference for Dynamo
Makhachkala – Spartak; its league issuance has not been authenticated.
Rubin – Zenit and Rodina – Lokomotiv still need sufficiently independent
official witnesses. No arbitrary URLs or new fetches are authorized.

A real source discrepancy was discovered in the existing Akron article
(https://fcakron.ru/news/2534): the headline score is directed 0:2 but
the running goal scores are written in the opposite direction, 1:0, 2:0.
The opposing Fakel article reports the directed progression 0:1, 0:2.
This is a source-content ambiguity, not evidence of technical award.
Do not silently invert the numbers or mark this match admitted. Investigate
the original publisher semantics and obtain independent official evidence.

The [RFS agenda published 23 November](https://www.rfs.ru/news/225644)
names Orenburg–Baltika, Akron–Fakel, CSKA–Akhmat and Dynamo Moscow–Krasnodar
for the 26 November hearing. This is not an issued decision; the other four
are not cleared merely because they are absent. The pure candidate review
retains known pending scope until reviewed issued dispositions exist, even
if the scheduled hearing date passes.

## Technical boundary

`assess_practical_result_claims` checks pinned reference shape, exact A5
directed identity, source-score agreement, full-time event claims and complete
counted goal progression (including explicit empty sequence for 0:0).
It accepts either the existing protocol reference or two opposing-club
report references as **untrusted structural candidates**. It never proves
editorial independence, source provenance, authentic extraction, current
KDK coverage, played-final or settlement. No parser or network/database
worker is introduced. All authorization flags remain false.

Next: independently review actual permitted source usage, protected parsing
and authenticated evidence retention, and issued KDK outcomes. Exact-head
CI, exact-main CI, both whole-repository audits and release gates remain
mandatory. No migration 0017, live writes, metrics, model approval, public
forecasts or sealed 2025/26 access. M4 remains 5/8.
