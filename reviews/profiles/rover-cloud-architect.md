# Rover CLI — Cloud Architect Review Profile

## Repo
~/hardshell/rover

## Standards

### GCP Identity & Authentication
- IAP (Identity-Aware Proxy) transport uses service account impersonation — verify the impersonation chain is correct
- OIDC identity tokens must target the correct audience (the IAP client ID)
- Application Default Credentials (ADC) must be the only credential source — never embed service account keys
- Token refresh must be handled automatically by the token source — no manual expiry tracking
- Workload Identity Federation for CI/CD — no exported service account keys in GitHub Actions

### OAuth2 Flow Security
- Authorization code flow with PKCE preferred — if not PKCE, CSRF state token is mandatory
- Callback server must bind to `localhost` only — never `0.0.0.0`
- Ephemeral port allocation (`localhost:0`) is correct — don't hardcode ports
- State parameter must be generated with `crypto/rand`, not `math/rand`
- Token exchange must happen server-side — authorization code never exposed to user
- Redirect URI must be validated — no open redirect vulnerabilities

### HTTP Transport & Networking
- `http.RoundTripper` implementations must be safe for concurrent use
- Never modify the original request — clone with `req.Clone(req.Context())`
- Set timeouts on `http.Client` — default Go client has no timeout
- TLS verification must never be disabled in production code
- User-Agent header should identify the client: `rover/{version}`

### Credential Storage
- Tokens stored at `~/.config/rover/credentials.json` with `0600` permissions
- Never write credentials to stdout, logs, or temp files with relaxed permissions
- Credential path derived from `os.UserConfigDir()` — respects XDG on Linux, Library on macOS
- Token refresh tokens are long-lived secrets — treat with same care as passwords

### GCS & Release Infrastructure
- Release artifacts uploaded to `gs://hardshell-rover-releases/{version}/`
- GoReleaser handles cross-compilation and checksums — review `.goreleaser.yml` changes carefully
- Install script (`scripts/install.sh`) downloads over HTTPS from GCS — verify URL construction
- Version file (`version.txt`) used for update checks — must be atomically written

### IAP-Specific Patterns
- `transport.NewIAPTransport(audience, serviceAccount)` — both params must come from config, not hardcoded
- IAP transport is optional (falls back gracefully for non-IAP environments)
- Service account for impersonation: the rover SA needs `roles/iam.serviceAccountTokenCreator` on itself
- IAP audience format: `/projects/{number}/global/backendServices/{id}` or the OAuth client ID

### Environment Configuration
- All config via environment variables (`ROVER_API_URL`, `ROVER_IAP_AUDIENCE`, `ROVER_IAP_SERVICE_ACCOUNT`)
- Sensible defaults for QA environment — production values set in deployment
- No config files checked into the repo that contain real project IDs, client IDs, or service accounts
- `iap_settings.yaml` and `iap_web_settings.yaml` in repo root — verify these don't contain secrets

### CI/CD (GitHub Actions)
- Workload Identity Provider for GCP auth — no service account key JSON
- GoReleaser runs on push to main only — verify concurrency controls
- `svu` for semantic versioning — review version bump logic
- Build matrix covers all target platforms

## Linter Checks
- `golangci-lint run` — must pass clean
- `go vet ./...` — must pass clean
- `go test ./...` — all tests must pass

## Severity Levels
- **blocker**: Must fix before merge (credential leaks, IAP misconfiguration, disabled TLS verification, open redirects, missing auth on endpoints, secrets in repo)
- **warning**: Should fix (missing timeouts, hardcoded config values, no error wrapping on GCP calls, missing User-Agent)
- **suggestion**: Nice to have (token caching improvements, retry policies, observability improvements)
