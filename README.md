# QuickNotes System Design

## Description

QuickNotes is a practice project that demonstrates how a browser-based notes interface can communicate with an HTTP API and how a production notes service could be designed for growth. The client uses the JSONPlaceholder practice API for GET, POST, and DELETE requests. JSONPlaceholder simulates mutations; created or deleted notes are not permanently stored by that service.

The `docs/` directory contains the proposed real backend API design, relational data model, and scalable service architecture.

## Features

- Load up to 10 sample posts from JSONPlaceholder.
- Create a note with a required title of no more than 100 characters.
- Delete a note from the current page.
- Display loading, success, error, and empty states.
- Disable action buttons while requests are in progress.
- Render user-provided text with `textContent` rather than injecting HTML.

## How to run the API client

1. Clone or download this repository.
2. Open `index.html` in a modern browser, or serve the directory with a local static web server.
3. For example, if Python 3 is installed, run this command from the repository root:

   ```bash
   python3 -m http.server 8000
   ```

4. Open `http://localhost:8000` in your browser.
5. Select **Load notes** to fetch sample posts, fill in the form to create a simulated note, or use a note's **Delete** button.

An internet connection is required to access JSONPlaceholder. The practice API does not permanently persist POST or DELETE changes, so a created or deleted note may reappear or disappear differently after reloading the page.

## Design documents

- [API design](docs/api-design.md) — endpoints, JSON examples, status codes, and API conventions.
- [Data model](docs/data-model.md) — entities, relationships, table definitions, queries, and indexes.
- [Architecture](docs/architecture.md) — requirements assumptions, load estimates, component diagram, request flows, trade-offs, and resilience.

## What I learned

- How to use `fetch()` with reusable asynchronous request handling, HTTP status checks, and `try`/`catch`/`finally`.
- Why input validation, safe DOM rendering with `textContent`, and clear loading/success/error messages improve client safety and usability.
- How relational primary keys, foreign keys, constraints, and join tables represent data and protect integrity.
- How a CDN, load balancer, cache, read replica, queue, and workers separate responsibilities and support growth.
- Why caching, replicas, and asynchronous processing introduce trade-offs such as stale reads, replication lag, and delayed background work.

## Scope and limitations

This repository is a front-end API-client exercise plus system-design documentation. It does not include a production backend, authentication service, real database, Redis deployment, or queue implementation. The architecture and API documents describe a recommended future system, not services deployed by this demo.
