
  
    

  create  table "globe"."public_marts"."mart_crime_americas__dbt_tmp"
  
  
    as
  
  (
    select * from "globe"."public_core"."fct_homicides" where continent = 'Americas'
  );
  