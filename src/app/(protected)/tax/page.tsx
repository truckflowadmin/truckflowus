import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { safePage } from '@/lib/server-error';
import { TaxAdvisory } from './TaxAdvisory';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function TaxPage({
  searchParams,
}: {
  searchParams: { year?: string; tab?: string };
}) {
  const session = await requireSession();

  const selectedYear = parseInt(searchParams.year || String(new Date().getFullYear()), 10);
  const yearStart = new Date(selectedYear, 0, 1);
  const yearEnd = new Date(selectedYear + 1, 0, 1);

  const data = await safePage(async () => {
    // Fetch all contractors for 1099 generation
    const contractors = await prisma.driver.findMany({
      where: {
        companyId: session.companyId,
        workerType: 'CONTRACTOR',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        payType: true,
        payRate: true,
        active: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all employees too (for tax summary)
    const employees = await prisma.driver.findMany({
      where: {
        companyId: session.companyId,
        workerType: 'EMPLOYEE',
      },
      select: {
        id: true,
        name: true,
        payType: true,
        payRate: true,
        active: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch payments made to contractors in the selected year
    const contractorPayments = await prisma.driverPayment.findMany({
      where: {
        companyId: session.companyId,
        driver: { workerType: 'CONTRACTOR' },
        status: 'PAID',
        paidAt: { gte: yearStart, lt: yearEnd },
      },
      select: {
        driverId: true,
        finalAmount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
      },
    });

    // Fetch all payments for tax summary (both employee and contractor)
    const allPayments = await prisma.driverPayment.findMany({
      where: {
        companyId: session.companyId,
        status: 'PAID',
        paidAt: { gte: yearStart, lt: yearEnd },
      },
      select: {
        driverId: true,
        finalAmount: true,
        paidAt: true,
        payType: true,
      },
    });

    // Fetch completed ticket revenue for tax summary
    const completedTickets = await prisma.ticket.findMany({
      where: {
        companyId: session.companyId,
        status: 'COMPLETED',
        date: { gte: yearStart, lt: yearEnd },
        deletedAt: null,
      },
      select: {
        date: true,
        totalPrice: true,
      },
    });

    // Fetch invoices for revenue tracking
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: session.companyId,
        issueDate: { gte: yearStart, lt: yearEnd },
      },
      select: {
        issueDate: true,
        total: true,
        status: true,
      },
    });

    // Fetch expenses for the year
    const expenses = await prisma.expense.findMany({
      where: {
        companyId: session.companyId,
        date: { gte: yearStart, lt: yearEnd },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        category: true,
        description: true,
        vendor: true,
        truckId: true,
      },
      orderBy: { date: 'desc' },
    });

    // Fetch company info for 1099 payer section
    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        phone: true,
        ein: true,
      },
    });

    // Fetch trucks for expense mapping
    const trucks = await prisma.truck.findMany({
      where: { companyId: session.companyId },
      select: { id: true, truckNumber: true },
      orderBy: { truckNumber: 'asc' },
    });

    // Aggregate contractor payments by driver
    const contractorTotals: Record<string, number> = {};
    for (const p of contractorPayments) {
      contractorTotals[p.driverId] = (contractorTotals[p.driverId] || 0) + Number(p.finalAmount);
    }

    // Quarterly revenue breakdown
    const quarterlyRevenue = [0, 0, 0, 0];
    for (const tk of completedTickets) {
      if (tk.date) {
        const q = Math.floor(tk.date.getMonth() / 3);
        quarterlyRevenue[q] += Number(tk.totalPrice || 0);
      }
    }

    // Quarterly expense breakdown
    const quarterlyExpenses = [0, 0, 0, 0];
    for (const exp of expenses) {
      const q = Math.floor(exp.date.getMonth() / 3);
      quarterlyExpenses[q] += Number(exp.amount);
    }

    // Quarterly payments breakdown
    const quarterlyPayroll = [0, 0, 0, 0];
    for (const p of allPayments) {
      if (p.paidAt) {
        const q = Math.floor(p.paidAt.getMonth() / 3);
        quarterlyPayroll[q] += Number(p.finalAmount);
      }
    }

    // Expense breakdown by IRS category
    const expenseByCategory: Record<string, number> = {};
    for (const exp of expenses) {
      expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + Number(exp.amount);
    }

    // Available years (check what years have data)
    const currentYear = new Date().getFullYear();
    const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].filter(y => y >= 2020 && y <= currentYear + 1);

    return {
      contractors: contractors.map(c => ({
        ...c,
        payRate: c.payRate ? Number(c.payRate) : null,
        totalPaid: contractorTotals[c.id] || 0,
        needs1099: (contractorTotals[c.id] || 0) >= 600,
      })),
      employees: employees.map(e => ({
        ...e,
        payRate: e.payRate ? Number(e.payRate) : null,
      })),
      company: company || { name: '', address: '', city: '', state: '', zip: '', phone: '', ein: '' },
      quarterlyRevenue,
      quarterlyExpenses,
      quarterlyPayroll,
      expenseByCategory,
      expenses: expenses.map(e => ({
        ...e,
        amount: Number(e.amount),
      })),
      trucks,
      totalRevenue: completedTickets.reduce((s, tk) => s + Number(tk.totalPrice || 0), 0),
      totalExpenses: expenses.reduce((s, e) => s + Number(e.amount), 0),
      totalPayroll: allPayments.reduce((s, p) => s + Number(p.finalAmount), 0),
      totalInvoiced: invoices.reduce((s, inv) => s + Number(inv.total || 0), 0),
      unpaidInvoices: invoices.filter(inv => inv.status !== 'PAID').reduce((s, inv) => s + Number(inv.total || 0), 0),
      selectedYear,
      availableYears,
    };
  });

  if (!data) {
    return (
      <div className="p-6 text-red-400">
        Failed to load tax data. Please try refreshing the page.
      </div>
    );
  }

  return <TaxAdvisory data={data} />;
}
