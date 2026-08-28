import { prisma } from "../db/prisma";
import { generateRecoveryMessage } from "../llm/generateMessage";

// Delay helper to avoid rate limits
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateMessagesForInterventions(): Promise<{ generated: number; skipped: number; failed: number; remaining: number }> {
  // Query Intervention where status = "pending" AND messageText IS NULL
  // IMPORTANT: We only process 'pending' (autonomously approved) and NOT 'pending_human_approval'
  const eligibleInterventions = await prisma.intervention.findMany({
    where: {
      status: "pending",
      messageText: null,
      actionType: {
        in: ["reminder", "retry", "discount_5", "discount_10", "waiver"] // Ensure only these types are picked up
      }
    },
    include: {
      customer: true,
      revenueRiskEvent: {
        include: {
          rootCause: true
        }
      }
    },
    take: 50 // Cap at 50 per run
  });

  const totalEligibleCount = await prisma.intervention.count({
    where: {
      status: "pending",
      messageText: null,
      actionType: {
        in: ["reminder", "retry", "discount_5", "discount_10", "waiver"]
      }
    }
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const intervention of eligibleInterventions) {
    if (intervention.messageText) {
      skipped++;
      continue;
    }

    try {
      const input = {
        customerName: intervention.customer.name,
        preferredLanguage: intervention.customer.preferredLanguage,
        actionType: intervention.actionType,
        predictedReason: intervention.revenueRiskEvent.rootCause?.predictedReason || "Unknown",
        amountAtRisk: intervention.revenueRiskEvent.amountAtRisk,
        cost: intervention.cost,
        sourceType: intervention.revenueRiskEvent.sourceType,
      };

      const message = await generateRecoveryMessage(input);

      // Determine channel
      const channel = intervention.revenueRiskEvent.sourceType === "invoice" ? "email" : "sms";

      await prisma.intervention.update({
        where: { id: intervention.id },
        data: {
          messageText: message,
          channel: channel,
          language: intervention.customer.preferredLanguage,
        }
      });

      await prisma.auditLog.create({
        data: {
          entityType: "Intervention",
          entityId: intervention.id,
          action: "message_generated",
          actor: "MessagingAgent",
          details: { channel, language: intervention.customer.preferredLanguage }
        }
      });

      generated++;

      // Delay to respect rate limit
      await delay(600);

    } catch (error: any) {
      console.error(`Failed to process intervention ${intervention.id}:`, error);
      
      await prisma.auditLog.create({
        data: {
          entityType: "Intervention",
          entityId: intervention.id,
          action: "message_generation_failed",
          actor: "MessagingAgent",
          details: { error: error.message }
        }
      });

      failed++;
    }
  }

  const remaining = Math.max(0, totalEligibleCount - (generated + skipped + failed));

  return { generated, skipped, failed, remaining };
}
