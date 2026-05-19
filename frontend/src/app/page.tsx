import GlobeVisualization from "@/components/GlobeVisualization";
import CountryChart from "@/components/CountryChart";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-background overflow-hidden relative">
      <ThemeToggle />
      <GlobeVisualization />
      <CountryChart />
    </main>
  );
}
