# Backtesting protocol (design)

Initial candidates from user specification: training 2015/16–2022/23, validation 2023/24–2024/25, independent test 2025/26 and prospective forecasts 2026/27. This must be revised only after legal and historical coverage is confirmed.

For every as-of cutoff T, reconstruct source information demonstrably available at T; learn preprocessing exclusively on pre-T data. Track separate train, validation, calibration and test identifiers. Preserve predictions with code SHA, dataset snapshot hash, cutoff, predicted timestamp, and model hash. Do not select architectures or calibrators using independent final test observations. Repeated investigation of test performance invalidates its claim of independence.

Archived data downloaded in 2026 is not by itself evidence of historical publication time for 2018 lineups/xG. No random match shuffle for primary evaluation. Pre-register baseline, minimum sample sizes, paired confidence intervals and reproducibility tolerance before running experiments.
