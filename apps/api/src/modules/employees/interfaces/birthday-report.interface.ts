export interface BirthdayReportItem {
  id: string;
  fullName: string;
  area: string | null;
  division: string | null;
  position: string;
  companyCode: string;
  companyName: string;
  seniorityDate: string | null;
  birthDate: string; // "MM-DD"
}
