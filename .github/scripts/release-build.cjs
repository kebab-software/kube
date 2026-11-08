const requiredArtifacts = ['kube-web', 'kube-android-debug', 'kube-desktop-windows-latest', 'kube-desktop-macos-latest', 'kube-desktop-ubuntu-latest'];
function selectBuild(runs, branch, repositoryId) {
  const run = runs.filter(r => r.status === 'completed' && r.conclusion === 'success' && r.head_branch === branch && r.head_repository?.id === repositoryId && ['push', 'workflow_dispatch'].includes(r.event))
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
  if (!run) throw new Error(`No successful trusted build exists on ${branch}. Run Build Kube first.`);
  return run;
}
function validateArtifacts(artifacts) {
  for (const name of requiredArtifacts) {
    const matches = artifacts.filter(a => a.name === name && !a.expired && a.size_in_bytes > 0);
    if (matches.length !== 1) throw new Error(`Build artifact ${name} is missing, expired, empty, or ambiguous. Run a new build before publishing.`);
  }
}
module.exports = { selectBuild, validateArtifacts, requiredArtifacts };
