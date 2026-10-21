# SportScore: запрос условий бесплатного API и использования данных РПЛ (M0)

**21.10.2026: подготовлен черновик, НЕ ОТПРАВЛЕН.** Адрес разработчиков указан в условиях API: **api@sportscore.com**. Отправку, хранение ответа и согласование условий выполняет владелец проекта. Письмо не является лицензией.

Основания для обращения:

- [Специальные условия API (23.04.2026)](https://sportscore.com/developers/terms/): §1 разрешает бесплатный доступ hobby/open-source и early-stage commercial при атрибуции; §2 требует видимую индексируемую ссылку «Powered by SportScore»; §3 ограничивает примерно 10 000 запросов/сутки/IP; §5 допускает кэширование, производные dashboards/analytics и монетизацию, но запрещает bulk redistribution.
- [Общие условия сайта (12.04.2026)](https://sportscore.com/terms/): §2.2 запрещает commercial site use, §2.8–2.10 ограничивают использование контента, систематический сбор базы и автоматизированные запросы.
- Не следует автоматически считать более поздние условия API отменяющими общие. Нужно письменное подтверждение применимых прав и прав на исходные данные.

## Готовое письмо владельцу API

**Кому:** api@sportscore.com

**Тема:** SportScore free API: clarification of RPL coverage, ML use and API-vs-site terms

Hello SportScore API team,

I am developing FootballForecast (https://github.com/StanleyLl0yd/FootballForecast), a public, free-access football forecasting and analytics website. We require exclusively $0 data sources, and we are happy to display a prominent, crawlable “Powered by SportScore” dofollow attribution link on every screen using your data, if we are authorized to integrate the API.

I have reviewed your API Terms of Use (updated April 23, 2026) and general Site Terms of Use (updated April 12, 2026). The API-specific terms expressly allow caching, derived dashboards/analytics, and monetized applications with attribution, but general Site Terms sections 2.2 and 2.8–2.10 prohibit commercial use, database extraction and certain automated access.

Could you please clarify the following for the **public `/api/widget/` JSON endpoints**?

1. Do the **April 23 API terms govern these API requests and permitted derivative uses**, even where the general Site Terms appear stricter? Is an attributed publicly accessible analytics website, potentially supported by modest advertising in future, eligible for the genuinely free tier?
2. Is there exact **Russian Premier League** (not other Russian leagues) coverage for **2024/25** completed results, **2025/26** completed results and **2026/27** updated results/upcoming fixtures? Which free endpoints provide these, and how deep can an anonymous user paginate without moving to a paid plan?
3. Does the free attributed API tier authorize **storing structured results/fixtures in a private database**, keeping older versions for audit and encrypted offsite backups, and **training a statistical Poisson-type model** on the completed results? We will not mirror your API as a public raw-data service.
4. Are we allowed to publicly display **derived home/draw/away probabilities and score forecasts** based partly on that historical data (with source attribution), and to publish a methodology/accuracy summary?
5. Do you have the necessary rights from your original match-data providers to grant the above acquisition, storage, machine-learning and derived-publication uses? If any upstream rights are not sublicensable, which competitions, fields or uses are excluded?
6. Can your API provide immutable match IDs, UTC kickoff times, played/awarded/postponed status, revision or correction timestamps, and documentation of when a given historical score/fixture was first observed? An updated live match record alone cannot prove historical pre-kickoff availability.
7. Is the free tier genuinely available with **no payment method**, no overage charges or automatic paid upgrade? We intend to make a very small number of requests, obey cache-control/Retry-After, and stop immediately if quota or license constraints prevent access.

We do not intend to use any paid tier or remove the attribution badge. If you cannot authorize all three seasons and the requested ML usage, a narrower confirmed subset and any precise restrictions would also help.

Thank you for clarifying the rights and available scope.

FootballForecast
https://github.com/StanleyLl0yd/FootballForecast

## Приёмка письменного ответа (внутренняя)

- Хранить текст письма и ответ приватно. В публичном GitHub допустимы только дата, точная версия условий, квалифицированное разрешение/отказ и обезличенный статус; не публиковать личные данные переписки.
- Разделять письменное подтверждение **приоритета специальных условий API** и прав на **третьесторонние исходные данные**; это разные вопросы. Если один из них не решён, соответствующее разрешение остаётся `false`.
- Отдельно проверить доступность именно **2024/25, 2025/26, 2026/27 РПЛ** в бесплатном слое, лимиты, поля, корректировки и футбольную точность на оригинальных протоколах. Другие турниры, «free forever» и заявленные 10 000 запросов не доказывают RPL coverage.
- Любой архив исторических результатов 2026 года не является самостоятельным доказательством исторической pre-match доступности.
- После подтверждения всех соответствующих прав и реальной точности потребуется отдельный PR с проверками безопасности, provenance, quota и постоянной атрибуции. До этого `active=false`, `authorizedAutomatedTraining=false`, M0 и #2 OPEN.
