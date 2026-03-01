import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  DollarSign,
  CalendarDays,
  Bell,
  Palette,
  LayoutGrid,
  Download,
  Trash2,
  ChevronRight,
  Sun,
  Moon,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/apiClient';
import { useNavigate } from 'react-router-dom';

// ── Helpers ─────────────────────────────────────────────────
function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary-400" />
      </div>
      <h2 className="text-sm font-semibold text-surface-50">{label}</h2>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-surface-700 last:border-0">
      <div className="mr-4">
        <p className="text-sm font-medium text-surface-50">{label}</p>
        {description && <p className="text-xs text-surface-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-surface-700'}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-surface-700 border border-surface-600 text-surface-50 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ── Main component ───────────────────────────────────────────
export default function SettingsPage() {
  const navigate = useNavigate();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const logout = useAuthStore((s) => s.logout);

  const settings = useSettingsStore();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const showSaved = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await apiClient.get('/transactions?limit=10000');
      const rows = [
        ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'Moneda', 'Método'],
        ...(data?.data?.transactions ?? []).map((t: Record<string, unknown>) => [
          t.date,
          t.type,
          t.description,
          (t.category as Record<string, unknown>)?.nameEs ?? '',
          (typeof t.amount === 'number' ? (t.amount / 100).toFixed(2) : t.amount),
          t.currency,
          t.paymentMethod ?? '',
        ]),
      ];
      const csv = rows.map((r) => r.map(String).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowfy-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiClient.delete('/auth/account');
      await logout();
      navigate('/login');
    } catch {
      // Backend endpoint may not exist yet — at least notify
      alert('No se pudo eliminar la cuenta. Contactá soporte.');
    }
  };

  const sections = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'appearance', label: 'Apariencia', icon: Palette },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'data', label: 'Datos & Cuenta', icon: Download },
  ];

  const [activeSection, setActiveSection] = useState('general');

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto">
      {/* Sidebar menu */}
      <aside className="md:w-52 flex-shrink-0">
        <div className="card p-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeSection === id
                  ? 'bg-primary-500/15 text-primary-400'
                  : 'text-surface-400 hover:text-surface-50 hover:bg-surface-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <ChevronRight className={`ml-auto w-3.5 h-3.5 transition-opacity ${activeSection === id ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="card"
        >
          {/* ── General ─────────────────────────────── */}
          {activeSection === 'general' && (
            <>
              <SectionTitle icon={Globe} label="General" />
              <div className="divide-y divide-surface-700">
                <SettingRow label="Idioma" description="Idioma de la interfaz">
                  <Select
                    value={settings.language}
                    onChange={(v) => { settings.setLanguage(v); showSaved(); }}
                    options={[
                      { value: 'es', label: '🇺🇾 Español' },
                      { value: 'en', label: '🇺🇸 English' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Moneda por defecto" description="Al registrar nuevos movimientos">
                  <Select
                    value={settings.defaultCurrency}
                    onChange={(v) => { settings.setDefaultCurrency(v); showSaved(); }}
                    options={[
                      { value: 'UYU', label: '$ Peso uruguayo' },
                      { value: 'USD', label: '$ Dólar' },
                      { value: 'EUR', label: '€ Euro' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Formato de fecha">
                  <Select
                    value={settings.dateFormat}
                    onChange={(v) => { settings.setDateFormat(v); showSaved(); }}
                    options={[
                      { value: 'dd/MM/yyyy', label: '31/12/2025' },
                      { value: 'MM/dd/yyyy', label: '12/31/2025' },
                      { value: 'yyyy-MM-dd', label: '2025-12-31' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Mostrar centavos siempre" description="Ej: $1.500,00 vs $1.500">
                  <Toggle value={settings.showCentsAlways} onChange={(v) => { settings.setShowCentsAlways(v); showSaved(); }} />
                </SettingRow>
              </div>
            </>
          )}

          {/* ── Apariencia ──────────────────────────── */}
          {activeSection === 'appearance' && (
            <>
              <SectionTitle icon={Palette} label="Apariencia" />
              <div className="divide-y divide-surface-700">
                <SettingRow label="Tema" description="Claro u oscuro según preferencia">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => theme !== 'light' && toggleTheme()}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        theme === 'light'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                          : 'border-surface-600 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" /> Claro
                    </button>
                    <button
                      onClick={() => theme !== 'dark' && toggleTheme()}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        theme === 'dark'
                          ? 'bg-primary-500/15 border-primary-500/40 text-primary-400'
                          : 'border-surface-600 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" /> Oscuro
                    </button>
                  </div>
                </SettingRow>
                <SettingRow label="Modo compacto" description="Tablas y listas más densas, menos padding">
                  <Toggle value={settings.compactMode} onChange={(v) => { settings.setCompactMode(v); showSaved(); }} />
                </SettingRow>
              </div>
            </>
          )}

          {/* ── Notificaciones ──────────────────────── */}
          {activeSection === 'notifications' && (
            <>
              <SectionTitle icon={Bell} label="Notificaciones" />
              <div className="divide-y divide-surface-700">
                <SettingRow label="Notificaciones por email" description="Avisos del sistema enviados a tu email">
                  <Toggle value={settings.emailNotifications} onChange={(v) => { settings.setEmailNotifications(v); showSaved(); }} />
                </SettingRow>
                <SettingRow label="Alertas de presupuesto" description="Cuando superás el 80% del presupuesto">
                  <Toggle value={settings.budgetAlerts} onChange={(v) => { settings.setBudgetAlerts(v); showSaved(); }} />
                </SettingRow>
                <SettingRow label="Alertas de metas" description="Progreso y logros de ahorro">
                  <Toggle value={settings.goalAlerts} onChange={(v) => { settings.setGoalAlerts(v); showSaved(); }} />
                </SettingRow>
                <SettingRow label="Reporte semanal" description="Resumen de movimientos cada lunes">
                  <Toggle value={settings.weeklyReport} onChange={(v) => { settings.setWeeklyReport(v); showSaved(); }} />
                </SettingRow>
              </div>
              <p className="text-xs text-surface-500 mt-4">
                Las notificaciones push requieren que la app esté instalada como PWA.
              </p>
            </>
          )}

          {/* ── Datos & Cuenta ──────────────────────── */}
          {activeSection === 'data' && (
            <>
              <SectionTitle icon={Download} label="Datos & Cuenta" />
              <div className="space-y-3">
                {/* Export */}
                <div className="p-4 rounded-xl border border-surface-700 bg-surface-800/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-surface-50">Exportar mis datos</p>
                      <p className="text-xs text-surface-400 mt-1">
                        Descargá todos tus movimientos en formato CSV. Compatible con Excel.
                      </p>
                    </div>
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {exporting ? 'Exportando...' : 'Exportar CSV'}
                    </button>
                  </div>
                </div>

                {/* Data info */}
                <div className="p-4 rounded-xl border border-surface-700 bg-surface-800/50">
                  <div className="flex items-start gap-3">
                    <LayoutGrid className="w-4 h-4 text-accent-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-surface-50">Importar movimientos</p>
                      <p className="text-xs text-surface-400 mt-1">
                        Próximamente: importación de extractos bancarios (OFX, CSV de bancos UY).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delete zone */}
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-rose-400">Zona peligrosa</p>
                      <p className="text-xs text-surface-400 mt-1 mb-3">
                        Eliminar la cuenta borra permanentemente todos tus datos. Esta acción no se puede deshacer.
                      </p>
                      {!deleteConfirm ? (
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-500/40 text-rose-400 text-sm font-medium hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar mi cuenta
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-rose-300">¿Estás seguro? No hay vuelta atrás.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeleteConfirm(false)}
                              className="px-4 py-2 rounded-xl border border-surface-600 text-surface-400 text-sm hover:bg-surface-700 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleDeleteAccount}
                              className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-colors"
                            >
                              Sí, eliminar todo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Save feedback */}
          {saveStatus === 'saved' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-2 text-xs text-positive font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              Cambios guardados automáticamente
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
