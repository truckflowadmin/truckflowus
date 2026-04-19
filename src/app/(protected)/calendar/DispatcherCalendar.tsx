'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TimeOffEvent {
  id: string;
  type: 'timeoff';
  startDate: string;
  endDate: string;
  status: string;
  driverName: string;
  reason: string | null;
}

interface JobEvent {
  id: string;
  type: 'job';
  date: string;
  jobNumber: number;
  name: string;
  status: string;
  driverName: string | null;
  customerName: string | null;
  material: string | null;
  totalLoads: number;
  completedLoads: number;
}

interface TicketEvent {
  id: string;
  type: 'ticket';
  date: string;
  ticketNumber: number;
  status: string;
  driverName: string | null;
  customerName: string | null;
  material: string | null;
  hauledFrom: string;
  hauledTo: string;
}

type CalendarEvent = TimeOffEvent | JobEvent | TicketEvent;

interface Props {
  timeOffEvents: TimeOffEvent[];
  jobEvents: JobEvent[];
  ticketEvents: TicketEvent[];
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const EVENT_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  timeoff_APPROVED: { bg: 'bg-purple-100', dot: 'bg-purple-500', label: 'Time Off' },
  timeoff_PENDING: { bg: 'bg-purple-50', dot: 'bg-purple-300', label: 'Time Off (Pending)' },
  job_CREATED: { bg: 'bg-blue-50', dot: 'bg-blue-400', label: 'Job' },
  job_ASSIGNED: { bg: 'bg-blue-100', dot: 'bg-blue-500', label: 'Job' },
  job_IN_PROGRESS: { bg: 'bg-green-100', dot: 'bg-green-500', label: 'Job' },
  job_COMPLETED: { bg: 'bg-green-50', dot: 'bg-green-400', label: 'Job' },
  ticket_PENDING: { bg: 'bg-amber-50', dot: 'bg-amber-400', label: 'Ticket' },
  ticket_DISPATCHED: { bg: 'bg-amber-100', dot: 'bg-amber-500', label: 'Ticket' },
  ticket_IN_PROGRESS: { bg: 'bg-green-100', dot: 'bg-green-500', label: 'Ticket' },
  ticket_COMPLETED: { bg: 'bg-green-50', dot: 'bg-green-400', label: 'Ticket' },
  ticket_ISSUE: { bg: 'bg-red-100', dot: 'bg-red-500', label: 'Ticket' },
};

function getStyle(event: CalendarEvent) {
  const key = event.type === 'timeoff'
    ? `timeoff_${event.status}`
    : `${event.type}_${event.status}`;
  return EVENT_STYLES[key] || { bg: 'bg-steel-100', dot: 'bg-steel-400', label: event.type };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DispatcherCalendar({ timeOffEvents, jobEvents, ticketEvents }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'timeoff' | 'job' | 'ticket'>('all');

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
    setSelectedDay(null);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }

  // -- Build day → events map --
  function dateKey(y: number, m: number, d: number) {
    return `${y}-${m}-${d}`;
  }

  const dayEventsMap = new Map<string, CalendarEvent[]>();

  function addEvent(y: number, m: number, d: number, ev: CalendarEvent) {
    const key = dateKey(y, m, d);
    if (!dayEventsMap.has(key)) dayEventsMap.set(key, []);
    dayEventsMap.get(key)!.push(ev);
  }

  // Time-off: spans multiple days
  for (const ev of timeOffEvents) {
    const s = new Date(ev.startDate);
    const e = new Date(ev.endDate);
    const cursor = new Date(s);
    while (cursor <= e) {
      addEvent(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), ev);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  // Jobs: single date
  for (const ev of jobEvents) {
    const d = new Date(ev.date);
    addEvent(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), ev);
  }

  // Tickets: single date
  for (const ev of ticketEvents) {
    const d = new Date(ev.date);
    addEvent(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), ev);
  }

  function getDayEvents(day: number): CalendarEvent[] {
    const key = dateKey(viewYear, viewMonth, day);
    const events = dayEventsMap.get(key) || [];
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  // Get unique event type dots for a day (max 3 colored dots)
  function getDayDots(day: number) {
    const events = getDayEvents(day);
    const types = new Set<string>();
    const dots: string[] = [];
    for (const e of events) {
      const t = e.type;
      if (!types.has(t)) {
        types.add(t);
        const s = getStyle(e);
        dots.push(s.dot);
      }
      if (dots.length >= 3) break;
    }
    return dots;
  }

  // Selected day details
  const selectedEvents = selectedDay ? getDayEvents(selectedDay) : [];

  // Event summary for sidebar
  function eventSummary(ev: CalendarEvent): { title: string; subtitle: string; link: string } {
    if (ev.type === 'timeoff') {
      return {
        title: `${ev.driverName} — Time Off`,
        subtitle: ev.status === 'PENDING' ? 'Pending approval' : (ev.reason || 'Approved'),
        link: '/drivers?tab=timeoff',
      };
    }
    if (ev.type === 'job') {
      const driver = ev.driverName ? ` · ${ev.driverName}` : '';
      return {
        title: `Job #${ev.jobNumber} — ${ev.name}`,
        subtitle: `${ev.status.replace('_', ' ')}${driver} · ${ev.totalLoads > 0 ? `${ev.completedLoads}/${ev.totalLoads} loads` : `${ev.completedLoads} loads`}`,
        link: `/jobs/${ev.id}`,
      };
    }
    // ticket
    const tev = ev as TicketEvent;
    const driver = tev.driverName ? ` · ${tev.driverName}` : '';
    return {
      title: `Ticket #${String(tev.ticketNumber).padStart(4, '0')}`,
      subtitle: `${tev.status.replace('_', ' ')}${driver} · ${tev.hauledFrom} → ${tev.hauledTo}`,
      link: '/tickets',
    };
  }

  // Count totals for the month
  const monthTotals = { timeoff: 0, jobs: 0, tickets: 0 };
  for (let d = 1; d <= daysInMonth; d++) {
    const events = getDayEvents(d);
    const seen = new Set<string>();
    for (const e of events) {
      const uid = e.id;
      if (seen.has(uid)) continue;
      seen.add(uid);
      if (e.type === 'timeoff') monthTotals.timeoff++;
      else if (e.type === 'job') monthTotals.jobs++;
      else monthTotals.tickets++;
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost px-3 py-1.5 text-sm">←</button>
          <h2 className="font-bold text-lg text-steel-800 min-w-[180px] text-center">{monthLabel}</h2>
          <button onClick={nextMonth} className="btn-ghost px-3 py-1.5 text-sm">→</button>
          <button onClick={goToday} className="btn-ghost px-3 py-1.5 text-xs ml-2">Today</button>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'timeoff', 'job', 'ticket'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-diesel text-white'
                  : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'timeoff' ? 'Time Off' : f === 'job' ? 'Jobs' : 'Tickets'}
            </button>
          ))}
        </div>
      </div>

      {/* Month summary */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span className="text-steel-600">{monthTotals.timeoff} time-off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-steel-600">{monthTotals.jobs} jobs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-steel-600">{monthTotals.tickets} tickets</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar grid */}
        <div className="panel p-4 flex-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-steel-500 uppercase tracking-wider mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`e-${i}`} className="h-16" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const events = getDayEvents(day);
              const dots = getDayDots(day);
              const isSelected = selectedDay === day;
              const todayRing = isToday(day);

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`h-16 rounded-lg flex flex-col items-center justify-start pt-1.5 text-sm transition-all relative
                    ${todayRing ? 'ring-2 ring-safety' : ''}
                    ${isSelected ? 'bg-diesel text-white' : events.length > 0 ? 'bg-steel-50 hover:bg-steel-100' : 'hover:bg-steel-50'}
                  `}
                >
                  <span className={`text-xs font-semibold ${isSelected ? 'text-white' : todayRing ? 'text-safety-dark' : ''}`}>
                    {day}
                  </span>
                  {events.length > 0 && (
                    <>
                      <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-steel-300' : 'text-steel-500'}`}>
                        {events.length} event{events.length > 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-0.5 mt-1">
                        {dots.map((color, idx) => (
                          <span key={idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : color}`} />
                        ))}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          {selectedDay ? (
            <div className="panel p-4">
              <h3 className="font-bold text-steel-800 mb-3">
                {new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-steel-500">No events this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((ev) => {
                    const style = getStyle(ev);
                    const info = eventSummary(ev);
                    return (
                      <a
                        key={`${ev.type}-${ev.id}`}
                        href={info.link}
                        className={`block rounded-lg p-3 ${style.bg} hover:opacity-80 transition-opacity`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className="text-[10px] uppercase tracking-wider text-steel-500 font-semibold">
                            {style.label}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-steel-900">{info.title}</div>
                        <div className="text-xs text-steel-600 mt-0.5">{info.subtitle}</div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="panel p-8 text-center">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm text-steel-500">Click a day to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
