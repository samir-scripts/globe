export type MetricId = 'homicide' | 'sexual_assault';

export interface MetricConfig {
  id: MetricId;
  label: string;
  unit: string;
  rateField: string;
  countField?: string;
  color: string;
}

export const METRICS: MetricConfig[] = [
  {
    id: 'homicide',
    label: 'Homicide',
    unit: 'per 100k',
    rateField: 'homicide_rate',
    color: '#DC2626', // Red
  },
  // Placeholder for future extension
  // {
  //   id: 'sexual_assault',
  //   label: 'Sexual Assault',
  //   unit: 'per 100k',
  //   rateField: 'assault_rate',
  //   color: '#7C3AED', // Purple
  // }
];
