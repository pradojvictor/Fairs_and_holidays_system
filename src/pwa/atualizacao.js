// Versão nova do app (PWA) depois de um deploy — auditoria §5-C22.
//
// O service worker guarda o front para abrir rápido e funcionar sem rede. Depois de um deploy,
// a primeira abertura ainda vem do que ele guardou (a versão antiga); a nova baixa em segundo
// plano e assume (o sw.js do plugin tem skipWaiting + clientsClaim). Antes, a página não
// recarregava: a tela antiga seguia falando com a API nova até alguém recarregar — e o pop-up
// de uma novidade aparecia numa tela que ainda não tinha a novidade.
//
// Agora, quando a versão nova assume:
// - nos primeiros 20 s depois de abrir, a página recarrega sozinha (ninguém começou a mexer);
// - depois disso, não recarrega por conta própria (apagaria um formulário pela metade): avisa
//   a faixa "versão nova" (components/VersaoNova), que oferece "Atualizar agora".
// Com o painel aberto o dia todo, procura versão nova a cada 5 minutos e ao voltar para a aba.

export const EVENTO_VERSAO_NOVA = 'sistema:versao-nova';

const JANELA_RECARGA_MS = 20_000;
const INTERVALO_MS = 5 * 60 * 1000;
const MIN_ENTRE_CONFERENCIAS_MS = 60 * 1000;
const CHAVE_RECARGA = 'sistema-ferias:recarga-por-versao';

let versaoNovaPronta = false;
export const haVersaoNova = () => versaoNovaPronta;

// Uma recarga automática por vez: se a versão nova assumir de novo logo depois de recarregar,
// vira aviso — nunca um laço de recargas.
function recarregouHaPouco() {
  try {
    return Date.now() - Number(sessionStorage.getItem(CHAVE_RECARGA) || 0) < 60_000;
  } catch {
    return false;
  }
}

function marcarRecarga() {
  try {
    sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
  } catch {
    // Sem armazenamento: segue sem a trava; a recarga acontece igual.
  }
}

export function iniciarAtualizacao() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // Sem controlador, é a primeira visita: o service worker que assumir agora não é versão nova.
  const tinhaVersaoAnterior = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaVersaoAnterior || versaoNovaPronta) return;
    versaoNovaPronta = true;
    if (performance.now() < JANELA_RECARGA_MS && !recarregouHaPouco()) {
      marcarRecarga();
      window.location.reload();
      return;
    }
    window.dispatchEvent(new Event(EVENTO_VERSAO_NOVA));
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registro) => {
      let ultimaConferencia = Date.now();
      const conferir = () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - ultimaConferencia < MIN_ENTRE_CONFERENCIAS_MS) return;
        ultimaConferencia = Date.now();
        registro.update().catch(() => {});
      };
      setInterval(conferir, INTERVALO_MS);
      document.addEventListener('visibilitychange', conferir);
    }).catch((erro) => console.error('Service worker não registrado:', erro));
  });
}
