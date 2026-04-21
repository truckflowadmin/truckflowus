'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePublicLang } from '@/lib/usePublicLang';
import PublicLanguageToggle from '@/components/PublicLanguageToggle';

const CATEGORIES = [
  { value: '', labelKey: 'pub.contact.selectCat' },
  { value: 'Special Request', labelKey: 'pub.contact.catSpecial' },
  { value: 'Something Not Working', labelKey: 'pub.contact.catBug' },
  { value: 'General Inquiry', labelKey: 'pub.contact.catGeneral' },
  { value: 'Other', labelKey: 'pub.contact.catOther' },
];

export default function ContactPage() {
  const { lang, t } = usePublicLang();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), category, message: message.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || (lang === 'en' ? 'Something went wrong. Please try again.' : 'Algo salió mal. Intente de nuevo.'));
        return;
      }

      setStatus('sent');
      setName('');
      setEmail('');
      setCategory('');
      setMessage('');
    } catch {
      setStatus('error');
      setErrorMsg(t('pub.contact.errorConnection'));
    }
  }

  return (
    <div className="min-h-screen bg-diesel text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-steel-800 bg-diesel/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-safety rounded flex items-center justify-center font-black text-diesel text-lg">
              TF
            </div>
            <span className="text-xl font-bold tracking-tight">TruckFlowUS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              {t('pub.nav.blog')}
            </Link>
            <PublicLanguageToggle />
            <Link
              href="/signup"
              className="text-sm font-semibold bg-safety text-diesel px-4 py-2 rounded-md hover:bg-safety-dark transition-colors"
            >
              {t('pub.nav.startTrial')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-20">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Left — Info */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              {t('pub.contact.title')}{' '}
              {t('pub.contact.titleAccent') && <span className="text-safety">{t('pub.contact.titleAccent')}</span>}
            </h1>
            <p className="text-steel-400 text-lg leading-relaxed mb-8">
              {t('pub.contact.subtitle')}
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-steel-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-safety" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">{t('pub.contact.email')}</p>
                  <a href="mailto:truckflowadmin@gmail.com" className="text-steel-400 hover:text-safety transition-colors">
                    truckflowadmin@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-steel-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-safety" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">{t('pub.contact.responseTime')}</p>
                  <p className="text-steel-400">{t('pub.contact.responseDesc')}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-steel-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-safety" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">{t('pub.contact.existing')}</p>
                  <p className="text-steel-400">
                    {t('pub.contact.existingDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div>
            {status === 'sent' ? (
              <div className="bg-steel-900/60 border border-green-800 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">{t('pub.contact.sent')}</h2>
                <p className="text-steel-400 mb-6">
                  {t('pub.contact.sentDesc')}
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="text-sm font-medium text-safety hover:text-safety-dark transition-colors"
                >
                  {t('pub.contact.sendAnother')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-steel-900/60 border border-steel-800 rounded-xl p-6 sm:p-8 space-y-5">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-steel-300 mb-1.5">
                    {t('pub.contact.yourName')}
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full bg-steel-800 border border-steel-700 rounded-lg px-4 py-2.5 text-white placeholder-steel-500 focus:border-safety focus:outline-none focus:ring-1 focus:ring-safety transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-steel-300 mb-1.5">
                    {t('pub.contact.emailAddr')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-steel-800 border border-steel-700 rounded-lg px-4 py-2.5 text-white placeholder-steel-500 focus:border-safety focus:outline-none focus:ring-1 focus:ring-safety transition-colors"
                  />
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-steel-300 mb-1.5">
                    {t('pub.contact.helpWith')}
                  </label>
                  <select
                    id="category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-steel-800 border border-steel-700 rounded-lg px-4 py-2.5 text-white focus:border-safety focus:outline-none focus:ring-1 focus:ring-safety transition-colors"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value} disabled={!cat.value}>
                        {t(cat.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-steel-300 mb-1.5">
                    {t('pub.contact.message')}
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('pub.contact.messagePlaceholder')}
                    className="w-full bg-steel-800 border border-steel-700 rounded-lg px-4 py-2.5 text-white placeholder-steel-500 focus:border-safety focus:outline-none focus:ring-1 focus:ring-safety transition-colors resize-none"
                  />
                </div>

                {/* Error */}
                {status === 'error' && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-safety text-diesel font-bold text-sm px-6 py-3 rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? t('pub.contact.sending') : t('pub.contact.send')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-steel-800">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-steel-500">
          <Link href="/" className="hover:text-steel-300 transition-colors">
            {t('pub.nav.backHome')}
          </Link>
          <p className="text-xs text-steel-600">
            &copy; {new Date().getFullYear()} TruckFlowUS. {t('pub.nav.allRights')}
          </p>
        </div>
      </footer>
    </div>
  );
}
