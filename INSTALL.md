# Installation

## Recommended: Chrome Web Store

1. Install **Marketplace Brother Package Label BETA** from its private Chrome Web Store testing listing.
2. Install Brother's official **b-PAC Client Component 3.4+** and **Brother b-PAC Extension**.
3. Download the matching `local.zip` release from GitHub, extract it, and run `installer/setup-windows.cmd` once. This installs the P-touch template in the stable public Windows location used by the extension.
4. Load a 62 mm continuous roll in the Brother QL-700, open an Amazon Seller Central or Octopia order, and use **Print package label**.

## Local/developer install

1. Download and extract the matching `local.zip` GitHub Release.
2. Run `installer/setup-windows.cmd`.
3. Open `brave://extensions` or `chrome://extensions`.
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
5. Refresh the Amazon Seller Central or Octopia order page.

The extension stores its settings only in the browser profile. Sender QR data is intentionally blank until the user configures it.
