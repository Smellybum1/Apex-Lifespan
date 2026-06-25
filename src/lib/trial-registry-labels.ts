import { labelTrialRegistryRecord } from "@/lib/integrations/clinical-trials";
import type { Intervention, TrialWatchItem } from "@/lib/types";

export function labelTrialWatchItem(
  trial: TrialWatchItem,
  intervention?: Pick<Intervention, "name" | "synonyms">
) {
  return labelTrialRegistryRecord(
    {
      briefSummary: trial.briefSummary,
      conditions: trial.conditions,
      hasResults: trial.resultsPosted,
      primaryOutcomes: trial.primaryOutcomes,
      registeredInterventions: trial.registeredInterventions,
      status: trial.status,
      title: trial.title
    },
    intervention?.name ?? ""
  );
}
