export const projectConfig = {
  audience: "public-read-only",
  defaultRegion: "AU",
  defaultRegulatoryAgency: "TGA",
  firstIngestionWorkflow: "PubMed",
  detailMode: {
    default: "consumer-friendly",
    expandable: "investor-grade research"
  },
  safetyBoundaries: [
    "No individualized medical advice.",
    "No sourcing, compounding, reconstitution, injection, cycling, or self-administration guidance for unapproved drugs or peptides.",
    "Every final medical claim must be citation-linked and review-status visible."
  ]
} as const;
