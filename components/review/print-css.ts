// What a report page prints: the report alone, on A4. Anything marked `no-print` is left out, and `print-plain`
// loses its card border. Kept out of print-button.tsx (a client file) so server pages can use the text itself.
export const PRINT_CSS = `@page { size: A4; margin: 14mm 12mm; } @media print { .no-print { display: none !important; } html, body { background: #fff !important; } .print-plain { border: 0 !important; box-shadow: none !important; padding: 0 !important; } }`
