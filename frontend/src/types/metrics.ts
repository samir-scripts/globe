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
  {
    id: 'sexual_assault',
    label: 'Sexual Assault',
    unit: '% of women',
    rateField: 'sexual_violence',
    color: '#8B5CF6', // Purple
  }
];
