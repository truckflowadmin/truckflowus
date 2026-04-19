-- Session invalidation for force-logout (superadmin debug)
ALTER TABLE "User" ADD COLUMN "sessionInvalidatedAt" TIMESTAMP(3);

-- Driver login tracking & session invalidation
ALTER TABLE "Driver" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN "sessionInvalidatedAt" TIMESTAMP(3);
