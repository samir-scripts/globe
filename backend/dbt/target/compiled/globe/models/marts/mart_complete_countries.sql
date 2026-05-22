with staging as (
    select * from "globe"."public_staging"."stg_worldbank_total_statistics"
),

continents as (
    select * from "globe"."public"."iso3_to_continent"
),

coords as (
    select * from "globe"."public"."iso3_to_coords"
),

year_spine as (
    select generate_series(2000, 2022) as reporting_year
),

country_spine as (
    select distinct iso3, country_name from staging
),

grid as (
    select
        c.country_name,
        c.iso3,
        y.reporting_year
    from country_spine c
    cross join year_spine y
),

joined_grid as (
    select
        g.country_name,
        g.iso3,
        g.reporting_year,
        s.homicide_rate
    from grid g
    left join staging s on g.iso3 = s.iso3 and g.reporting_year = s.reporting_year
),

with_latest_year as (
    select
        country_name,
        iso3,
        reporting_year,
        max(case when homicide_rate is not null then reporting_year end) over (
            partition by iso3 
            order by reporting_year 
            rows between unbounded preceding and current row
        ) as latest_year_with_data
    from joined_grid
),

filled as (
    select
        w.country_name,
        w.iso3,
        w.reporting_year,
        w.latest_year_with_data as data_year,
        s.homicide_rate
    from with_latest_year w
    left join staging s on w.iso3 = s.iso3 and w.latest_year_with_data = s.reporting_year
),

joined as (
    select
        f.country_name,
        f.iso3,
        c.continent,
        f.reporting_year,
        f.data_year,
        f.homicide_rate,
        co.latitude,
        co.longitude,
        -- Generate a PostGIS Point geometry (SRID 4326 for WGS84)
        public.ST_SetSRID(public.ST_MakePoint(co.longitude::double precision, co.latitude::double precision), 4326) as geom
    from filled f
    left join continents c on f.iso3 = c.iso3
    left join coords co on f.iso3 = co.iso3
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