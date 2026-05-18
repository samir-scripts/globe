with seed_data as (
    select * from "globe"."public"."iso3_to_continent"
)

select
    iso3,
    continent
from seed_data