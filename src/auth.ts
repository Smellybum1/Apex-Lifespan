import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

import { prisma } from "@/lib/db/prisma";

const githubProviderConfigured = Boolean(
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
);

const githubProvider = GitHub({
  // Operator users are pre-bootstrapped by email before their first OAuth login.
  // GitHub email linking lets that first login attach to the existing operator user.
  allowDangerousEmailAccountLinking: true
});

const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: githubProviderConfigured ? [githubProvider] : [],
  session: {
    strategy: "database"
  },
  trustHost: true
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
