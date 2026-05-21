with staging as (
    select * from {{ ref('stg_worldbank_total_statistics') }}
)

select *
from staging
where
    country_name is not null
    and iso3 is not null
    and reporting_year is not null
    and homicide_rate is not null
    and latitude is not null
    and longitude is not null
