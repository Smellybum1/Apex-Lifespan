import { runSourceCandidateJobCommand } from "../src/lib/data/source-candidate-job-command";

void runSourceCandidateJobCommand().then((exitCode) => {
  process.exitCode = exitCode;
});
