# Browser Extension

The FeedMe Chromium extension captures visual evidence on an approved workspace domain and sends a structured report to the dashboard.

## Install The Hosted Build

1. Download `feedme-extension.zip` from the dashboard or [`public/downloads/feedme-extension.zip`](../public/downloads/feedme-extension.zip).
2. Extract it to a stable folder.
3. Open `chrome://extensions` in Chrome, Edge, Brave, or another Chromium browser.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder.
6. Keep the folder in place while the extension is installed.

This manual flow is intended for the public demo and internal evaluation. Chrome Web Store distribution is not part of the current release.

## Capture Flow

1. Sign in to FeedMe.
2. Create or open a workspace and add the exact target hostname.
3. Open the target website.
4. Activate FeedMe and select the page or an element.
5. Add the title, description, type, and priority.
6. Submit the report.

The extension captures the visible evidence immediately, stores pending work locally, uploads screenshots directly to Cloudinary with a server-issued signature, and submits the final report. Retry and idempotency controls prevent a network retry from intentionally creating a duplicate report.

## Permissions And Trust

The packaged extension currently requests:

- `storage` and `unlimitedStorage` for the local-first pending queue;
- `tabs`, `activeTab`, and `scripting` for user-initiated capture;
- `alarms` for background retries;
- host access to the FeedMe dashboard, Cloudinary upload API, and local development origin.

FeedMe does not continuously record browsing. Capture begins through an explicit user action. Workspace domain checks decide where a report can be submitted.

## Self-Hosting Limitation

This repository contains the dashboard source and a prebuilt extension archive. It does not contain the extension source toolchain. The packaged archive targets `https://meefeed.vercel.app` and `http://localhost:3000`.

A self-hosted deployment on another origin needs a separately built extension with:

- the self-hosted dashboard origin;
- the matching Cloudinary upload origin;
- the intended manifest permissions;
- a versioned archive copied to `public/downloads/feedme-extension.zip`.

Do not patch minified bundle strings as a release process. Rebuild from extension source and review the resulting `manifest.json`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Workspace is missing | Confirm the dashboard session and active membership |
| Domain is not available | Add the exact hostname to the intended workspace |
| Screenshot upload fails | Verify all three Cloudinary variables and folder configuration |
| Report stays pending | Keep the browser open long enough for retry; inspect the extension service worker |
| Dashboard request is rejected | Confirm the packaged extension targets the same dashboard origin |
| Duplicate-looking report | Compare report ids and the extension queue id before retrying manually |
