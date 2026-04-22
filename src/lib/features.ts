/**
 * Feature catalog + plan keys.
 *
 * Plans are stored in the database (see prisma/schema.prisma → Plan) so the
 * superadmin UI can edit price and feature set. This file just enumerates the
 * feature keys the app knows how to gate, so the UI can render checkboxes
 * with labels instead of free-text strings.
 *
 * Each feature belongs to a `side`:
 *   - 'dispatcher' — gates functionality in the dispatcher web UI (/dashboard, /tickets, /reports, etc.)
 *   - 'driver'     — gates functionality in the driver mobile view (/d/[token])
 *
 * Adding a new feature:
 *   1. Add a key here + a human label in FEATURE_CATALOG with the correct side.
 *   2. Use `hasFeature(companyId, FEATURES.YOUR_KEY)` server-side where it matters.
 *   3. Enable it on the plans that should include it (via /sa/plans/[id]/edit
 *      or by editing the seed).
 */

import { prisma } from './prisma';

export const FEATURES = {
  // ---- Dispatcher-side features ----
  BULK_TICKETS: 'bulk_tickets',
  EMAIL_INVOICES: 'email_invoices',
  REPORTS: 'reports',
  SMS_NOTIFICATIONS: 'sms_notifications',
  CSV_EXPORT: 'csv_export',
  PDF_INVOICES: 'pdf_invoices',
  API_ACCESS: 'api_access',
  CUSTOM_BRANDING: 'custom_branding',

  // ---- Fleet & maintenance ----
  FLEET_MANAGEMENT: 'fleet_management',
  MAINTENANCE_TRACKING: 'maintenance_tracking',
  FLEET_DOCUMENTS: 'fleet_documents',
  FLEET_EXPENSES: 'fleet_expenses',

  // ---- Dispatcher view access ----
  VIEW_FLEET: 'view_fleet',
  VIEW_JOBS: 'view_jobs',
  VIEW_BROKERS: 'view_brokers',
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_TICKETS: 'view_tickets',
  VIEW_DRIVERS: 'view_drivers',
  VIEW_CUSTOMERS: 'view_customers',
  VIEW_INVOICES: 'view_invoices',
  VIEW_REPORTS: 'view_reports',
  VIEW_SMS: 'view_sms',
  VIEW_SETTINGS: 'view_settings',
  VIEW_CHECKS: 'view_checks',
  VIEW_CALENDAR: 'view_calendar',

  // ---- Advanced dispatcher features ----
  AI_JOB_SCAN: 'ai_job_scan',
  MULTI_DRIVER_JOBS: 'multi_driver_jobs',
  MAPS_URL_RESOLUTION: 'maps_url_resolution',

  // ---- Driver-side features ----
  DRIVER_ISSUE_REPORTING: 'driver_issue_reporting',
  DRIVER_JOB_HISTORY: 'driver_job_history',
  DRIVER_MAPS: 'driver_maps',
  DRIVER_DAILY_STATS: 'driver_daily_stats',
  DRIVER_PHOTO_UPLOAD: 'driver_photo_upload',
  DRIVER_AI_EXTRACTION: 'driver_ai_extraction',
  DRIVER_CLAIM_JOBS: 'driver_claim_jobs',
  DRIVER_PIN_RESET: 'driver_pin_reset',

  // ---- Driver view access ----
  VIEW_DRIVER_ACTIVE: 'view_driver_active',
  VIEW_DRIVER_COMPLETED: 'view_driver_completed',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];
export type FeatureSide = 'dispatcher' | 'driver' | 'dispatcher_views' | 'driver_views';

export const FEATURE_CATALOG: {
  key: FeatureKey;
  label: string;
  description: string;
  side: FeatureSide;
}[] = [
  // ---- Dispatcher-side ----
  {
    key: FEATURES.BULK_TICKETS,
    label: 'Bulk ticket creation',
    description: 'Create up to 50 identical tickets at once for multi-trip jobs',
    side: 'dispatcher',
  },
  {
    key: FEATURES.EMAIL_INVOICES,
    label: 'Email invoices',
    description: 'Send invoice PDFs to customers by email directly from the app',
    side: 'dispatcher',
  },
  {
    key: FEATURES.REPORTS,
    label: 'Reports & analytics',
    description: 'Daily activity charts, revenue breakdown, driver leaderboard',
    side: 'dispatcher',
  },
  {
    key: FEATURES.SMS_NOTIFICATIONS,
    label: 'SMS notifications',
    description: 'Auto-send dispatch SMS to drivers with job details and deep link',
    side: 'dispatcher',
  },
  {
    key: FEATURES.CSV_EXPORT,
    label: 'CSV export',
    description: 'Export tickets to CSV with date and status filters',
    side: 'dispatcher',
  },
  {
    key: FEATURES.PDF_INVOICES,
    label: 'PDF invoices',
    description: 'Generate print-ready PDF invoices from completed tickets',
    side: 'dispatcher',
  },
  {
    key: FEATURES.API_ACCESS,
    label: 'API access',
    description: 'Programmatic access for 3rd-party integrations',
    side: 'dispatcher',
  },
  {
    key: FEATURES.CUSTOM_BRANDING,
    label: 'Custom branding',
    description: 'Upload a logo and use custom colors across dispatcher UI and invoices',
    side: 'dispatcher',
  },

  // ---- Advanced dispatcher features ----
  {
    key: FEATURES.AI_JOB_SCAN,
    label: 'AI job scanning',
    description: 'Scan broker texts and images to auto-fill new job forms with AI extraction',
    side: 'dispatcher',
  },
  {
    key: FEATURES.MULTI_DRIVER_JOBS,
    label: 'Multi-driver jobs',
    description: 'Assign multiple drivers to a single job with independent per-driver status tracking',
    side: 'dispatcher',
  },
  {
    key: FEATURES.MAPS_URL_RESOLUTION,
    label: 'Google Maps address fill',
    description: 'Auto-resolve Google Maps short URLs to full addresses when scanning job documents',
    side: 'dispatcher',
  },

  // ---- Fleet & maintenance ----
  {
    key: FEATURES.FLEET_MANAGEMENT,
    label: 'Fleet management',
    description: 'Track trucks with VIN, license, registration/insurance/inspection expiry, and documents',
    side: 'dispatcher',
  },
  {
    key: FEATURES.MAINTENANCE_TRACKING,
    label: 'Maintenance tracking',
    description: 'Drivetrain details, filter/tire/brake replacement schedules, mileage tracking, and oil specs',
    side: 'dispatcher',
  },
  {
    key: FEATURES.FLEET_DOCUMENTS,
    label: 'Fleet documents',
    description: 'Upload and manage truck registration, insurance, inspection, and other documents',
    side: 'dispatcher',
  },
  {
    key: FEATURES.FLEET_EXPENSES,
    label: 'Fleet expenses',
    description: 'Track fuel, repairs, tolls, insurance, and other truck expenses with receipt upload',
    side: 'dispatcher',
  },

  // ---- Driver-side ----
  {
    key: FEATURES.DRIVER_ISSUE_REPORTING,
    label: 'Driver issue reporting',
    description: 'Let drivers flag problems on a job (blocked site, wrong address, truck issue)',
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_JOB_HISTORY,
    label: 'Driver job history',
    description: "Show drivers their last 7 days of completed jobs in the mobile view",
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_MAPS,
    label: 'Driver tap-to-navigate',
    description: 'Turn pickup/dropoff addresses into Google Maps links for one-tap navigation',
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_DAILY_STATS,
    label: 'Driver daily stats',
    description: 'Show a "Done Today" counter in the driver app header',
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_PHOTO_UPLOAD,
    label: 'Driver ticket photo upload',
    description: 'Let drivers photograph completed job tickets from the Completed tab',
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_AI_EXTRACTION,
    label: 'AI ticket scanning',
    description: 'Automatically extract tons, yards, ticket number, and date from uploaded ticket photos',
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_CLAIM_JOBS,
    label: 'Driver self-assign jobs',
    description: 'Let drivers see and claim available jobs marked as "open for drivers"',
    side: 'driver',
  },
  {
    key: FEATURES.DRIVER_PIN_RESET,
    label: 'Driver PIN reset via email',
    description: 'Allow drivers to reset their PIN by receiving an email link after failed security questions',
    side: 'driver',
  },

  // ---- Dispatcher view access ----
  {
    key: FEATURES.VIEW_FLEET,
    label: 'Fleet tab',
    description: 'Access to Fleet management — trucks, maintenance, documents, and expenses',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_JOBS,
    label: 'Jobs tab',
    description: 'Access to Jobs module for multi-load job tracking and driver assignment',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_BROKERS,
    label: 'Brokers tab',
    description: 'Access to Brokers management and commission tracking',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_DASHBOARD,
    label: 'Dashboard tab',
    description: 'Access to the main Dashboard overview',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_TICKETS,
    label: 'Tickets tab',
    description: 'Access to Tickets list and detail pages',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_DRIVERS,
    label: 'Drivers tab',
    description: 'Access to Drivers management',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_CUSTOMERS,
    label: 'Customers tab',
    description: 'Access to Customers list and management',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_INVOICES,
    label: 'Invoices tab',
    description: 'Access to Invoices creation and management',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_REPORTS,
    label: 'Reports tab',
    description: 'Access to Reports & Analytics dashboards',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_SMS,
    label: 'SMS & Fax tab',
    description: 'Access to SMS & Fax messaging hub — send/receive SMS and faxes',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_SETTINGS,
    label: 'Settings tab',
    description: 'Access to company Settings and plan info',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_CHECKS,
    label: 'Checks tab',
    description: 'Access to check printing and manual check writing',
    side: 'dispatcher_views',
  },
  {
    key: FEATURES.VIEW_CALENDAR,
    label: 'Calendar tab',
    description: 'Access to the scheduling Calendar view',
    side: 'dispatcher_views',
  },

  // ---- Driver view access ----
  {
    key: FEATURES.VIEW_DRIVER_ACTIVE,
    label: 'Active Jobs tab',
    description: 'Access to the Active Jobs tab in the driver app',
    side: 'driver_views',
  },
  {
    key: FEATURES.VIEW_DRIVER_COMPLETED,
    label: 'Completed tab',
    description: 'Access to the Completed jobs tab with photo upload and history',
    side: 'driver_views',
  },
];

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.key, f.label]),
);

/** Features grouped by side, preserving catalog order. */
export function featuresBySide(): Record<FeatureSide, typeof FEATURE_CATALOG> {
  return {
    dispatcher: FEATURE_CATALOG.filter((f) => f.side === 'dispatcher'),
    driver: FEATURE_CATALOG.filter((f) => f.side === 'driver'),
    dispatcher_views: FEATURE_CATALOG.filter((f) => f.side === 'dispatcher_views'),
    driver_views: FEATURE_CATALOG.filter((f) => f.side === 'driver_views'),
  };
}

/** Well-known plan keys seeded out of the box. */
export const PLAN_KEYS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS];

/** Defaults the seed uses. Editable afterwards from /sa/plans. */
export const PLAN_SEED_DEFAULTS: {
  key: PlanKey;
  name: string;
  description: string;
  priceMonthlyCents: number;
  maxDrivers: number | null;
  maxTicketsPerMonth: number | null;
  features: FeatureKey[];
  sortOrder: number;
}[] = [
  {
    key: PLAN_KEYS.FREE,
    name: 'Free',
    description: 'Trial tier — kick the tires',
    priceMonthlyCents: 0,
    maxDrivers: 2,
    maxTicketsPerMonth: 50,
    features: [
      // Dispatcher features
      FEATURES.PDF_INVOICES,
      // Dispatcher views — Free gets basics
      FEATURES.VIEW_DASHBOARD,
      FEATURES.VIEW_JOBS,
      FEATURES.VIEW_TICKETS,
      FEATURES.VIEW_DRIVERS,
      FEATURES.VIEW_SETTINGS,
      FEATURES.VIEW_CALENDAR,
      // Driver features — all included even on Free
      FEATURES.DRIVER_ISSUE_REPORTING,
      FEATURES.DRIVER_JOB_HISTORY,
      FEATURES.DRIVER_MAPS,
      FEATURES.DRIVER_DAILY_STATS,
      FEATURES.DRIVER_PHOTO_UPLOAD,
      FEATURES.DRIVER_AI_EXTRACTION,
      FEATURES.DRIVER_CLAIM_JOBS,
      // Driver views — Free gets Active Jobs only
      FEATURES.VIEW_DRIVER_ACTIVE,
    ],
    sortOrder: 10,
  },
  {
    key: PLAN_KEYS.STARTER,
    name: 'Starter',
    description: 'Small haulers (up to 5 trucks)',
    priceMonthlyCents: 4900,
    maxDrivers: 5,
    maxTicketsPerMonth: 500,
    features: [
      // Dispatcher
      FEATURES.PDF_INVOICES,
      FEATURES.SMS_NOTIFICATIONS,
      FEATURES.CSV_EXPORT,
      // Driver — all driver features on every tier
      FEATURES.DRIVER_ISSUE_REPORTING,
      FEATURES.DRIVER_JOB_HISTORY,
      FEATURES.DRIVER_MAPS,
      FEATURES.DRIVER_DAILY_STATS,
      FEATURES.DRIVER_PHOTO_UPLOAD,
      FEATURES.DRIVER_AI_EXTRACTION,
      FEATURES.DRIVER_CLAIM_JOBS,
      // Fleet — Starter gets basic fleet management
      FEATURES.FLEET_MANAGEMENT,
      FEATURES.FLEET_DOCUMENTS,
      // Dispatcher views — Starter gets core tabs
      FEATURES.VIEW_DASHBOARD,
      FEATURES.VIEW_JOBS,
      FEATURES.VIEW_TICKETS,
      FEATURES.VIEW_DRIVERS,
      FEATURES.VIEW_CUSTOMERS,
      FEATURES.VIEW_INVOICES,
      FEATURES.VIEW_FLEET,
      FEATURES.VIEW_CHECKS,
      FEATURES.VIEW_CALENDAR,
      FEATURES.VIEW_SETTINGS,
      // Driver views — both tabs on Starter+
      FEATURES.VIEW_DRIVER_ACTIVE,
      FEATURES.VIEW_DRIVER_COMPLETED,
    ],
    sortOrder: 20,
  },
  {
    key: PLAN_KEYS.PRO,
    name: 'Pro',
    description: 'Growing fleets (up to 20 trucks)',
    priceMonthlyCents: 14900,
    maxDrivers: 20,
    maxTicketsPerMonth: 5000,
    features: [
      // Dispatcher
      FEATURES.PDF_INVOICES,
      FEATURES.SMS_NOTIFICATIONS,
      FEATURES.CSV_EXPORT,
      FEATURES.BULK_TICKETS,
      FEATURES.EMAIL_INVOICES,
      FEATURES.REPORTS,
      FEATURES.AI_JOB_SCAN,
      FEATURES.MULTI_DRIVER_JOBS,
      FEATURES.MAPS_URL_RESOLUTION,
      // Fleet — Pro gets full fleet + maintenance
      FEATURES.FLEET_MANAGEMENT,
      FEATURES.FLEET_DOCUMENTS,
      FEATURES.FLEET_EXPENSES,
      FEATURES.MAINTENANCE_TRACKING,
      // Driver — all driver features on every tier
      FEATURES.DRIVER_ISSUE_REPORTING,
      FEATURES.DRIVER_JOB_HISTORY,
      FEATURES.DRIVER_MAPS,
      FEATURES.DRIVER_DAILY_STATS,
      FEATURES.DRIVER_PHOTO_UPLOAD,
      FEATURES.DRIVER_AI_EXTRACTION,
      FEATURES.DRIVER_CLAIM_JOBS,
      FEATURES.DRIVER_PIN_RESET,
      // Dispatcher views — Pro adds Reports + SMS & Fax + Brokers + Fleet
      FEATURES.VIEW_DASHBOARD,
      FEATURES.VIEW_JOBS,
      FEATURES.VIEW_TICKETS,
      FEATURES.VIEW_DRIVERS,
      FEATURES.VIEW_CUSTOMERS,
      FEATURES.VIEW_INVOICES,
      FEATURES.VIEW_REPORTS,
      FEATURES.VIEW_SMS,
      FEATURES.VIEW_BROKERS,
      FEATURES.VIEW_FLEET,
      FEATURES.VIEW_CHECKS,
      FEATURES.VIEW_CALENDAR,
      FEATURES.VIEW_SETTINGS,
      // Driver views
      FEATURES.VIEW_DRIVER_ACTIVE,
      FEATURES.VIEW_DRIVER_COMPLETED,
    ],
    sortOrder: 30,
  },
  {
    key: PLAN_KEYS.ENTERPRISE,
    name: 'Enterprise',
    description: 'Unlimited drivers and tickets, API access, custom branding',
    priceMonthlyCents: 49900,
    maxDrivers: null,
    maxTicketsPerMonth: null,
    features: [
      // Dispatcher
      FEATURES.PDF_INVOICES,
      FEATURES.SMS_NOTIFICATIONS,
      FEATURES.CSV_EXPORT,
      FEATURES.BULK_TICKETS,
      FEATURES.EMAIL_INVOICES,
      FEATURES.REPORTS,
      FEATURES.API_ACCESS,
      FEATURES.CUSTOM_BRANDING,
      FEATURES.AI_JOB_SCAN,
      FEATURES.MULTI_DRIVER_JOBS,
      FEATURES.MAPS_URL_RESOLUTION,
      // Fleet — Enterprise gets everything
      FEATURES.FLEET_MANAGEMENT,
      FEATURES.FLEET_DOCUMENTS,
      FEATURES.FLEET_EXPENSES,
      FEATURES.MAINTENANCE_TRACKING,
      // Driver — all driver features on every tier
      FEATURES.DRIVER_ISSUE_REPORTING,
      FEATURES.DRIVER_JOB_HISTORY,
      FEATURES.DRIVER_MAPS,
      FEATURES.DRIVER_DAILY_STATS,
      FEATURES.DRIVER_PHOTO_UPLOAD,
      FEATURES.DRIVER_AI_EXTRACTION,
      FEATURES.DRIVER_CLAIM_JOBS,
      FEATURES.DRIVER_PIN_RESET,
      // Dispatcher views — Enterprise gets everything
      FEATURES.VIEW_DASHBOARD,
      FEATURES.VIEW_JOBS,
      FEATURES.VIEW_TICKETS,
      FEATURES.VIEW_DRIVERS,
      FEATURES.VIEW_CUSTOMERS,
      FEATURES.VIEW_INVOICES,
      FEATURES.VIEW_REPORTS,
      FEATURES.VIEW_SMS,
      FEATURES.VIEW_BROKERS,
      FEATURES.VIEW_FLEET,
      FEATURES.VIEW_CHECKS,
      FEATURES.VIEW_CALENDAR,
      FEATURES.VIEW_SETTINGS,
      // Driver views
      FEATURES.VIEW_DRIVER_ACTIVE,
      FEATURES.VIEW_DRIVER_COMPLETED,
    ],
    sortOrder: 40,
  },
];

/**
 * Maps dispatcher sidebar routes to the feature key that gates them.
 * Routes not in this map are always visible.
 */
export const NAV_FEATURE_MAP: Record<string, FeatureKey> = {
  '/dashboard': FEATURES.VIEW_DASHBOARD,
  '/fleet': FEATURES.VIEW_FLEET,
  '/jobs': FEATURES.VIEW_JOBS,
  '/tickets': FEATURES.VIEW_TICKETS,
  '/drivers': FEATURES.VIEW_DRIVERS,
  '/customers': FEATURES.VIEW_CUSTOMERS,
  '/invoices': FEATURES.VIEW_INVOICES,
  '/reports': FEATURES.VIEW_REPORTS,
  '/sms': FEATURES.VIEW_SMS,
  '/brokers': FEATURES.VIEW_BROKERS,
  '/settings': FEATURES.VIEW_SETTINGS,
  '/checks': FEATURES.VIEW_CHECKS,
  '/calendar': FEATURES.VIEW_CALENDAR,
};

/** Format price cents as a display string like "$149.00/mo" or "Free". */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}/mo`;
}

/**
 * Resolves the effective feature set for a company.
 * Formula: (plan features + featureOverrides) − disabledFeatures
 * Suspended companies get no features.
 */
function resolveFeatureSet(company: {
  suspended: boolean;
  featureOverrides: string[];
  disabledFeatures: string[];
  plan: { features: string[] } | null;
}): Set<string> {
  if (company.suspended) return new Set();
  const planFeatures = company.plan?.features ?? [];
  const combined = new Set([...planFeatures, ...company.featureOverrides]);
  for (const f of company.disabledFeatures) combined.delete(f);
  return combined;
}

const COMPANY_FEATURE_SELECT = {
  suspended: true,
  featureOverrides: true,
  disabledFeatures: true,
  plan: { select: { features: true } },
} as const;

/**
 * Returns true if the given company's effective feature set includes the key.
 * Effective = (plan features + overrides) − disabled.
 * Suspended companies are treated as having no features.
 */
export async function hasFeature(
  companyId: string,
  key: FeatureKey,
): Promise<boolean> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: COMPANY_FEATURE_SELECT,
  });
  if (!c) return false;
  return resolveFeatureSet(c).has(key);
}

/**
 * Batch version — fetches the company's feature set once and returns a
 * resolver. Use on pages that gate multiple features to avoid N queries.
 */
export async function loadCompanyFeatures(
  companyId: string,
): Promise<(key: FeatureKey) => boolean> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: COMPANY_FEATURE_SELECT,
  });
  if (!c) return () => false;
  const set = resolveFeatureSet(c);
  return (key: FeatureKey) => set.has(key);
}

/**
 * Returns the full effective feature set for a company as an array.
 * Useful for settings pages that need to display all active features.
 */
export async function getEffectiveFeatures(
  companyId: string,
): Promise<{ features: Set<string>; planFeatures: string[]; overrides: string[]; disabled: string[] }> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: COMPANY_FEATURE_SELECT,
  });
  if (!c || c.suspended) {
    return { features: new Set(), planFeatures: [], overrides: [], disabled: [] };
  }
  return {
    features: resolveFeatureSet(c),
    planFeatures: c.plan?.features ?? [],
    overrides: c.featureOverrides,
    disabled: c.disabledFeatures,
  };
}
