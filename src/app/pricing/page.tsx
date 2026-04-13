import Pricing from "./Pricing";
import Footer from "../components/Footer";

export default function PricingPage() {
  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <main className="flex-grow bg-background transition-colors duration-300">
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
