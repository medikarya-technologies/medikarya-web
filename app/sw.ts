import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// WorkerGlobalScope (in the DOM types the site already uses) is enough: only self.__SW_MANIFEST is read, added above.
declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst(), // Always try fresh content first
    },
    {
      matcher: ({ request }) =>
        ["style", "script", "image", "font"].includes(request.destination),
      handler: new StaleWhileRevalidate(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
