# Contributing to OwnJournal

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/ownjournal.git`
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env` and fill in your credentials
5. Start the dev server: `npm run dev`

## Making Changes

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run linting: `npm run lint`
4. Run tests: `npm run test -- --run`
5. Commit with a clear message describing the change
6. Push and open a Pull Request

## Code Guidelines

- **TypeScript** — All new code should be in TypeScript
- **Components** — Place feature components in `src/components/{feature}/`
- **Tests** — Co-locate tests in `__tests__/` subdirectories alongside the code
- **i18n** — All user-facing strings must use `t()` from react-i18next
- **shadcn/ui** — Do not edit files in `src/components/ui/` manually; use the shadcn CLI to add new primitives
- **No secrets** — Never commit API keys, tokens, or credentials

## Pull Requests

- Keep PRs focused on a single change
- Include a clear description of what and why
- Make sure CI passes (lint + tests + build)

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/platform info

## Security Vulnerabilities

If you find a security vulnerability, please report it privately via GitHub's security advisory feature rather than opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
