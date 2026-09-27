set -euo pipefail

release_sha="${1:?Release commit is required}"
reference="${2:-refs/heads/main}"
if [[ ! "$release_sha" =~ ^[a-f0-9]{40}$ ]] || [[ ! "$reference" =~ ^refs/(heads/main|pull/[1-9][0-9]*/merge)$ ]]; then
  echo "::error::Code scanning requires an exact commit and a supported analysis reference"
  exit 1
fi

analyses="$(gh api --method GET "repos/${GITHUB_REPOSITORY}/code-scanning/analyses" \
  -f ref="$reference" -f tool_name=CodeQL -f per_page=100 --paginate --slurp)"
required="$(jq -ce --arg sha "$release_sha" --arg ref "$reference" '
  [.[][] | select(.commit_sha == $sha and .ref == $ref and .tool.name == "CodeQL" and
    .analysis_key == ".github/workflows/codeql.yml:analyze")] as $analyses |
  ["/language:actions", "/language:javascript-typescript", "/language:rust"] |
  map(. as $category | [$analyses[] | select(.category == $category)] | max_by(.id)) |
  select(length == 3 and all(.[]; . != null and .error == "" and
    (.id | type == "number" and . > 0 and floor == .) and
    (.results_count | type == "number" and . >= 0 and floor == .)))
' <<<"$analyses")"

while IFS=$'\t' read -r analysis_id result_count category; do
  sarif="$(gh api "repos/${GITHUB_REPOSITORY}/code-scanning/analyses/${analysis_id}" \
    -H 'Accept: application/sarif+json')"
  alerts="$(jq -ce --argjson count "$result_count" --arg category "$category" '
    select(.version == "2.1.0" and (.runs | type == "array" and length > 0)) |
    select(all(.runs[]; .tool.driver.name == "CodeQL" and
      (.automationDetails.id | rtrimstr("/")) == $category and (.results | type == "array"))) |
    [.runs[].results[]] | select(length == $count) |
    map(.properties["github/alertNumber"]) |
    select(all(.[]; type == "number" and . > 0 and floor == .)) | unique
  ' <<<"$sarif")"
  while IFS= read -r alert_number; do
    alert="$(gh api "repos/${GITHUB_REPOSITORY}/code-scanning/alerts/${alert_number}")"
    if ! jq -e --argjson number "$alert_number" '
      .number == $number and .tool.name == "CodeQL" and .state == "dismissed"
    ' <<<"$alert" > /dev/null; then
      echo "::error::Release analysis contains a CodeQL finding without an accepted dismissal: ${alert_number}"
      exit 1
    fi
  done < <(jq -r '.[]' <<<"$alerts")
done < <(jq -r '.[] | [.id, .results_count, .category] | @tsv' <<<"$required")
