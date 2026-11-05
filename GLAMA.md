# Glama release (notifycx-mcp)

Glama listing: [notifycx/notifycx on Glama](https://glama.ai/mcp/servers/notifycx/notifycx).

This repo ships a checked-in [`mcp/Dockerfile`](./mcp/Dockerfile) that builds and runs the stdio MCP server (`node dist/index.js`). **`NOTIFY_API_KEY` is not in the image** — set it only in Glama deployment env (or leave unset for bootstrap-only introspection).

## One-time setup

1. Install the [Glama GitHub App](https://glama.ai/mcp/hosting) on the `notifycx` organization if it is not already connected.
2. Merge the PR that adds `glama.json`, `mcp/Dockerfile`, and this file.
3. On the server page, run **Sync Server** so Glama picks up the latest default-branch commit.

## Claim ownership (org repo)

Because this repository is under the `notifycx` organization, maintainers must claim via [`glama.json`](./glama.json) (not GitHub login alone):

1. Open the server’s **Score** tab on Glama.
2. Complete **Claim ownership** while logged in as a GitHub user listed in `glama.json` (`sunil-sandhu`).
3. If claim fails, re-sync and confirm `glama.json` on the default branch lists your exact GitHub username with valid JSON.

## Configure build and deploy

1. Open **Admin → Dockerfile** (or equivalent build settings) for this server.
2. Point the build at the repository Dockerfile **`mcp/Dockerfile`** (build context: `mcp/` directory).
3. **CMD** should match the image: `node`, `dist/index.js` (already set in the Dockerfile).
4. Under environment variables, add **`NOTIFY_API_KEY`** for production-hosted runs (encrypted at rest in Glama). Optional: **`NOTIFY_BASE_URL`** if testing against a non-default API base.
5. Run **Deploy** / build test. Glama boots the server and runs MCP introspection over stdio.

## Publish a release

When the build test passes:

1. Choose **Make Release** (or **Publish release** in the admin UI).
2. Enter a version label (for example the current `notifycx-mcp` npm version in [`mcp/package.json`](./mcp/package.json); this repo does not require bumping package version for Glama).
3. Confirm publish. The listing should then show a deployable release (unblocks downstream checks such as [awesome-mcp-servers #18582](https://github.com/punkpeye/awesome-mcp-servers/pull/18582)).

## Local smoke test (optional)

From the repo root:

```bash
cd mcp
docker build -t notifycx-mcp .
docker run --rm -i -e NOTIFY_API_KEY=nk_your_key notifycx-mcp
```

The process speaks MCP over stdin/stdout; interrupt when done.
