.PHONY: help install dev build test test-contracts lint lint-fix clean contracts-build contracts-test validate-env

# ──────────────────────────────────────────────────────────────────────────────
# HELP
# ──────────────────────────────────────────────────────────────────────────────

help:
	@echo "Ancore Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install              Install all dependencies"
	@echo "  make validate-env         Validate service health endpoints"
	@echo ""
	@echo "Development:"
	@echo "  make dev                  Start development servers (TBD)"
	@echo "  make build                Build all packages"
	@echo ""
	@echo "Testing:"
	@echo "  make test                 Run all tests"
	@echo "  make test-contracts       Run Soroban contract tests"
	@echo ""
	@echo "Linting:"
	@echo "  make lint                 Lint all code"
	@echo "  make lint-fix             Fix linting issues"
	@echo ""
	@echo "Contracts:"
	@echo "  make contracts-build      Build Soroban contracts"
	@echo "  make contracts-test       Run contract tests"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean                Remove build artifacts"

# ──────────────────────────────────────────────────────────────────────────────
# SETUP
# ──────────────────────────────────────────────────────────────────────────────

install:
	pnpm install

validate-env:
	@bash scripts/dev/validate-env.sh

# ──────────────────────────────────────────────────────────────────────────────
# DEVELOPMENT
# ──────────────────────────────────────────────────────────────────────────────

dev:
	@echo "Development server setup is in-progress"
	@echo "Start services individually:"
	@echo "  - Indexer: pnpm --filter @ancore/indexer dev"
	@echo "  - Relayer: pnpm --filter @ancore/relayer dev"
	@echo "  - AI Agent: pnpm --filter @ancore/ai-agent dev"

build:
	pnpm build

# ──────────────────────────────────────────────────────────────────────────────
# TESTING
# ──────────────────────────────────────────────────────────────────────────────

test:
	pnpm test

test-contracts:
	cd contracts && cargo test

# ──────────────────────────────────────────────────────────────────────────────
# LINTING
# ──────────────────────────────────────────────────────────────────────────────

lint:
	pnpm lint

lint-fix:
	pnpm lint -- --fix

# ──────────────────────────────────────────────────────────────────────────────
# CONTRACTS
# ──────────────────────────────────────────────────────────────────────────────

contracts-build:
	pnpm contracts:build

contracts-test:
	make test-contracts

# ──────────────────────────────────────────────────────────────────────────────
# CLEANUP
# ──────────────────────────────────────────────────────────────────────────────

clean:
	pnpm clean
	cd contracts && cargo clean || true
	find . -type d -name node_modules -prune -exec rm -rf {} \; 2>/dev/null || true
