import GlobeVisualization from "@/components/GlobeVisualization";
import CountryChart from "@/components/CountryChart";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#0C0C0C] overflow-hidden relative">
      <GlobeVisualization />
      <CountryChart />
    </main>
  );
}
