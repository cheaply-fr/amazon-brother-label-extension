# Chrome Web Store listing

Permanent item ID: `cjcpkepjaohailehapclenmiplfbckbp`

Publisher: `cheaply.fr` (`834b08cc-f204-46e3-b7d0-d914b36c2504`)

## Product details

- Category: Workflow & Planning
- Language: English
- Homepage: `https://github.com/faresd/amazon-brother-label-extension`
- Support: `https://github.com/faresd/amazon-brother-label-extension/issues`

Description:

> Print 62 mm continuous-length package labels from Amazon Seller Central or
> the Chlabs Shopify order action using Brother b-PAC and an editable P-touch template.
>
> The extension reads the delivery address, Amazon order number, order date,
> account name, product model, and quantity visible on the current order page.
> It opens a preview where missing or masked values can be corrected before
> printing.
>
> Labels include a recipient block, sender QR code, account/model shortcut,
> order date, and a Code 128 barcode for the Amazon order number. The label
> length follows the content while preserving the 62 mm roll width.
>
> Requirements: Windows with Brother b-PAC Client Component, the Brother b-PAC
> browser extension, a compatible Brother QL printer with a 62 mm continuous
> roll, and the supplied P-touch template.
>
> Privacy: Amazon order data and sender QR information stay on the local
> computer. Shopify print data uses an encrypted two-minute, single-use Chlabs
> API handoff and is not retained after printing. QR generation runs locally.

## Assets

- `store-icon-128.png`: required 128 x 128 Store icon.
- `screenshot-1280x800.png`: required screenshot using fictional test data.
- `small-promo-440x280.png`: optional small promotional tile.

The generated artwork is original, contains no third-party logos, and does not
contain real customer, sender, or order information.

## Privacy declarations

Single purpose:

> Print an editable 62 mm package label from the current Amazon Seller Central
> order or a user-reviewed Chlabs Shopify order through the locally installed
> Brother b-PAC printing component.

Permission justification:

- `storage`: saves optional sender QR text and local label preferences in the
  browser profile.
- Official Amazon Seller Central `/orders-v3/order/*` URLs worldwide: read the visible order
  details required to populate the label on the user-selected order page.
- The exact Chlabs `/shopify/brother-print` route consumes a random, two-minute,
  single-use print handoff created by the authenticated Shopify app.

The extension does not sell data or use data for advertising or credit
purposes. Amazon order data and sender QR data are never transferred. Shopify
print data is encrypted by the Chlabs API and expires after two minutes. The
extension does not use remote code.

## Reviewer test instructions

No shared Amazon credentials are provided because the extension operates on
Amazon.fr Seller Central order pages through the reviewer's own authenticated
session. Testing the complete print flow requires Windows, Brother b-PAC Client
Component, the Brother b-PAC browser extension, a compatible Brother QL
printer, and a 62 mm continuous roll. Open an order detail page, click **Create
package label**, verify the preview, and print. The options page can be opened
without an Amazon login to inspect the local sender QR settings.
