"""Offline RPL 2025/26 score-matrix crosscheck, never a training-data importer.

Sources: Footbolno CC BY 4.0 and a revision-pinned English Wikipedia
article under CC BY-SA 4.0. Both contain upstream rights uncertainty.
No HTTP in this module, raw rows/club IDs in reports, or implicit licensing.
"""
from collections import Counter
import csv
import hashlib
from html.parser import HTMLParser
from io import StringIO
import json
from pathlib import Path
import re
import sys
import unicodedata

SEASON = "2025/2026"
REVISION = 1359156694
WIKI_URL = "https://en.wikipedia.org/w/rest.php/v1/revision/1359156694/html"
WIKI_LICENSE = "https://creativecommons.org/licenses/by-sa/4.0/"
PUBLISHER_LICENSE = "https://footbolno.ru/otkrytye-dannye"


def norm(s):
    if not isinstance(s, str):
        raise ValueError("invalid club name type")
    text = unicodedata.normalize("NFKC", s).lower().replace("ё", "е")
    text = " ".join(re.findall(r"[^\W_]+", text, re.UNICODE))
    return re.sub(r"^(?:fc|fk|фк) ", "", text)


# Bilingual predeclared semantic aliases. No outcomes/results are used to
# infer mappings. "Динамо" alone is deliberately NOT accepted: two teams.
CLUBS = {
    "AKH": ("Akhmat Grozny", "Ахмат", "Ахмат Грозный", "Akhmat"),
    "AKR": ("Akron Tolyatti", "Акрон", "Акрон Тольятти", "Akron Togliatti"),
    "BAL": ("Baltika Kaliningrad", "Балтика", "Балтика Калининград", "Baltika"),
    "CSK": ("CSKA Moscow", "ЦСКА", "ЦСКА Москва", "CSKA Moskva"),
    "DMA": ("Dynamo Makhachkala", "Динамо Махачкала", "Динамо Мх", "Dinamo Makhachkala"),
    "DMO": ("Dynamo Moscow", "Динамо Москва", "Динамо Мск", "Dinamo Moskva"),
    "KRA": ("Krasnodar", "Краснодар", "FK Krasnodar"),
    "KRY": ("Krylia Sovetov Samara", "Крылья Советов", "Крылья Советов Самара", "Krylya Sovetov"),
    "LOK": ("Lokomotiv Moscow", "Локомотив", "Локомотив Москва", "Lokomotiv Moskva"),
    "ORE": ("Orenburg", "Оренбург", "FK Orenburg"),
    "PNN": ("Pari Nizhny Novgorod", "Пари НН", "Пари Нижний Новгород", "Нижний Новгород", "Nizhny Novgorod"),
    "ROS": ("Rostov", "Ростов", "ФК Ростов", "FK Rostov"),
    "RUB": ("Rubin Kazan", "Рубин", "Рубин Казань", "Rubin"),
    "SOC": ("Sochi", "Сочи", "ФК Сочи", "FK Sochi"),
    "SPA": ("Spartak Moscow", "Спартак", "Спартак Москва", "Spartak Moskva"),
    "ZEN": ("Zenit Saint Petersburg", "Зенит", "Зенит Санкт-Петербург", "Zenit St Petersburg"),
}
ALIASES = {}
for club, spellings in CLUBS.items():
    for name in spellings:
        key = norm(name)
        if key in ALIASES and ALIASES[key] != club:
            raise RuntimeError("bilingual club alias collision")
        ALIASES[key] = club


class TableReader(HTMLParser):
    """A bounded table reader. Ignore nested tables and footnote superscripts."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.depth = 0
        self.table = None
        self.row = None
        self.cell = None
        self.skip_sup = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.depth += 1
            if self.depth == 1:
                self.table = []
            return
        if self.depth != 1:
            return
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag == "sup" and self.cell is not None:
            self.skip_sup += 1

    def handle_data(self, data):
        if self.depth == 1 and self.cell is not None and not self.skip_sup:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag == "table":
            if self.depth == 1 and self.table is not None:
                self.tables.append(self.table)
                self.table = None
            self.depth = max(0, self.depth-1)
            return
        if self.depth != 1:
            return
        if tag == "sup" and self.skip_sup:
            self.skip_sup -= 1
        elif tag in ("th", "td") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.table.append(self.row)
            self.row = None


def wikipedia_scores(html):
    if not isinstance(html, str) or len(html) > 2_000_000:
        raise ValueError("Wikimedia HTML budget exceeded")
    if "Russian Premier League" not in html:
        raise ValueError("not the expected encyclopedia page")
    parser = TableReader()
    parser.feed(html)
    expected = set(CLUBS)
    candidates = []
    for table in parser.tables:
        if len(table) != 17 or len(table[0]) != 17:
            continue
        if not re.search(r"home\s*[/\\]\s*away", table[0][0], re.I):
            continue
        labels = [x.strip() for x in table[0][1:]]
        if len(set(labels)) != 16 or set(labels) != expected:
            continue
        candidates.append(table)
    if len(candidates) != 1:
        raise ValueError("not exactly one validated complete results matrix")
    table = candidates[0]
    labels = table[0][1:]
    parsed = {}
    home_rows = set()
    for row in table[1:]:
        if len(row) != 17:
            raise ValueError("wiki matrix width is not 17")
        home = ALIASES.get(norm(row[0]))
        if not home or home in home_rows:
            raise ValueError("unrecognized or duplicate wiki home identity")
        home_rows.add(home)
        for away, score in zip(labels, row[1:]):
            if away == home:
                if score not in ("—", "–", "-", "−"):
                    raise ValueError("non-empty wiki matrix diagonal")
                continue
            m = re.fullmatch(r"(\d{1,2})\s*[-–−]\s*(\d{1,2})", score)
            if not m or int(m[1]) > 20 or int(m[2]) > 20:
                raise ValueError("missing/invalid wiki match score")
            key = (home, away)
            if key in parsed:
                raise ValueError("duplicated wiki directed fixture")
            parsed[key] = (int(m[1]), int(m[2]))
    if home_rows != expected or len(parsed) != 240:
        raise ValueError("incomplete wiki result matrix")
    return parsed


def publisher_scores(csv_text):
    if not isinstance(csv_text, str) or len(csv_text) > 2_000_000:
        raise ValueError("Footbolno CSV budget exceeded")
    rows = csv.DictReader(StringIO(csv_text))
    required = {"match_id", "league_id", "season", "status",
                "home_id", "away_id", "home", "away", "home_goals", "away_goals"}
    if not rows.fieldnames or not required <= set(rows.fieldnames) or len(rows.fieldnames) > 48:
        raise ValueError("publisher fields missing or unexpected")
    pairs = {}
    ids = set()
    observed = set()
    for index, row in enumerate(rows):
        if index >= 5000 or None in row:
            raise ValueError("CSV row budget or field width exceeded")
        if row["league_id"].strip() != "235" or row["season"].strip() != SEASON:
            continue
        if row["status"].strip() != "finished" or not row["match_id"].strip():
            raise ValueError("incomplete publisher season")
        home = ALIASES.get(norm(row["home"]))
        away = ALIASES.get(norm(row["away"]))
        if not home or not away or home == away:
            raise ValueError("unmapped publisher identity")
        key = (home, away)
        if key in pairs or row["match_id"] in ids:
            raise ValueError("duplicate source fixture or match ID")
        scores = [row["home_goals"].strip(), row["away_goals"].strip()]
        if not all(re.fullmatch(r"\d{1,2}", x) and int(x) <= 20 for x in scores):
            raise ValueError("invalid publisher result")
        ids.add(row["match_id"])
        observed.update((home, away))
        pairs[key] = (int(scores[0]), int(scores[1]))
    if len(pairs) != 240 or observed != set(CLUBS):
        raise ValueError("publisher does not contain full season")
    return pairs


def compare(csv_text, wiki_html):
    pub = publisher_scores(csv_text)
    ref = wikipedia_scores(wiki_html)
    missing_pub = set(ref) - set(pub)
    missing_wiki = set(pub) - set(ref)
    mismatched = [key for key in pub.keys() & ref.keys() if pub[key] != ref[key]]
    home_differ = sum(pub[key][0] != ref[key][0] for key in mismatched)
    away_differ = sum(pub[key][1] != ref[key][1] for key in mismatched)
    return {
        "schemaVersion": 1,
        "kind": "M0_CC_BY_CC_BY_SA_2025_HOLDOUT_SOURCE_RESEARCH",
        "season": SEASON,
        "wikiRevisionId": REVISION,
        "sources": [
            {"name":"Footbolno","licenseClaim":"CC BY 4.0","attribution":PUBLISHER_LICENSE},
            {"name":"English Wikipedia","licenseClaim":"CC BY-SA 4.0",
             "attribution": "https://en.wikipedia.org/wiki/2025%E2%80%9326_Russian_Premier_League"}
        ],
        "publisherFixtures": len(pub), "wikipediaFixtures": len(ref),
        "matchedDirectedFixtures": len(set(pub) & set(ref)),
        "missingFromPublisher": len(missing_pub), "missingFromWikipedia": len(missing_wiki),
        "differentScoreFixtures": len(mismatched),
        "homeScoreMismatches": home_differ, "awayScoreMismatches": away_differ,
        "recordScoreAgreement": not (missing_pub or missing_wiki or mismatched),
        "wikiMatrixHasNoKickoffDates": True,
        "officialProtocolTruthVerified": False,
        "independentOriginalDataProvenanceVerified": False,
        "historicPrematchAvailabilityVerified": False,
        "holdoutLabelDataUsedForTrainingOrCalibration": False,
        "productionIngestionApproved": False,
        "rawSourceRowsPersisted": False,
    }


def main():
    if len(sys.argv) != 3:
        raise ValueError("expected disposable publisher CSV and Wikimedia HTML")
    csv_bytes = Path(sys.argv[1]).read_bytes()
    html_bytes = Path(sys.argv[2]).read_bytes()
    if not 0 < len(csv_bytes) <= 2_000_000 or not 0 < len(html_bytes) <= 2_000_000:
        raise ValueError("source bytes exceed budget")
    out = compare(csv_bytes.decode("utf-8-sig"), html_bytes.decode("utf-8"))
    out["footbolnoSourceSHA256"] = hashlib.sha256(csv_bytes).hexdigest()
    out["wikipediaRevisionHtmlSHA256"] = hashlib.sha256(html_bytes).hexdigest()
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Exception payload from untrusted source data is intentionally not printed.
        print("FAIL: 2025/26 Wikimedia/Footbolno crosscheck refused, no raw rows emitted", file=sys.stderr)
        sys.exit(2)
