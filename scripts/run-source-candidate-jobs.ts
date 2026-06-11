process.env.APEX_PRISMA_LOG ??= "silent";

void import("../src/lib/data/source-candidate-job-command").then(
  ({ runSourceCandidateJobCommand }) => {
    void runSourceCandidateJobCommand().then((exitCode) => {
      process.exitCode = exitCode;
    });
  }
);
