import { randomUUID } from "node:crypto";

const response = await fetch("http://localhost:3000/appointments/notification-upload", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tenantId: "north-clinic",
    appointmentId: randomUUID(),
    status: "rescheduled",
    channel: "sms",
  }),
});

const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
const upload = await fetch(result.uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(result.payload),
});
if (!upload.ok) throw new Error(`Upload returned ${upload.status}`);
console.log({ bucket: result.bucket, objectKey: result.objectKey, status: "uploaded" });
