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

export function ReportMoneyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M14 12h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H10" />
      <path d="M12 11.5v1M12 18.5v1" />
    </Svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="13" height="10" rx="1" />
      <path d="M15 8.5h3.5l2.5 4V16h-6V8.5z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="19" cy="18" r="1.5" />
    </Svg>
  );
}

export function IdCardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="11" r="2.5" />
      <path d="M5 19a4 4 0 0 1 8 0" />
      <path d="M15 9h3M15 13h2" />
    </Svg>
  );
}

export function ShoppingCartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3h2l2.5 12h9.5l2-8H7" />
      <circle cx="10" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
    </Svg>
  );
}

export function SpeakerphoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 8a3 3 0 0 1 0 6" />
      <path d="M10 8v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5" />
      <path d="M12 8H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h8l7-3-7-3z" />
    </Svg>
  );
}

export function BroadcastIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.343 17.657A8 8 0 0 1 6.343 6.343M17.657 6.343A8 8 0 0 1 17.657 17.657" />
      <path d="M9.172 14.828A4 4 0 0 1 9.172 9.172M14.828 9.172A4 4 0 0 1 14.828 14.828" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CpuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M7 10H4M7 14H4M10 7V4M14 7V4M17 10H20M17 14H20M10 17V20M14 17V20" />
    </Svg>
  );
}

export function LicenseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <path d="M8 7h8M8 11h8M8 15h5" />
      <circle cx="16" cy="17" r="2" />
    </Svg>
  );
}

export function TicketIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 9a2 2 0 0 0 0 4v4a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-4a2 2 0 0 0 0-4V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v3z" />
      <path d="M9 5v14M6 9h1M6 13h1" />
    </Svg>
  );
}

export function UsersGroupIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7" r="3" />
      <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />
      <circle cx="5" cy="8" r="2" />
      <path d="M2 21v-.5A4.5 4.5 0 0 1 5 16" />
      <circle cx="19" cy="8" r="2" />
      <path d="M22 21v-.5A4.5 4.5 0 0 0 19 16" />
    </Svg>
  );
}

export function ShieldLockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 4.5 6v5c0 4.2 3 7.6 7.5 9 4.5-1.4 7.5-4.8 7.5-9V6L12 3Z" />
      <rect x="9.5" y="10.5" width="5" height="4" rx="1" />
      <path d="M11.5 10.5V9.5a1.5 1.5 0 0 1 3 0v1" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6h10M9 12h10M9 18h10" />
      <circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none" />
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

export function CakeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c.7 0 .7 1.5 0 2" />
      <path d="M12 4v3" />
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M3 13.5c1.5-2 3-2 4.5 0s3 2 4.5 0 3 2 4.5 0 3 2 4.5 0" />
    </Svg>
  );
}

export function TableIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 9v12" />
    </Svg>
  );
}

export function PrintIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="2" width="12" height="7" rx="1" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
      <path d="M6 18H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2" />
      <circle cx="17.5" cy="11.5" r=".75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function HeadsetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 14v-3a8 8 0 1 1 16 0v3" />
      <rect x="2" y="13" width="4" height="7" rx="1" />
      <rect x="18" y="13" width="4" height="7" rx="1" />
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

export function RobotIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="M12 3v1" />
      <circle cx="9.5" cy="13" r="1" fill="currentColor" />
      <circle cx="14.5" cy="13" r="1" fill="currentColor" />
      <path d="M9 17h6" />
      <path d="M3 12v3" />
      <path d="M21 12v3" />
    </Svg>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.5 13.5 3 12l1-2 6 1 4.5-5a2 2 0 0 1 3 3l-5 4.5 1 6-2 1-1.5-7.5-3 2v2l-1.5 1L4 15l1.5-1h2z" />
    </Svg>
  );
}

export function ChartDotsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4v16h16" />
      <path d="M7 15l4-4 3 3 5-6" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="11" cy="11" r="1" />
      <circle cx="14" cy="14" r="1" />
      <circle cx="19" cy="8" r="1" />
    </Svg>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1z" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </Svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </Svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h3" />
      <path d="M3 9h13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10.5 19a1.5 1.5 0 0 0 3 0" />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
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
