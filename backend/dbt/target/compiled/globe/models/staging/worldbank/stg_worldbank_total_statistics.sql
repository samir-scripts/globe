with source as (
    select * from "globe"."public"."total_statistics"
),

renamed as (
    select
        "Country" as country_name,
        "ISO3" as iso3,
        "Year" as reporting_year,
        "Homicide Rate" as homicide_rate,
        "sexual_violence" as sexual_violence
    from source
)

select * from renamed