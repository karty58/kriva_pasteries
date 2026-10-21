# Payments: Google Pay & UPI via Razorpay

## Why Razorpay (and not a standalone Google Pay button)

Google Pay for Business in India accepts payments via UPI. Its web integration ([Google Pay India web docs](https://developers.google.com/pay/india/api/web/intro)) is limited to Chrome on Android, requires the business to be an NPCI/bank-verified UPI merchant, and requires the merchant's own bank APIs to check payment status. A Google Pay–branded button alone cannot accept money.

A payment gateway such as **Razorpay** gives KRIVA:
- UPI payments that customers can complete in **Google Pay, PhonePe, Paytm, BHIM or any UPI app** (UPI intent on mobile, QR code on desktop) — subject to what Razorpay enables on KRIVA's account;
- server-side order creation, signed callbacks, signed webhooks and a payments API used to verify every payment;
- refunds and settlement to KRIVA's bank account.

The integration follows Razorpay Standard Checkout: [build integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/) and [webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

> **Before going live, confirm with Razorpay:** merchant eligibility for a bakery/food business, KYC requirements, the current transaction fees (MDR) for UPI, settlement timelines, and that UPI is enabled on the account. These change and are not assumed here. Note that per Razorpay's documentation, NPCI deprecated the **UPI Collect** flow (entering a UPI ID) from 28 Feb 2026 for most merchants; **UPI Intent** and **UPI QR** remain the standard flows.

Customers will **not** see Google Pay on every device. On desktop they typically scan a UPI QR with their phone; on mobile, the UPI apps installed on that phone are offered. The checkout and order page say this, and every order can also be placed with "Arrange payment with KRIVA" or on WhatsApp if the owner keeps those enabled.

## How the flow works

```
Customer                    KRIVA server                          Razorpay
--------                    ------------                          --------
Place order  ───────────▶   /api/checkout: re-price from DB,
                            create order (pending/pending)
Pay now      ───────────▶   /api/payments/start: check order may
                            be paid, amount from DB  ───────────▶ POST /v1/orders (amount in paise)
             ◀───────────   key_id + order_id (no secrets)
Razorpay Checkout window (Google Pay / UPI) ─────────────────────▶ customer approves in UPI app
handler(payment_id, order_id, signature)
             ───────────▶   /api/payments/verify:
                            1. HMAC_SHA256(our order_id|payment_id, key_secret) == signature
                            2. GET /v1/payments/{id}  ───────────▶ authoritative status/amount
                            3. order matches, amount & INR match, status captured
                            4. mark paid (once; duplicates flagged)
                                         ◀──────────────────────── webhook (signed, retried)
                            /api/payments/razorpay/webhook:
                            verify X-Razorpay-Signature over raw body,
                            de-duplicate by x-razorpay-event-id,
                            re-fetch payment, apply same rules
```

What never marks an order paid: reaching a "success" page, a client-side callback by itself, a screenshot, or a customer saying they paid. KRIVA's application never sees UPI PINs, OTPs or card details — they are entered only in Razorpay/the UPI app.

**Payment capture:** in Razorpay Dashboard → *Account & Settings → Payment capture*, set **automatic capture**. The app marks orders paid only on `captured` payments.

**Approval workflow:** in */admin/settings → Payments* choose:
- *Immediately at checkout* — customers pay right after placing the order (products ticked "I confirm before the customer pays", such as custom cakes, still wait for approval), or
- *Only after I confirm each order* — customers pay from their order link after the owner confirms.

**Delayed confirmations:** UPI payments are sometimes confirmed minutes later. The webhook handles this automatically; the customer's "Check payment status" button and the owner's "Refresh from Razorpay" button query Razorpay directly.

**Duplicates:** if a customer somehow pays twice, the first captured payment settles the order and later ones are flagged on the order page for refund.

**Refunds:** owners can refund a paid online order from the order page (type REFUND to confirm). The order changes to *Refunded* only after Razorpay confirms the refund (webhook or refresh).

## Test mode (do this first)

1. Create a Razorpay account at https://razorpay.com and stay in **Test Mode** (toggle in the dashboard).
2. *Account & Settings → API Keys → Generate Test Key*. Put the values in `.env.local`:
   ```
   PAYMENTS_MODE=test
   RAZORPAY_KEY_ID=rzp_test_…
   RAZORPAY_KEY_SECRET=…
   ```
3. *Account & Settings → Webhooks → Add New Webhook* (test mode):
   - URL: `https://<your-domain-or-tunnel>/api/payments/razorpay/webhook`
   - Secret: a long random string → `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`
4. In */admin/settings*, enable "Accept Google Pay / UPI online". The Payments panel confirms the keys were found and the mode.
5. Place orders and use Razorpay's test UPI options to simulate success and failure. Check that the order page and dashboard show the right status, and that a webhook delivery appears in Razorpay's webhook logs with a 200 response.

The app refuses to run if the key prefix doesn't match `PAYMENTS_MODE` (e.g. live key in test mode).

## Going live — checklist

- [ ] Razorpay KYC complete and **live mode activated** for KRIVA's business and bank account
- [ ] UPI confirmed enabled on the live account; fees and settlement terms reviewed
- [ ] Website policies (privacy, terms, cancellation/refund) completed — Razorpay reviews these
- [ ] Domain added/approved in Razorpay if requested
- [ ] Live API keys generated; `PAYMENTS_MODE=live`, `RAZORPAY_KEY_ID=rzp_live_…`, `RAZORPAY_KEY_SECRET` set **in the hosting provider only**
- [ ] **Live** webhook created (live and test webhooks are separate) with a new secret → `RAZORPAY_WEBHOOK_SECRET`
- [ ] Automatic capture enabled
- [ ] Redeploy, then make one small real payment end to end; confirm it shows *Paid* in the dashboard and the webhook log shows 200; refund it from the dashboard and confirm *Refunded*
- [ ] Only then announce online payments

## Payment links for WhatsApp customers

For orders taken on WhatsApp, the owner can create a **Razorpay Payment Link** from the Razorpay Dashboard and share it in the chat. Payments made through links are tracked in Razorpay, not automatically matched to website orders. Record them on a website order only if that order uses "Arrange payment with KRIVA".
