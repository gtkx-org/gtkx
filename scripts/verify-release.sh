set -euo pipefail

release_sha="$(git rev-parse HEAD)"
if [ "${RELEASE_SHA:-$release_sha}" != "$release_sha" ]; then
  echo "::error::Release checkout does not match the verified commit"
  exit 1
fi

pull_requests="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${release_sha}/pulls" --paginate --slurp)"
release_pr="$(jq -cer --arg sha "$release_sha" --arg repo "$GITHUB_REPOSITORY" '
  [.[][] | select(.merged_at != null and .merge_commit_sha == $sha and
    .base.ref == "main" and .head.ref == "release/next" and
    .head.repo.full_name == $repo)] | if length == 1 then .[0] else error("Missing merged release PR") end
' <<<"$pull_requests")"
pr_number="$(jq -r '.number' <<<"$release_pr")"
pr_head="$(jq -r '.head.sha' <<<"$release_pr")"
reviews="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${pr_number}/reviews" --paginate --slurp)"
reviewers="$(jq -r --arg sha "$pr_head" '
  [.[][] | select(.state == "APPROVED" or .state == "CHANGES_REQUESTED" or .state == "DISMISSED")]
  | group_by(.user.login) | map(max_by(.id))
  | select(all(.state != "CHANGES_REQUESTED"))
  | .[] | select(.state == "APPROVED" and .commit_id == $sha) | .user.login
' <<<"$reviews")"
has_approval=false
while IFS= read -r reviewer; do
  if [ -z "$reviewer" ]; then continue; fi
  permission="$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${reviewer}/permission" --jq '.permission')"
  case "$permission" in
    admin|maintain|write) has_approval=true ;;
  esac
done <<<"$reviewers"
if [ "$has_approval" != "true" ]; then
  echo "::error::Release PR has no approval from a reviewer with write access"
  exit 1
fi

runs="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${release_sha}&event=push&branch=main&per_page=100")"
run_id="$(jq -er --arg sha "$release_sha" --arg repo "$GITHUB_REPOSITORY" '
  [.workflow_runs[] | select(.head_sha == $sha and .head_repository.full_name == $repo)]
  | max_by(.id) | select(.status == "completed" and .conclusion == "success") | .id
' <<<"$runs")"
jobs="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}/jobs?filter=latest&per_page=100" --paginate --slurp)"
jq -e '[.[].jobs[] | select(.name == "ci-success")] | length == 1 and all(.conclusion == "success")' <<<"$jobs" > /dev/null

deadline=$((SECONDS + 1200))
while true; do
  checks="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${release_sha}/check-runs?per_page=100&filter=latest" --paginate --slurp)"
  if jq -e '
    [.[].check_runs[]] as $checks |
    [["Analyze (actions)", 15368],
     ["Analyze (javascript-typescript)", 15368], ["Analyze (rust)", 15368]] |
    all(. as $required | [$checks[] | select(.name == $required[0] and .app.id == $required[1])]
      | max_by(.id) | .conclusion == "success")
  ' <<<"$checks" > /dev/null; then
    break
  fi
  if jq -e '
    [.[].check_runs[]] as $checks |
    [["Analyze (actions)", 15368],
     ["Analyze (javascript-typescript)", 15368], ["Analyze (rust)", 15368]] |
    any(. as $required | [$checks[] | select(.name == $required[0] and .app.id == $required[1])]
      | max_by(.id) | .status == "completed" and .conclusion != "success")
  ' <<<"$checks" > /dev/null; then
    echo "::error::Release commit failed a required external check"
    exit 1
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::Release commit is missing successful required external checks"
    exit 1
  fi
  sleep 20
done

bash scripts/verify-code-scanning.sh "$release_sha"

printf 'run-id=%s\nrelease-sha=%s\n' "$run_id" "$release_sha" >> "$GITHUB_OUTPUT"
