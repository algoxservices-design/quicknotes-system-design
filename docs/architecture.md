# QuickNotes System Architecture

## 1. Scope and assumptions

QuickNotes is moving from a browser-only notes application to an online service. The following is an initial planning estimate, not a production capacity guarantee.

Assumptions for the estimate:

- 1,000,000 registered users.
- 10% are active on an average day: 100,000 daily active users.
- Each daily active user makes 50 note-list/feed reads and creates one note per day.
- The average stored note record, including its typical text and basic metadata, uses approximately 2 KB before indexes, replicas, and backups.
- A year has 365 days and 86,400 seconds per day.
- Peak reads are estimated at five times average reads; writes are shown as an average because no separate write-peak factor was supplied.
- The estimates exclude attachments and logs.

## 2. Load estimates for one million registered users

### Reads per second

Daily reads = 100,000 active users × 50 reads = 5,000,000 reads/day.

Average reads per second = 5,000,000 ÷ 86,400 = **57.9 reads/second**, approximately 58.

Estimated peak reads = 57.9 × 5 = **289.4 reads/second**, approximately 290.

### Writes per second

Daily writes = 100,000 active users × 1 note = 100,000 writes/day.

Average writes per second = 100,000 ÷ 86,400 = **1.16 writes/second**.

Actual traffic will be uneven, so the service should be load-tested above the average and peak estimates.

### Storage per year

Annual notes = 100,000 notes/day × 365 = 36,500,000 notes/year.

Estimated logical storage = 36,500,000 × 2 KB = 73,000,000 KB.

Using decimal units, this is approximately **73 GB/year** for note records alone. Indexes, database overhead, replicas, backups, and logs require additional capacity.

| Metric | Estimate |
|---|---:|
| Registered users | 1,000,000 |
| Daily active users (10%) | 100,000 |
| Reads per day | 5,000,000 |
| Average reads per second | 58 |
| Estimated peak reads per second (5×) | 290 |
| Writes per day | 100,000 |
| Average writes per second | 1.16 |
| Logical note storage per year | 73 GB |

QuickNotes is read-heavy under these assumptions because it performs about 50 reads per active user per day compared with one write. The design should therefore emphasize caching, efficient indexes, and a read replica, while routing writes to the primary database.

## 3. Architecture diagram

```text
                         ┌──────────────────────┐
                         │ Browser / Mobile App │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │ DNS                  │
                         │ Resolves service host│
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
              Static assets                   API requests
                     │                             │
              ┌──────▼──────┐              ┌───────▼────────┐
              │ CDN          │              │ Load Balancer  │
              │ HTML/CSS/JS  │              │ Health checks  │
              └──────────────┘              └───────┬────────┘
                                                    │
                                          ┌─────────┴─────────┐
                                          │                   │
                                    ┌─────▼─────┐       ┌─────▼─────┐
                                    │ App Server│       │ App Server│
                                    │     A     │       │     B     │
                                    └─────┬─────┘       └─────┬─────┘
                                          │                   │
                                          └─────────┬─────────┘
                                                    │
                                           ┌────────▼────────┐
                                           │ Redis Cache     │
                                           │ Cached note lists│
                                           └────────┬────────┘
                                                    │ cache miss
                                                    ▼
                                           ┌─────────────────┐
                              writes ──────►│ Primary Database│
                                           └────────┬────────┘
                                                    │ replication
                                                    ▼
                                           ┌─────────────────┐
                                           │ Read Replica    │
                                           └─────────────────┘

                    App servers enqueue slow/background work
                                    │
                                    ▼
                           ┌────────────────┐
                           │ Message Queue  │
                           └───────┬────────┘
                                   ▼
                           ┌────────────────┐
                           │ Background     │
                           │ Worker         │
                           └───────┬────────┘
                                   │
                       e.g. exports, reminders,
                       cleanup, notifications
```

## 4. Components and the problems they solve

1. **Client:** The browser or mobile application lets users read, create, update, and delete notes.
2. **DNS:** DNS maps the service's domain name to the correct public endpoint so clients do not need a fixed server IP.
3. **CDN:** The CDN delivers static HTML, CSS, and JavaScript from nearby edge locations, reducing latency and origin-server traffic.
4. **Load balancer:** The load balancer spreads API requests across healthy app servers and stops sending new traffic to unhealthy instances.
5. **App servers:** Multiple stateless app servers handle authentication, validation, business rules, and database/cache access while allowing horizontal scaling.
6. **Redis cache:** The cache serves frequently requested note lists quickly and reduces repeated read queries against the database.
7. **Primary database:** The primary database stores durable note and user records and accepts writes to preserve a single authoritative write path.
8. **Read replica:** The replica serves eligible read queries so feed/list traffic does not all compete with writes on the primary.
9. **Message queue:** The queue buffers background jobs so slow work does not hold up user-facing requests and can recover from temporary worker outages.
10. **Background worker:** The worker consumes queued jobs for work such as exports, reminders, notifications, and cleanup outside the main request path.
11. **Monitoring and alerting:** Metrics, logs, traces, and alerts reveal latency, error rates, cache misses, database pressure, and queue backlogs before they become prolonged outages.
12. **Rate limiting and timeouts:** Rate limits constrain abusive traffic, while timeouts bound how long a request can hold resources waiting for a dependency.

## 5. Flow of `GET /notes`

1. The client resolves the service domain through DNS and sends an HTTPS request to `GET /api/v1/notes`.
2. The load balancer selects a healthy app server based on health and load.
3. The app server authenticates the user, validates pagination parameters, and determines which user's notes may be returned.
4. The server checks Redis for the user's cached note list and relevant pagination key.
5. On a cache hit, the server returns the cached response quickly.
6. On a cache miss, the app server queries the read replica using the indexed `user_id` and `updated_at` columns.
7. The server places the result in Redis with a time-to-live (TTL), then returns the notes and pagination metadata to the client.
8. When a note changes, the application invalidates or updates the corresponding cache key so stale content is not served indefinitely.

For operations that require immediate read-after-write consistency, the service can read from the primary database rather than a potentially lagging replica.

## 6. Flow of `POST /notes`

1. The client sends `POST /api/v1/notes` with a JSON body containing the title and optional body, along with its authentication token.
2. The load balancer routes the request to a healthy app server.
3. The server authenticates the caller, validates the title, checks request-size limits, and applies rate limiting.
4. The app server inserts the note into the primary database using a parameterized query and obtains the new note ID.
5. After the write succeeds, the server invalidates the user's cached note list so later reads do not return stale data.
6. If secondary work is needed, such as sending a reminder or recording an export job, the server publishes a message to the queue rather than doing that work synchronously.
7. The server returns `201 Created` with the new note representation and a `Location` header.
8. The primary database replicates the committed change to the read replica; replication may take a short time, so immediate reads can use the primary when strict freshness is required.

The server should only return success after the note is durably written. If publishing an essential background event must be atomic with the note write, use a transactional outbox pattern rather than relying on two independent operations.

## 7. Trade-offs

### Cache speed versus data freshness

Caching reduces response time and database load, but cached lists may be briefly stale after a write. QuickNotes should invalidate or update a user's cache after changes, use bounded TTLs, and read from the primary for operations that require immediate consistency.

### Read replica scale versus replication lag

A read replica helps the service handle more reads, but it may lag behind the primary. Most list requests can use the replica; requests that need read-after-write consistency should temporarily use the primary or use a replication-aware strategy.

### Asynchronous jobs versus operational complexity

A queue and worker keep slow tasks out of user-facing requests and absorb temporary bursts, but introduce delayed completion, retry handling, duplicate-job concerns, and monitoring needs. Jobs should be idempotent, retried with exponential back-off, and moved to a dead-letter queue after repeated failure.

### Horizontal scaling versus state management

Adding app servers increases capacity and resilience, but servers must remain stateless or keep shared state in external services such as Redis and the database. Session state should not exist only in one server's memory.

## 8. Avoiding single points of failure

- Run multiple app-server instances across separate failure zones and configure health checks on the load balancer.
- Deploy the load-balancing and DNS services with managed or redundant configurations rather than relying on one manually maintained machine.
- Use a highly available database configuration with automated backups, monitoring, and a documented failover procedure for the primary and replica.
- Configure Redis with an appropriate highly available deployment and treat cache loss as a recoverable performance issue, not loss of authoritative note data.
- Use a durable, replicated message queue and run multiple workers so queued jobs can resume after a worker failure.
- Monitor service health and test recovery procedures regularly; redundancy alone does not prove that failover will work.
- Set request timeouts, retry transient failures with exponential back-off and jitter, and use rate limits to avoid retry storms or overload.
- Keep app servers stateless so a failed instance can be replaced without losing durable user data.

## Conclusion

The proposed design separates static delivery, application logic, caching, durable storage, and background work. At the stated assumptions, the system averages about 58 reads per second and 1.16 writes per second, with estimated peak reads near 290 per second. These figures provide a starting point for load testing; real capacity planning should be updated using measured traffic, latency targets, query patterns, and growth.
