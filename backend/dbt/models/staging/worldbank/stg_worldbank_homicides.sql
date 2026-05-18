with source as (
    select * from {{ source('globe', 'homicide') }}
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
