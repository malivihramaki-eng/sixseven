/**
 * SixSeven - backend (Google Apps Script)
 * Banco de dados: Google Sheets. Fotos e áudios: pasta "SixSeven" no Google Drive.
 */
const SHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
const PASTA = 'SixSeven';
const RECOMPENSA = 1; // R$ por atividade aprovada
const TZ = 'America/Sao_Paulo';

const ABAS = {
  usuarios: ['id', 'nome', 'tipo', 'cor', 'hash', 'foto'],
  atividades: ['id', 'usuario', 'data', 'descricao', 'foto', 'audio', 'status', 'nota'],
  carteira: ['id', 'usuario', 'valor', 'motivo', 'data'],
  loja: ['id', 'nome', 'icone', 'preco', 'ativo'],
  compras: ['id', 'usuario', 'item', 'preco', 'data'],
};

// Rode UMA vez: no editor, escolha a função "setup" e clique em ▶
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ss.setSpreadsheetTimeZone(TZ);
  Object.entries(ABAS).forEach(([nome, cab]) => {
    const aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (aba.getLastRow() === 0) aba.appendRow(cab);
  });
  const u = ss.getSheetByName('usuarios');
  if (u.getLastRow() === 1) {
    u.appendRow(['cesar', 'Cesar', 'pattern', '#3b82f6', '', '']);
    u.appendRow(['arthur', 'Arthur', 'pattern', '#22c55e', '', '']);
    // Ericky também usa padrão de desenho: hash vazio = ele cria no primeiro acesso
    u.appendRow(['ericky', 'Ericky', 'admin', '#ffffff', '', '']);
  }
}

// Rode UMA vez se a conta do Ericky já foi criada com o PIN antigo (1313):
// limpa a senha e a foto para ele criar o padrão de desenho no próximo acesso.
function resetarSenhaEricky() {
  atualizarLinha('usuarios', 'ericky', { hash: '', foto: '' });
}

function doGet() {
  return json({
    ok: true,
    usuarios: rows('usuarios').map(x => ({
      id: x.id, nome: x.nome, tipo: x.tipo, cor: x.cor, foto: x.foto, configurado: !!x.hash,
    })),
  });
}

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    const u = rows('usuarios').find(x => x.id === r.user);
    if (!u) throw new Error('Conta não encontrada');

    if (r.acao === 'configurar') {
      if (u.hash) throw new Error('Conta já configurada');
      const foto = salvarArquivo(r.foto, 'image/jpeg', `${u.id}_perfil.jpg`);
      atualizarLinha('usuarios', u.id, { hash: r.hash, foto });
      return json({ ok: true });
    }

    if (!u.hash || u.hash !== r.hash) throw new Error('Senha incorreta');
    const admin = u.tipo === 'admin';
    const hoje = hojeInfo();

    switch (r.acao) {
      case 'entrar':
        return json({ ok: true, ...pacote(u) });

      case 'enviarAtividade': {
        if (hoje.diaSemana > 5) throw new Error('Atividades só de segunda a sexta');
        if (rows('atividades').some(a => a.usuario === u.id && a.data === hoje.data))
          throw new Error('Você já fez a atividade de hoje');
        const foto = salvarArquivo(r.foto, 'image/jpeg', `${hoje.data}_${u.id}_foto.jpg`);
        const audio = salvarArquivo(r.audio, r.audioMime || 'audio/webm', `${hoje.data}_${u.id}_audio`);
        append('atividades', {
          id: uuid(), usuario: u.id, data: hoje.data, descricao: String(r.descricao || '').slice(0, 300),
          foto, audio, status: 'pendente', nota: '',
        });
        return json({ ok: true });
      }

      case 'comprar': {
        const item = rows('loja').find(i => i.id === r.itemId && i.ativo === true);
        if (!item) throw new Error('Item indisponível');
        if (saldoDe(rows('carteira'), u.id) < Number(item.preco)) throw new Error('Saldo insuficiente');
        append('carteira', { id: uuid(), usuario: u.id, valor: -Number(item.preco), motivo: 'Compra: ' + item.nome, data: hoje.data });
        append('compras', { id: uuid(), usuario: u.id, item: item.nome, preco: Number(item.preco), data: hoje.data });
        return json({ ok: true });
      }

      case 'avaliar': {
        if (!admin) throw new Error('Sem permissão');
        const a = rows('atividades').find(x => x.id === r.atividadeId);
        if (!a) throw new Error('Atividade não encontrada');
        if (a.status !== 'pendente') throw new Error('Essa atividade já foi avaliada');
        const aprovado = r.aprovado === true;
        const nota = Math.min(10, Math.max(0, Number(r.nota) || 0));
        atualizarLinha('atividades', a.id, { status: aprovado ? 'aprovado' : 'negado', nota });
        if (aprovado) append('carteira', { id: uuid(), usuario: a.usuario, valor: RECOMPENSA, motivo: 'Atividade ' + a.data, data: hoje.data });
        return json({ ok: true });
      }

      case 'adicionarItem': {
        if (!admin) throw new Error('Sem permissão');
        append('loja', { id: uuid(), nome: String(r.nome).slice(0, 40), icone: String(r.icone).slice(0, 4), preco: Number(r.preco), ativo: true });
        return json({ ok: true });
      }

      case 'removerItem': {
        if (!admin) throw new Error('Sem permissão');
        atualizarLinha('loja', r.itemId, { ativo: false });
        return json({ ok: true });
      }

      default:
        throw new Error('Ação inválida');
    }
  } catch (err) {
    return json({ ok: false, erro: err.message });
  }
}

/* ---------- o que o app recebe após entrar ---------- */
function pacote(u) {
  const admin = u.tipo === 'admin';
  const hoje = hojeInfo();
  const atv = rows('atividades');
  const cart = rows('carteira');
  const minhas = admin ? atv : atv.filter(a => a.usuario === u.id);
  return {
    perfil: { id: u.id, nome: u.nome, tipo: u.tipo, cor: u.cor, foto: u.foto },
    saldo: saldoDe(cart, u.id),
    hoje: {
      ...hoje,
      podeEnviar: hoje.diaSemana <= 5 && !atv.some(a => a.usuario === u.id && a.data === hoje.data),
    },
    atividades: minhas,
    carteira: admin ? cart : cart.filter(c => c.usuario === u.id),
    loja: rows('loja').filter(i => admin || i.ativo === true),
    usuarios: admin
      ? rows('usuarios').filter(x => x.tipo !== 'admin').map(x => ({ id: x.id, nome: x.nome, cor: x.cor, saldo: saldoDe(cart, x.id) }))
      : undefined,
  };
}

/* ---------- utilitários ---------- */
function sheet(nome) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(nome);
}

function rows(nome) {
  const v = sheet(nome).getDataRange().getValues();
  const cab = v.shift();
  return v.filter(r => r[0] !== '').map(r => {
    const obj = {};
    cab.forEach((k, i) => {
      let val = r[i];
      if (val instanceof Date) val = Utilities.formatDate(val, TZ, 'yyyy-MM-dd');
      obj[k] = val;
    });
    return obj;
  });
}

function append(nome, obj) {
  sheet(nome).appendRow(ABAS[nome].map(k => (obj[k] === undefined ? '' : obj[k])));
}

function atualizarLinha(nome, id, campos) {
  const s = sheet(nome);
  const v = s.getDataRange().getValues();
  const cab = v[0];
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === id) {
      Object.entries(campos).forEach(([k, val]) => s.getRange(i + 1, cab.indexOf(k) + 1).setValue(val));
      return;
    }
  }
  throw new Error('Registro não encontrado');
}

function saldoDe(cart, id) {
  return cart.filter(c => c.usuario === id).reduce((s, c) => s + (Number(c.valor) || 0), 0);
}

function hojeInfo() {
  const d = new Date();
  return {
    data: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
    diaSemana: Number(Utilities.formatDate(d, TZ, 'u')), // 1 = segunda ... 7 = domingo
  };
}

function salvarArquivo(base64, mime, nome) {
  const it = DriveApp.getFoldersByName(PASTA);
  const pasta = it.hasNext() ? it.next() : DriveApp.createFolder(PASTA);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, nome);
  const arq = pasta.createFile(blob);
  arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arq.getId();
}

function hash(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

function uuid() {
  return Utilities.getUuid();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
