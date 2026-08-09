# SPDX-License-Identifier: MIT
# Top-level Makefile for STJÓRNA.
# Discoverable entry points for the helm chart test rig.

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c

HELM_CHART     := helm/stjorna
KIND_CLUSTER   := stjorna-test
SCRIPTS_DIR    := scripts
TAG            ?= v3.0.0-rc1
REPO_OWNER     ?= secanis
PB_IMAGE       := docker.io/$(REPO_OWNER)/stjorna-pocketbase
FE_IMAGE       := docker.io/$(REPO_OWNER)/stjorna-frontend

.DEFAULT_GOAL := help

.PHONY: help test-helm build-images lint-helm keep-kind clean-kind site-serve

# Note: the 'gh-pages' site lives in site/ and is published by the
# 'publish-site' job in .github/workflows/release.yml. The old v2
# Jekyll-based 'github-pages' Ruby gem that read a docs/ directory
# was removed in the v3 rewrite and no longer exists in this repo.
# If you see 'No such file or directory @ dir_chdir0 - .../docs',
# it's coming from a local alias or stale venv — see site/README.md
# for the current build path.

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Targets:\n"} \
		/^[a-zA-Z_-]+:.*?##/ \
		{ printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)

build-images: ## Build PocketBase and frontend images locally (podman build)
	@TAG=$(TAG) PB_IMAGE=$(PB_IMAGE) FE_IMAGE=$(FE_IMAGE) $(SCRIPTS_DIR)/test-helm.sh --build-only

lint-helm: ## helm lint + helm template render check
	@$(SCRIPTS_DIR)/test-helm.sh --lint-only

test-helm: ## Full end-to-end test: build images, kind cluster, install chart, smoke test
	@TAG=$(TAG) PB_IMAGE=$(PB_IMAGE) FE_IMAGE=$(FE_IMAGE) $(SCRIPTS_DIR)/test-helm.sh

keep-kind: ## Run the full test but keep the kind cluster for debugging
	@TAG=$(TAG) PB_IMAGE=$(PB_IMAGE) FE_IMAGE=$(FE_IMAGE) $(SCRIPTS_DIR)/test-helm.sh --keep-kind

clean-kind: ## Delete the test kind cluster if it still exists
	-kind delete cluster --name $(KIND_CLUSTER)

site-serve: ## Serve site/ locally for development (no Jekyll, no Ruby)
	@echo "Serving site/ at http://localhost:8080"
	@echo "(Ctrl-C to stop. The Swagger UI will load ./openapi.json from disk.)"
	@python3 -m http.server 8080 --directory site
