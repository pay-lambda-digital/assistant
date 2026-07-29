# Subscription Billing

A planned option available to merchants on the Auto-convert plan (not available yet) —
merchants will be able to set up recurring subscriptions for their own customers, on top
of accepting regular one-off payments.

- The merchant defines a subscription for a customer.
- When a payment comes due, Lambda Digital emails the subscribed customer with a link to
  pay, and the customer has 10 days to pay.
- The Auto-convert plan's standard 0.1% fee applies to every payment on that plan, whether
  it's a one-off payment or a subscription charge — subscriptions aren't a separately
  priced feature, just an option for how a Tier 2 merchant collects payments.
- Each subscription charge is idempotent, same as any other payment on the platform — a
  customer can't be charged twice for the same subscription payment.
