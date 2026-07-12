---
name: database-performance-tuning
description: >-
  Use this skill when diagnosing and fixing database performance issues — slow
  queries, missing indexes, N+1 problems, and connection pool exhaustion.
  Covers EXPLAIN analysis, indexing strategy, and read-only diagnosis first.
---

# Database Performance Tuning Skill

## Purpose

Diagnose database bottlenecks using a read-only-first approach: analyze query
plans, identify missing indexes, rewrite queries, and recommend schema changes —
all without risking production data.

## When To Use

- Queries are slow (high latency, timeouts)
- Database CPU/I/O is saturated
- Need to add indexes or optimize schema
- N+1 query patterns detected
- Connection pool exhaustion

## Diagnostic Workflow

### 1. Identify Slow Queries
- **Query logs** — `pg_stat_statements` (PostgreSQL), `slow_query_log` (MySQL)
- **APM tracing** — find the slowest DB spans in traces
- **Application profiling** — identify which code paths hit the DB most

### 2. Analyze Execution Plan
```
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```
Key signals in the plan:
- **Seq Scan** on large tables → missing index
- **Nested Loop** with many iterations → N+1 or missing join index
- **Sort** with high cost → missing index for ORDER BY
- **Hash Join** with large build → might need more work_mem or a better join
- **Filter** removing most rows → predicate not covered by index

### 3. Index Strategy
- **B-tree** — equality and range queries (default)
- **GIN/GIST** — full-text search, array containment, geo
- **Composite index** — multi-column; order matters (equality columns first, then range)
- **Partial index** — `WHERE deleted_at IS NULL` to index only active rows
- **Covering index** — `INCLUDE (column)` to avoid heap lookups (PostgreSQL 11+)

**Anti-pattern**: over-indexing. Every index slows writes. Index for the queries
that matter, not every possible query.

### 4. Query Rewriting
- **Replace N+1 with JOINs or batch loading** — `WHERE id = ANY($1::int[])`
- **Avoid `SELECT *`** — fetch only needed columns
- **Use `LIMIT` with `ORDER BY` on indexed columns** — avoid full sort
- **Replace `COUNT(*)` with estimated counts** for large tables
- **Use `EXISTS` instead of `IN`** for subqueries on large sets

### 5. Connection & Pool
- **Pool sizing** — `(core_count * 2) + effective_spindle_count` as a starting point
- **PgBouncer / connection proxy** — multiplex many app connections over few DB connections
- **Transaction length** — long transactions hold locks and prevent vacuum

## Safety Rules

- **Read-only first** — always diagnose with `EXPLAIN ANALYZE` before suggesting changes
- **Never run destructive commands** — `DROP`, `TRUNCATE`, `DELETE WHERE` without explicit approval
- **Test on staging** — index creation on large tables can lock writes; use `CREATE INDEX CONCURRENTLY`
- **Measure before and after** — capture query latency before the change and after

## Guidelines

- **The optimizer is usually right** — if it's choosing a Seq Scan, ask why before overriding
- **Schema design beats query tricks** — a well-modeled schema needs fewer optimizations
- **Vacuum and analyze** — stale statistics lead to bad plans; ensure autovacuum is running
- **Partition large tables** — tables > 100M rows benefit from partition pruning
