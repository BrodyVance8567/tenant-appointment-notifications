import { randomUUID } from "node:crypto";
import { infrai } from "./infrai.js";
import { tenantBucket } from "./appointment_notifications.js";

export async function onboardTenant(tenantId: string) {
  const bucket = tenantBucket(tenantId);
  await infrai.storage.bucket.create({ name: bucket });
  const credential = await infrai.account.keys.create({
    name: `tenant-${tenantId}`,
    idempotency_key: `onboard-${tenantId}`,
  });
  return { bucket, credentialId: credential.id, tenantKey: credential.key };
}

export async function offboardTenant(tenantId: string, credentialId: string) {
  const operationId = randomUUID();
  await Promise.all([
    infrai.storage.bucket.delete(tenantBucket(tenantId)),
    infrai.account.keys.revoke(credentialId),
  ]);
  return { operationId, bucketDeleted: true, credentialRevoked: true };
}
