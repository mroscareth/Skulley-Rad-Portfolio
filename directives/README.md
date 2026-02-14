# Directives

Standard Operating Procedures for the Skulley Rad portfolio project.

Each `.md` file in this directory is a **directive** — a clear set of instructions
for a specific workflow. Agents read these to understand *what* to do, then call
the appropriate scripts in `execution/` (or `scripts/`) to *do* it.

## Format

Every directive should include:

- **Goal** — What this workflow accomplishes
- **Inputs** — What data/context is needed
- **Steps** — Ordered instructions (tools/scripts to call, decisions to make)
- **Outputs** — Expected deliverables
- **Edge Cases** — Known gotchas, API limits, timing, etc.

## Existing Directives

| File | Purpose |
|------|---------|
| `site_architecture.md` | Overview of the site structure, tech stack, and key files |
| `build_and_deploy.md`  | How to build, preview, and deploy the site |
| `content_management.md`| How to manage site content via the CMS |
