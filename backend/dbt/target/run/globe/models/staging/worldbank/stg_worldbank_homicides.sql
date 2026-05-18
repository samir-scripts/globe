
  create view "globe"."public_staging"."stg_worldbank_homicides__dbt_tmp"
    
    
  as (
    with source as (
    select * from "globe"."public"."homicide"
),

renamed as (
    select
        "Country" as country_name,
        "ISO3" as iso3,
        "Year" as reporting_year,
        "Homicide Rate" as homicide_rate
    from source
)

select * from renamed
  );