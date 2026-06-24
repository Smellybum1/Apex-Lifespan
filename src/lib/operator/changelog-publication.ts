import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";

const CHANGELOG_PUBLICATION_APPROVAL_KEY =
  "APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT";

export interface OperatorChangelogPublicationEnv extends OperatorWriteEnv {
  APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT?: string;
}

export interface PublishPublicChangelogEntryInput {
  changelogEntryId?: string;
  publicationNote: string;
  publishedAt?: Date;
  slug?: string;
}

export interface PublishedPublicChangelogEntry {
  id: string;
  publishedAt: string;
  slug: string;
  title: string;
}

export async function publishPublicChangelogEntryAsOperator(
  principal: OperatorPrincipal,
  input: PublishPublicChangelogEntryInput,
  env: OperatorChangelogPublicationEnv = {
    APEX_OPERATOR_WRITES_ENABLED: process.env.APEX_OPERATOR_WRITES_ENABLED,
    APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT:
      process.env.APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT
  }
): Promise<PublishedPublicChangelogEntry> {
  requireOperatorPermission(principal, "evidence:promote", env);

  const approvalAt = requireChangelogPublicationApproval(env);
  const publicationNote = input.publicationNote.trim();
  const selector = changelogSelector(input);

  if (!publicationNote) {
    throw new Error("Changelog publication note is required.");
  }

  const publishedAt = input.publishedAt ?? new Date();
  const published = await prisma.$transaction(async (tx) => {
    const entry = await tx.publicChangelogEntry.findUnique({
      select: {
        claimId: true,
        id: true,
        interventionId: true,
        kind: true,
        publishedAt: true,
        referenceId: true,
        scoreHistoryId: true,
        slug: true,
        title: true
      },
      where: selector
    });

    if (!entry) {
      throw new Error("Draft changelog entry was not found.");
    }

    if (entry.publishedAt) {
      throw new Error("Public changelog entry is already published.");
    }

    const updateResult = await tx.publicChangelogEntry.updateMany({
      data: {
        publishedAt
      },
      where: {
        id: entry.id,
        publishedAt: null
      }
    });

    if (updateResult.count !== 1) {
      throw new Error("Public changelog entry is already published.");
    }

    const updated = await tx.publicChangelogEntry.findUniqueOrThrow({
      select: {
        id: true,
        publishedAt: true,
        slug: true,
        title: true
      },
      where: {
        id: entry.id
      }
    });

    await recordOperatorAuditEvent(
      principal,
      {
        action: "publicChangelog.publish",
        afterSummary: {
          id: updated.id,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
          slug: updated.slug,
          title: updated.title
        },
        beforeSummary: {
          id: entry.id,
          publishedAt: null,
          slug: entry.slug,
          title: entry.title
        },
        metadata: {
          approvalAt,
          approvalKey: CHANGELOG_PUBLICATION_APPROVAL_KEY,
          claimId: entry.claimId,
          interventionId: entry.interventionId,
          kind: entry.kind,
          referenceId: entry.referenceId,
          scoreHistoryId: entry.scoreHistoryId
        },
        note: publicationNote,
        targetId: entry.id,
        targetType: "PublicChangelogEntry"
      },
      tx
    );

    return updated;
  });

  return {
    id: published.id,
    publishedAt: published.publishedAt?.toISOString() ?? publishedAt.toISOString(),
    slug: published.slug,
    title: published.title
  };
}

function requireChangelogPublicationApproval(env: OperatorChangelogPublicationEnv) {
  const approvalAt = readEnv(env, CHANGELOG_PUBLICATION_APPROVAL_KEY);

  if (!approvalAt) {
    throw new Error(`${CHANGELOG_PUBLICATION_APPROVAL_KEY} is required.`);
  }

  return approvalAt;
}

function changelogSelector(input: PublishPublicChangelogEntryInput) {
  const changelogEntryId = input.changelogEntryId?.trim();
  const slug = input.slug?.trim();

  if (changelogEntryId && slug) {
    throw new Error("Provide either changelogEntryId or slug, not both.");
  }

  if (changelogEntryId) {
    return {
      id: changelogEntryId
    };
  }

  if (slug) {
    return {
      slug
    };
  }

  throw new Error("Changelog entry id or slug is required.");
}

function readEnv(
  env: OperatorChangelogPublicationEnv,
  key: typeof CHANGELOG_PUBLICATION_APPROVAL_KEY
) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
