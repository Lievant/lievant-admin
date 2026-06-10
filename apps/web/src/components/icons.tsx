import type { SVGProps } from 'react';
import type { ModuleIcon } from '@/lib/modules';

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

export function FinanceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5h3.25a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14" />
    </Svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 13.5c2.9 0 6 1.6 6 4.5v2" />
    </Svg>
  );
}

export function PayrollIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </Svg>
  );
}

export function AccountsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V5a1 1 0 0 1 1-1h10l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M14 4v5h5M8 13h8M8 17h5" />
    </Svg>
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V5a1 1 0 0 1 1-1h7l6 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M11 4v5h6" />
      <path d="M9 13l1.8 1.8L13.5 12" />
    </Svg>
  );
}

export function AdminIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 4.5 6v5c0 4.2 3 7.6 7.5 9 4.5-1.4 7.5-4.8 7.5-9V6L12 3Z" />
      <path d="M9.5 12.25 11.25 14 14.5 10.25" />
    </Svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 13l4 4L19 7" />
    </Svg>
  );
}

export function MicrosoftLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" {...props}>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

const MODULE_ICONS: Record<ModuleIcon, (props: IconProps) => React.ReactElement> = {
  finance: FinanceIcon,
  people: PeopleIcon,
  payroll: PayrollIcon,
  accounts: AccountsIcon,
  reports: ReportsIcon,
  admin: AdminIcon,
};

export function ModuleIconView({ icon, ...props }: { icon: ModuleIcon } & IconProps) {
  const Icon = MODULE_ICONS[icon];
  return <Icon {...props} />;
}
