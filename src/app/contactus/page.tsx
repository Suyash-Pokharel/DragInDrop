import ContactUs from "./ContactUs";
import Footer from "../components/Footer";

export default function ContactUsPage() {
  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <main className="flex-grow bg-background w-full flex items-center justify-center transition-colors duration-300 p-4 md:p-20">
        <ContactUs />
      </main>
      <Footer />
    </div>
  );
}
