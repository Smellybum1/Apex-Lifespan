import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

import { prisma } from "@/lib/db/prisma";

const githubProviderConfigured = Boolean(
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
);

const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: githubProviderConfigured ? [GitHub] : [],
  session: {
    strategy: "database"
  },
  trustHost: true
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
