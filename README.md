# FootballForecast

**Football forecasting built around measurable probabilities, not confident guesses.**

FootballForecast is a browser-first football analytics project focused initially on the **Russian Premier League (RPL)**, with **FC Zenit Saint Petersburg** as the first team of interest. Its goal is to collect traceable match data, produce time-safe probabilistic forecasts, and measure how well those probabilities actually perform.

> **Status: early development (M0).** The repository contains an initial web application, a Python statistical core and database definitions. There is **no validated live forecasting service or published accuracy claim yet**.

## Why this project?

Correctly predicting a winner is not the same as producing a good forecast. FootballForecast is designed to answer more useful questions:

- Are the predicted **home win / draw / away win** probabilities calibrated?
- Do statistical or machine-learning models consistently beat simple baselines on unseen matches?
- How much can we trust a prediction when the underlying data is missing or stale?
- Can any historical result be reproduced without accidentally using information from the future?

## What's in the repository

| Component | Current scope |
| --- | --- |
| **Web app** | Next.js, React, TypeScript; Russian-language dashboard and analytics navigation with honest empty states |
| **Python core** | Data/provenance contracts, Poisson probability utilities and forecast scoring |
| **Database** | PostgreSQL migration draft with row-level security and append-only forecast history |
| **Automation** | GitHub Actions definitions for code checks and security scanning |
| **Research** | Source licensing, temporal integrity, calibration and backtesting methodology |

**Planned, not delivered:** automatic RPL data ingestion, trained Dixon-Coles / Elo / CatBoost models, walk-forward evaluations, live match forecasts, scheduled reports and a deployed private web app. Development is organized in [ROADMAP.md](ROADMAP.md).

## Approach

**Traceable data** · **No look-ahead bias** · **Proper scoring rules** · **Calibrated probabilities** · **Reproducible experiments** · **No fictitious results**

The model will be evaluated using multiclass log loss, Brier score, ranked probability score and calibration diagnostics. Predictions will retain model/data versions and their original publication timestamps. Odds, if available, are comparison data, **not** a guarantee of betting profitability. This project does not place bets.

## Technology

Next.js 16 · React 19 · TypeScript · Python 3.11+ · PostgreSQL / Supabase · GitHub Actions · Vercel (planned)

The web interface is intended for private, authenticated use, even though the source repository is public.

## Local development

```bash
npm ci
npm run dev

python -m pip install -e 'ml[test]'
python -m pytest ml/tests -q
```

Authentication is deny-by-default until Supabase and the owner's GitHub identity have been configured. See [deployment setup](docs/DEPLOYMENT.md). Do not commit local credentials, private match datasets, or provider-restricted data.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Data sources](docs/DATA_SOURCES.md) · [Methodology](docs/MODEL_METHODOLOGY.md) · [Temporal integrity](docs/TEMPORAL_INTEGRITY.md) · [Backtesting](docs/BACKTESTING.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md) · [Security](SECURITY.md)

## Contributing and reuse

Issues and constructive feedback are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). The repository does **not yet** provide a software license; publishing source code does not, by itself, grant reuse or redistribution rights.
