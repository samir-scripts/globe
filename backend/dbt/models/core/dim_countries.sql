with seed_continent as (
    select * from {{ ref('iso3_to_continent') }}
),

seed_coords as (
    select * from {{ ref('iso3_to_coords') }}
)

select
    c.iso3,
    c.continent,
    co.latitude,
    co.longitude,
    -- Generate a PostGIS Point geometry (SRID 4326 for WGS84)
    ST_SetSRID(ST_MakePoint(co.longitude, co.latitude), 4326) as geom
from seed_continent c
left join seed_coords co on c.iso3 = co.iso3
