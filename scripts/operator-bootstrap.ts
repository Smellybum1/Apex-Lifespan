import {
  bootstrapOperatorProfile,
  buildOperatorBootstrapPlan,
  parseOperatorRole,
  parseOperatorStatus,
  type OperatorBootstrapInput
} from "@/lib/operator/bootstrap";

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const email = readOption(args, "--email")?.trim();

  if (!email) {
    throw new Error(
      "Usage: npm run operator:bootstrap -- --email <email> [--role OWNER|ADMIN|REVIEWER|AUDITOR] [--status ACTIVE|DISABLED] [--name <name>] [--note <note>] [--apply --confirm-email <email>]"
    );
  }

  const input: OperatorBootstrapInput = {
    email,
    name: readOption(args, "--name"),
    note: readOption(args, "--note"),
    role: parseOperatorRole(readOption(args, "--role")),
    status: parseOperatorStatus(readOption(args, "--status"))
  };
  const apply = args.includes("--apply");
  const plan = buildOperatorBootstrapPlan({
    apply,
    confirmEmail: readOption(args, "--confirm-email")?.trim(),
    env: {
      APEX_OPERATOR_WRITES_ENABLED: process.env.APEX_OPERATOR_WRITES_ENABLED
    },
    input
  });

  if (plan.blockers.length > 0) {
    console.log(
      JSON.stringify(
        {
          applied: false,
          blockers: plan.blockers,
          dryRun: !apply,
          input: plan.input,
          nextAction:
            "Resolve blockers and rerun. The command is dry-run by default and writes only with --apply."
        },
        null,
        2
      )
    );
    process.exitCode = apply ? 1 : 0;
    return;
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          applied: false,
          dryRun: true,
          input: plan.input,
          nextAction:
            "Review this operator bootstrap plan. To write it locally, rerun with --apply --confirm-email <email> and APEX_OPERATOR_WRITES_ENABLED=true."
        },
        null,
        2
      )
    );
    return;
  }

  const result = await bootstrapOperatorProfile(plan.input);

  console.log(
    JSON.stringify(
      {
        applied: true,
        result
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
