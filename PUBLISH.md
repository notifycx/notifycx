# Publishing notifycx + notifycx-mcp

Requires npm login (`npm login`).

```bash
# 1. SDK
cd /Users/sunilsandhu/Desktop/CODE/notifycx
npm test && npm run build
npm publish --access public

# 2. MCP (keep notifycx + notifycx-mcp on the SAME version, e.g. both 1.1.0)
cd mcp
# package.json should depend on "notifycx": "^1.1.0" (same major.minor.patch family)
npm install
npm run build
npm publish --access public
```
