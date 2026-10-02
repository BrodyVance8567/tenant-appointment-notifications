import assert from "node:assert/strict";
import test from "node:test";
import { appointmentEventSchema, buildOperationalNotification } from "../src/appointment_notifications.js";

test("cancelled appointments produce tenant-isolated, patient-safe notifications", () => {
  const event = appointmentEventSchema.parse({
    tenantId: "harbor-clinic",
    appointmentId: "8b34e376-a131-4ee7-980d-d1f96b5e884e",
    status: "cancelled",
    channel: "email",
  });
  const result = buildOperationalNotification(event);

  assert.equal(result.bucket, "care-harbor-clinic");
  assert.equal(result.objectKey, "appointment-events/8b34e376-a131-4ee7-980d-d1f96b5e884e/cancelled.json");
  assert.equal(result.payload.message, "Your appointment was cancelled. Open the patient portal if you need to arrange another time.");
  assert.deepEqual(Object.keys(result.payload).sort(), ["appointmentId", "channel", "message", "status"]);
});
