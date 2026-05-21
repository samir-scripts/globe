with staging as (
    select * from {{ ref('stg_worldbank_total_statistics') }}
),

continents as (
    select * from {{ ref('iso3_to_continent') }}
),

coords as (
    select * from {{ ref('iso3_to_coords') }}
),

joined as (
    select
        s.country_name,
        s.iso3,
        c.continent,
        s.reporting_year,
        s.homicide_rate,
        co.latitude,
        co.longitude,
        -- Generate a PostGIS Point geometry (SRID 4326 for WGS84)
        public.ST_SetSRID(public.ST_MakePoint(co.longitude::double precision, co.latitude::double precision), 4326) as geom
    from staging s
    left join continents c on s.iso3 = c.iso3
    left join coords co on s.iso3 = co.iso3
)

select *
from joined
where
    country_name is not null
    and iso3 is not null
    and reporting_year is not null
    and homicide_rate is not null
    and latitude is not null
    and longitude is not null


