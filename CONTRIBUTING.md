# Contributing to Dakota TypeScript SDK

Thank you for your interest in contributing to the Dakota TypeScript SDK! We welcome contributions from the community.

## Code of Conduct

Please be respectful and constructive in all interactions. We expect all contributors to:

- Be welcoming and inclusive
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check existing [issues](https://github.com/dakota-xyz/dakota-ts-sdk/issues) to avoid duplicates
2. Update to the latest version to see if the issue persists

When submitting a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs **actual behavior**
- **Code samples** or minimal reproduction
- **Environment details**:
  ```bash
  npx envinfo --system --binaries --npmPackages
  ```

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:

- **Clear title** describing the enhancement
- **Detailed description** of the proposed feature
- **Use case** explaining why this would be useful
- **Alternative solutions** you've considered

### Pull Requests

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/dakota-ts-sdk.git
   cd dakota-ts-sdk
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** and add tests
6. **Run tests**:
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```
7. **Commit** with a descriptive message (see commit format below)
8. **Push** and create a Pull Request

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Commands

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Lint and format
npm run lint
npm run lint:fix

# Type check
npm run typecheck

# Regenerate types from OpenAPI spec
npm run generate
```

### Project Structure

```
src/
├── client/
│   ├── client.ts         # Main DakotaClient class
│   ├── transport.ts      # HTTP transport layer
│   ├── pagination.ts     # Async iterator for paginated responses
│   └── resources/        # API resource classes
├── webhook/
│   ├── handler.ts        # Webhook handler
│   └── signature.ts      # Ed25519 signature verification
└── generated/
    └── api.ts            # Generated from OpenAPI (don't edit)
```

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Follow existing patterns in the codebase
- Add TSDoc comments for public APIs
- Keep functions small and focused
- Prefer `async/await` over raw Promises

### Style

- Use ESLint and Prettier (run `npm run lint:fix`)
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line structures

### Testing

- Write tests for all new features and bug fixes
- Maintain or improve code coverage
- Use descriptive test names
- Mock external dependencies

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, or tooling

### Examples

```
feat(client): add retry logic for rate-limited requests
fix(webhook): handle missing timestamp header
docs(readme): add webhook setup instructions
test(transactions): add coverage for pagination
```

## Documentation

- Update README.md for user-facing changes
- Update AGENTS.md for API reference changes
- Add JSDoc comments for new public methods
- Include code examples where helpful

## Release Process

Version bumps follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Anyone with write access to this repository can cut a release. Only the
last step needs an npm maintainer of the package
(`npm owner ls @dakota-xyz/ts-sdk`).

1. **Open a release PR.** Run `npm version X.Y.Z --no-git-tag-version`
   (it bumps `package.json` and `package-lock.json`), and date the
   `[Unreleased]` section of `CHANGELOG.md` as `[X.Y.Z] - YYYY-MM-DD`.
   Merge it. Merging to `main` runs CI only. It publishes nothing.
2. **Publish a GitHub release** from `main`, with the tag `vX.Y.Z` (the exact
   `package.json` version):

   ```bash
   gh release create vX.Y.Z --target main --title "vX.Y.Z: <summary>" --notes-file notes.md
   ```

   A draft release does nothing until you publish it.
3. **CI stages the version on npm.** The *Publish Package* workflow checks
   that the tag matches `package.json`, is on `main` and is not on npm yet.
   Then it lints, type checks, tests, builds and runs `npm stage publish`.
   A staged version is not public.
4. **An npm maintainer approves it with 2FA.** On npmjs.com, open
   `@dakota-xyz/ts-sdk`, then the *Staged Packages* tab, then *Approve*. Or,
   with npm 11.15 or later:

   ```bash
   npm stage list @dakota-xyz/ts-sdk
   ```

   ```bash
   npm stage approve <stage-id>
   ```

5. **Check** that `npm view @dakota-xyz/ts-sdk dist-tags` shows the new
   version as `latest`. A version with a pre-release suffix (`3.5.0-beta.1`)
   goes to `next` instead.

Do not change the workflow back to `npm publish`. The npm token can only
stage, so npm refuses a direct publish with `E403 E_STAGE_REQUIRED`. That is
why 3.2.0 and 3.3.0 failed in CI.

**If staging fails**, fix the cause and stage the tag again from `main`:

```bash
gh workflow run publish.yml --ref main -f tag=vX.Y.Z
```

Do not use *Re-run* on the failed release run for a workflow fix. A release
run uses `publish.yml` as it is at the tagged commit, so a re-run does not
see changes merged after the tag. (A re-run does see a changed secret.)

## Questions?

- Check the [documentation](https://docs.dakota.xyz)
- Open a [discussion](https://github.com/dakota-xyz/dakota-ts-sdk/discussions)
- Contact: support@dakota.xyz

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
