import { z } from "zod";

export const appointmentEventSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  appointmentId: z.string().uuid(),
  status: z.enum(["scheduled", "rescheduled", "cancelled"]),
  channel: z.enum(["email", "sms"]),
});

export type AppointmentEvent = z.infer<typeof appointmentEventSchema>;

const messages: Record<AppointmentEvent["status"], string> = {
  scheduled: "Your appointment is scheduled. Open the patient portal for the date, time, and care details.",
  rescheduled: "Your appointment has changed. Open the patient portal to review the updated details.",
  cancelled: "Your appointment was cancelled. Open the patient portal if you need to arrange another time.",
};

export function tenantBucket(tenantId: string): string {
  return `care-${tenantId}`;
}

export function buildOperationalNotification(event: AppointmentEvent) {
  return {
    bucket: tenantBucket(event.tenantId),
    objectKey: `appointment-events/${event.appointmentId}/${event.status}.json`,
    payload: {
      appointmentId: event.appointmentId,
      status: event.status,
      channel: event.channel,
      message: messages[event.status],
    },
  };
}
