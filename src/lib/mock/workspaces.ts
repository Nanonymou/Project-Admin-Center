export type Workspace = {
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string;
  locationId: string;
  locationName: string;
  invoicePeriod: string;
};

export const MOCK_WORKSPACES: Workspace[] = [
  {
    projectId: "prj-buma-tabang",
    projectCode: "BUMA",
    projectName: "BUMA Tabang",
    client: "BUMA",
    locationId: "loc-km22",
    locationName: "KM22",
    invoicePeriod: "15 - 14",
  },
  {
    projectId: "prj-buma-tabang",
    projectCode: "BUMA",
    projectName: "BUMA Tabang",
    client: "BUMA",
    locationId: "loc-km92",
    locationName: "KM92",
    invoicePeriod: "15 - 14",
  },
  {
    projectId: "prj-pomala",
    projectCode: "POMALA",
    projectName: "Pomala",
    client: "Aneka Tambang",
    locationId: "loc-pomala",
    locationName: "Pomala",
    invoicePeriod: "1 - Akhir Bulan",
  },
  {
    projectId: "prj-phss",
    projectCode: "PHSS",
    projectName: "PHSS",
    client: "Pertamina",
    locationId: "loc-muara-badak",
    locationName: "Muara Badak",
    invoicePeriod: "1 - Akhir Bulan",
  },
  {
    projectId: "prj-phss",
    projectCode: "PHSS",
    projectName: "PHSS",
    client: "Pertamina",
    locationId: "loc-mutiara",
    locationName: "Mutiara",
    invoicePeriod: "1 - Akhir Bulan",
  },
  {
    projectId: "prj-phkt",
    projectCode: "PHKT",
    projectName: "PHKT",
    client: "Pertamina",
    locationId: "loc-santan",
    locationName: "Santan",
    invoicePeriod: "1 - Akhir Bulan",
  },
  {
    projectId: "prj-phkt",
    projectCode: "PHKT",
    projectName: "PHKT",
    client: "Pertamina",
    locationId: "loc-attaka-nib",
    locationName: "Attaka NIB",
    invoicePeriod: "1 - Akhir Bulan",
  },
];

export const CURRENT_USER = {
  id: "usr-001",
  name: "Randi Setiawan",
  email: "unyil.randi@gmail.com",
  role: "Leader Admin",
  initials: "RS",
};
