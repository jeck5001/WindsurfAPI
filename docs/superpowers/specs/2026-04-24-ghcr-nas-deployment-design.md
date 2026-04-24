# GHCR NAS Deployment Design

**Date:** 2026-04-24

## Goal

Add a deployment path that publishes this project as a versioned multi-architecture container image to GitHub Container Registry (`GHCR`) from the user's fork, then runs that published image on a NAS with `docker compose` instead of building from source on the NAS.

## Current State

- The repository already contains a production-ready [Dockerfile](/Users/jfwang/IdeaProjects/CascadeProjects/WindsurfAPI/Dockerfile).
- The existing [docker-compose.yml](/Users/jfwang/IdeaProjects/CascadeProjects/WindsurfAPI/docker-compose.yml) is optimized for local source builds using `build:` and an `nginx` sidecar, not for pulling a published image from a registry.
- There is no GitHub Actions workflow that builds and publishes container images.
- There is no NAS-oriented compose file or deployment documentation for `GHCR`.

## Requirements

1. Preserve the current local source-build workflow for contributors.
2. Add a GitHub Actions workflow that can publish images from the user's fork to `ghcr.io/<owner>/<image>`.
3. Build and publish both `linux/amd64` and `linux/arm64` images so the setup works for common NAS platforms.
4. Provide a dedicated compose file for NAS deployments that pulls a published image instead of building locally.
5. Keep runtime configuration externalized through `.env` and mounted volumes so upgrades only require pulling a new image and recreating containers.
6. Document the exact fork, package visibility, GitHub Actions, and NAS deployment steps.

## Non-Goals

- Reworking the application runtime model.
- Replacing `docker compose` with Kubernetes, Portainer templates, or Synology/QNAP specific UI automation.
- Introducing a separate release pipeline outside GitHub Actions.
- Changing the existing local development compose flow unless required for clarity or compatibility.

## Chosen Approach

Use a split deployment model:

- Keep the current [docker-compose.yml](/Users/jfwang/IdeaProjects/CascadeProjects/WindsurfAPI/docker-compose.yml) for local source-based builds.
- Add a new NAS-focused compose file that references a published `GHCR` image with configurable image name and tag.
- Add a GitHub Actions workflow that logs in to `GHCR`, builds the existing Dockerfile with Buildx, publishes multi-arch images, and applies predictable tags.

This keeps local contributors on the simplest loop while giving the user a stable registry-backed deployment artifact for the NAS.

## Registry and Tagging Design

### Registry

- Registry target: `ghcr.io`
- Default image path pattern: `ghcr.io/${{ github.repository_owner }}/windsurf-api`

### Tags

The workflow should publish:

- `latest` from the default branch
- branch-scoped tags for non-default branches when useful for testing
- semver tags when the repository is tagged with a release version
- immutable commit SHA tags

This gives the NAS two stable deployment strategies:

- production tracks `latest`
- pinned deployments track an explicit version or commit SHA

## GitHub Actions Design

### Workflow triggers

- push to the default branch
- tag pushes matching release versions
- optional manual dispatch for rebuilds

### Workflow behavior

1. Check out the repository.
2. Set up QEMU for cross-platform builds.
3. Set up Docker Buildx.
4. Log in to `GHCR` using the built-in `GITHUB_TOKEN`.
5. Generate Docker metadata and tags.
6. Build and push `linux/amd64` and `linux/arm64` images from the root [Dockerfile](/Users/jfwang/IdeaProjects/CascadeProjects/WindsurfAPI/Dockerfile).
7. Publish OCI labels for source repo and revision traceability.

### Permissions

The workflow must explicitly request:

- `contents: read`
- `packages: write`

No long-lived personal access token should be required for publishing from the fork to that fork's `GHCR` package.

## NAS Compose Design

Add a new compose file dedicated to registry-backed deployment.

### Service model

- `windsurf-api` service uses `image:` instead of `build:`
- `nginx` service remains if load balancing multiple replicas is still desired on NAS
- image tag and image path are configurable via environment variables

### Configuration

The NAS compose file should support:

- `IMAGE_NAME=ghcr.io/<owner>/windsurf-api`
- `IMAGE_TAG=latest`
- `PORT`
- `API_KEY`
- `DASHBOARD_PASSWORD`
- `DATA_DIR` related runtime paths through mounted volumes

### Volumes

The NAS deployment keeps the current persistent directories conceptually unchanged:

- app state under `/data`
- Windsurf LS assets under `/opt/windsurf`
- temp workspace under `/tmp/windsurf-workspace`

The compose example should use host paths that are easy to rewrite for NAS storage locations.

### Pulling private images

If the package remains private, the docs must include `docker login ghcr.io` on the NAS using a GitHub token with package read permission.

If the package is public, the docs should state that no registry login is required for pulls.

## Documentation Design

Update the main README deployment section to separate:

- local Docker build flow
- GHCR publishing flow
- NAS deployment flow

Add concise instructions covering:

1. Fork the upstream repo to the user's GitHub account.
2. Enable GitHub Actions on the fork.
3. Confirm package visibility and workflow permissions.
4. Wait for the image to appear in `GHCR`.
5. Copy the NAS compose example and `.env` example to the NAS.
6. Run `docker compose pull` and `docker compose up -d`.
7. Upgrade later via `docker compose pull && docker compose up -d`.

## Files Expected To Change

- Create `.github/workflows/docker-publish.yml`
- Create a dedicated NAS compose file, likely `docker-compose.ghcr.yml`
- Create or update an env example for NAS deployment if the current one is insufficient
- Update [README.md](/Users/jfwang/IdeaProjects/CascadeProjects/WindsurfAPI/README.md)
- Optionally update [README.en.md](/Users/jfwang/IdeaProjects/CascadeProjects/WindsurfAPI/README.en.md) if the repository keeps deployment docs in both languages

## Error Handling and Operational Notes

- The workflow should fail fast on push/build/auth errors.
- NAS docs should call out that first startup may still need the Windsurf language server binary download if it is not pre-mounted.
- The deployment docs should explain how to override the image tag for rollback.
- The compose file should avoid hidden rebuild behavior so the NAS never depends on local source code.

## Testing Strategy

Before considering the change complete:

1. Run the existing test suite to ensure runtime code was not regressed.
2. Validate the new compose file with `docker compose -f <file> config`.
3. Validate the GitHub Actions workflow syntax with a local YAML sanity check if available.
4. Confirm the image reference and env interpolation render correctly in the compose output.

## Open Decisions Resolved

- Registry choice: `GHCR`
- Deployment style: dedicated NAS compose file, not replacing the local compose file
- Architecture support: `linux/amd64` and `linux/arm64`

## Implementation Boundary

This design covers publishing and deployment plumbing only. It does not automate the fork itself, does not create the GitHub repository on the user's behalf, and does not push to the user's remote unless the user explicitly requests git remote or publishing operations.
