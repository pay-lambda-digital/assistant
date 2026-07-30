# Legal & Compliance Policies

## Do you have a Privacy Policy?
Yes — the full Privacy Policy is at /privacy. Summary: Lambda Digital collects only what's
needed to operate — merchant account info (business name, email, optional webhook URL),
registered wallet addresses, on-chain transaction data (derived from public blockchain
records), API key hashes (never the plain key) and IPs for rate limiting, and OAuth email/
profile name if you sign in with Google or GitHub. Data is never sold. Session cookies are
used for authentication only — no tracking or advertising cookies. Umami (a
privacy-focused, cookieless analytics service) is used for aggregate site usage stats.

## Do you use cookies?
No tracking or advertising cookies — Lambda Digital uses session cookies only for
authentication (keeping you signed in). For site analytics, Lambda Digital uses Umami, a
privacy-focused analytics service that is cookieless, does not track individuals across
sites, and does not share data with advertising networks. Full details are in the Privacy
Policy at /privacy (section 9, Cookies & Analytics).

## What data does Lambda Digital share, and with whom?
Only with: infrastructure providers (hosting/database, under appropriate agreements),
blockchain RPC providers (Alchemy for Ethereum/BSC, TronGrid for Tron, TonCenter for TON —
wallet addresses are shared with these to monitor for incoming payments), and law
enforcement when legally required or to prevent fraud/financial crime. Data is never sold,
rented, or traded. Transaction records are retained for a minimum of 5 years for compliance
purposes; account data is retained while the account is active. See /privacy for full data
subject rights (access, correction, deletion, portability) — contact admin@xn--wxa.digital
to exercise them.

## Do you have an Anti-Money Laundering (AML) policy?
Yes — the full AML Policy is at /aml. As a non-custodial infrastructure provider, Lambda
Digital never holds, transmits, or controls customer funds, and is not a money services
business or payment processor. The policy prohibits use for money laundering, terrorist
financing, sanctioned-entity transactions (OFAC/UN/EU lists), drug/arms trafficking, fraud,
tax evasion, or human trafficking. Merchants are responsible for their own KYC/AML
compliance in their jurisdiction. Lambda Digital maintains merchant account screening,
transaction monitoring, sanctions screening (reserves the right to block wallet addresses
tied to sanctioned entities), and can suspend accounts pending investigation. Report
suspicious activity to admin@xn--wxa.digital.

## Do you have Terms of Service?
Yes — the full Terms of Service are at /terms. Key points: you must be 18+ and legally able
to enter contracts; the Service is non-custodial (Lambda Digital never holds crypto funds,
lost wallet access can't be recovered by Lambda Digital); merchants are responsible for
securing their own API keys/webhook secrets and for all activity on their account; Tier 1
(Self-custody) is free, Tier 2 (Auto-convert) charges 0.1% per confirmed transaction (fee
changes require 30 days notice); blockchain transactions are irreversible and Lambda
Digital isn't responsible for funds sent to wrong addresses or network-congestion failures;
liability is capped at fees paid in the preceding 12 months; disputes go through binding
arbitration where legally permitted.

## Do you have a Service Level Agreement (SLA)? What uptime do you guarantee?
Yes — the full SLA is at /sla. Target: 99.5% monthly uptime for payment detection (the
watchers) and the REST API, 99.0% for the merchant dashboard. This does not cover
third-party dependencies (blockchain networks, RPC providers) or the merchant's own
infrastructure — those are explicitly excluded. Support response targets: Critical issues
(payments not confirming, API down) get a 4-hour first response and 24-hour resolution
target; High priority (webhooks failing) 8 hours/48 hours; Medium 1 business day/5 business
days; Low 2 business days/no guarantee. Support is via admin@xn--wxa.digital — include
[CRITICAL] in the subject line to escalate.

## How do webhook delivery retries work?
Per the SLA, once a payment confirms on-chain, webhook delivery is retried on this
schedule: immediately, then 30 seconds, 5 minutes, 30 minutes, and 2 hours after the first
attempt (5 attempts total). After 5 failed attempts the webhook is marked failed, but the
underlying payment stays confirmed regardless — delivery failure never affects payment
status. Delivery logs are visible in the merchant dashboard.

## Do you have a Data Processing Agreement (DPA) for GDPR compliance?
Yes — the full DPA is at /dpa, compliant with GDPR Article 28. The merchant is the Data
Controller; Lambda Digital is the Data Processor, processing personal data (blockchain
addresses, transaction metadata, IPs, any merchant-supplied payment metadata like order
IDs) only to detect payments, deliver webhooks, and prevent abuse — never for any other
purpose. Current sub-processors: the cloud infrastructure provider, Alchemy (Ethereum/BSC),
TronGrid (Tron), and TonCenter (TON). Security measures include TLS 1.2+ in transit,
encryption at rest, bcrypt-hashed API keys, and HMAC-SHA256-signed webhook payloads. On
termination, Lambda Digital deletes or returns all personal data unless law requires
retention. Contact admin@xn--wxa.digital for DPA/data-protection questions.