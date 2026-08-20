const $ = (selector) => document.querySelector(selector);
const presets = [...document.querySelectorAll('.preset')];
const input = $('#customTime');
const unit = $('#customUnit');
const countdown = $('#countdown');
const deadline = $('#deadline');
const timerLabel = $('#timerLabel');
const statusText = $('#statusText');
const setupControls = $('#setupControls');
const activeControls = $('#activeControls');
let selectedSeconds = 1800;
let endTime = null;
let ticker = null;

function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  const hours = String(Math.floor(value / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((value % 3600) / 60)).padStart(2, '0');
  const secs = String(value % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function selectTime(seconds, preset = null) {
  selectedSeconds = seconds;
  countdown.textContent = formatTime(seconds);
  presets.forEach(button => button.classList.toggle('active', button === preset));
}

presets.forEach(button => button.addEventListener('click', () => {
  const seconds = Number(button.dataset.seconds);
  input.value = seconds < 3600 ? seconds / 60 : seconds / 3600;
  unit.value = seconds < 3600 ? '60' : '3600';
  selectTime(seconds, button);
}));

function updateCustom() {
  const value = Math.max(1, Number(input.value) || 1);
  input.value = value;
  selectTime(value * Number(unit.value));
}
input.addEventListener('input', updateCustom);
unit.addEventListener('change', updateCustom);
$('#decrease').addEventListener('click', () => { input.value = Math.max(1, Number(input.value) - 1); updateCustom(); });
$('#increase').addEventListener('click', () => { input.value = Number(input.value) + 1; updateCustom(); });

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('error', error);
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 3500);
}

async function api(path, body = {}) {
  const response = await fetch(path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}

function updateCountdown() {
  const remaining = (endTime - Date.now()) / 1000;
  countdown.textContent = formatTime(remaining);
  if (remaining <= 0) clearInterval(ticker);
}

$('#scheduleButton').addEventListener('click', async () => {
  const button = $('#scheduleButton');
  button.disabled = true;
  try {
    await api('/api/schedule', { seconds: selectedSeconds });
    endTime = Date.now() + selectedSeconds * 1000;
    const time = new Date(endTime).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    deadline.textContent = `Desligamento previsto para ${time}`;
    timerLabel.textContent = 'TEMPO RESTANTE';
    statusText.textContent = 'AGENDADO';
    setupControls.classList.add('hidden');
    activeControls.classList.remove('hidden');
    ticker = setInterval(updateCountdown, 250);
    updateCountdown();
    toast('Desligamento agendado com sucesso.');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#cancelButton').addEventListener('click', async () => {
  const button = $('#cancelButton');
  button.disabled = true;
  try {
    await api('/api/cancel');
    clearInterval(ticker);
    endTime = null;
    countdown.textContent = formatTime(selectedSeconds);
    deadline.textContent = 'Nenhum desligamento agendado';
    timerLabel.textContent = 'SELECIONE QUANDO DESLIGAR';
    statusText.textContent = 'PRONTO';
    activeControls.classList.add('hidden');
    setupControls.classList.remove('hidden');
    toast('Desligamento cancelado. Encerrando o aplicativo...');
    setTimeout(() => window.close(), 700);
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

// pagehide também funciona ao fechar a janela inteira. sendBeacon é próprio para
// enviar uma última mensagem mesmo enquanto o navegador descarrega a página.
window.addEventListener('pagehide', () => {
  navigator.sendBeacon('/api/exit', new Blob(['{}'], { type: 'application/json' }));
});
