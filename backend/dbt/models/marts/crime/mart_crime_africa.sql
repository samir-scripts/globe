select * from {{ ref('fct_homicides') }} where continent = 'Africa'
