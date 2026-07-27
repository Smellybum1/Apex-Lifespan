import { syncOperatorQaFixture } from "@/lib/operator/qa-fixture";

syncOperatorQaFixture()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
