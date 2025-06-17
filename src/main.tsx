import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker disabled temporarily to fix refresh loop
const registerServiceWorker = async () => {
  console.log("🚫 Service Worker disabled to prevent refresh loops");

  // Unregister any existing service workers to stop refresh loops
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log("🗑️ Unregistering service worker:", registration.scope);
        await registration.unregister();
      }
      console.log("✅ All service workers unregistered");
    } catch (error) {
      console.warn("⚠️ Failed to unregister service workers:", error);
    }
  }

  return null;
};

// Initialize app
const initializeApp = async () => {
  try {
    // Register Service Worker first for optimal caching
    await registerServiceWorker();

    // Then render the app - StrictMode disabled to prevent double rendering
    createRoot(document.getElementById("root")!).render(<App />);

    console.log("🚀 مركز البدر app started successfully");
  } catch (error) {
    console.error("❌ App initialization failed:", error);

    // Fallback: render app anyway - StrictMode disabled
    createRoot(document.getElementById("root")!).render(<App />);
  }
};

// Start the app
initializeApp();
