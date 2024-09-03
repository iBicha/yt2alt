# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.2] - 2024-09-02

### Changed

- Updated YouTube.js

## [0.7.1] - 2024-07-26

### Fixed

- Updated YouTube.js to 10.2.0 which fixes a couple of parse errors

## [0.7.0] - 2024-07-23

### Added

- Dump the request/response data from [YouTube.js](https://github.com/LuanRT/YouTube.js) to `yt2alt-debug.log` when `--debug` flag is used

### Fixed

- A bug when importing a podcast playlist

## [0.6.0] - 2024-07-12

### Added

- `--cache` and `--debug` flags.
  - `--cache`: Reuse login if token is cached.
  - `--debug`: Add debug logging, mostly from [YouTube.js](https://github.com/LuanRT/YouTube.js)
  - Usage: `npx yt2alt -- --cache --debug`

## [0.5.0] - 2024-06-16

### Changed

- Updated YouTube.js to v10
- `Watch Later` and `Liked videos` are removed from "standard" items, as they are considered playlists, and end up being duplicates

## [0.4.7] - 2024-04-29

### Fixed

- `InnertubeError: ChipBarView not found` error
- Few small fixes

## [0.4.6] - 2024-04-14

### Fixed

- Ensure session creation before fetching data

## [0.4.5] - 2024-04-13

### Fixed

- A bug with reading the user library

## [0.4.4] - 2024-03-24

### Fixed

- Update YouTube.js, which fixes an issue with reading the library

## [0.4.3] - 2024-01-26

### Fixed

- Update YouTube.js, which fixes an issue with Playlists
- Fix bug introduced in 0.4.0 in Invidious and Piped

## [0.4.0] - 2024-01-24

### Added

- Support for FreeTube (Subscriptions and History only)
- Support for ViewTube (Subscriptions only)

## [0.3.3] - 2024-01-16

### Added

- Support for NewPipe (Subscriptions only)

## [0.3.0] - 2024-01-16

### Added

- Support for Piped

## [0.2.0] - 2024-01-13

### Added

- Support for importing to Invidious using API

## [0.1.2] - 2024-01-09

### Changed

- Upgrade dependencies: youtubei.js

## [0.1.1] - 2023-12-23

Initial version

<!-- markdownlint-configure-file {"MD024": { "siblings_only": true } } -->
