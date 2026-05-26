import GlobeVisualization from "@/components/GlobeVisualization";
import CountryChart from "@/components/CountryChart";
import GlobalFilters from "@/components/GlobalFilters";
import { fetchGraphQL } from "@/lib/hasura";
import { GET_ALL_DATA } from "@/queries/crime";

export default async function Home() {
  let initialData = [];
  try {
    const response = await fetchGraphQL(GET_ALL_DATA) as { mart_complete_countries?: any[] };
    initialData = response?.mart_complete_countries || [];
  } catch (err) {
    console.error("Error pre-fetching data on server:", err);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#0C0C0C] overflow-hidden relative">
      <GlobeVisualization initialData={initialData} />
      <GlobalFilters />
      <CountryChart />
    </main>
  );
}
