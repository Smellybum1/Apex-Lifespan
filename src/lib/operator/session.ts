import { OperatorStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import { operatorAuthConfigured } from "@/lib/operator/config";

export async function getCurrentOperatorPrincipal(): Promise<OperatorPrincipal | null> {
  if (!operatorAuthConfigured()) {
    return null;
  }

  const session = await auth();
  const email = session?.user?.email?.trim();

  if (!email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email
    },
    include: {
      operatorProfile: true
    }
  });

  if (!user?.email || !user.operatorProfile) {
    return null;
  }

  return {
    email: user.email,
    role: user.operatorProfile.role,
    status: user.operatorProfile.status ?? OperatorStatus.DISABLED,
    userId: user.id
  };
}
