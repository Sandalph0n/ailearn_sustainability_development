# Database snapshot

The normal Prisma seed remains the reproducible source for public/demo data:

```text
pnpm exec prisma migrate deploy
pnpm db:seed
```

It restores users, the Macquarie institution, permissions, roles, terms, subjects, offerings and
assessments. It intentionally does not reproduce role assignments, requests or other records made
through the UI.

`ailearn-current.dump` is the exact portable snapshot of the current development database. It
contains the schema, Prisma migration history and all database rows except active `LoginSession`
records.

Create or refresh the snapshot:

```text
pnpm db:backup
```

Restore it on another machine after Docker Desktop is running:

```text
pnpm db:restore -- --force
```

Restore deletes and replaces the entire local `ailearn` database schema. Login sessions are not
portable; sign in again after restoring.
