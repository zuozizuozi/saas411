export function GET() {
  // A process-local EventEmitter cannot deliver events reliably across
  // serverless instances. Returning 204 also tells existing EventSource
  // clients not to reconnect while generation status continues via polling.
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
