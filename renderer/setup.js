(function(){
  const $ = (s) => document.querySelector(s);

  function setStatus(html, cls){
    const el = $('#status');
    if (!el) return;
    el.innerHTML = html;
    if (cls) el.className = `hint ${cls}`; else el.className = 'hint';
  }

  async function loadDefaults(){
    try {
      const res = await (window.api?.getSetupDefaults?.() || Promise.resolve(null));
      if (res?.success) {
        const def = res.defaults || {};
        const defaultsEl = $('#defaults');
        if (defaultsEl) defaultsEl.textContent = `Vorschlag: ${def.suggestedDir || '-'}  •  Alternative: ${def.userDataDir || '-'}`;
        if (def.suggestedDir) {
          const input = $('#dir');
          if (input) input.value = def.suggestedDir;
        }
      }
    } catch (e){
      console.error('[setup] loadDefaults failed', e);
    }
  }

  async function chooseDir(){
    try {
      const res = await (window.api?.showOpenDialog?.({ properties: ['openDirectory', 'createDirectory'] }) || Promise.resolve(null));
      if (res && !res.canceled && Array.isArray(res.filePaths) && res.filePaths[0]) {
        const input = $('#dir');
        if (input) input.value = res.filePaths[0];
      }
    } catch (e){
      console.error('[setup] chooseDir failed', e);
      setStatus(`<span class="err">Ordnerauswahl fehlgeschlagen: ${e?.message || 'Unbekannt'}</span>`);
    }
  }

  async function testDir(){
    try {
      const input = $('#dir');
      const dir = (input?.value || '').trim();
      if (!dir){
        setStatus(`<span class="err">Bitte einen Ordner angeben.</span>`);
        return;
      }
      setStatus('Prüfe Schreibrechte…');
      const res = await (window.api?.testDirWritable?.(dir) || Promise.resolve(null));
      const saveBtn = $('#save');
      if (res?.success){
        setStatus(`<span class="ok">OK: Schreibzugriff möglich.</span>`);
        if (saveBtn) saveBtn.disabled = false;
      } else {
        setStatus(`<span class="err">Fehler: ${res?.message || 'Unbekannt'}</span>`);
        if (saveBtn) saveBtn.disabled = true;
      }
    } catch (e){
      console.error('[setup] testDir failed', e);
    }
  }

  async function saveAndRelaunch(){
    try {
      const input = $('#dir');
      const dir = (input?.value || '').trim();
      if (!dir) return;
      const res = await (window.api?.finalizeSetup?.(dir) || Promise.resolve(null));
      if (!res?.success){
        setStatus(`<span class="err">Speichern fehlgeschlagen: ${res?.message || 'Unbekannt'}</span>`);
      } else {
        setStatus(`<span class="ok">Konfiguration gespeichert, Anwendung startet neu…</span>`);
      }
    } catch (e){
      console.error('[setup] saveAndRelaunch failed', e);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('#choose')?.addEventListener('click', chooseDir);
    $('#test')?.addEventListener('click', testDir);
    $('#save')?.addEventListener('click', saveAndRelaunch);
    loadDefaults();
  });
})();
