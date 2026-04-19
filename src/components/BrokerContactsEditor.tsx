'use client';

import { useState } from 'react';
import type { BrokerContact } from '@/lib/broker-types';

interface Props {
  initial?: BrokerContact[];
}

export default function BrokerContactsEditor({ initial = [] }: Props) {
  const [contacts, setContacts] = useState<BrokerContact[]>(
    initial.length > 0 ? initial : [{ name: '', phone: '', email: '', jobTitle: '' }]
  );

  function addContact() {
    setContacts([...contacts, { name: '', phone: '', email: '', jobTitle: '' }]);
  }

  function removeContact(index: number) {
    setContacts(contacts.filter((_, i) => i !== index));
  }

  function updateContact(index: number, field: keyof BrokerContact, value: string) {
    const updated = contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    setContacts(updated);
  }

  return (
    <div>
      {/* Hidden field sends JSON to the server action */}
      <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />

      <label className="label-sa mb-2">Contacts</label>
      <div className="space-y-3">
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 rounded-lg border border-purple-500/25 bg-[#0f0719]">
            <div>
              <label className="text-xs text-purple-300">Name</label>
              <input
                className="input-sa"
                placeholder="Contact name"
                value={c.name}
                onChange={(e) => updateContact(i, 'name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-purple-300">Job Title</label>
              <input
                className="input-sa"
                placeholder="e.g. Owner, Dispatcher"
                value={c.jobTitle}
                onChange={(e) => updateContact(i, 'jobTitle', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-purple-300">Phone</label>
              <input
                className="input-sa"
                placeholder="(555) 555-0000"
                value={c.phone}
                onChange={(e) => updateContact(i, 'phone', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-purple-300">Email</label>
              <input
                className="input-sa"
                type="email"
                placeholder="name@example.com"
                value={c.email}
                onChange={(e) => updateContact(i, 'email', e.target.value)}
              />
            </div>
            <div className="flex items-end">
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addContact}
        className="mt-2 text-sm text-purple-400 hover:text-purple-200"
      >
        + Add another contact
      </button>
    </div>
  );
}
