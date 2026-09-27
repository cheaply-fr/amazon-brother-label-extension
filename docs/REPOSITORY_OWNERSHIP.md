# Repository ownership

The canonical home for this repository is:

`https://github.com/cheaply-fr/amazon-brother-label-extension`

The previous `faresd/` location is legacy and must not be used for links,
status checks, release automation, deployment integrations, or trust policies.
The application does not contain production secrets, and this migration does
not require rotating credentials or invalidating sessions.

## Local safeguards

- `origin` is configured for the `cheaply-fr` repository.
- `scripts/git-remote-safe.mjs` accepts only the `cheaply-fr` owner.
- CI, packaging, and the 50-test suite remain unchanged functionally.
- Store/support/privacy links point to `cheaply-fr`.

## GitHub-side checklist

An organization administrator must verify these items in the `cheaply-fr`
organization because they cannot be safely changed from this local checkout:

1. The repository exists at the canonical URL and the default branch is
   `main`; preserve its Actions history and release artifacts if the repository
   was transferred rather than recreated.
2. Re-create or verify `production` environment reviewers, branch protection,
   required checks, and any CODEOWNERS file in the transferred repository.
3. Update the Google Cloud Workload Identity provider condition to
   `assertion.repository == 'cheaply-fr/amazon-brother-label-extension'`.
4. Copy the existing non-secret repository/environment variables
   (`GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
   `GCP_CWS_SERVICE_ACCOUNT`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`,
   `CWS_UPLOAD_ENABLED`, and `CWS_SUBMIT_FOR_REVIEW`) to the new repository.
   Do not print, rotate, or replace secret values as part of this migration.
5. If the Chrome Web Store bridge is in a separate repository, update its
   download URL, release-status links, workflow repository allow-list, and
   Google/Cloudflare deployment integration to the `cheaply-fr` path.
6. Update any Cloudflare Pages/Workers, webhook, or GitHub App installation
   that still references `faresd/amazon-brother-label-extension`; keep the
   existing domain, secrets, and sessions intact.

After those changes, run the tagged release workflow and confirm the GitHub
Release, Store upload, and deployment checks link to the canonical repository.
