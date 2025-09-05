# Publishing to npm

Short answer: probably not yet. Here’s how to get set up to publish and verify everything end-to-end.

## Check Setup

- `npm -v`: confirm npm is installed.
- `npm whoami`: confirms you’re logged in; errors if not.
- `npm config get registry`: should be `https://registry.npmjs.org/` for public publish.

## Create/Configure Account

- `npm login`: create or sign in (prompts for username, password, email).
- 2FA: enable in your npm account settings (recommended: “Auth & Publish”).
  - With 2FA “Auth & Publish”, `npm publish` prompts for an OTP each time.

## Reserve/Verify Package Name

- `npm view cc-viz name version`: if it prints data, the name is taken; if it errors “not found”, it’s available.
- If taken, use a scoped name: `@your-scope/cc-viz` and publish with `--access public`.

## Pre-Publish Sanity

- `pnpm install` (dev deps for the build).
- `npm pack` (already wired to build via `prepack`; inspects what will be published).
- Optional dry run: `npm publish --dry-run` (shows files that would publish).

## Publish

- Unscoped (public by default):
  - `npm publish --access public`
- Scoped (public):
  - `npm publish --access public`
- Pre-release flow:
  - `npm version prerelease --preid=beta`
  - `npm publish --tag next`
  - Users can try: `npx cc-viz@next`

## Post-Publish Test

- `npx cc-viz@latest` (or `npx @your-scope/cc-viz@latest`)
- Optional: `PORT=4000 npx cc-viz@latest`

## Optional package.json Tweaks

- `publishConfig`: set default publish access (esp. for scoped packages).
  - Example:
    ```json
    {
      "publishConfig": { "access": "public" }
    }
    ```
- Metadata (helps on npmjs.com):
  - `repository`, `homepage`, `bugs`, `author`, `license`

