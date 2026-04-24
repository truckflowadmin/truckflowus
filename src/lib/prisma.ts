import { PrismaClient, Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS: Prisma.ModelName[] = ['Customer', 'Job', 'Ticket'];

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // ── Soft-delete middleware ─────────────────────────────────────────
  // Automatically adds `deletedAt: null` to read queries on models that
  // support soft-delete.  To query deleted records (e.g. in the SA Trash
  // page), pass `deletedAt: { not: null }` or any explicit `deletedAt`
  // value in your `where` — the middleware will not overwrite it.

  client.$use(async (params, next) => {
    if (!params.model || !SOFT_DELETE_MODELS.includes(params.model as Prisma.ModelName)) {
      return next(params);
    }

    const readActions = [
      'findFirst',
      'findFirstOrThrow',
      'findMany',
      'findUnique',
      'findUniqueOrThrow',
      'count',
      'aggregate',
      'groupBy',
    ];

    if (readActions.includes(params.action)) {
      // If the caller already specified a deletedAt condition, don't override it
      const where = params.args?.where ?? {};
      if (where.deletedAt === undefined && !where.AND?.some?.((c: any) => c?.deletedAt !== undefined)) {
        params.args = { ...params.args, where: { ...where, deletedAt: null } };
      }
    }

    // For updateMany — also exclude soft-deleted records by default
    if (params.action === 'updateMany') {
      const where = params.args?.where ?? {};
      if (where.deletedAt === undefined && !where.AND?.some?.((c: any) => c?.deletedAt !== undefined)) {
        params.args = { ...params.args, where: { ...where, deletedAt: null } };
      }
    }

    return next(params);
  });

  return client;
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
