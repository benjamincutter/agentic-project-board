-- Rover CLI dataset + reviewer profiles
INSERT INTO datasets (name, repo_path, description) VALUES (
  'Rover CLI',
  '~/hardshell/rover',
  'Go CLI for local dataset preprocessing — browser auth, IAP transport, GCP integrations'
);

INSERT INTO agent_profiles (name, agent_type, content) VALUES (
  'rover-cli',
  'reviewer',
  '# Rover CLI — Code Review Profile

## Repo
~/hardshell/rover

## Standards

### Go Idioms
- Follow Effective Go and the Go Code Review Comments wiki
- Errors are values — handle every error, don''t discard with `_`
- Return `error` as the last return value, wrap with `fmt.Errorf("context: %w", err)` for stack context
- Use `errors.Is()` / `errors.As()` for error checking, never string comparison
- Prefer returning early over deep nesting (guard clauses)
- Unexported by default — only export what the package''s consumers need
- Use struct literals with field names: `Foo{Bar: 1}`, never positional `Foo{1}`

### Naming
- Package names: short, lowercase, no underscores — `auth`, `config`, `transport`
- Interfaces: single-method → `-er` suffix (`Reader`, `TokenSource`); describe behavior not data
- Avoid stuttering: `auth.Login` not `auth.AuthLogin`
- Acronyms keep consistent case: `APIURL` or `apiURL`, never `ApiUrl`
- Test helpers start with `setup` or `new` (e.g. `newTestServer`, `setupCredentials`)

### CLI Patterns (This Project)
- Hand-rolled arg parsing via `os.Args` switch — keep it simple, no framework bloat
- Config loaded from environment via `config.Load()` — all settings from env vars
- Commands go in `cmd/rover/main.go` — helper funcs like `runLogin()` stay in main package
- User-facing output via `fmt.Println` / `fmt.Fprintf(os.Stderr, ...)` for errors
- Fatal errors: `log.Fatal` or `log.Fatalf` — no panics
- Version injected at build time via `-ldflags "-X main.version=..."`

### Package Structure
- `internal/` packages are not importable outside the module — keep it that way
- `internal/auth/` — browser OAuth2 flow, credential storage, callback server
- `internal/transport/` — HTTP round-tripper middleware (IAP)
- `internal/config/` — environment-based config loading
- New packages belong under `internal/` unless they''re meant as a library

### Error Handling & Security
- Never log tokens, secrets, or credentials — even at debug level
- Credential files written with `0600` permissions
- CSRF state tokens must be cryptographically random and validated on callback
- Timeout all network operations — no hanging on bad servers
- Validate redirect URLs and callback parameters before trusting them

### Testing
- Standard `testing` package — no testify, no third-party assertion libraries
- Table-driven tests where there are 3+ cases
- Mock external dependencies via interfaces (e.g. `mockTokenSource`, `mockRoundTripper`)
- Test files live next to source: `login.go` → `login_test.go`
- Async tests use channels and `time.After` for timeout — no `time.Sleep`
- New exported functions must have test coverage

### Cross-Platform
- Browser opening: `open` (macOS), `xdg-open` (Linux), `cmd /c start` (Windows)
- File paths: use `os.UserConfigDir()` and `filepath.Join`, never hardcode separators
- Builds target: darwin/amd64, darwin/arm64, linux/amd64, linux/arm64, windows/amd64

## Linter Checks
- `golangci-lint run` — must pass clean (staticcheck enabled, all checks minus QF*)
- `go vet ./...` — must pass clean
- `go test ./...` — all tests must pass

## Severity Levels
- **blocker**: Must fix before merge (security holes, leaked credentials, unhandled errors, broken builds, failing tests/linters)
- **warning**: Should fix (missing tests for new functions, poor naming, DRY violations, missing error wrapping)
- **suggestion**: Nice to have (style, godoc improvements, minor refactors)'
);

INSERT INTO agent_profiles (name, agent_type, content) VALUES (
  'rover-cloud-architect',
  'reviewer',
  '# Rover CLI — Cloud Architect Review Profile

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
- Ephemeral port allocation (`localhost:0`) is correct — don''t hardcode ports
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
- `iap_settings.yaml` and `iap_web_settings.yaml` in repo root — verify these don''t contain secrets

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
- **suggestion**: Nice to have (token caching improvements, retry policies, observability improvements)'
);
