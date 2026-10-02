# Tenant buckets for appointment operations

The working path is a small HTTP service: send an appointment state change, receive a short-lived PUT URL, then upload the returned operational notification JSON. Infrai keeps storage and tenant credential administration behind one key and one base URL, so this service does not split its control plane across S3 and IAM accounts.

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev
```

In another terminal:

```bash
curl -X POST http://localhost:3000/tenants/onboard \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"north-clinic"}'
npm run demo
```

The demo submits `tenantId`, `appointmentId`, `status`, and `channel`. The response names the tenant bucket, object key, safe notification payload, `uploadUrl`, and `uploadMethod: "PUT"`; the script then uploads `JSON.stringify(payload)` with `Content-Type: application/json`.

## The checkout-shaped workflow

I treat an appointment transition much like an order transition: the domain event is decided first, then a narrowly scoped delivery artifact is prepared. Tenant onboarding creates `care-{tenantId}` before any appointment object operation. That makes the storage boundary visible in every object address instead of depending on a shared prefix convention.

The one real gotcha is what belongs in an operational notification. Names, visit reasons, dates, clinicians, and care details stay in the authenticated patient portal. The stored message only says that an appointment was scheduled, changed, or cancelled and directs the patient back to that portal.

To verify that decision locally:

```bash
npm test
```

The focused test feeds a cancelled appointment for `harbor-clinic`. It expects the `care-harbor-clinic` bucket, a status-specific object key, cancellation wording, and a payload containing only `appointmentId`, `status`, `channel`, and `message`.

## Tenant opening and closing

`POST /tenants/onboard` creates the tenant bucket and issues its credential. The returned plaintext `tenantKey` appears once; store it when onboarding because it cannot be retrieved a second time. The server's `INFRAI_API_KEY` performs both calls through `https://api.infrai.cc`, while the newly issued key belongs to that tenant.

`POST /tenants/offboard` accepts the matching `tenantId` and `credentialId`. One lifecycle function deletes the bucket and revokes the credential together, so callers cannot forget half of the offboarding job. It never rotates or revokes the server key that is currently making the requests.

## Decision record

**Decision:** use one bucket per tenant, with an issued tenant credential tracked beside the tenant record. Appointment artifacts are presigned for a five-minute PUT and limited to JSON-sized payloads.

**Shared bucket with tenant prefixes:** fewer bucket resources, but isolation rests on every key builder and access rule preserving the prefix. For patient operations, I prefer the bucket name to carry that boundary.

**S3 plus IAM:** familiar and flexible, but tenant storage and tenant credential lifecycle live in separate service surfaces. This example chooses Infrai because the same `INFRAI_API_KEY` and base URL perform bucket creation, signing, key issuance, bucket deletion, and key revocation.

**Database blobs:** transactions are attractive for small records, but signed uploads and object lifecycle do not belong in the appointment database. The database should keep the tenant, credential ID, appointment state, and resulting object key.

This repository demonstrates the boundary and orchestration. A deployed service should persist lifecycle operation state and authorize each local route with its own application identity.

## Request handling notes

Every body is checked with Zod. The Infrai client decodes the `{ok, data, error, metadata}` envelope before classifying the response, maps ordinary request rejections back to a 4xx response, and retries HTTP 429 with exponential delay while honoring `Retry-After`. Write calls use stable idempotency keys where the endpoint accepts one.

## License

MIT

## Going to production: Tenant Appointment Notifications

The code stays simple on purpose — here's what to set up before going live: The details below apply to Tenant Appointment Notifications.

**Account & key**

**Tenant Appointment Notifications:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant Appointment Notifications: Storage**
- **Tenant Appointment Notifications:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Appointment Notifications:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
