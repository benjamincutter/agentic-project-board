# Rover CLI — Code Review Profile

## Repo
~/hardshell/rover

## Standards

### Go Idioms
- Follow Effective Go and the Go Code Review Comments wiki
- Errors are values — handle every error, don't discard with `_`
- Return `error` as the last return value, wrap with `fmt.Errorf("context: %w", err)` for stack context
- Use `errors.Is()` / `errors.As()` for error checking, never string comparison
- Prefer returning early over deep nesting (guard clauses)
- Unexported by default — only export what the package's consumers need
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
- New packages belong under `internal/` unless they're meant as a library

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
- **suggestion**: Nice to have (style, godoc improvements, minor refactors)
