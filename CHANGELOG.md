# Changelog

All notable changes to this project will be documented in this file.

## v0.1.0 — Phase 1: Firefox container-based prefix

- Automatically prefixes tab titles with the Multi-Account Containers container name
- Keeps the prefix across SPA route changes via a `MutationObserver`
- Options page: ON/OFF toggle and customizable prefix format
- Localized UI (English / Japanese) via `browser.i18n`
- Firefox only (Chrome + manual URL rules planned for Phase 2)
