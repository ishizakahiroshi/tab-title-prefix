# Changelog

## v0.2.0

- Added Chrome support with URL rule based title prefixes.
- Added URL rules for Firefox, combined after the existing container prefix.
- Added URL rule management in the options page: add, edit, delete, enable/disable, reorder, and pause all URL rules.
- Added prefix preview and clearer validation messages for URL match patterns.
- Added "use current tab" support for generating a URL rule pattern from the active tab.
- Migrated settings to schema v2 while preserving the v0.1.0 container prefix behavior.
- URL rules are now re-evaluated when a single-page app changes route.
- Renaming a container now updates the prefix in already-open tabs.
- Split extension manifests for Firefox and Chrome.
- Chrome now registers content scripts dynamically for granted URL rule hosts instead of requiring all-site host access at install time.
- Added a shared build script for Firefox xpi and Chrome zip packages.
- Updated extension icons and README screenshots with synthetic, non-service-specific examples.

## v0.1.0

- Initial Firefox release.
- Added automatic tab title prefixes based on Firefox Multi-Account Containers.
- Added options for enabling/disabling the extension and customizing the container prefix format.
- Preserved prefixes after single-page app title updates.
