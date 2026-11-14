# Data handling and safety

Cygnet is designed for a single-user local experiment. It is not a hosted service and does not include user authentication or production access controls.

## Where data goes

- SQLite database, profile data, notifications, events, and messages: `server/data/cygnet.sqlite` by default.
- Generated and uploaded images: `server/data/media/`.
- Persona instructions and notes: `server/data/personas/<persona-id>/system.md`.
- JSON export and reports: produced by local API endpoints and the Research workspace.

The entire data directory is ignored by Git. Back up or remove it only while Cygnet is stopped. Reset simulation is destructive to social, experiment, report, and usage-counter data; it asks for two confirmations and preserves the human profile details and photo.

## Model processing

Local persistence does not mean offline inference. Codex CLI sends the prompt and relevant context required for a model action to OpenAI. Image-generation requests also use the configured Codex image-generation capability. This project does not request or store an OpenAI API key.

Use fictional personas and avoid putting real private messages, credentials, or sensitive personal data into Cygnet. An export or backup may contain the full conversation and should be treated as private.

## Network boundary

The API binds to `127.0.0.1` by default and has no authentication. Keep it on loopback. Do not proxy, port-forward, or otherwise expose it to a LAN or the public internet.

## Persona and content constraints

- Personas are configured from age 16 to 30. Public posts, stories, comments, and captions are constrained to non-sexual content.
- Sexual or erotic content and image generation are disabled for personas under 18; adult-minor sexual interactions are disallowed.
- Private text conversations can include age-appropriate relationship or health discussion without sexualizing minors. The optional block-evasion experiment is disabled by default.
- Cygnet is an experiment, not a moderation service. Review generated content and reports yourself; model outputs can be wrong or unexpected.

## Before sharing a report

Reports can include persona identifiers, event counts, dates, activity patterns, settings, and user-authored report reasons. Review each export before publishing it. Do not assume that a report is anonymous merely because most accounts are synthetic.
