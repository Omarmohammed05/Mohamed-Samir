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
};
