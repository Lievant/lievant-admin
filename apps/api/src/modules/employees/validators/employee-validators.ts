import { registerDecorator, ValidationOptions } from 'class-validator';
import { ALLOWED_CORPORATE_EMAIL_DOMAINS } from '../constants/company.constant';

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions ?? {},
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return false;
          return date.getTime() <= Date.now();
        },
        defaultMessage(): string {
          return `${propertyName} no puede ser una fecha futura`;
        },
      },
    });
  };
}

export function IsCorporateEmailDomain(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCorporateEmailDomain',
      target: object.constructor,
      propertyName,
      options: validationOptions ?? {},
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const domain = value.split('@')[1]?.toLowerCase();
          return Boolean(domain && ALLOWED_CORPORATE_EMAIL_DOMAINS.includes(domain));
        },
        defaultMessage(): string {
          return `corporateEmail debe pertenecer a uno de los dominios corporativos permitidos (${ALLOWED_CORPORATE_EMAIL_DOMAINS.join(', ')})`;
        },
      },
    });
  };
}
