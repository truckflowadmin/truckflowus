import { prisma } from '@/lib/prisma';
import { requireSession, hashPassword, verifyPassword } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { FEATURE_CATALOG, featuresBySide, getEffectiveFeatures, formatPrice } from '@/lib/features';
import { SECURITY_QUESTIONS, hashAnswer } from '@/lib/driver-auth';
import { audit } from '@/lib/audit';
import CompanyLogoUpload from '@/components/CompanyLogoUpload';

async function saveCompanyAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  if (session.role !== 'ADMIN') throw new Error('Only admins can modify company settings');
  const rateStr = String(formData.get('defaultRate') || '').trim();
  const rate = rateStr ? Number(rateStr) : 0;
  await prisma.company.update({
    where: { id: session.companyId },
    data: {
      name: String(formData.get('name') || '').trim() || undefined,
      address: String(formData.get('address') || '').trim() || null,
      city: String(formData.get('city') || '').trim() || null,
      state: String(formData.get('state') || '').trim() || null,
      zip: String(formData.get('zip') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
      email: String(formData.get('email') || '').trim() || null,
      defaultRate: isNaN(rate) ? 0 : rate,
      checkRoutingNumber: String(formData.get('checkRoutingNumber') || '').trim() || null,
      checkAccountNumber: String(formData.get('checkAccountNumber') || '').trim() || null,
    } as any,
  });
  revalidatePath('/settings');
  redirect('/settings?saved=1');
}

async function changePasswordAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const current = String(formData.get('currentPassword') || '');
  const newPw = String(formData.get('newPassword') || '');
  const confirm = String(formData.get('confirmPassword') || '');

  if (!current || !newPw) throw new Error('All fields required');
  if (newPw.length < 6) throw new Error('Password must be at least 6 characters');
  if (newPw !== confirm) throw new Error('Passwords do not match');

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error('User not found');

  const valid = await verifyPassword(current, user.passwordHash);
  if (!valid) throw new Error('Current password is incorrect');

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: await hashPassword(newPw), lastPasswordChange: new Date() },
  });
  await audit({
    companyId: session.companyId,
    entityType: 'user',
    entityId: session.userId,
    action: 'update',
    actor: session.email,
    actorRole: session.role as 'ADMIN' | 'DISPATCHER',
    summary: `${session.email} changed their own password`,
  });
  redirect('/settings?pwOk=1');
}

async function saveSecurityQuestionsAction(formData: FormData) {
  'use server';
  const session = await requireSession();

  // Require current password to change security questions
  const currentPassword = String(formData.get('currentPasswordSQ') || '');
  if (!currentPassword) {
    redirect('/settings?sqErr=Current+password+is+required+to+change+security+questions');
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
  if (!user) throw new Error('User not found');
  const pwValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!pwValid) {
    redirect('/settings?sqErr=Current+password+is+incorrect');
  }

  const q1 = String(formData.get('securityQ1') || '').trim();
  const a1 = String(formData.get('securityA1') || '').trim();
  const q2 = String(formData.get('securityQ2') || '').trim();
  const a2 = String(formData.get('securityA2') || '').trim();
  const q3 = String(formData.get('securityQ3') || '').trim();
  const a3 = String(formData.get('securityA3') || '').trim();

  if (!q1 || !a1 || !q2 || !a2 || !q3 || !a3) {
    redirect('/settings?sqErr=All+three+questions+and+answers+are+required');
  }

  // Ensure 3 unique questions
  if (q1 === q2 || q1 === q3 || q2 === q3) {
    redirect('/settings?sqErr=Each+question+must+be+different');
  }

  const [h1, h2, h3] = await Promise.all([
    hashAnswer(a1),
    hashAnswer(a2),
    hashAnswer(a3),
  ]);

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      securityQ1: q1, securityA1: h1,
      securityQ2: q2, securityA2: h2,
      securityQ3: q3, securityA3: h3,
    },
  });

  // Clear the mustSetSecurityQuestions flag if it was set (by superadmin clearing questions)
  try {
    await prisma.$executeRaw`
      UPDATE "User" SET "mustSetSecurityQuestions" = false WHERE "id" = ${session.userId}
    `;
  } catch {
    // Column may not exist yet — skip
  }

  await audit({
    companyId: session.companyId,
    entityType: 'user',
    entityId: session.userId,
    action: 'update',
    actor: session.email,
    actorRole: session.role as 'ADMIN' | 'DISPATCHER',
    summary: `${session.email} updated their security questions`,
  });

  redirect('/settings?sqOk=1');
}

async function addUserAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  if (session.role !== 'ADMIN') throw new Error('Admin only');

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const name = String(formData.get('name') || '').trim();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || 'DISPATCHER') as 'ADMIN' | 'DISPATCHER';

  if (!email || !name || !password) throw new Error('All fields required');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already in use');

  await prisma.user.create({
    data: {
      companyId: session.companyId,
      email,
      name,
      passwordHash: await hashPassword(password),
      role,
    },
  });
  revalidatePath('/settings');
}

async function removeUserAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  if (session.role !== 'ADMIN') throw new Error('Admin only');
  const id = String(formData.get('id') || '');
  if (id === session.userId) throw new Error('Cannot remove yourself');
  const user = await prisma.user.findFirst({ where: { id, companyId: session.companyId } });
  if (!user) throw new Error('User not found');
  await prisma.user.delete({ where: { id } });
  revalidatePath('/settings');
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { pwOk?: string; sqOk?: string; sqErr?: string; setupSQ?: string; saved?: string };
}) {
  const session = await requireSession();
  const lang = getServerLang();
  const [company, users, plan, currentUser] = await Promise.all([
    prisma.company.findUnique({ where: { id: session.companyId } }),
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: 'asc' } }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { plan: true },
    }).then((c) => c?.plan ?? null),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { securityQ1: true, securityQ2: true, securityQ3: true },
    }),
  ]);
  if (!company) return null;
  const hasSecurityQuestions = !!(currentUser?.securityQ1 && currentUser?.securityQ2 && currentUser?.securityQ3);

  const { features: effectiveFeatures } = await getEffectiveFeatures(session.companyId);
  const grouped = featuresBySide();

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('settings.configuration', lang)}</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('settings.title', lang)}</h1>
      </header>

      {/* My Plan & Features */}
      <section className="panel p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-lg">My Plan & Features</h2>
          <a
            href="/subscribe"
            className="text-xs text-safety-dark hover:underline font-medium"
          >
            Change plan
          </a>
        </div>
        {plan ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-diesel">{plan.name}</span>
              <span className="badge bg-safety text-diesel">{formatPrice(plan.priceMonthlyCents)}</span>
              {plan.maxDrivers && (
                <span className="text-xs text-steel-500">Up to {plan.maxDrivers} drivers</span>
              )}
              {plan.maxTicketsPerMonth && (
                <span className="text-xs text-steel-500">· {plan.maxTicketsPerMonth} tickets/mo</span>
              )}
            </div>

            {([
              { title: 'Dispatcher Features', items: grouped.dispatcher },
              { title: 'Driver App Features', items: grouped.driver },
            ]).map((section) => (
              <div key={section.title} className="mb-4">
                <h3 className="text-xs uppercase tracking-widest text-steel-500 font-semibold mb-2">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {section.items.map((f) => {
                    const enabled = effectiveFeatures.has(f.key);
                    return (
                      <div
                        key={f.key}
                        className={`flex items-start gap-2 p-3 rounded-lg border ${
                          enabled
                            ? 'border-green-200 bg-green-50'
                            : 'border-steel-200 bg-steel-50 opacity-60'
                        }`}
                      >
                        <span className="text-base mt-0.5">{enabled ? '✓' : '🔒'}</span>
                        <div>
                          <div className={`text-sm font-medium ${enabled ? 'text-green-900' : 'text-steel-500'}`}>
                            {f.label}
                          </div>
                          <div className="text-xs text-steel-500">{f.description}</div>
                          {!enabled && (
                            <span className="inline-block mt-1 text-[10px] bg-steel-200 text-steel-600 rounded-full px-2 py-0.5">
                              Contact admin to upgrade
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-steel-500">
            No plan assigned. Contact your administrator.
          </p>
        )}
      </section>

      {/* Company Info */}
      <form action={saveCompanyAction} className="panel p-6 space-y-4 mb-6">
        <h2 className="font-semibold text-lg">Company Information</h2>
        {searchParams.saved && (
          <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">Settings saved successfully.</p>
        )}

        {/* Company Logo Upload */}
        <CompanyLogoUpload currentLogoUrl={company.logoUrl ?? null} />

        <div>
          <label className="label">Company Name</label>
          <input name="name" defaultValue={company.name} className="input" required />
        </div>
        <div>
          <label className="label">Address</label>
          <input name="address" defaultValue={company.address ?? ''} className="input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">City</label>
            <input name="city" defaultValue={company.city ?? ''} className="input" />
          </div>
          <div>
            <label className="label">State</label>
            <input name="state" defaultValue={company.state ?? ''} className="input" />
          </div>
          <div>
            <label className="label">ZIP</label>
            <input name="zip" defaultValue={company.zip ?? ''} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={company.phone ?? ''} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" defaultValue={company.email ?? ''} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Default rate per load ($)</label>
          <input
            name="defaultRate" type="number" step="0.01" min="0"
            defaultValue={Number(company.defaultRate).toFixed(2)}
            className="input max-w-xs"
          />
          <p className="text-xs text-steel-500 mt-1">Used as the default when creating new tickets.</p>
        </div>
        <div className="border-t border-steel-200 pt-4 mt-4">
          <h3 className="font-semibold text-sm mb-3">Check / Payment Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Routing Number</label>
              <input name="checkRoutingNumber" defaultValue={(company as any).checkRoutingNumber ?? ''} className="input" placeholder="e.g. 021000021" />
            </div>
            <div>
              <label className="label">Account Number</label>
              <input name="checkAccountNumber" defaultValue={(company as any).checkAccountNumber ?? ''} className="input" placeholder="e.g. 1234567890" />
            </div>
          </div>
          <p className="text-xs text-steel-500 mt-1">Displayed on printed driver payment checks.</p>
        </div>
        <div className="pt-3 border-t border-steel-200">
          <button className="btn-accent" type="submit">Save Changes</button>
        </div>
      </form>

      {/* Change Password */}
      <form action={changePasswordAction} className="panel p-6 space-y-4 mb-6">
        <h2 className="font-semibold text-lg">Change Password</h2>
        {searchParams.pwOk && (
          <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">Password updated successfully.</p>
        )}
        <div>
          <label className="label">Current Password</label>
          <input name="currentPassword" type="password" required className="input max-w-sm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">New Password</label>
            <input name="newPassword" type="password" required minLength={6} className="input" />
          </div>
          <div>
            <label className="label">Confirm</label>
            <input name="confirmPassword" type="password" required className="input" />
          </div>
        </div>
        <button className="btn-primary" type="submit">Update Password</button>
      </form>

      {/* Security Questions */}
      <form action={saveSecurityQuestionsAction} className="panel p-6 space-y-4 mb-6">
        <h2 className="font-semibold text-lg">Security Questions</h2>
        {searchParams.setupSQ && (
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm">
            Your security questions were cleared by an administrator. Please set up new ones below to continue using your account.
          </div>
        )}
        <p className="text-sm text-steel-600">
          Set up 3 security questions so you can reset your password without email.
          {hasSecurityQuestions && (
            <span className="ml-1 text-green-600 font-medium">✓ Configured</span>
          )}
        </p>
        {searchParams.sqOk && (
          <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">Security questions saved successfully.</p>
        )}
        {searchParams.sqErr && (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{searchParams.sqErr}</p>
        )}
        <div className="space-y-1">
          <label className="label">Current Password (required to change security questions)</label>
          <input name="currentPasswordSQ" type="password" required className="input" placeholder="Enter your current password" />
        </div>
        {[1, 2, 3].map((n) => {
          const currentQ = currentUser?.[`securityQ${n}` as keyof typeof currentUser] as string | null;
          return (
            <div key={n} className="space-y-2 border-t border-steel-100 pt-3">
              <label className="label">Question {n}</label>
              <select name={`securityQ${n}`} required className="input" defaultValue={currentQ || ''}>
                <option value="">Select a question…</option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <label className="label">Answer {n}</label>
              <input
                name={`securityA${n}`}
                type="text"
                required
                className="input"
                placeholder={hasSecurityQuestions ? '(enter new answer to update)' : 'Your answer'}
              />
            </div>
          );
        })}
        <button className="btn-primary" type="submit">
          {hasSecurityQuestions ? 'Update Security Questions' : 'Save Security Questions'}
        </button>
      </form>

      {/* User Management (admin only) */}
      {session.role === 'ADMIN' && (
        <section className="panel p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Dispatchers &amp; Admins</h2>
          <table className="w-full text-sm mb-4">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
              <tr>
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Email</th>
                <th className="text-left py-2 pr-4">Role</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-steel-100">
                  <td className="py-2 pr-4 font-medium">{u.name}</td>
                  <td className="py-2 pr-4 text-steel-600">{u.email}</td>
                  <td className="py-2 pr-4">
                    <span className={`badge ${u.role === 'ADMIN' ? 'bg-safety text-diesel' : 'bg-steel-200 text-steel-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {u.id !== session.userId && (
                      <form action={removeUserAction} className="inline">
                        <input type="hidden" name="id" value={u.id} />
                        <button className="text-xs text-red-600 hover:text-red-800">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <details>
            <summary className="text-sm font-medium text-steel-700 cursor-pointer mb-3">+ Add User</summary>
            <form action={addUserAction} className="space-y-3 border-t border-steel-200 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input name="name" required className="input" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input name="email" type="email" required className="input" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Password</label>
                  <input name="password" type="password" required minLength={6} className="input" />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select name="role" className="input">
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <button className="btn-accent" type="submit">Add User</button>
            </form>
          </details>
        </section>
      )}

      {/* Textbelt info */}
      <section className="panel p-6 text-sm text-steel-600">
        <h2 className="font-semibold text-steel-900 mb-3">Textbelt Configuration</h2>
        <p className="mb-2">SMS sending is controlled by environment variables:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs font-mono">
          <li>TEXTBELT_KEY — your paid Textbelt key (or <code>textbelt_test</code> for dev)</li>
          <li>APP_URL — public URL of this app, used for SMS links and reply webhook</li>
        </ul>
        <p className="mt-3">
          Inbound reply webhook: <code className="text-xs">{process.env.APP_URL || 'http://localhost:3000'}/api/sms/webhook</code>
        </p>
      </section>
    </div>
  );
}
