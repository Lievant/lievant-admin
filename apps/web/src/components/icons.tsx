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

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 4.3 2.7 17a1.5 1.5 0 0 0 1.3 2.25h16a1.5 1.5 0 0 0 1.3-2.25L13.7 4.3a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 19h16" />
    </Svg>
  );
}

export function CatalogIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </Svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="3" width="11" height="18" rx="1" />
      <path d="M9 8h1M9 12h1M9 16h1M15 21v-7h4a1 1 0 0 1 1 1v6" />
    </Svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function LaptopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="11" rx="1" />
      <path d="M2 19h20M9 19v-1.5M15 19v-1.5" />
    </Svg>
  );
}

export function SitemapIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <rect x="3" y="15" width="6" height="4" rx="1" />
      <rect x="15" y="15" width="6" height="4" rx="1" />
      <path d="M12 7v4M6 15v-2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2" />
    </Svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </Svg>
  );
}

export function ContractIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 2h9l3 3v17H6Z" />
      <path d="M15 2v3h3M9 11h6M9 14h6M9 17h4" />
    </Svg>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 2h8l4 4v16H6Z" />
      <path d="M14 2v4h4M9 13h6M9 17h6" />
    </Svg>
  );
}

export function LevelsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="14" width="4" height="7" />
      <rect x="10" y="9" width="4" height="12" />
      <rect x="17" y="4" width="4" height="17" />
    </Svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5s6 7 6 11.5a6 6 0 1 1-12 0c0-4.5 6-11.5 6-11.5Z" />
    </Svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20.5 4.5 13a4.5 4.5 0 0 1 6.5-6.2L12 7.5l1-0.7a4.5 4.5 0 0 1 6.5 6.2L12 20.5Z" />
    </Svg>
  );
}

export function FactoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 21V11l6 4v-4l6 4V8l6 4v9Z" />
      <path d="M3 21h18" />
    </Svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    </Svg>
  );
}

export function DoorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="2.5" width="14" height="19" rx="1" />
      <circle cx="14.5" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function TvIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 17v3" />
    </Svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="13" height="12" rx="1.5" />
      <path d="M16 10.5 21 7.5v9l-5-3Z" />
    </Svg>
  );
}

export function WhiteboardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M8 21h8M12 17v4M7 13l3-4 2 2 3-4" />
    </Svg>
  );
}

export function ProjectorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="8" width="14" height="8" rx="1.5" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M16 11h2l3-2v6l-3-2h-2" />
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3h3l1.5 4.5L7.5 9a10 10 0 0 0 6.5 6.5l1.5-2L20 15v3a2 2 0 0 1-2 2C9.7 20 4 14.3 4 6a2 2 0 0 1 1-3Z" />
    </Svg>
  );
}

export function AcIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="6" rx="1.5" />
      <path d="M7 15c0 1.5-1 2-1 3.5M12 15c0 1.5-1 2-1 3.5M17 15c0 1.5-1 2-1 3.5" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
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
