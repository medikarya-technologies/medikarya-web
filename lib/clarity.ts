/**
 * A Microsoft Clarity custom event. Tags (Clarity's "set") label the session too, so sessions can be filtered by
 * them in Clarity, e.g. every session where upgrade_source = locked_card, or checkout_plan = resident_yearly.
 */
export const trackEvent = (eventName: string, tags?: Record<string, string>) => {
    if (typeof window !== 'undefined' && (window as any).clarity) {
        for (const [key, value] of Object.entries(tags ?? {})) (window as any).clarity("set", key, value);
        (window as any).clarity("event", eventName);
    }
};
