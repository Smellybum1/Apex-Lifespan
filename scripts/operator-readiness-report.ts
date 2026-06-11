import { buildOperatorReadinessReport } from "@/lib/operator/readiness";

function main() {
  const report = buildOperatorReadinessReport({
    env: process.env
  });

  console.log(JSON.stringify(report, null, 2));
}

main();
