import { useEffect, useRef } from "react";

import "../styles/splash.css";

export default function SplashScreen({ destination, onNavigate, ready = true }) {
  const shellRef = useRef(null);
  const logoRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const gsap = window.gsap;
    let timer = null;

    if (ready && destination) {
      timer = window.setTimeout(() => {
        onNavigate(destination, { replace: true });
      }, 2400);
    }

    if (gsap && shellRef.current && logoRef.current && textRef.current) {
      const timeline = gsap.timeline();
      timeline
        .fromTo(
          logoRef.current,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1.1, duration: 0.7, ease: "power3.out" },
        )
        .to(logoRef.current, {
          scale: 1,
          duration: 0.45,
          ease: "power2.out",
        })
        .fromTo(
          textRef.current,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" },
          "-=0.28",
        )
        .to(
          logoRef.current,
          {
            boxShadow: "0 0 28px rgba(255,255,255,0.28)",
            repeat: 1,
            yoyo: true,
            duration: 0.35,
            ease: "sine.inOut",
          },
          "-=0.12",
        );
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [destination, onNavigate, ready]);

  return (
    <div className="splash-screen" ref={shellRef}>
      <div className="splash-mark" ref={logoRef}>
        <img src="/assets/alchemista.jpeg" alt="Alchemist logo" />
      </div>
      <div className="splash-title" ref={textRef}>ALCHEMIST</div>
    </div>
  );
}
