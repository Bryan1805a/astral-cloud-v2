import { db } from "./db";
import type { NotificationType } from "@astral/shared";

export async function createNotification(userId: string, type: NotificationType, title: string, body: string, link?: string): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, type, title, body, link: link || null },
    });
  } catch (error) {
    console.error("[notification] Failed to create notification:", error);
  }
}

export async function notifyServerEvent(userId: string, hostname: string, action: string): Promise<void> {
  const typeMap: Record<string, NotificationType> = {
    created: "SERVER_CREATED" as NotificationType,
    started: "SERVER_STARTED" as NotificationType,
    stopped: "SERVER_STOPPED" as NotificationType,
    restarted: "SERVER_RESTARTED" as NotificationType,
    deleted: "SERVER_DELETED" as NotificationType,
  };
  const type = typeMap[action] || ("SERVER_CREATED" as NotificationType);
  await createNotification(userId, type,
    `Server ${action}`,
    `Your server "${hostname}" has been ${action}.`,
    "/dashboard/servers");
}

export async function notifyTicketEvent(userId: string, subject: string, action: string, ticketId: string): Promise<void> {
  await createNotification(userId, "TICKET_UPDATED" as NotificationType,
    `Ticket ${action}`,
    `Your ticket "${subject}" has been ${action.toLowerCase()}.`,
    `/dashboard/tickets/${ticketId}`);
}

export async function notifyPaymentEvent(userId: string, action: string, amount: string): Promise<void> {
  await createNotification(userId, "PAYMENT_COMPLETED" as NotificationType,
    `Payment ${action}`,
    `A payment of $${amount} has been ${action.toLowerCase()}.`,
    "/dashboard/billing");
}
