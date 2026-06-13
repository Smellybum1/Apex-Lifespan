import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import {
  buildFullTextConnectorApprovalPacket,
  buildFullTextConnectorReviewDraft,
  buildFullTextSourceInventoryNextActionPlan,
  buildFullTextSourceInventoryProgressReport,
  summarizeFullTextConnectorApprovalPacket,
  summarizeFullTextConnectorReviewDraft,
  summarizeFullTextSourceInventoryNextActionPlan,
  summarizeFullTextSourceInventoryProgressReport
} from "@/lib/full-text-source-readiness";
import {
  buildSupplementOnboardingQualityDashboard,
  type SupplementOnboardingQualityDashboard
} from "@/lib/supplement-onboarding-quality";
import { readSupplementOnboardingSourceSignals } from "@/lib/supplement-onboarding-source-signals";

export interface OperatorOnboardingQualitySnapshot
  extends SupplementOnboardingQualityDashboard {
  fullTextConnectorApproval: ReturnType<typeof summarizeFullTextConnectorApprovalPacket>;
  fullTextConnectorReview: ReturnType<typeof summarizeFullTextConnectorReviewDraft>;
  fullTextNextAction: ReturnType<typeof summarizeFullTextSourceInventoryNextActionPlan>;
  fullTextProgress: ReturnType<typeof summarizeFullTextSourceInventoryProgressReport>;
}

export async function getOperatorOnboardingQualitySnapshot(
  limit = 6
): Promise<OperatorOnboardingQualitySnapshot> {
  const data = await getEvidenceDashboardData();
  const sourceSignals = await readSupplementOnboardingSourceSignals({ data });
  const generatedAt = new Date();
  const dashboard = buildSupplementOnboardingQualityDashboard({
    data,
    generatedAt,
    sourceSignals
  });
  const fullTextProgress = summarizeFullTextSourceInventoryProgressReport(
    buildFullTextSourceInventoryProgressReport({ generatedAt })
  );
  const fullTextNextAction = summarizeFullTextSourceInventoryNextActionPlan(
    buildFullTextSourceInventoryNextActionPlan({ generatedAt })
  );
  const fullTextConnectorReview = summarizeFullTextConnectorReviewDraft(
    buildFullTextConnectorReviewDraft({ generatedAt })
  );
  const fullTextConnectorApproval = summarizeFullTextConnectorApprovalPacket(
    buildFullTextConnectorApprovalPacket({ generatedAt })
  );

  return {
    ...dashboard,
    fullTextConnectorApproval,
    fullTextConnectorReview,
    fullTextNextAction,
    fullTextProgress,
    priorityQueue: dashboard.priorityQueue.slice(0, limit),
    rows: dashboard.rows.slice(0, limit)
  };
}
