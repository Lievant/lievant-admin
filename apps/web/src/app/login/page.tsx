import { MicrosoftLogo } from '@/components/icons';
import { getMicrosoftSsoUrl } from '@/lib/cognito';

export default function LoginPage() {
  const ssoUrl = getMicrosoftSsoUrl();

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <span className="text-2xl font-bold tracking-tight text-navy">
            Lievant<span className="text-terracota">.</span>
          </span>
          <h1 className="mt-4 text-xl font-semibold text-navy">Bienvenido a Lievant Admin</h1>
          <p className="mt-2 text-sm text-slate-500">
            Inicia sesión con tu cuenta corporativa de Microsoft para continuar.
          </p>
        </div>

        <a
          href={ssoUrl}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracota focus-visible:ring-offset-2"
        >
          <MicrosoftLogo className="h-5 w-5" />
          Continuar con Microsoft
        </a>

        <p className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Lievant. Acceso restringido a personal autorizado.
        </p>
      </div>
    </main>
  );
}
