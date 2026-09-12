# Marketplace Brother Package Label BETA

> THIS EXTENSION IS FOR BETA TESTING.

Version 2 prints through Brother b-PAC and the existing P-touch template. This preserves the 62 mm continuous roll and Automatic Length instead of forcing the job through the browser's fixed page sizes.

Required local components:

- Brother b-PAC Client Component 3.4 or later
- Brother b-PAC Extension for Brave/Chrome
- the bundled P-touch template installed by `installer/setup-windows.cmd`

The label dialog includes **Check printer setup**, which renders the populated template without sending a physical print. **Print one label** sends exactly one copy with automatic cutting.

An internal Chrome extension that reads the visible delivery information from Amazon Seller Central and Octopia/Cdiscount orders, or consumes an authenticated Shopify print handoff, then reproduces the existing 62 mm P-touch label through Brother b-PAC.

## Install

The recommended installation is the Chrome Web Store listing plus the matching
GitHub Release setup package. See [INSTALL.md](INSTALL.md) for the complete
Store and local-development instructions.

The Windows setup package installs the template at:

`C:\Users\Public\Documents\Chlabs\AmazonBrotherPackageLabel\address-62mm-bottom-code128.lbx`

After installation, open an Amazon Seller Central or Octopia order-detail page, refresh it
once, and click **Print package label** near the order heading.

The extension requests access only to Amazon.fr order-detail pages and the exact Chlabs Shopify print-handoff route. Shopify customer data is encrypted by the backend, available for two minutes and consumed exactly once; the browser extension does not retain it. The profile-local sender QR value never leaves the computer.

See [PRIVACY.md](PRIVACY.md) for the complete privacy policy and permission
explanations used by the Chrome Web Store listing.

## First print

In Chrome print preview select:

- Printer: Brother QL-700
- Media: 62 mm continuous roll
- Scale: 100%
- Margins: none
- Headers and footers: off
- Label length: calculated automatically from the content

Chrome normally remembers the last printer settings.

Version 2.0.18 automatically selects an online replacement printer with the
same Brother model, recovers when Seller Central replaces the b-PAC page
bridge, and ignores navigation labels such as `Menu` when reading the Amazon
account name.

Version 2.0.19 adds Shopify order printing through a separated frontend/API/local-extension architecture. The Shopify app reviews the destination, telephone, order creation date, account, four-character model shortcut, quantity and Code 128 order number. The extension consumes only a two-minute, single-use handoff and keeps all Brother settings and sender QR data local to the Brave profile.

Version 1.0.3 compensates for the QL-700 driver's print-preview scaling so the
label fills the 62 × 90 mm page while Chrome remains set to 100%.

Version 1.1.0 removes the printed frame and derives the two-line local mark from
the Seller Central account and product model (for example, `cheaply.es` -> `ch`
and `WD19DCS` / `WD19S DCS` -> `dcs`). The value remains editable before print.

Version 1.2.0 prints the full normalized account name and a clearer product mark.

Version 2.0.17 is the Store beta build. It aligns the sender QR code to the top edge and keeps the
account/model shortcut directly below it without overlap.

Version 2.0.15 uses the user's P-touch layout with a standard horizontal Code 128
barcode across the bottom edge and the Amazon order number printed beneath it.

Version 2.0.13 recognizes Amazon's `Purchase date`/`Date d'achat` fields and
abbreviated month names such as `Aug` and `févr.`.

Version 2.0.12 adds the Amazon order number as a human-readable vertical Code 128
barcode in a dedicated 30 × 7.5 mm strip on the far-left side. The printed date is
taken from the Amazon order date instead of the print date.

Version 2.0.11 uses the first four model characters and appends the item count
for multi-quantity orders (`Lenovo 40AF0135EU`, quantity 5 -> `lenovo 40af x5`).
Single-unit orders do not show `x1`. The value remains editable before printing.

Version 1.2.1 constrains the enlarged, rotated artwork to one fixed 62 × 90 mm
print viewport, preventing element displacement and accidental second pages.

Version 1.3.0 removes page-level scaling and rotation. Print elements are placed
directly in the QL-700's portrait 62 × 90 mm coordinates, eliminating clipping,
overlap, and transform-driven extra pages.

Version 1.4.0 keeps the roll width at 62 mm and calculates each page's length
from its content. Long destination lines extend the label instead of being
shrunk or clipped, while short labels stop after the final fixed element.

## Settings

Click the extension toolbar icon to change the default QR content, channel mark, or automatic print-preview behavior.

## Development and release

```sh
npm test
npm run build
```

GitHub Actions validates every change and attaches local-install and Chrome Web
Store ZIP files to version tags. Chrome Web Store API v2 publishing uses
keyless Google Workload Identity Federation. See
[docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md).

The Store listing assets, privacy declarations, and production item ID are
versioned in [store-assets/README.md](store-assets/README.md).

### Safe Git publishing on Windows

Native Windows Codex sandboxes can make Git for Windows' HTTPS helper crash while Schannel or Git Credential Manager tries to use credentials from the isolated sandbox account. Do not run remote Git commands directly from that environment.

Use the fail-closed wrapper instead:

```powershell
node scripts/git-remote-safe.mjs diagnose --json
node scripts/git-remote-safe.mjs fetch --ref main
node scripts/git-remote-safe.mjs pull --branch main
node scripts/git-remote-safe.mjs push --refspec HEAD:refs/heads/main
```

The wrapper accepts only credential-free `https://github.com/<owner>/<repo>` remotes, rejects unsafe refs, bypasses persistent credential helpers, uses an ephemeral GitHub CLI token through a temporary askpass file, forces OpenSSL for only the child Git process, disables interactive prompts, removes only the known Codex loopback blackhole proxy, enforces a timeout, and cleans up in `finally`. Tokens are never placed in Git arguments, repository configuration, or source files. Read-only operations may retry twice; push and pull never retry automatically because their outcome can be ambiguous. See [docs/SAFE_GIT_PUBLISHING.md](docs/SAFE_GIT_PUBLISHING.md) for the failure matrix and incident procedure.

## Notes

- Amazon sometimes masks delivery details after an order is shipped. The preview makes missing lines editable before printing.
- The logo was extracted from the user's existing `address 62mm with date.lbx` template.
- QR generation is local and uses `qrcode-generator` 1.4.4 (MIT), bundled in the extension. No customer or sender data is sent to a QR service.
- The repository contains no default sender address or phone number. Each browser profile keeps its own optional QR sender text in local extension storage.
