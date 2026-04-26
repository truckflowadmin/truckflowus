import React, { createContext, useContext, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

type Lang = 'en' | 'es';

interface I18nContextType {
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  t: (k) => k,
  setLang: () => {},
});

const LANG_KEY = 'tf_language';

const translations: Record<string, Record<Lang, string>> = {
  // Tab labels
  'tab.jobs': { en: 'Jobs', es: 'Trabajos' },
  'tab.tickets': { en: 'Tickets', es: 'Boletos' },
  'tab.upload': { en: 'Upload', es: 'Subir' },
  'tab.history': { en: 'History', es: 'Historial' },
  'tab.calendar': { en: 'Calendar', es: 'Calendario' },
  'tab.expenses': { en: 'Expenses', es: 'Gastos' },
  'tab.profile': { en: 'Profile', es: 'Perfil' },

  // Login
  'login.title': { en: 'Driver App', es: 'App del Conductor' },
  'login.phone': { en: 'Phone Number', es: 'Número de Teléfono' },
  'login.pin': { en: 'PIN', es: 'PIN' },
  'login.signIn': { en: 'Sign In', es: 'Iniciar Sesión' },
  'login.forgotPin': { en: 'Forgot PIN?', es: '¿Olvidó su PIN?' },

  // Jobs
  'jobs.welcome': { en: 'Welcome', es: 'Bienvenido' },
  'jobs.myJobs': { en: 'My Jobs', es: 'Mis Trabajos' },
  'jobs.available': { en: 'Available', es: 'Disponibles' },
  'jobs.noJobs': { en: 'No jobs assigned to you', es: 'No tiene trabajos asignados' },
  'jobs.noAvailable': { en: 'No available jobs right now', es: 'No hay trabajos disponibles' },
  'jobs.loads': { en: 'loads', es: 'cargas' },
  'jobs.activeJobs': { en: 'active job', es: 'trabajo activo' },
  'jobs.activeJobsPlural': { en: 'active jobs', es: 'trabajos activos' },

  // Job detail
  'job.start': { en: 'Start Job', es: 'Iniciar Trabajo' },
  'job.resume': { en: 'Resume Job', es: 'Reanudar Trabajo' },
  'job.pause': { en: 'Pause Job', es: 'Pausar Trabajo' },
  'job.complete': { en: 'Complete Job', es: 'Completar Trabajo' },
  'job.cancel': { en: 'Cancel Job', es: 'Cancelar Trabajo' },
  'job.reportIssue': { en: 'Report Issue', es: 'Reportar Problema' },
  'job.claimJob': { en: 'Claim This Job', es: 'Reclamar Trabajo' },
  'job.takePhoto': { en: 'Take Photo', es: 'Tomar Foto' },
  'job.signature': { en: 'Signature', es: 'Firma' },
  'job.route': { en: 'Route', es: 'Ruta' },
  'job.details': { en: 'Details', es: 'Detalles' },
  'job.notes': { en: 'Notes', es: 'Notas' },
  'job.pickup': { en: 'Pickup', es: 'Recogida' },
  'job.delivery': { en: 'Delivery', es: 'Entrega' },
  'job.material': { en: 'Material', es: 'Material' },
  'job.rate': { en: 'Rate', es: 'Tarifa' },
  'job.truck': { en: 'Truck', es: 'Camión' },
  'job.date': { en: 'Date', es: 'Fecha' },

  // Tickets
  'tickets.active': { en: 'Active', es: 'Activos' },
  'tickets.completed': { en: 'Completed', es: 'Completados' },
  'tickets.noActive': { en: 'No active tickets', es: 'No hay boletos activos' },
  'tickets.noCompleted': { en: 'No completed tickets', es: 'No hay boletos completados' },

  // History
  'history.completedJobs': { en: 'Completed', es: 'Completados' },
  'history.tripSheets': { en: 'Trip Sheets', es: 'Hojas de Viaje' },
  'history.noCompleted': { en: 'No completed jobs yet', es: 'No hay trabajos completados' },
  'history.noSheets': { en: 'No trip sheets available', es: 'No hay hojas de viaje' },

  // Calendar
  'calendar.requestTimeOff': { en: 'Request Time Off', es: 'Solicitar Tiempo Libre' },
  'calendar.startDate': { en: 'Start Date', es: 'Fecha de Inicio' },
  'calendar.endDate': { en: 'End Date', es: 'Fecha de Fin' },
  'calendar.reason': { en: 'Reason (optional)', es: 'Motivo (opcional)' },
  'calendar.submitRequest': { en: 'Submit Request', es: 'Enviar Solicitud' },
  'calendar.noRequests': { en: 'No time-off requests', es: 'No hay solicitudes' },
  'calendar.submitted': { en: 'Submitted', es: 'Enviada' },

  // Expenses
  'expenses.total': { en: 'Total Expenses', es: 'Gastos Totales' },
  'expenses.addExpense': { en: 'Add Expense', es: 'Agregar Gasto' },
  'expenses.newExpense': { en: 'New Expense', es: 'Nuevo Gasto' },
  'expenses.amount': { en: 'Amount', es: 'Monto' },
  'expenses.vendor': { en: 'Vendor', es: 'Proveedor' },
  'expenses.description': { en: 'Description', es: 'Descripción' },
  'expenses.category': { en: 'Category', es: 'Categoría' },
  'expenses.fuel': { en: 'Fuel', es: 'Combustible' },
  'expenses.parts': { en: 'Parts', es: 'Piezas' },
  'expenses.other': { en: 'Other', es: 'Otro' },
  'expenses.receipt': { en: 'Receipt Photo', es: 'Foto de Recibo' },
  'expenses.submitExpense': { en: 'Submit Expense', es: 'Enviar Gasto' },
  'expenses.noExpenses': { en: 'No expenses recorded', es: 'No hay gastos registrados' },

  // Profile
  'profile.editProfile': { en: 'Edit Profile', es: 'Editar Perfil' },
  'profile.contact': { en: 'Contact', es: 'Contacto' },
  'profile.address': { en: 'Address', es: 'Dirección' },
  'profile.emergencyContact': { en: 'Emergency Contact', es: 'Contacto de Emergencia' },
  'profile.documents': { en: 'Documents', es: 'Documentos' },
  'profile.notifications': { en: 'Notifications', es: 'Notificaciones' },
  'profile.smsNotifications': { en: 'SMS notifications', es: 'Notificaciones SMS' },
  'profile.app': { en: 'App', es: 'Aplicación' },
  'profile.version': { en: 'Version', es: 'Versión' },
  'profile.lastLogin': { en: 'Last login', es: 'Último acceso' },
  'profile.signOut': { en: 'Sign Out', es: 'Cerrar Sesión' },
  'profile.language': { en: 'Language', es: 'Idioma' },
  'profile.saveChanges': { en: 'Save Changes', es: 'Guardar Cambios' },

  // Upload
  'upload.takePhoto': { en: 'Take Photo', es: 'Tomar Foto' },
  'upload.chooseFromLibrary': { en: 'Choose from Library', es: 'Elegir de Galería' },
  'upload.ticketNumber': { en: 'Ticket Number (optional)', es: 'Número de Boleto (opcional)' },
  'upload.uploadPhoto': { en: 'Upload Ticket Photo', es: 'Subir Foto de Boleto' },
  'upload.success': { en: 'Photo uploaded successfully!', es: '¡Foto subida exitosamente!' },

  // Common
  'common.cancel': { en: 'Cancel', es: 'Cancelar' },
  'common.confirm': { en: 'Confirm', es: 'Confirmar' },
  'common.save': { en: 'Save', es: 'Guardar' },
  'common.delete': { en: 'Delete', es: 'Eliminar' },
  'common.loading': { en: 'Loading...', es: 'Cargando...' },
  'common.error': { en: 'Error', es: 'Error' },
  'common.success': { en: 'Success', es: 'Éxito' },
  'common.notSet': { en: 'Not set', es: 'No definido' },
  'common.phone': { en: 'Phone', es: 'Teléfono' },
  'common.email': { en: 'Email', es: 'Correo' },
  'common.name': { en: 'Name', es: 'Nombre' },

  // GPS
  'gps.trackingActive': { en: 'GPS tracking active', es: 'GPS activo' },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // Load saved language on mount
  React.useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY).then((saved) => {
      if (saved === 'en' || saved === 'es') setLangState(saved);
    });
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    SecureStore.setItemAsync(LANG_KEY, newLang);
  }, []);

  const t = useCallback((key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry.en || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
