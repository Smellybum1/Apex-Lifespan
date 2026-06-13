import { describe, expect, it } from "vitest";

import {
  applyLaunchEvidenceToEnvContent,
  buildLaunchEvidenceRecord
} from "@/lib/launch-evidence";

describe("launch evidence recorder", () => {
  it("builds admin-flow smoke evidence without production writes", () => {
    const record = buildLaunchEvidenceRecord({
      note:
        "Production admin smoke passed: signed in as authorized owner and reviewed queue.",
      timestamp: new Date("2026-06-13T01:00:00.000Z"),
      type: "admin-flow-smoke",
      url: "https://apex-lifespan.vercel.app/operator"
    });

    expect(record).toEqual({
      entries: {
        APEX_ADMIN_FLOW_SMOKE_NOTE:
          "Production admin smoke passed: signed in as authorized owner and reviewed queue.",
        APEX_ADMIN_FLOW_SMOKE_PASSED_AT: "2026-06-13T01:00:00.000Z",
        APEX_ADMIN_FLOW_SMOKE_URL: "https://apex-lifespan.vercel.app/operator"
      },
      evidenceKey: "APEX_ADMIN_FLOW_SMOKE_PASSED_AT",
      humanOwned: true,
      label: "Production authenticated admin/operator-flow smoke",
      noDatabaseWrite: true,
      noProductionWrite: true,
      noteKey: "APEX_ADMIN_FLOW_SMOKE_NOTE",
      recordedKeys: [
        "APEX_ADMIN_FLOW_SMOKE_PASSED_AT",
        "APEX_ADMIN_FLOW_SMOKE_NOTE",
        "APEX_ADMIN_FLOW_SMOKE_URL"
      ],
      requiredConfirmation:
        "Authenticated production operator console was manually smoked by an authorized operator.",
      timestamp: "2026-06-13T01:00:00.000Z",
      type: "admin-flow-smoke"
    });
  });

  it("requires specific human evidence fields for each launch gate", () => {
    expect(() =>
      buildLaunchEvidenceRecord({
        note: "Too short",
        type: "admin-flow-smoke",
        url: "https://apex-lifespan.vercel.app/operator"
      })
    ).toThrow(/specific enough/);

    expect(() =>
      buildLaunchEvidenceRecord({
        note: "Production operator smoke was reviewed by an authorized owner.",
        type: "admin-flow-smoke"
      })
    ).toThrow(/--url is required/);

    expect(() =>
      buildLaunchEvidenceRecord({
        note: "Post launch review was scheduled in the launch calendar.",
        type: "post-launch-review"
      })
    ).toThrow(/--review-window is required/);

    expect(() =>
      buildLaunchEvidenceRecord({
        note: "Readiness report was reviewed and launch was approved.",
        type: "launch-approval"
      })
    ).toThrow(/--approved-by is required/);
  });

  it("applies launch evidence entries to env content without leaking note parsing issues", () => {
    const record = buildLaunchEvidenceRecord({
      note: "Post launch review scheduled with launch owner for follow-up.",
      reviewWindow: "2026-06-14 10:00 Australia/Brisbane",
      timestamp: new Date("2026-06-13T01:30:00.000Z"),
      type: "post-launch-review"
    });
    const update = applyLaunchEvidenceToEnvContent("APEX_DATA_SOURCE=database\n", record);

    expect(update.appendedKeys).toEqual([
      "APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT",
      "APEX_POST_LAUNCH_REVIEW_NOTE",
      "APEX_POST_LAUNCH_REVIEW_WINDOW"
    ]);
    expect(update.replacedKeys).toEqual([]);
    expect(update.content).toContain(
      "APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT=2026-06-13T01:30:00.000Z"
    );
    expect(update.content).toContain(
      'APEX_POST_LAUNCH_REVIEW_NOTE="Post launch review scheduled with launch owner for follow-up."'
    );
    expect(update.content).toContain(
      'APEX_POST_LAUNCH_REVIEW_WINDOW="2026-06-14 10:00 Australia/Brisbane"'
    );
  });

  it("refuses to overwrite existing launch evidence without force", () => {
    const record = buildLaunchEvidenceRecord({
      approvedBy: "Tom Chanpheng",
      note: "Readiness report was reviewed and final launch approval was granted.",
      timestamp: new Date("2026-06-13T02:00:00.000Z"),
      type: "launch-approval"
    });
    const content = [
      "APEX_FULLY_LIVE_LAUNCH_APPROVED_AT=2026-06-13T01:00:00.000Z",
      "APEX_FULLY_LIVE_LAUNCH_APPROVAL_NOTE=old"
    ].join("\n");

    expect(() => applyLaunchEvidenceToEnvContent(content, record)).toThrow(
      /already recorded/
    );

    const forcedUpdate = applyLaunchEvidenceToEnvContent(content, record, { force: true });

    expect(forcedUpdate.replacedKeys).toEqual([
      "APEX_FULLY_LIVE_LAUNCH_APPROVED_AT",
      "APEX_FULLY_LIVE_LAUNCH_APPROVAL_NOTE"
    ]);
    expect(forcedUpdate.appendedKeys).toEqual(["APEX_FULLY_LIVE_LAUNCH_APPROVED_BY"]);
  });
});
