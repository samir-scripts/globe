
  
    

  create  table "globe"."public_core"."fct_homicides__dbt_tmp"
  
  
    as
  
  (
    with homicides as (
    select * from "globe"."public_staging"."stg_worldbank_homicides"
),

countries as (
    select * from "globe"."public_core"."dim_countries"
),

joined as (
    select
        h.country_name,
        h.iso3,
        c.continent,
        h.reporting_year,
        h.homicide_rate,
        c.geom
    from homicides h
    inner join countries c on h.iso3 = c.iso3
)

select * from joined
  );
  