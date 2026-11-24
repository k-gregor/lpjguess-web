// Runs LPJ-GUESS (compiled to WebAssembly) in a worker so the page stays responsive.
// Cancelling a run = terminating this worker; every run gets a fresh worker.
importScripts('guess.js');

function parseOut(text) {
  const lines = text.split('\n');
  const columns = lines[0].trim().split(/\s+/);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const v = l.trim().split(/\s+/).map(Number);
    return Object.fromEntries(columns.map((c, i) => [c, v[i]]));
  });
  return {columns, rows};
}

function insText(p) {
  return `import "/in/teaching_default.ins"
outputdirectory "/run/"
nyear ${p.nyear}
nyear_spinup ${p.spinup}
npatch ${p.npatch}
firemodel "${p.firemodel}"
ifdisturb ${p.ifdisturb ? 1 : 0}
${p.ifdisturb ? `distinterval ${p.distinterval}` : ''}
param "file_gridlist" (str "/run/gridlist.txt")
param "file_temp" (str "/in/tmp30_21.grd")
param "file_prec" (str "/in/prc30_21.grd")
param "file_sun" (str "/in/clo30_21.grd")
param "file_soil" (str "/in/soils_lpj.dat")
modify_temperature ${p.temp.join(' ')}
modify_precipitation ${p.prec.join(' ')}
modify_co2 ${p.co2}
`;
}

onmessage = async e => {
  const p = e.data;
  const printed = [];
  const onLine = line => {
    printed.push(line);
    const m = /(\d+)% complete/.exec(line);
    if (m) postMessage({type: 'progress', pct: +m[1]});
  };
  try {
    postMessage({type: 'status', text: 'Loading model and input data…'});
    const M = await createGuess({print: onLine, printErr: onLine});
    const FS = M.FS;
    FS.mkdir('/in'); FS.mkdir('/run');
    const manifest = await (await fetch('manifest.json')).json();
    await Promise.all(manifest.files.map(async f => {
      const r = await fetch('in/' + f);
      FS.writeFile('/in/' + f, new Uint8Array(await r.arrayBuffer()));
    }));
    FS.writeFile('/run/gridlist.txt', `${p.lon} ${p.lat}\n`);
    FS.writeFile('/run/run.ins', insText(p));
    FS.chdir('/run');
    postMessage({type: 'status', text: 'Running model…'});
    try { M.callMain(['-input', 'demo', 'run.ins']); } catch (err) { /* exit status is checked via the outputs */ }
    const read = f => { try { return FS.readFile('/run/' + f, {encoding: 'utf8'}); } catch (_) { return null; } };
    const cpool = read('cpool.out'), cmass = read('cmass.out');
    if (!cpool || !cmass) {
      postMessage({type: 'error', error: (read('guess.log') || printed.join('\n')).split('\n').slice(-15).join('\n')});
      return;
    }
    const files = {};
    for (const f of FS.readdir('/run').filter(f => f.endsWith('.out'))) files[f] = read(f);
    const cflux = files['cflux.out'];
    postMessage({type: 'done', data: {cpool: parseOut(cpool), cmass: parseOut(cmass),
                                      cflux: cflux ? parseOut(cflux) : null, files}});
  } catch (err) {
    postMessage({type: 'error', error: String(err)});
  }
};
