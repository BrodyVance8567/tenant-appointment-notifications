import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appointmentEventSchema, buildOperationalNotification } from "./appointment_notifications.js";
import { infrai, InfraiError } from "./infrai.js";
import { offboardTenant, onboardTenant } from "./tenant_lifecycle.js";

const offboardSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  credentialId: z.string().min(1),
});
const onboardSchema = z.object({ tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/) });

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === "POST" && request.url === "/tenants/onboard") {
    const input = onboardSchema.parse(await readJson(request));
    json(response, 201, await onboardTenant(input.tenantId));
    return;
  }
  if (request.method === "POST" && request.url === "/appointments/notification-upload") {
    const event = appointmentEventSchema.parse(await readJson(request));
    const notification = buildOperationalNotification(event);
    const signed = await infrai.storage.object.presign(notification.bucket, notification.objectKey, {
      op: "put",
      expires_seconds: 300,
      content_type: "application/json",
      max_bytes: 4096,
      idempotency_key: randomUUID(),
    });
    json(response, 200, { ...notification, uploadUrl: signed.url, uploadMethod: "PUT" });
    return;
  }
  if (request.method === "POST" && request.url === "/tenants/offboard") {
    const input = offboardSchema.parse(await readJson(request));
    json(response, 200, await offboardTenant(input.tenantId, input.credentialId));
    return;
  }
  json(response, 404, { error: "Route not found" });
}

const server = createServer((request, response) => {
  route(request, response).catch((error: unknown) => {
    if (error instanceof z.ZodError) {
      json(response, 400, { error: "Invalid request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "Internal service error" });
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Healthtech service listening on http://localhost:${port}`));
