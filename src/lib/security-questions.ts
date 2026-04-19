/**
 * Predefined security questions shared between server and client components.
 * Extracted from driver-auth.ts so client components can import without
 * pulling in next/headers (server-only).
 */
export const SECURITY_QUESTIONS = [
  'What is the name of your first pet?',
  'What city were you born in?',
  "What is your mother's maiden name?",
  'What was the name of your first school?',
  'What is your favorite sports team?',
  'What was the make of your first car?',
  'What street did you grow up on?',
  'What is your favorite food?',
  'What is your childhood nickname?',
  'What was your first job?',
];
