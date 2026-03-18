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

Releases are managed by maintainers. Version bumps follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## Questions?

- Check the [documentation](https://docs.dakota.xyz)
- Open a [discussion](https://github.com/dakota-xyz/dakota-ts-sdk/discussions)
- Contact: support@dakota.xyz

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
