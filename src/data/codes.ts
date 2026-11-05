export const FILE_NAME = "Data_Standards_CODE_LIST_20261104.csv";

export type Row = {
  codeType: string;
  code: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  modified: string;
};

export type CodeColumn =
  | "employment_status_code"
  | "gender_code"
  | "marital_status_code"
  | "aboriginal_status_code"
  | "sex_at_birth_code"
  | "state_or_territory_code";

export type Domain = {
  codeType: string;
  label: string;
  mapFile: string;
  refTable: string;
  column: CodeColumn;
  selectAs: string;
  alias: string;
  caution?: string;
};

type Spec = {
  codeType: string;
  modified: string;
  items: [code: string, description: string][];
};

const SPECS: Spec[] = [
  {
    codeType: "EMPLOYMENT_STATUS_CODE",
    modified: "2026-09-17 12:16:31",
    items: [
      ["1", "Child not at school"],
      ["2", "Student"],
      ["3", "Employed"],
      ["4", "Unemployed"],
      ["5", "Home duties"],
      ["6", "Retired"],
      ["7", "Pensioner"],
      ["8", "Other"],
      ["9", "Not stated/inadequately described."],
    ],
  },
  {
    codeType: "GENDER_CODE",
    modified: "2026-09-17 12:16:30",
    items: [
      ["1", "Man, or boy, or male"],
      ["2", "Woman, or girl, or female"],
      ["3", "Non-binary"],
      ["4", "Different term"],
      ["5", "Prefer not to answer"],
      ["9", "Not stated or inadequately described."],
    ],
  },
  {
    codeType: "MARITAL_STATUS_CODE",
    modified: "2026-09-17 12:16:31",
    items: [
      ["1", "Never married"],
      ["2", "Widowed"],
      ["3", "Divorced"],
      ["4", "Separated"],
      ["5", "Married (registered or de facto)"],
      ["6", "Not stated/Unknown/Inadequately Described"],
    ],
  },
  {
    codeType: "PERS_ABORIGINAL_STATUS_CODE",
    modified: "2026-08-27 13:51:44",
    items: [
      ["1", "Aboriginal but not Torres Strait Islander Origin"],
      ["2", "Torres Strait Islander but not Aboriginal Origin"],
      ["3", "Both Aboriginal and Torres Strait Islander Origin"],
      ["4", "Neither Aboriginal nor Torres Strait Islander"],
      ["9", "Not stated/Inadequately described"],
    ],
  },
  {
    codeType: "SEX_AT_BIRTH_CODE",
    modified: "2026-09-17 12:16:31",
    items: [
      ["1", "Male"],
      ["2", "Female"],
      ["3", "Another term"],
      ["9", "Not stated/inadequately described"],
    ],
  },
  {
    codeType: "STATE_ OR_TERRITORY_CODE",
    modified: "2026-09-17 12:16:31",
    items: [
      ["1", "New South Wales"],
      ["2", "Victoria"],
      ["3", "Queensland"],
      ["4", "South Australia"],
      ["5", "Western Australia"],
      ["6", "Tasmania"],
      ["7", "Northern Territory"],
      ["8", "Australian Capital Territory"],
      ["9", "Other Territories"],
    ],
  },
];

export const ROWS: Row[] = SPECS.flatMap((spec) =>
  spec.items.map(([code, description]) => ({
    codeType: spec.codeType,
    code,
    description,
    effectiveFrom: "1600-01-01",
    effectiveTo: "9999-01-01",
    modified: spec.modified,
  })),
);

export const DOMAINS: Domain[] = [
  {
    codeType: "EMPLOYMENT_STATUS_CODE",
    label: "Employment status",
    mapFile: "map_employment_status.csv",
    refTable: "ref_employment_status",
    column: "employment_status_code",
    selectAs: "employment_status",
    alias: "emp",
  },
  {
    codeType: "GENDER_CODE",
    label: "Gender",
    mapFile: "map_gender.csv",
    refTable: "ref_gender",
    column: "gender_code",
    selectAs: "gender",
    alias: "gen",
  },
  {
    codeType: "MARITAL_STATUS_CODE",
    label: "Marital status",
    mapFile: "map_marital_status.csv",
    refTable: "ref_marital_status",
    column: "marital_status_code",
    selectAs: "marital_status",
    alias: "mar",
  },
  {
    codeType: "PERS_ABORIGINAL_STATUS_CODE",
    label: "Aboriginal and Torres Strait Islander status",
    mapFile: "map_aboriginal_status.csv",
    refTable: "ref_aboriginal_status",
    column: "aboriginal_status_code",
    selectAs: "aboriginal_status",
    alias: "ats",
  },
  {
    codeType: "SEX_AT_BIRTH_CODE",
    label: "Sex at birth",
    mapFile: "map_sex_at_birth.csv",
    refTable: "ref_sex_at_birth",
    column: "sex_at_birth_code",
    selectAs: "sex_at_birth",
    alias: "sab",
  },
  {
    codeType: "STATE_ OR_TERRITORY_CODE",
    label: "State or territory",
    mapFile: "map_state_or_territory.csv",
    refTable: "ref_state_territory",
    column: "state_or_territory_code",
    selectAs: "state_or_territory",
    alias: "stt",
    caution:
      "The export has an accidental space in this name (STATE_ OR_TERRITORY_CODE). Engineering tidies it in the mapping file. The numbers stay the same.",
  },
];

export type RecordRow = { id: string } & Record<CodeColumn, string>;

/** Illustrative warehouse rows. Not real people. Codes are from the export. */
export const RECORDS: RecordRow[] = [
  {
    id: "1042",
    employment_status_code: "3",
    gender_code: "2",
    marital_status_code: "5",
    aboriginal_status_code: "4",
    sex_at_birth_code: "2",
    state_or_territory_code: "5",
  },
  {
    id: "1188",
    employment_status_code: "2",
    gender_code: "1",
    marital_status_code: "1",
    aboriginal_status_code: "4",
    sex_at_birth_code: "1",
    state_or_territory_code: "3",
  },
  {
    id: "1204",
    employment_status_code: "4",
    gender_code: "3",
    marital_status_code: "4",
    aboriginal_status_code: "1",
    sex_at_birth_code: "2",
    state_or_territory_code: "1",
  },
  {
    id: "1310",
    employment_status_code: "6",
    gender_code: "1",
    marital_status_code: "2",
    aboriginal_status_code: "9",
    sex_at_birth_code: "1",
    state_or_territory_code: "8",
  },
];

export function rowsOf(codeType: string): Row[] {
  return ROWS.filter((row) => row.codeType === codeType);
}

export function findRow(codeType: string, code: string): Row | undefined {
  return ROWS.find((row) => row.codeType === codeType && row.code === code);
}

export function domainFor(codeType: string): Domain {
  const found = DOMAINS.find((domain) => domain.codeType === codeType);
  if (!found) throw new Error(`Unknown code type ${codeType}`);
  return found;
}

export function csvLine(row: Row): string {
  const description = /[",\n]/.test(row.description)
    ? `"${row.description.replaceAll('"', '""')}"`
    : row.description;
  return [
    row.codeType,
    row.code,
    description,
    row.effectiveFrom,
    row.effectiveTo,
    row.modified,
  ].join(",");
}
