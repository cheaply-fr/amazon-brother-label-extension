# Security and privacy

- The extension is limited to official Amazon Seller Central domains and requests only Chrome `storage` permission.
- It does not use a backend, analytics, telemetry, or remote executable code.
- Buyer and recipient data is read from the visible signed-in order page and sent only to the locally installed Brother b-PAC component for the user-requested print.
- Sender QR text is optional, has no repository default, and is stored only in the browser profile.
- Chrome Web Store publishing uses short-lived, keyless workload-identity tokens. Do not add Google keys, OAuth refresh tokens, GitHub tokens, printer credentials, addresses, phone numbers, or order data to this repository.

Report security issues privately to the repository owner instead of opening a public issue containing customer or credential data.
