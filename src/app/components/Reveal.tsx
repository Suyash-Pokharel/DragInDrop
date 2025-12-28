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
    // 1. Capture the ref value in a local variable
    const currentRef = ref.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Use the captured variable (or the observer instance directly)
          if (currentRef) observer.unobserve(currentRef);
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.1,
      }
    );

    // 2. Use the variable to observe
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      // 3. Use the variable in cleanup
      if (currentRef) observer.disconnect();
    };
  }, []);

    return (
        <div
            ref={ref}
            style={{
                width,
                transitionDelay: `${delay}s` // Applies the delay via inline style
            }}
            className={`reveal-hidden ${isVisible ? "reveal-visible" : ""}`}
        >
            {children}
        </div>
    );
};