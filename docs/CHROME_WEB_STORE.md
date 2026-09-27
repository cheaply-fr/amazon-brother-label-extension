# Chrome Web Store automation

Tagged releases build two deterministic ZIP files and publish a GitHub Release. The bridge repository's exact trusted publisher workflow downloads and validates the immutable Store ZIP, then uploads it with Chrome Web Store API v2. This keeps Store credentials and publishing trust in one audited workflow.

## One-time Google/Chrome setup

1. Create or select a Google Cloud project and enable the Chrome Web Store API.
2. Create a service account and add its email in Chrome Web Store Developer Dashboard → Account. Chrome currently permits one service account per publisher.
3. Configure GitHub Actions Workload Identity Federation for keyless authentication to that service account.
4. Create the initial Chrome Web Store item manually, complete Store listing, Privacy, Distribution, and test instructions, then publish the first visibility configuration manually when required by Chrome.

The production Store item has been created with ID
`cjcpkepjaohailehapclenmiplfbckbp`, owned by the `cheaply.fr` publisher
(`834b08cc-f204-46e3-b7d0-d914b36c2504`). Reusable listing copy and the exact-size
artwork are kept in `store-assets/`.

## GitHub repository variables

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_CWS_SERVICE_ACCOUNT`
- `CWS_PUBLISHER_ID`
- `CWS_EXTENSION_ID`
- `CWS_UPLOAD_ENABLED=true`
- `CWS_SUBMIT_FOR_REVIEW=true` to submit automatically after upload

No long-lived Google key, OAuth client secret, or refresh token is stored in the repository. Protect the `production` GitHub environment and require reviewer approval if desired.

Before the first Store item exists, keep `CWS_UPLOAD_ENABLED=false` and run the
workflow manually with `auth_only=true`. This verifies the keyless Google trust
without uploading the package to another item. After Google assigns the new
item ID, set `CWS_EXTENSION_ID` and enable uploads.

If `google-github-actions/auth` reports `unauthorized_client` because the
credential is rejected by the provider's attribute condition, update the
Google Cloud Workload Identity provider condition to allow this repository:
`assertion.repository == 'cheaply-fr/amazon-brother-label-extension'` (or combine
it with the existing release-branch restriction). The account making that
change needs permission to read and update Workload Identity pool providers;
the GitHub deployment service account intentionally does not have that
administrative permission.

The production publisher currently authenticates Brother extension releases
through the bridge repository's approved Workload Identity trust. Its
`publish-label-extension.yml` workflow downloads the immutable Store ZIP from
this repository and publishes item `cjcpkepjaohailehapclenmiplfbckbp`. The
extension repository's direct uploader remains disabled until its own
repository claim is accepted by the Google provider.

## Canonical repository ownership

The canonical repository is
`https://github.com/cheaply-fr/amazon-brother-label-extension`. Keep the
`production` environment, repository variables, branch protections, CODEOWNERS,
release links, and Workload Identity repository condition attached to
`cheaply-fr/amazon-brother-label-extension`; do not recreate them under the
legacy `faresd` organization. The safe Git wrapper also rejects remotes outside
the `cheaply-fr` organization.

No Cloudflare integration is referenced by this extension repository. If a
future deployment adds one, authorize it against the `cheaply-fr` repository
and keep its tokens in the existing protected environment without rotating
production secrets.

## Release

Update `manifest.json` and `package.json` to the same version, merge to `main`, and push a matching tag such as `v2.0.18`. CI validates and packages the extension; the release workflow creates GitHub artifacts; the bridge publisher uses the immutable release ZIP.
