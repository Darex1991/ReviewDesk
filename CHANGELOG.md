# Changelog

## v0.1.0

Initial release of ReviewDesk, built on Selleo boilerplate v1.7.0.

Feat:
- Upload ZIP archives or individual files for review (multipart, stored in S3-compatible storage)
- Background analysis via BullMQ worker with live progress
- Static analysis engine with ~20 security/bug/maintainability rules
- AI code review via Anthropic Claude (structured outputs, batching, prompt caching) with mock/disabled adapters
- Prioritised findings (critical → info) with category, source, snippet and suggested fix
- Dashboard overview, reviews list, review details with filters, retry and delete
- Reviews API (`/api/v1/reviews`) with generated typed client
