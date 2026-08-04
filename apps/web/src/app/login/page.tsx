import { MicrosoftLogo } from '@/components/icons';

const MODULE_CHIPS = [
  { icon: '🏢', label: 'Clientes y cuentas' },
  { icon: '📦', label: 'Proveedores y compras' },
  { icon: '👥', label: 'Recursos Humanos' },
  { icon: '🔑', label: 'Administración del sistema' },
];

const ERROR_MESSAGES: Record<string, string> = {
  sso: 'No se pudo completar el inicio de sesión con Microsoft. Intenta nuevamente.',
  unregistered: 'Tu cuenta no está registrada en el sistema. Contacta a un administrador.',
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.sso) : null;

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: branding */}
      <div className="relative flex w-full flex-col overflow-hidden bg-black p-10 lg:w-[60%]">
        {/* Halos sutiles en blanco: sobre negro el acento oscuro anterior era invisible. */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white opacity-[0.04]" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-white opacity-[0.03]" />

        <div className="relative inline-flex w-fit flex-col items-center">
          <img src="/images/lievant-logo.png" alt="Lievant" className="h-9 w-auto" />
          <p className="mt-2 text-sm font-light tracking-[0.3em] text-white">LIEVANT ADMIN</p>
        </div>

        <div className="mt-auto mb-8 max-w-md">
          <p className="mb-3 text-[10px] tracking-[0.2em] text-white/45 uppercase">
            Sistema Administrativo
          </p>
          <h2 className="mb-3 text-2xl leading-tight font-black text-white">
            Gestión centralizada
            <br />
            para toda la agencia.
          </h2>
          <p className="text-sm leading-relaxed text-white/55">
            Accede a tus módulos de trabajo con tu cuenta corporativa de Lievant. Un solo inicio
            de sesión para todo.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[9px] tracking-[0.2em] text-white/35 uppercase">
            Módulos disponibles
          </p>
          <div className="flex flex-wrap gap-2">
            {MODULE_CHIPS.map((chip) => (
              <div
                key={chip.label}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/70"
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-[9px] leading-relaxed text-white/25">
          system.lievant.com · Acceso restringido a colaboradores Lievant
          <br />
          © {new Date().getFullYear()} Lievant — Dirección de Transformación Digital
        </div>
      </div>

      {/* Right: login card */}
      <div className="flex w-full items-center justify-center bg-white p-10 lg:w-[40%]">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-black text-navy">Bienvenido</h1>
          <p className="mt-1 mb-6 text-xs text-slate-500">
            Inicia sesión con tu cuenta corporativa @lievant.com
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              {errorMessage}
            </div>
          )}

          <a
            href="/api/auth/login"
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg bg-black px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            <MicrosoftLogo className="h-[18px] w-[18px]" />
            Continuar con cuenta Microsoft
          </a>

          <div className="mb-5 rounded-lg border border-black/20 bg-zinc-50 px-4 py-3">
            <p className="mb-0.5 text-xs font-semibold text-black">Autenticación SSO</p>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Serás redirigido a Microsoft para verificar tu identidad. Solo se aceptan cuentas{' '}
              <span className="font-semibold">@lievant.com</span>. Se requerirá MFA en todos los
              accesos.
            </p>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] text-slate-400">¿Problemas para acceder?</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <a
            href="mailto:transformaciondigital@lievant.com"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-navy transition-colors hover:border-black"
          >
            ✉ Contactar a soporte de TI
          </a>

          <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-400">
            Al iniciar sesión aceptas las
            <br />
            <a href="#" className="text-black underline">
              Políticas de seguridad de la información
            </a>{' '}
            de Lievant.
            <br />
            Versión 1.0 · Junio 2026
          </p>
        </div>
      </div>
    </main>
  );
}
