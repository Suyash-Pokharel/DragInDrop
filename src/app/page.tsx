"use client";

import Link from "next/link";
import Image from "next/image";
import { Reveal } from "./components/Reveal";
import Footer from "./components/Footer";
import { 
  ArrowRight, 
  UploadCloud, 
  CalendarClock, 
  BarChart3, 
  Link2, 
  PlayCircle,
  CheckCircle2,
  Star
} from "lucide-react";

// Platform Logos
import YoutubeLogo from "./assets/logo/Youtube.webp";
import InstagramLogo from "./assets/logo/Instagram.webp";
import TikTokLogo from "./assets/logo/TikTok.webp";
import FacebookLogo from "./assets/logo/Facebook.webp";
import XLogo from "./assets/logo/X.webp";
import ThreadsLogo from "./assets/logo/Threads.webp";

const REVIEWS = [
  { name: "Alex R.", handle: "@alexcreates", text: "DragInDrop completely transformed how I schedule my content. The multi-platform feature is insane!", avatarText: "AR", stars: 5 },
  { name: "Sarah J.", handle: "@sarahvlogs", text: "I save at least 10 hours a week. Uploading once and boom, it's everywhere.", avatarText: "SJ", stars: 3 },
  { name: "Mike T.", handle: "@miketech", text: "The UI is buttery smooth. Literally drag, drop, and I'm done for the week.", avatarText: "MT", stars: 5 },
  { name: "Emily W.", handle: "@emilytravels", text: "Finally, a tool that supports all my networks without buggy uploads.", avatarText: "EW", stars: 4 },
  { name: "Chris P.", handle: "@chrisp_dev", text: "If you're a creator, you need this. It's the standard now.", avatarText: "CP", stars: 4 },
  { name: "Jessica L.", handle: "@jess_lifestyle", text: "Seamless Instagram and TikTok syncing. Best decision ever.", avatarText: "JL", stars: 5 },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-text-main font-sans overflow-hidden">
      
      {/* 1. HERO SECTION & INTEGRATION BAR */}
      <section className="relative pt-28 pb-12 px-4 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

        <Reveal width="100%" delay={0.1}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface border border-border rounded-full text-sm text-text-secondary mb-4 shadow-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Drag, Drop, and Dominate
          </div>
        </Reveal>

        <Reveal width="100%" delay={0.2}>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-r from-text-main to-text-secondary">
            Schedule your Videos<br className="hidden md:block" />
            <span className="text-primary">Anywhere</span>
          </h1>
        </Reveal>

        <Reveal width="100%" delay={0.3}>
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            DragInDrop is the all-in-one platform for content creators to schedule, automate,
            their videos and let us publish it across all your platforms automatically.
          </p>
        </Reveal>

        <Reveal width="100%" delay={0.4}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full mb-12">
            <Link 
              href="/register" 
              className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-secondary hover:shadow-glow hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              Get Started for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/pricing" 
              className="w-full sm:w-auto px-8 py-4 bg-surface border border-border text-text-main rounded-xl font-semibold hover:border-primary/50 hover:bg-surface hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
            >
              View Pricing
            </Link>
          </div>
        </Reveal>

        {/* INLINE PLATFORMS BAR */}
        <Reveal width="100%" delay={0.5}>
          <div className="flex flex-col items-center opacity-70">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">
              Supported Platforms
            </p>
            <div className="flex justify-center items-center gap-6 md:gap-8">
              {[
                { name: "YouTube", src: YoutubeLogo },
                { name: "Instagram", src: InstagramLogo },
                { name: "TikTok", src: TikTokLogo },
                { name: "Facebook", src: FacebookLogo },
                { name: "X", src: XLogo },
                { name: "Threads", src: ThreadsLogo },
              ].map((platform) => (
                <div key={platform.name} title={platform.name} className="w-8 h-8 md:w-10 md:h-10 relative grayscale hover:grayscale-0 transition duration-300 transform hover:scale-110 cursor-pointer">
                  <Image src={platform.src} alt={platform.name} fill sizes="(max-width: 768px) 32px, 40px" className="object-contain" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* 2. HOW IT WORKS */}
      <section className="py-24 bg-surface/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4">
          <Reveal width="100%">
            <div className="text-center mb-24">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-text-main">How it works</h2>
              <p className="text-text-secondary text-lg">The 3 simple steps to automate your content delivery.</p>
            </div>
          </Reveal>

          <div className="relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-[4.5rem] left-[10%] right-[10%] h-[3px] bg-border rounded-full -z-10">
               <div className="absolute top-0 left-0 h-full bg-primary/30 w-full animate-pulse rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-3 gap-12 relative z-10">
              {[
                {
                  step: "01",
                  title: "Connect Accounts",
                  description: "Securely link your social media profiles using OAuth. We never store your passwords.",
                  icon: <Link2 size={24} strokeWidth={2.5} />,
                  delay: 0.1
                },
                {
                  step: "02",
                  title: "Upload & Schedule",
                  description: "Drag your video into the dashboard, write your caption, and pick a date.",
                  icon: <UploadCloud size={24} strokeWidth={2.5} />,
                  delay: 0.2
                },
                {
                  step: "03",
                  title: "Sit Back & Relax",
                  description: "Our system automatically publishes your posts to all selected platforms at the exact time.",
                  icon: <PlayCircle size={24} strokeWidth={2.5} />,
                  delay: 0.3
                }
              ].map((item, i) => (
                <Reveal width="100%" delay={item.delay} key={i}>
                  <div className="flex flex-col items-center text-center px-4 group">
                    <div className="w-[88px] h-[88px] bg-surface border-[3px] border-border rounded-full flex items-center justify-center text-text-secondary mb-6 shadow-sm relative group-hover:border-primary group-hover:text-primary group-hover:shadow-glow transition-all duration-500">
                      <span className="absolute -top-1 -right-2 text-xs font-bold text-text-secondary group-hover:text-primary group-hover:border-primary bg-surface-highlight px-3 py-1 rounded-md border border-border transition-colors duration-500 shadow-sm">
                        {item.step}
                      </span>
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-text-main group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-text-secondary leading-relaxed">{item.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. USER REVIEWS - SLIDING MARQUEE (Left to Right) */}
      <section className="py-24 overflow-hidden relative">
        <div className="text-center mb-16">
          <Reveal width="100%">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-text-main">Loved by Creators</h2>
            <p className="text-text-secondary text-lg">See what our community is saying.</p>
          </Reveal>
        </div>

        {/* Sliding Track */}
        <div className="relative w-full flex overflow-hidden group">
           {/* Fading Edges */}
           <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"></div>
           <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"></div>

           {/* The animated flex container - moving Left To Right */}
           <div className="flex shrink-0 gap-6 animate-slide-ltr w-max">
             {/* Render reviews 3 times to ensure continuous seamless loop */}
             {[...REVIEWS, ...REVIEWS, ...REVIEWS].map((review, i) => (
               <div key={i} className="w-80 shrink-0 bg-surface border border-border p-6 rounded-2xl shadow-sm hover:border-primary cursor-default transition-all duration-300">
                 <div className="flex items-center gap-1 mb-4">
                   {[...Array(5)].map((_, starIdx) => (
                     <Star 
                       key={starIdx} 
                       size={18} 
                       fill={starIdx < review.stars ? "currentColor" : "transparent"} 
                       className={starIdx < review.stars ? "text-warning" : "text-border"} 
                     />
                   ))}
                 </div>
                 <p className="text-text-main leading-relaxed mb-6">&quot;{review.text}&quot;</p>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shadow-sm">
                     {review.avatarText}
                   </div>
                   <div>
                     <div className="font-bold text-sm text-text-main">{review.name}</div>
                     <div className="text-xs text-text-secondary">{review.handle}</div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </section>

      {/* 4. FEATURES GRID */}
      <section className="py-24 bg-surface/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Reveal width="100%">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-text-main">Everything you need to scale</h2>
              <p className="text-text-secondary max-w-2xl mx-auto text-lg leading-relaxed">
                Stop wasting hours posting manually. We built the tools so you can focus on creating.
              </p>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Reveal width="100%" delay={0.1}>
              <div className="bg-surface border border-border p-8 rounded-2xl shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-300 h-full transform hover:-translate-y-1">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <UploadCloud size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-text-main">Drag & Drop Uploads</h3>
                <p className="text-text-secondary leading-relaxed">
                  Easily upload videos up to 250MB. Our intuitive interface securely processes all modern formats directly to our cloud.
                </p>
              </div>
            </Reveal>

            <Reveal width="100%" delay={0.2}>
              <div className="bg-surface border border-border p-8 rounded-2xl shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-300 h-full transform hover:-translate-y-1">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <CalendarClock size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-text-main">Multi-Platform Scheduling</h3>
                <p className="text-text-secondary leading-relaxed">
                  Plan your posts weeks or months in advance. One video, multiple networks. Connect to all the available platforms instantly.
                </p>
              </div>
            </Reveal>

            <Reveal width="100%" delay={0.3}>
              <div className="bg-surface border border-border p-8 rounded-2xl shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-300 h-full transform hover:-translate-y-1">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <BarChart3 size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-text-main">Advanced Analytics</h3>
                <p className="text-text-secondary leading-relaxed">
                  Track your content performance deeply across all platforms from a single unified dashboard view.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5. FINAL CTA BANNER */}
      <section className="py-24 px-4 pt-10 mt-10">
        <Reveal width="100%">
          <div className="max-w-5xl mx-auto bg-surface border border-primary/20 rounded-[2.5rem] p-10 md:p-20 text-center relative overflow-hidden shadow-glow">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-text-main tracking-tight">Ready to streamline your workflow?</h2>
            <p className="text-lg md:text-xl text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed">
              Join thousands of creators who save hours every week. Try DragInDrop today on our Free plan. No credit card required.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
              <Link 
                href="/register" 
                className="w-full sm:w-auto px-10 py-4 bg-primary text-white text-lg rounded-xl font-bold hover:bg-secondary hover:-translate-y-1 transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl"
              >
                Create Free Account
              </Link>
              <div className="flex items-center gap-2 text-sm font-medium text-text-secondary bg-background px-4 py-2 rounded-full border border-border shadow-sm">
                <CheckCircle2 size={16} className="text-success" strokeWidth={3} />
                7-Day Money-Back Guarantee
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 6. FOOTER */}
      <Footer />

      {/* MARQUEE STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideLeftToRight {
          from { transform: translateX(-33.333333%); }
          to { transform: translateX(0); }
        }
        .animate-slide-ltr {
          animation: slideLeftToRight 25s linear infinite;
        }
        .animate-slide-ltr:hover {
          animation-play-state: paused;
        }
      `}} />
    </div>
  );
}
