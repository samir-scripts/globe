with homicides as (
    select * from {{ ref('stg_worldbank_homicides') }}
),

countries as (
    select * from {{ ref('dim_countries') }}
),

joined as (
    select
        h.country_name,
        h.iso3,
        c.continent,
        h.reporting_year,
        h.homicide_rate
    from homicides h
    inner join countries c on h.iso3 = c.iso3
)

select * from joined
