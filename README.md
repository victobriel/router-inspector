# Router Inspector

A Chrome extension for automated data extraction from home routers, built for ISP technicians and network administrators.

## Overview

Router Inspector connects to your router's web interface, authenticates automatically, and extracts configuration data (PPPoE credentials, network settings, etc.) into a clean popup UI — with CSV export support.

## Features

- **Automated authentication** — fills and submits router login forms programmatically
- **Data extraction** — collects WAN configuration, PPPoE credentials, and network status
- **Retry logic** — handles post-login page redirects gracefully with configurable retry attempts
- **CSV export** — download collected data for reporting or record-keeping
- **Injected UI** — adds a "Get Data Automatically" button directly on the router's login page

## Supported Routers

| Model | Status |
|---|---|
| ZTE ZXHN H199A | ✅ Supported |

New router models can be added by implementing the `Router` abstract class and registering the driver in `RouterFactory`.

## Project Structure

```
src/
├── application/
│   ├── CollectionService.ts      # Orchestrates authentication and extraction
│   └── PopupController.ts        # Popup UI logic and message handling
├── domain/
│   ├── drivers/
│   │   └── ZteH199ADriver.ts     # ZTE H199A specific implementation
│   ├── models/
│   │   ├── Router.ts             # Abstract base class for all router drivers
│   │   └── RouterFactory.ts      # Auto-detects and instantiates the correct driver
│   └── schemas/
│       └── validation.ts         # Zod schemas and shared types
├── infra/
│   ├── background/
│   │   └── background.ts         # Service worker (handles openPopup messages)
│   └── dom/
│       ├── DomService.ts         # DOM utilities (get, update, click elements)
│       └── PopupView.ts          # Popup rendering helpers
└── presentation/
    ├── content/
    │   └── main.ts               # Content script entry point
    └── popup/
        ├── popup.html
        ├── popup.css
        └── popup.ts
```

## Prerequisites

- Node.js >= 18
- npm >= 6

## Installation

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

The compiled extension will be output to the `dist/` directory.

## Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. The Router Inspector icon will appear in your toolbar

## Usage

1. Navigate to your router's admin page (e.g. `http://192.168.1.1`)
2. Click the Router Inspector icon in the Chrome toolbar
3. Enter your router credentials (default username: `admin`)
4. Click **Collect Data**
5. Once data is collected, click **Export CSV** to download

Alternatively, use the **"Get Data Automatically"** button injected directly on the router's login page — it reads credentials from the login form fields and triggers collection automatically.

## Adding a New Router Driver

1. Create a new driver in `src/domain/drivers/` extending `Router`:

```typescript
export class MyRouterDriver extends Router {
  constructor() {
    super('My Router Model Name');
  }

  protected readonly loginSelectors = {
    username: '#username',
    password: '#password',
  };

  public async authenticate(credentials: Credentials): Promise<IResponse> { ... }
  public async extract(): Promise<ExtractionResult> { ... }
  public buttonElementConfig(): ButtonConfig | null { ... }
}
```

2. Register it in `RouterFactory.ts` by adding a detection condition based on page title or body text.

## Tech Stack

- **TypeScript** — strict mode, `nodenext` modules
- **esbuild** — fast bundling to IIFE format for Chrome
- **Zod v4** — runtime schema validation for all messages and extracted data
- **Chrome Extensions Manifest V3**

## License
