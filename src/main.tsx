import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

/**
 * A camada de mocks (MSW) precisa estar ativa ANTES de qualquer módulo que use fetch/XHR/WebSocket.
 * O socket.io-client, por exemplo, captura `globalThis.WebSocket` no momento em que é importado.
 * Por isso o app inteiro é importado dinamicamente depois que o worker sobe.
 */
async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMocks } = await import("./mocks/browser");
    await startMocks();
  }
  const [{ RouterProvider }, { QueryClientProvider }, { router }, { queryClient }, { RealtimeProvider }] = await Promise.all([
    import("@tanstack/react-router"),
    import("@tanstack/react-query"),
    import("./app/router"),
    import("./app/queryClient"),
    import("./shared/realtime/RealtimeProvider"),
  ]);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
