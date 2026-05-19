export const GET_HOMICIDE_DATA = `
  query GetHomicideData($year: Int) {
    fct_homicides(where: {reporting_year: {_eq: $year}}) {
      country_name
      iso3
      continent
      reporting_year
      homicide_rate
      geom
    }
  }
`;

export const GET_HOMICIDE_DATA_BY_CONTINENT = `
  query GetHomicideDataByContinent($year: Int, $continent: String) {
    fct_homicides(where: {reporting_year: {_eq: $year}, continent: {_eq: $continent}}) {
      country_name
      iso3
      continent
      reporting_year
      homicide_rate
      geom
    }
  }
`;

export const GET_HOMICIDE_TIME_SERIES = `
  query GetHomicideTimeSeries($iso3: String!) {
    fct_homicides(
      where: { iso3: { _eq: $iso3 } }
      order_by: { reporting_year: asc }
    ) {
      reporting_year
      homicide_rate
      country_name
    }
  }
`;
