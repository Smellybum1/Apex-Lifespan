export interface OperatorAuthEnv {
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
}

export function operatorAuthConfigured(
  env: OperatorAuthEnv = {
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL
  }
) {
  return Boolean(
    env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET && env.AUTH_SECRET && env.DATABASE_URL
  );
}
