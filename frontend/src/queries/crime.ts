export const GET_HOMICIDE_DATA = `
  query GetHomicideData($year: Int) {
    mart_complete_countries(where: {reporting_year: {_eq: $year}}) {
      country_name
      iso3
      continent
      reporting_year
      data_year
      sv_data_year
      homicide_rate
      sexual_violence
      geom
    }
  }
`;

export const GET_HOMICIDE_DATA_BY_CONTINENT = `
  query GetHomicideDataByContinent($year: Int, $continent: String) {
    mart_complete_countries(where: {reporting_year: {_eq: $year}, continent: {_eq: $continent}}) {
      country_name
      iso3
      continent
      reporting_year
      data_year
      sv_data_year
      homicide_rate
      sexual_violence
      geom
    }
  }
`;

export const GET_HOMICIDE_TIME_SERIES = `
  query GetHomicideTimeSeries($iso3: String!) {
    mart_complete_countries(
      where: { iso3: { _eq: $iso3 } }
      order_by: { reporting_year: asc }
    ) {
      reporting_year
      homicide_rate
      sexual_violence
      country_name
    }
  }
`;
