#!/usr/bin/env python3
"""Download ONLY two historical RSSSF season pages and print public-safe audit."""
import json
from dataclasses import asdict
from urllib.request import Request, urlopen

from football_forecast.data.contracts import DataError

from football_forecast.research.m3_rsssf_match_schedule import audit_rsssf_rpl

SOURCE_URLS = (
    ("2021/22", "https://www.rsssf.org/tablesr/rus2022.html"),
    ("2022/23", "https://www.rsssf.org/tablesr/rus2023.html"),
)


def main() -> None:
    audits=[]
    for season,url in SOURCE_URLS:
        request=Request(url,headers={"User-Agent":"FootballForecast-research/1.0"})
        with urlopen(request,timeout=25) as response:
            if response.geturl()!=url or response.status!=200:
                raise ValueError("unexpected RSSSF source redirect or response")
            data=response.read(3_000_001)
        if len(data)>3_000_000:
            raise ValueError("oversized source")
        audits.append(asdict(audit_rsssf_rpl(data,season)))
    if sum(x["fixtures"] for x in audits)!=480:
        raise ValueError("incomplete two-season sample")
    print(json.dumps({
        "kind":"M3_2021_22_2022_23_PUBLIC_RSSSF_FIXTURE_AUDIT",
        "holdout2025_26Fetched":False,
        "privateDataFetched":False,
        "sourcePages":audits,
    },sort_keys=True,separators=(",",":")))


if __name__=="__main__":
    try:
        main()
    except DataError as exc:
        # This parser generates only static, non-sensitive error categories.
        raise SystemExit(f"FAIL: public-only source parser: {exc}") from None
    except Exception as exc:
        raise SystemExit(f"FAIL: public-only source retrieval: {type(exc).__name__}") from None
