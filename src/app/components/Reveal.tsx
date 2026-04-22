"use client";

import React, { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  width?: "fit-content" | "100%";
  delay?: number; // Optional delay in seconds
}

export const Reveal = ({ children, width = "fit-content", delay = 0 }: RevealProps) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (currentRef) observer.unobserve(currentRef);
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.1,
      },
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width,
        transitionDelay: `${delay}s`,
      }}
      className={`reveal-hidden ${isVisible ? "reveal-visible" : ""}`}
    >
      {children}
    </div>
  );
};
