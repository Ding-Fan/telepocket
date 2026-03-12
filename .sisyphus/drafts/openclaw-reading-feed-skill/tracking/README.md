# Link Exposure Tracking (Design)

This folder defines a portable exposure tracking system for links.

Purpose:
- Enable “least read/least exposed” selection.
- Provide an audit trail of what the assistant has already surfaced.

This is designed so Telepocket can implement it later (DB + MCP tool), but the skill can also implement it locally if the host supports persistent storage.

See `exposure-contract.md` for the provider interface and recommended Telepocket implementation.
