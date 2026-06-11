import { buildOperationsReadinessReport } from "@/lib/operations-readiness";

function main() {
  const report = buildOperationsReadinessReport({
    env: process.env
  });

  console.log(JSON.stringify(report, null, 2));
}

main();
