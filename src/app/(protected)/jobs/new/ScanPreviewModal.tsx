'use client';

import { useState } from 'react';

export interface ScanPreviewData {
  customerName: string;
  hauledFromName: string;
  hauledFromAddress: string;
  hauledToName: string;
  hauledToAddress: string;
  material: string;
  quantity: string;
  quantityType: string;
  ratePerUnit: string;
  date: string;
  notes: string;
  brokerName: string;
  truckNumber: string;
  driverName: string;
  rawText: string;
}

interface Props {
  imageUrl: string;
  data: ScanPreviewData;
  hasError: boolean;
  errorMessage?: string;
  onConfirm: (data: ScanPreviewData) => void;
  onCancel: () => void;
}

export default function ScanPreviewModal({ imageUrl, data, hasError, errorMessage, onConfirm, onCancel }: Props) {
  const [fields, setFields] = useState<ScanPreviewData>(data);

  function update(key: keyof ScanPreviewData, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Count non-empty fields (excluding rawText)
  const fieldKeys = Object.keys(fields).filter((k) => k !== 'rawText') as (keyof ScanPreviewData)[];
  const filledCount = fieldKeys.filter((k) => fields[k]?.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" onClick={onCancel}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 my-8 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-steel-200">
          <div>
            <h2 className="text-lg font-bold text-steel-900">Scan Preview</h2>
            <p className="text-xs text-steel-500 mt-0.5">
              {filledCount} field{filledCount !== 1 ? 's' : ''} detected — review and edit before filling the form
            </p>
          </div>
          <button type="button" onClick={onCancel} className="text-steel-400 hover:text-steel-600 text-xl leading-none p-1">
            {'\u2715'}
          </button>
        </div>

        {/* Error banner */}
        {hasError && errorMessage && (
          <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Image preview */}
          <div className="flex justify-center">
            <div className="relative rounded-lg overflow-hidden border border-steel-200 bg-steel-50 max-h-48 w-full flex items-center justify-center">
              <img
                src={imageUrl}
                alt="Scanned document"
                className="max-h-48 object-contain"
              />
            </div>
          </div>

          {/* Extracted text toggle */}
          {fields.rawText && (
            <details className="text-xs">
              <summary className="text-steel-500 cursor-pointer hover:text-steel-700 font-medium">
                View extracted text
              </summary>
              <pre className="mt-2 bg-steel-50 border border-steel-200 rounded-lg p-3 text-steel-600 whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
                {fields.rawText}
              </pre>
            </details>
          )}

          {/* Fields grid */}
          <div className="space-y-4">
            {/* Job Name / Customer */}
            <FieldRow
              label="Job Name / Customer"
              value={fields.customerName}
              onChange={(v) => update('customerName', v)}
              placeholder="e.g. Tomahawk"
            />

            {/* Route */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldRow
                  label="Hauled From"
                  value={fields.hauledFromName}
                  onChange={(v) => update('hauledFromName', v)}
                  placeholder="Pickup location name"
                />
                <FieldRow
                  label="From Address"
                  value={fields.hauledFromAddress}
                  onChange={(v) => update('hauledFromAddress', v)}
                  placeholder="Street address"
                  small
                />
              </div>
              <div className="space-y-2">
                <FieldRow
                  label="Hauled To"
                  value={fields.hauledToName}
                  onChange={(v) => update('hauledToName', v)}
                  placeholder="Delivery location name"
                />
                <FieldRow
                  label="To Address"
                  value={fields.hauledToAddress}
                  onChange={(v) => update('hauledToAddress', v)}
                  placeholder="Street address"
                  small
                />
              </div>
            </div>

            {/* Material, Quantity, Rate */}
            <div className="grid grid-cols-3 gap-3">
              <FieldRow
                label="Material"
                value={fields.material}
                onChange={(v) => update('material', v)}
                placeholder="e.g. Fill"
              />
              <FieldRow
                label="Quantity"
                value={fields.quantity}
                onChange={(v) => update('quantity', v)}
                placeholder="# loads"
              />
              <FieldRow
                label="Rate/Unit"
                value={fields.ratePerUnit}
                onChange={(v) => update('ratePerUnit', v)}
                placeholder="e.g. 85"
              />
            </div>

            {/* Quantity Type & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">Unit Type</label>
                <select
                  className="w-full text-sm border border-steel-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-safety/40 focus:border-safety"
                  value={fields.quantityType}
                  onChange={(e) => update('quantityType', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="LOADS">Loads</option>
                  <option value="TONS">Tons</option>
                  <option value="YARDS">Yards</option>
                </select>
              </div>
              <FieldRow
                label="Date"
                value={fields.date}
                onChange={(v) => update('date', v)}
                placeholder="YYYY-MM-DD"
                type="date"
              />
            </div>

            {/* Broker, Truck, Driver */}
            <div className="grid grid-cols-3 gap-3">
              <FieldRow
                label="Broker"
                value={fields.brokerName}
                onChange={(v) => update('brokerName', v)}
                placeholder="Broker name"
              />
              <FieldRow
                label="Truck #"
                value={fields.truckNumber}
                onChange={(v) => update('truckNumber', v)}
                placeholder="e.g. 4457-319"
              />
              <FieldRow
                label="Driver"
                value={fields.driverName}
                onChange={(v) => update('driverName', v)}
                placeholder="Driver name"
              />
            </div>

            {/* Notes */}
            <FieldRow
              label="Notes"
              value={fields.notes}
              onChange={(v) => update('notes', v)}
              placeholder="Special instructions..."
              multiline
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-steel-200 bg-steel-50 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(fields)}
            className="btn-accent text-sm inline-flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Use These Fields
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline editable field row with filled/empty indicator */
function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  small,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  small?: boolean;
  multiline?: boolean;
}) {
  const filled = value?.trim().length > 0;

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-steel-600 mb-1">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            filled ? 'bg-green-500' : 'bg-steel-300'
          }`}
        />
        {label}
      </label>
      {multiline ? (
        <textarea
          className={`w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-safety/40 focus:border-safety resize-none ${
            filled ? 'border-green-300 bg-green-50/30' : 'border-steel-200'
          }`}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          className={`w-full border rounded-lg px-3 focus:ring-2 focus:ring-safety/40 focus:border-safety ${
            small ? 'text-xs py-1' : 'text-sm py-1.5'
          } ${filled ? 'border-green-300 bg-green-50/30' : 'border-steel-200'}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
