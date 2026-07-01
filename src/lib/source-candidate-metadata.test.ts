import { describe, expect, it } from "vitest";

import {
  LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION,
  LOCAL_BENEFIT_DISCOVERY_METADATA_VERSION,
  LOCAL_CANDIDATE_REVIEW_METADATA_VERSION,
  LOCAL_IDENTITY_RESOLUTION_METADATA_VERSION,
  readLocalAcceptedCandidateProcessingMetadata,
  readLocalBenefitDiscoveryDecisionMetadata,
  readLocalCandidateReviewDispositionMetadata,
  readLocalIdentityResolutionMetadata,
  readSourceCandidateDiscoveryClassification,
  SOURCE_CANDIDATE_DISCOVERY_CLASSIFIER_VERSION,
  SOURCE_CANDIDATE_METADATA_KEYS,
  writeLocalAcceptedCandidateProcessingMetadata,
  writeLocalBenefitDiscoveryDecisionMetadata,
  writeLocalCandidateReviewDispositionMetadata,
  writeLocalIdentityResolutionMetadata
} from "@/lib/source-candidate-metadata";

describe("source candidate metadata helpers", () => {
  it("writes and reads accepted-candidate processing metadata", () => {
    const metadata = writeLocalAcceptedCandidateProcessingMetadata(
      {
        upstreamSource: "NCBI"
      },
      {
        linkedClaim: false,
        needsClaim: true,
        nextAction: "Review novel outcomes.",
        novelOutcomes: [{ label: "Skin", outcome: "SKIN" }],
        outcomeSuggestions: [
          { label: "Skin", outcome: "SKIN", score: 2 },
          { label: "Vision", outcome: "VISION", score: 1 }
        ],
        processedAt: "2026-06-29T00:00:00.000Z",
        referenceId: "ref-1",
        sourceTypeSuggestion: "Meta-analysis"
      }
    );

    expect(metadata).toMatchObject({
      upstreamSource: "NCBI",
      [SOURCE_CANDIDATE_METADATA_KEYS.acceptedProcessing]: {
        linkedClaim: false,
        needsClaim: true,
        referenceId: "ref-1",
        version: LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION
      }
    });
    expect(readLocalAcceptedCandidateProcessingMetadata(metadata)).toMatchObject({
      linkedClaim: false,
      needsClaim: true,
      nextAction: "Review novel outcomes.",
      novelOutcomeLabels: ["Skin"],
      outcomeLabels: ["Skin", "Vision"],
      processedAt: "2026-06-29T00:00:00.000Z",
      sourceTypeSuggestion: "Meta-analysis"
    });
  });

  it("writes benefit-discovery decisions and ignores stale versions", () => {
    const metadata = writeLocalBenefitDiscoveryDecisionMetadata(
      {},
      {
        action: "draft-claim",
        claimId: "claim-1",
        clusterKey: "astaxanthin::SKIN",
        status: "claim-drafted"
      },
      new Date("2026-06-29T01:00:00.000Z")
    );

    expect(metadata).toMatchObject({
      [SOURCE_CANDIDATE_METADATA_KEYS.benefitDiscoveryDecision]: {
        claimId: "claim-1",
        clusterKey: "astaxanthin::SKIN",
        decidedAt: "2026-06-29T01:00:00.000Z",
        status: "claim-drafted",
        version: LOCAL_BENEFIT_DISCOVERY_METADATA_VERSION
      }
    });
    expect(readLocalBenefitDiscoveryDecisionMetadata(metadata)).toEqual({
      clusterKey: "astaxanthin::SKIN",
      status: "claim-drafted"
    });
    expect(
      readLocalBenefitDiscoveryDecisionMetadata(
        writeLocalBenefitDiscoveryDecisionMetadata(
          {},
          {
            action: "park-lead",
            clusterKey: "matcha::CARDIOVASCULAR_EVENTS",
            status: "parked"
          },
          new Date("2026-06-29T01:30:00.000Z")
        )
      )
    ).toEqual({
      clusterKey: "matcha::CARDIOVASCULAR_EVENTS",
      status: "parked"
    });
    expect(
      readLocalBenefitDiscoveryDecisionMetadata({
        [SOURCE_CANDIDATE_METADATA_KEYS.benefitDiscoveryDecision]: {
          clusterKey: "astaxanthin::SKIN",
          status: "claim-drafted",
          version: "old"
        }
      })
    ).toBeUndefined();
  });

  it("writes identity-resolution metadata and clears benefit decisions after confirmation", () => {
    const withDecision = writeLocalBenefitDiscoveryDecisionMetadata(
      {},
      {
        action: "draft-claim",
        clusterKey: "astaxanthin::SKIN",
        status: "skipped-mismatch"
      }
    );
    const metadata = writeLocalIdentityResolutionMetadata(
      withDecision,
      {
        action: "add-synonym",
        interventionId: "astaxanthin",
        status: "confirmed-target",
        synonym: "AstaReal"
      },
      new Date("2026-06-29T02:00:00.000Z")
    );

    expect(metadata).not.toHaveProperty(
      SOURCE_CANDIDATE_METADATA_KEYS.benefitDiscoveryDecision
    );
    expect(metadata).toMatchObject({
      [SOURCE_CANDIDATE_METADATA_KEYS.identityResolution]: {
        action: "add-synonym",
        interventionId: "astaxanthin",
        resolvedAt: "2026-06-29T02:00:00.000Z",
        status: "confirmed-target",
        synonym: "AstaReal",
        version: LOCAL_IDENTITY_RESOLUTION_METADATA_VERSION
      }
    });
    expect(readLocalIdentityResolutionMetadata(metadata)).toEqual({
      interventionId: "astaxanthin",
      status: "confirmed-target"
    });
  });

  it("writes candidate-review parked research disposition metadata", () => {
    const metadata = writeLocalCandidateReviewDispositionMetadata(
      {
        upstreamSource: "NCBI"
      },
      {
        action: "park-mined-research",
        reason: "Research signal only.",
        status: "parked-research"
      },
      new Date("2026-06-29T03:00:00.000Z")
    );

    expect(metadata).toMatchObject({
      upstreamSource: "NCBI",
      [SOURCE_CANDIDATE_METADATA_KEYS.candidateReviewDisposition]: {
        action: "park-mined-research",
        decidedAt: "2026-06-29T03:00:00.000Z",
        reason: "Research signal only.",
        status: "parked-research",
        version: LOCAL_CANDIDATE_REVIEW_METADATA_VERSION
      }
    });
    expect(readLocalCandidateReviewDispositionMetadata(metadata)).toEqual({
      status: "parked-research"
    });
  });

  it("reads discovery classification metadata through one parser", () => {
    expect(
      readSourceCandidateDiscoveryClassification({
        [SOURCE_CANDIDATE_METADATA_KEYS.discoveryClassification]: {
          bucket: "maybe-useful",
          cautions: ["weak title/query overlap"],
          label: "Maybe useful",
          reasons: ["human trial signal"],
          score: 62
        }
      })
    ).toEqual({
      bucket: "maybe-useful",
      cautions: ["weak title/query overlap"],
      label: "Maybe useful",
      reasons: ["human trial signal"],
      score: 62,
      version: SOURCE_CANDIDATE_DISCOVERY_CLASSIFIER_VERSION
    });
  });
});
