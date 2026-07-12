---
name: api-contract-first
description: >-
  Use this skill when designing or modifying APIs — REST/OpenAPI, GraphQL, or
  gRPC. Covers contract-first design where the schema is authored before
  implementation, enabling mock servers, code generation, and contract testing.
---

# API Contract-First Development Skill

## Purpose

Design APIs where the contract (schema) is the single source of truth, authored
before implementation. This enables parallel frontend/backend work, automated
mocking, contract testing, and clean versioning.

## When To Use

- Designing a new API or adding significant endpoints
- Multiple teams/consumers depend on the API
- Need auto-generated documentation, SDKs, or mock servers
- Establishing backward compatibility guarantees

## Workflow

### 1. Design the Contract
- **Choose format** — OpenAPI (REST), GraphQL schema, or gRPC proto based on use case
- **Model resources/types** — define entities, enums, error types
- **Define endpoints** — paths, methods, request/response schemas, status codes
- **Versioning strategy** — URL path (`/v2/`), header, or content negotiation
- **Pagination & filtering** — cursor-based preferred; define sort/filter parameters

### 2. Validate & Mock
- **Lint the spec** — ensure naming conventions, required fields, examples
- **Generate mock server** — Prism (OpenAPI), Apollo mock (GraphQL), grpcurl
- **Frontend can start immediately** — against the mock, before backend exists

### 3. Implement Against Contract
- **Generate server stubs** — from the spec (openapi-generator, protoc)
- **Implement handlers** — business logic fills in the stubs
- **Validate I/O** — every request/response is validated against the schema

### 4. Contract Testing
- **Provider tests** — verify the implementation matches the contract
- **Consumer tests** — verify consumers work against the contract (not the implementation)
- **CI gate** — contract tests run on every PR; breaking changes fail the build

## Key Design Principles

### REST / OpenAPI
- Resource-oriented URLs: `/users/{id}/orders`, not `/getOrdersByUser`
- HTTP methods with correct semantics (GET=idempotent, POST=create, PUT=replace, PATCH=update)
- Consistent error format: `{ "code": "VALIDATION_ERROR", "message": "...", "details": [...] }`
- Use `oneOf`/`allOf` for polymorphic responses

### GraphQL
- Schema-first: define types and resolvers before implementation
- N+1 prevention: use DataLoader for batched resolution
- Deprecation via `@deprecated` directive, not removal

### gRPC
- Proto3 with well-known types (Timestamp, Empty, FieldMask)
- Bidirectional streaming for real-time; unary for request/response
- Backward-compatible field changes only (add fields, never remove/rename)

## Backward Compatibility Checklist
- [ ] No removed fields or endpoints
- [ ] No changed field types (widening is OK: int32 → int64)
- [ ] No new required fields without defaults
- [ ] Error codes only added, never removed
- [ ] Version bump only for breaking changes

## Anti-Pattern: Implementation-First APIs

Writing the backend first, then reverse-engineering the API spec from code,
produces contracts that mirror implementation quirks. Contract-first forces
you to think about the consumer's experience before the database schema.
