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

.PHONY: help test-helm build-images lint-helm keep-kind clean-kind

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
