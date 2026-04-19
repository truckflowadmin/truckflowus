-- Add mustSetSecurityQuestions flag to User and Driver
-- When set to true, forces the user/driver to set up security questions at next login
ALTER TABLE "User" ADD COLUMN "mustSetSecurityQuestions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Driver" ADD COLUMN "mustSetSecurityQuestions" BOOLEAN NOT NULL DEFAULT false;
