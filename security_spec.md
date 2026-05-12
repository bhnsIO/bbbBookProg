# Security Specification

## Data Invariants
1. A book cannot exist without a valid `userId` that belongs to the authenticated user.
2. The user can only create and access their own books.
3. The `createdAt` field must be the precise time of creation and is immutable.
4. The `updatedAt` field must be the precise time of update.
5. The type must be verified strictly (e.g., progress <= total). Wait, I don't need to enforce logic like `progress <= total` in rules unless critical, but schema must be respected. I will just validate types and basic constraints for safety.

## The Dirty Dozen Payloads
1. Unauthenticated read attempt.
2. Unauthenticated write attempt.
3. Valid payload, but `userId` is spoofed to another user.
4. Valid payload, but missing `title`.
5. Valid payload, but `emoji` is a 1MB string.
6. Shadow update: valid payload with a fake `isAdmin: true` field.
7. Modifying `createdAt` during an update.
8. Modifying `userId` during an update.
9. Array size attack: `chapters` array with 10,000 items.
10. Blanket list query without `where("userId", "==", uid)`.
11. Setting an unknown type (e.g. `audio-invalid`).
12. Providing an invalid timestamp.

These invariants guide the creation of the rules.
