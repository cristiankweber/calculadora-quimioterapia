import { startApplication } from "./bootEnvironment";

void startApplication(() => import("./main")).catch(error => {
  console.error("[App] Falha na inicialização da aplicação:", error);
  const root = document.getElementById("root");
  if (root)
    root.textContent =
      "Não foi possível iniciar a aplicação. Recarregue a página.";
});
