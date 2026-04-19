// src/hooks/useResponsive.js
// Hook que detecta el tamaño de pantalla y se actualiza automáticamente
// cuando el usuario cambia el tamaño de la ventana o gira el dispositivo.

import { useState, useEffect } from "react";
import { BREAKPOINTS } from "../utils.js";

function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1366, height: 768 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function classify(width) {
  // Categorías:
  // - mobile: <= 550px
  // - tabletPortrait: 551px - 750px
  // - tabletLandscape: 751px - 900px
  // - laptop: 901px - 1366px
  // - desktop: 1367px - 2400px
  // - desktopXL: > 2400px

  if (width <= BREAKPOINTS.sm) return "mobile";
  if (width <= BREAKPOINTS.md) return "tabletPortrait";
  if (width <= BREAKPOINTS.lg) return "tabletLandscape";
  if (width <= BREAKPOINTS.xl) return "laptop";
  if (width <= BREAKPOINTS.xxl) return "desktop";
  return "desktopXL";
}

export function useResponsive() {
  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    let timeout = null;

    function onResize() {
      // Pequeño debounce para no recalcular en cada pixel del resize
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setViewport(getViewport());
      }, 100);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const category = classify(viewport.width);

  return {
    width: viewport.width,
    height: viewport.height,
    category,

    // Atajos booleanos
    isMobile: category === "mobile",
    isTabletPortrait: category === "tabletPortrait",
    isTabletLandscape: category === "tabletLandscape",
    isLaptop: category === "laptop",
    isDesktop: category === "desktop",
    isDesktopXL: category === "desktopXL",

    // Combinaciones útiles
    isPhoneOrSmallTablet: category === "mobile" || category === "tabletPortrait",
    isTablet: category === "tabletPortrait" || category === "tabletLandscape",
    isDesktopOrLarger: category === "laptop" || category === "desktop" || category === "desktopXL",

    // Para layouts
    columnsForGrid: (() => {
      // Cuántas columnas usar en un grid de KPIs
      if (category === "mobile") return 1;
      if (category === "tabletPortrait") return 2;
      if (category === "tabletLandscape") return 2;
      if (category === "laptop") return 4;
      if (category === "desktop") return 4;
      return 5;  // desktopXL
    })(),

    formColumns: category === "mobile" || category === "tabletPortrait" ? 1 : 2
  };
}
