import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  section: string;
  module: string;
  action: string;
}

export const RequirePermission = (section: string, module: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { section, module, action } satisfies RequiredPermission);
