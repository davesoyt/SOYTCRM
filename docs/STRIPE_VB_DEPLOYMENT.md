# Stripe webhooks

**Recommended:** configure integrations in the app at **Setup → Webhooks** (field mapping UI, per-integration URL).

Legacy env-only VB sync (`STRIPE_VB_OBJECT_SLUG`) is superseded by webhook integrations stored in the database.

## Quick start (Setup UI)

1. Open **Setup → Webhooks** → **New webhook**
2. Set **Target object** (e.g. Venue Billing / `vb`)
3. Set **Upsert / match field** (e.g. `trx_id`)
4. Click **Load Venue Billing preset** or add field mappings manually
5. Check **Stripe events** to receive
6. Paste **Signing secret** from Stripe (`whsec_…`)
7. Copy the **Stripe endpoint URL** into [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
8. **Save**

Endpoint format: `https://YOUR_DOMAIN/api/webhooks/stripe/{integrationId}`

---

## Legacy / env reference


| VB field         | Stripe source                                      |
|------------------|----------------------------------------------------|
| `business_name`  | metadata `business_name` / `venue_name`, description, receipt email, or customer name |
| `date`           | Event created date (YYYY-MM-DD)                    |
| `source`         | `stripe`                                           |
| `amount`         | Amount in major units + currency (e.g. `49.00 USD`) |
| `trx_id`         | Payment Intent id, Charge id, or Invoice id        |
| `notes`          | Event id, type, customer id, status                |

## Supported webhook events

- `payment_intent.succeeded`
- `charge.succeeded` (uses linked Payment Intent id when present)
- `invoice.paid` / `invoice.payment_succeeded`

Duplicate Stripe events are ignored via the `ProcessedStripeEvent` table.

## Environment variables

Copy `.env.example` to `.env.local` (local) or set in your host (production):

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_VB_OBJECT_SLUG=vb          # optional
STRIPE_SYNC_SECRET=...            # optional, for backfill endpoint
```

## Local development

1. Install dependencies: `npm install`
2. Apply migrations: `npx prisma migrate deploy`
3. Add keys to `.env.local` (use Stripe **test** mode keys).
4. Start the app: `npm run dev`
5. Forward webhooks (Stripe CLI):

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

6. Trigger a test payment:

   ```bash
   stripe trigger payment_intent.succeeded
   ```

7. Open **Objects → Venue Billing** and confirm a new row with `trx_id` and `source: stripe`.

### Optional backfill (local)

```bash
curl -X POST "http://localhost:3000/api/stripe/sync?limit=50" \
  -H "Authorization: Bearer YOUR_STRIPE_SYNC_SECRET"
```

## Production deployment

### 1. Deploy the application

Deploy this Next.js app as you normally would (Vercel, Railway, Docker, etc.). Ensure:

- `dev.db` is **not** used in production — configure a persistent database URL if you migrate off SQLite.
- All env vars above are set in the hosting dashboard.
- Build runs `prisma generate` (already in `npm run build`).

Run migrations on deploy:

```bash
npx prisma migrate deploy
```

### 2. Create the Stripe webhook endpoint

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL**: `https://YOUR_DOMAIN/api/webhooks/stripe`
3. **Events to send** (minimum):
   - `payment_intent.succeeded`
   - `charge.succeeded`
   - `invoice.paid`
4. After creating, open the endpoint → **Signing secret** → copy `whsec_...` to `STRIPE_WEBHOOK_SECRET` in production env.
5. Redeploy or restart the app so the new secret is loaded.

### 3. Use live vs test keys

| Environment | `STRIPE_SECRET_KEY` | Webhook endpoint        |
|-------------|---------------------|-------------------------|
| Staging     | `sk_test_...`       | Test mode webhook URL   |
| Production  | `sk_live_...`       | Live mode webhook URL   |

Use separate webhook endpoints and secrets for test and live.

### 4. Stripe metadata (recommended)

On Payment Intents or Charges, set metadata so `business_name` is meaningful:

```json
{
  "business_name": "Acme Venue LLC",
  "venue_name": "Acme Hall"
}
```

You can set this in Checkout, Payment Links, or your server when creating PaymentIntents.

### 5. Verify in production

1. Send a real or test payment through your live Stripe flow.
2. In Stripe → Webhooks → your endpoint → **Recent deliveries**, confirm `200` responses.
3. In the CRM, open **Venue Billing** and confirm the record.

### 6. Backfill historical payments (once)

```bash
curl -X POST "https://YOUR_DOMAIN/api/stripe/sync?limit=100" \
  -H "Authorization: Bearer YOUR_STRIPE_SYNC_SECRET"
```

Increase `limit` (max 500) or run multiple times with Stripe pagination added later if needed.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `400 Invalid signature` | Wrong `STRIPE_WEBHOOK_SECRET` or body parsed as JSON before verify — this route uses raw body correctly. |
| `500 Venue Billing object not found` | Ensure custom object slug is `vb` or set `STRIPE_VB_OBJECT_SLUG`. |
| Duplicate rows | Same payment may fire both `payment_intent.succeeded` and `charge.succeeded`; upsert keys on `trx_id` (Payment Intent id when available). |
| Empty `business_name` | Add Stripe metadata `business_name` or `venue_name`. |

## API reference

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/webhooks/stripe` | Stripe signature header |
| `POST` | `/api/stripe/sync?limit=N` | `Authorization: Bearer STRIPE_SYNC_SECRET` |
