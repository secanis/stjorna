# AI Feedback Loop for Visual E2E Failures

The `ai-fixture.ts` Playwright extension automatically captures structured context whenever an E2E test fails. This document explains how to consume that context with OpenCode + MiniMax M3.

## What gets captured

On test failure, the fixture writes one JSON file to `frontend/ai-failed-tests/payload-<testId>.json` plus any auto-attached `*-actual.png`, `*-expected.png`, `*-diff.png` from `toHaveScreenshot()` failures.

Each payload contains:

| Field | Purpose |
|-------|---------|
| `testId`, `testName`, `testFile` | Locator for the failing test |
| `errorMessage`, `stackTrace` | Why Playwright failed |
| `url`, `viewport` | Page state at failure |
| `attachments.actualPath` | What the page actually rendered |
| `attachments.expectedPath` | The baseline snapshot |
| `attachments.diffPath` | Pixel-level diff |
| `diffBbox` | Computed bbox of changed pixels (from diff PNG) |
| `a11ySubtree` | Accessibility tree truncated to the diff region |
| `a11yFullNodeCount` / `a11ySubtreeNodeCount` | Token-cost visibility |

The accessibility tree is truncated to nodes intersecting the diff bbox (max 500 nodes) to keep token cost predictable. Typical failure: ~1.5k tokens instead of ~15k.

## Local flow

```bash
# 1. Run E2E; failures auto-write payloads
cd frontend
npm run test:e2e:fast

# 2. List what got captured
ls ai-failed-tests/

# 3. Hand a payload to OpenCode
opencode --model opencode-go/minimax-m3 \
  --attach ./ai-failed-tests/*-diff.png \
  --prompt "$(jq -r '.a11ySubtree' ai-failed-tests/payload-*.json | head -c 4000)"
```

## CI flow

The `.github/workflows/e2e-ai-artifact.yml` reusable workflow uploads the `frontend/ai-failed-tests/` directory as a GitHub Actions artifact (`e2e-ai-payload`, 7-day retention).

To wire it into an existing E2E workflow job:

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: npm run test:e2e
      - uses: ./../.github/workflows/e2e-ai-artifact.yml
        with:
          artifact-name: e2e-ai-payload-${{ github.run_id }}
          payload-dir: frontend/ai-failed-tests
```

Then download manually after a failure:

```bash
gh run download <run-id> -n e2e-ai-payload -D ./tmp-ai
ls ./tmp-ai
```

## Suggested prompt template

When feeding a payload to the model, include:

1. The diff PNG as `--attach` (visual signal)
2. The truncated a11y subtree (structural signal)
3. The error message (intent of the failing assertion)
4. The test file path (where the fix likely lives)

Example:

```
A Playwright visual regression test just failed. Help me diagnose.

Test: $(jq -r '.testName' payload.json)
File: $(jq -r '.testFile' payload.json)
URL:  $(jq -r '.url' payload.json)
Error: $(jq -r '.errorMessage' payload.json)

Accessibility subtree of the changed region:
$(jq -r '.a11ySubtree' payload.json)

The diff PNG is attached. Identify the most likely cause of the
visual change and suggest the smallest fix in the corresponding
.tsx component.
```

## Limitations

- Only catches `toHaveScreenshot()` failures. Other failures (logic, timing, selector misses) still produce payloads but without diff PNGs.
- `bboxFromDiffPng` treats any non-near-black pixel as "changed". Anti-aliased text on a different background color may produce a larger bbox than the actual semantic change.
- A11y snapshot can fail on pages with detached iframes after navigation. The fixture falls back to `a11ySubtree: null` rather than crashing the test.
