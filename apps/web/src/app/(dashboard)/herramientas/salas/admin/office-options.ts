import type { CountryWithCities } from '@/lib/api';

export interface OfficeOption {
  id: string;
  name: string;
  cityName: string;
  countryName: string;
}

export function flattenOffices(tree: CountryWithCities[], officeIds: string[], isGlobalAdmin: boolean): OfficeOption[] {
  const result: OfficeOption[] = [];
  for (const country of tree) {
    for (const city of country.cities) {
      for (const office of city.offices) {
        if (isGlobalAdmin || officeIds.includes(office.id)) {
          result.push({ id: office.id, name: office.name, cityName: city.name, countryName: country.name });
        }
      }
    }
  }
  return result;
}
