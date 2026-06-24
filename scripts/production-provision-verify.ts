import { spawnSync } from "node:child_process";

function main() {
  const apply = process.argv.includes("--apply");
  const steps = [
    ["npm", ["run", "production:connectivity"]],
    ["npm", ["run", "production:connectivity", "--", "--probe"]],
    ["npm", ["run", "production:migration-rehearsal"]],
    ...(apply ? [["npm", ["run", "production:migration-rehearsal", "--", "--apply"]] as const] : [])
  ];

  console.log(
    JSON.stringify(
      {
        applyRequested: apply,
        requiredEnv: [
          "DATABASE_URL",
          "APEX_DATA_SOURCE=database",
          "APEX_MIGRATION_REHEARSAL_TARGET=non-production"
        ],
        steps: steps.map(([command, args]) => [command, ...args].join(" "))
      },
      null,
      2
    )
  );

  for (const [command, args] of steps) {
    const label = [command, ...args].join(" ");
    console.log(`\n==> ${label}\n`);
    const result = spawnSync(command, args, {
      encoding: "utf8",
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    if (result.status !== 0) {
      console.error(`\nStopped: ${label} failed with exit code ${result.status ?? 1}.`);
      process.exit(result.status ?? 1);
    }
  }

  console.log(
    "\nProvisioning verification passed. Record APEX_MIGRATION_REHEARSAL_PASSED_AT only after reviewing the rehearsal output."
  );
}

main();
