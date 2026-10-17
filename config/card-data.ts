export type CardInputRow = {
  tagNo: string;
  unit: string;
  description: string;
  min: string;
  norm: string;
  max: string;
  value?: string;
  /** Sub-label (from the tab's `subLabels`) this row belongs to.
   *  Rows without a group are always visible (shared equipment). */
  group?: string;
  /** Hidden containers are invisible to non-admins; admins see them in edit mode. */
  hidden?: boolean;
};

export type EquipmentTab = {
  id: string;
  label: string;
  subLabels?: string[];
  rows: CardInputRow[];
};

export const CARD_DATA: Record<string, EquipmentTab[]> = {
  F01: [
    {
      id: 'ammonia-feed',
      label: 'Ammonia feed',
      rows: [
        { tagNo: 'LV 121502', unit: '%', description: 'Interm. tank vent valve', min: '0', norm: '100', max: '100' },
        { tagNo: 'FI 121401', unit: 'T/h', description: 'Amm. feed to interm. tank', min: '29', norm: '51', max: '' },
        { tagNo: 'FI 4121405', unit: 'T/h', description: 'Amm. feed to ejector', min: '', norm: '50', max: '' },
        { tagNo: 'TI 121002', unit: 'ºC', description: 'Amm. feed temp.', min: '15', norm: '25', max: '30' },
      ],
    },
    {
      id: 'pumps-ab',
      label: '121P002A/B',
      subLabels: ['121P002A', '121P002B'],
      rows: [
        // Shared (A/B/C suction) — always visible
        { tagNo: 'PI 121201/121204/121303', unit: 'barg', description: 'Amm. Pumps A/B/C suction press.', min: '18', norm: '24', max: '28' },
        // Pump A containers
        { tagNo: 'PI 4121254', unit: 'barg', description: 'Amm. Pump A disch. press.', min: '145', norm: '162.57', max: '175', group: '121P002A' },
        { tagNo: 'PDY 121203', unit: 'barg', description: 'Distance to sat. Point', min: '10', norm: '12', max: '20', group: '121P002A' },
        { tagNo: 'II 121961', unit: 'A', description: 'Main motor current', min: '30', norm: '', max: '60', group: '121P002A' },
        { tagNo: 'SIC 121950', unit: 'RPM', description: 'Pump Speed', min: '85', norm: '110', max: '142', group: '121P002A' },
        { tagNo: 'TI 121021', unit: 'ºC', description: 'Torque conv. Temp.', min: '60', norm: '65', max: '90', group: '121P002A' },
        { tagNo: 'TI 121022', unit: 'ºC', description: 'Gearbox temp.', min: '15', norm: '38', max: '70', group: '121P002A' },
        { tagNo: 'TI 121023', unit: 'ºC', description: 'Crank shaft oil temp.', min: '15', norm: '35', max: '65', group: '121P002A' },
        { tagNo: 'PI 121211', unit: 'barg', description: 'Pump A Crank shaft oil press.', min: '4', norm: '9', max: '10', group: '121P002A' },
        // Pump B containers
        { tagNo: 'PI 4121258', unit: 'barg', description: 'Amm. Pump B disch. press.', min: '145', norm: '162.57', max: '175', group: '121P002B' },
        { tagNo: 'PDY 121206', unit: 'barg', description: 'Distance to sat. Point', min: '10', norm: '12', max: '20', group: '121P002B' },
        { tagNo: 'II 121962', unit: 'A', description: 'Main motor current', min: '30', norm: '', max: '60', group: '121P002B' },
        { tagNo: 'SIC 121951', unit: 'RPM', description: 'Pump Speed', min: '85', norm: '110', max: '142', group: '121P002B' },
        { tagNo: 'TI 121031', unit: 'ºC', description: 'Torque conv. Temp.', min: '60', norm: '65', max: '90', group: '121P002B' },
        { tagNo: 'TI 121032', unit: 'ºC', description: 'Gearbox temp.', min: '15', norm: '38', max: '70', group: '121P002B' },
        { tagNo: 'TI 121033', unit: 'ºC', description: 'Crank shaft oil temp.', min: '15', norm: '35', max: '65', group: '121P002B' },
        { tagNo: 'PI 121221', unit: 'barg', description: 'Pump B Crank shaft oil press.', min: '4', norm: '9', max: '10', group: '121P002B' },
      ],
    },
    {
      id: 'pump-c',
      label: '4121P002C',
      rows: [
        { tagNo: 'PI 4121301', unit: 'barg', description: 'Amm. Pump C disch. Press.', min: '145', norm: '162.57', max: '175' },
        { tagNo: 'II 4121910C', unit: 'A', description: 'Main motor current', min: '', norm: '', max: '' },
        { tagNo: 'SIC 4121904 A/B/C', unit: 'RPM', description: 'Pump Speed', min: '41', norm: '70', max: '110' },
        { tagNo: 'TI 4121102', unit: 'ºC', description: 'Gear Box Temp.', min: '', norm: '', max: '80' },
        { tagNo: 'TI 4121101', unit: 'ºC', description: 'Crank shaft oil temp.', min: '', norm: '', max: '60' },
        { tagNo: 'PI 4121306', unit: 'barg', description: 'Crank shaft oil press.', min: '4', norm: '', max: '' },
        { tagNo: 'TI 4121161/4121162/4121163', unit: 'ºC', description: 'Motor wind. temp.', min: '', norm: '', max: '150' },
        { tagNo: 'TI 4121167/4121168', unit: 'ºC', description: 'Motor bearing temp.', min: '', norm: '', max: '115' },
      ],
    },
  ],
  F02: [
    {
      id: 'co2-air-feed',
      label: 'CO2 & AIR Feed',
      rows: [
        { tagNo: 'Plant Load', unit: '%', description: 'Plant Load', min: '65', norm: '112', max: '115' },
        { tagNo: 'FFIC 1101403', unit: 'mol/mol', description: 'N/C Feed Ratio', min: '1.8', norm: '2', max: '3' },
        { tagNo: 'FI 122403', unit: 'Nm3/h', description: 'Co2 flow to syn.', min: '20000', norm: '35000', max: '' },
        { tagNo: 'PI 122203', unit: 'barg', description: 'CO2 Press.', min: '120', norm: '140', max: '150' },
        { tagNo: 'TI 122017', unit: 'ºC', description: 'CO2 temp.', min: '100', norm: '116', max: '120' },
        { tagNo: 'TDY 120030', unit: 'ºC', description: 'Δ T at H.R.R.', min: '', norm: '', max: '' },
        { tagNo: 'FI 120402', unit: 'Nm3/h', description: 'Passiv. air flow', min: '750', norm: '841.3', max: '1400' },
        { tagNo: 'AI 120701B', unit: 'PPM', description: 'Excess O2% analyzer', min: '0', norm: '0', max: '100' },
        { tagNo: 'AY 120711', unit: '%', description: 'Excess O2% calc.', min: '0.25', norm: '0.27', max: '0.4' },
      ],
    },
    {
      id: '122r001-reactor',
      label: '122R001 Reactor',
      rows: [
        { tagNo: 'FY 4125404', unit: '', description: 'Co2 flow to MP Stripper', min: '', norm: '', max: '' },
        { tagNo: 'LI 122504', unit: '%', description: 'Reactor level', min: '20', norm: '50', max: '80' },
        { tagNo: 'AI 122701', unit: 'mol/mol', description: 'N/C Ratio', min: '3', norm: '2.98', max: '3.3' },
        { tagNo: 'TI 122005', unit: 'ºC', description: 'Reactor top temp.', min: '170', norm: '181', max: '190' },
        { tagNo: 'TI 122008', unit: 'ºC', description: 'Reactor bottom temp.', min: '170', norm: '181', max: '190' },
        { tagNo: 'TI 122014', unit: 'ºC', description: 'US temp.', min: '170', norm: '180', max: '190' },
        { tagNo: 'HV 122605', unit: '%', description: 'US to Stripper', min: '25', norm: '50', max: '70' },
        { tagNo: 'HV 4125602', unit: '%', description: 'US to MP R.C', min: '', norm: '', max: '' },
        { tagNo: 'HV 4125601', unit: '%', description: 'Gases to MP pre-evap.', min: '0', norm: '', max: '100' },
      ],
    },
    {
      id: 'lds',
      label: 'LDS',
      rows: [
        { tagNo: 'PI 122210', unit: 'barg', description: 'Passiv. Air Press.', min: '0.15', norm: '0.2', max: '1' },
        { tagNo: 'PV 122210', unit: '%', description: 'Passiv. air valve', min: '20', norm: '29', max: '50' },
      ],
    },
  ],
};
