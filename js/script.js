let items = [];
let headsetLogs = [];
let currentUser = null;

// Usuários Padrão
const defaultUsers = {
  Claudio: { pass: "123Mudar" },
  Pedro: { pass: "123Mudar" },
  Gabriel: { pass: "123Mudar" },
  Joao: { pass: "123Mudar" },
  Anderson: { pass: "123Mudar" },
  Davi: { pass: "123Mudar" }
};

// Itens Padrão do Estoque
const initialItems = [
  { name: "Mouse USB", category: "Periféricos Padrão", qty: 20, minQty: 5 },
  { name: "Teclado USB", category: "Periféricos Padrão", qty: 20, minQty: 5 },
  { name: "Headset MTX BLACK MASTERVOX", category: "Áudio", qty: 160, minQty: 40 },
  { name: "Monitor", category: "Outros", qty: 15, minQty: 2 },
  { name: "Notebook", category: "Outros", qty: 0, minQty: 2 },
  { name: "Máquina (Desktop)", category: "Outros", qty: 3, minQty: 1 },
  { name: "Adaptador de Rede", category: "Adaptadores", qty: 0, minQty: 2 },
  { name: "Adaptador HDMI", category: "Adaptadores", qty: 2, minQty: 3 },
  { name: "Adaptador DisplayPort", category: "Adaptadores", qty: 0, minQty: 3 }
];

function getRef(path) {
  return window.dbRef(window.db, path);
}

// Inicializar Usuários e Itens Padrão
async function seedInitialData() {
  const usersRef = getRef('usuarios');
  const userSnapshot = await window.dbGet(usersRef);
  if (!userSnapshot.exists()) {
    await window.dbSet(usersRef, defaultUsers);
  }

  const itemsRef = getRef('perifericos');
  const itemSnapshot = await window.dbGet(itemsRef);
  if (!itemSnapshot.exists()) {
    initialItems.forEach(item => {
      const newItemRef = window.dbPush(itemsRef);
      window.dbSet(newItemRef, item);
    });
  }
}

// Ouvintes em Tempo Real do Firebase
document.addEventListener('DOMContentLoaded', () => {
  const checkFirebase = setInterval(() => {
    if (window.db) {
      clearInterval(checkFirebase);
      
      seedInitialData();

      // Monitorar Estoque Geral
      window.dbOnValue(getRef('perifericos'), (snapshot) => {
        const data = snapshot.val();
        items = [];
        if (data) {
          Object.keys(data).forEach(key => {
            items.push({ id: key, ...data[key] });
          });
        }
        renderTable();
        updateDashboard();
      });

      // Monitorar Headsets
      window.dbOnValue(getRef('headset_logs'), (snapshot) => {
        const data = snapshot.val();
        headsetLogs = [];
        if (data) {
          Object.keys(data).forEach(key => {
            headsetLogs.push({ id: key, ...data[key] });
          });
        }
        syncHeadsetStockWithLogs();
        renderHeadsetLogsTable();
        updateDashboard();
      });

      const savedUser = localStorage.getItem('ti_logged_user');
      if (savedUser) {
        currentUser = savedUser;
        updateUserUI();
      }
    }
  }, 100);
});

// Sincroniza a quantidade de Headsets disponíveis com o Estoque Geral
async function syncHeadsetStockWithLogs() {
  const availableCount = headsetLogs.filter(l => 
    (l.statusDelivery && l.statusDelivery.toUpperCase().includes('NOVO')) || 
    l.destination === 'DISPONÍVEL EM ESTOQUE'
  ).length;

  const headsetItem = items.find(i => 
    i.category === 'Áudio' || 
    i.name.toLowerCase().includes('headset') || 
    i.name.toLowerCase().includes('head')
  );

  if (headsetItem && headsetItem.qty !== availableCount) {
    await window.dbUpdate(getRef(`perifericos/${headsetItem.id}`), { qty: availableCount });
  }
}

// Renderizar Tabela Geral de Estoque
function renderTable(filteredItems = null) {
  const tableBody = document.getElementById('inventoryTable');
  const displayItems = filteredItems || items;

  tableBody.innerHTML = '';

  if (displayItems.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhum periférico encontrado.</td></tr>`;
    return;
  }

  displayItems.forEach(item => {
    const isCritical = item.qty <= item.minQty;
    const statusBadge = isCritical 
      ? `<span class="badge bg-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i>Crítico</span>` 
      : `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Normal</span>`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="fw-bold">${item.name}</td>
      <td><span class="badge bg-secondary badge-category">${item.category}</span></td>
      <td><strong class="${isCritical ? 'text-danger' : ''}">${item.qty} un</strong></td>
      <td>${item.minQty} un</td>
      <td>${statusBadge}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-success me-1" onclick="openCheckinModal('${item.id}')" title="Entrada / Reestocar"><i class="fa-solid fa-plus"></i></button>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="openCheckoutModal('${item.id}')" title="Dar Baixa"><i class="fa-solid fa-minus"></i> Baixa</button>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal('${item.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${item.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// Renderizar Tabela de Headsets
function renderHeadsetLogsTable(filteredLogs = null) {
  const tbody = document.getElementById('headsetLogsTableBody');
  const logsToDisplay = filteredLogs || headsetLogs;

  tbody.innerHTML = '';

  if (logsToDisplay.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Nenhum registro encontrado no banco de dados.</td></tr>`;
    return;
  }

  logsToDisplay.forEach(log => {
    const isNovo = (log.statusDelivery && log.statusDelivery.toUpperCase().includes('NOVO')) || log.destination === 'DISPONÍVEL EM ESTOQUE';
    const statusClass = isNovo ? 'bg-danger' : 'bg-success';
    const situacaoBadge = `<span class="badge ${statusClass}">${log.statusDelivery || 'ENTREGUE'}</span>`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="fw-bold">${log.model || 'MTX BLACK'}</td>
      <td><span class="badge bg-dark">${log.brand || 'MASTERVOX'}</span></td>
      <td><span class="badge bg-secondary">${log.statusStock || 'EM ESTOQUE'}</span></td>
      <td>${situacaoBadge}</td>
      <td class="fw-bold text-primary">${log.destination || 'DISPONÍVEL EM ESTOQUE'}</td>
      <td><small class="text-muted"><i class="fa-regular fa-clock me-1"></i>${log.dateTimeFormatted || 'Inicial'}</small></td>
      <td><span class="badge bg-info text-dark"><i class="fa-solid fa-user me-1"></i>${log.technician || 'Sistema'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteHeadsetLog('${log.id}')" title="Excluir (Restrito ao Gabriel)">
          <i class="fa-solid fa-trash"></i> Excluir
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Atualizar Indicadores
function updateDashboard() {
  const totalTypes = items.length;
  const totalUnits = items.reduce((acc, item) => acc + Number(item.qty), 0);
  const criticalItems = items.filter(item => item.qty <= item.minQty).length;

  const availableHeadsets = headsetLogs.filter(l => 
    (l.statusDelivery && l.statusDelivery.toUpperCase().includes('NOVO')) || 
    l.destination === 'DISPONÍVEL EM ESTOQUE'
  ).length;
  const deliveredHeadsets = headsetLogs.length - availableHeadsets;

  document.getElementById('totalTypes').innerText = totalTypes;
  document.getElementById('totalUnits').innerText = totalUnits;
  document.getElementById('criticalItems').innerText = criticalItems;
  document.getElementById('headsetSummary').innerText = `${availableHeadsets} Disp. / ${deliveredHeadsets} Saídas`;
}

// 🛒 EXECUÇÃO DA BAIXA COM ATUALIZAÇÃO DA SITUAÇÃO PARA "ENTREGUE"
async function executeCheckout(e) {
  e.preventDefault();
  const id = document.getElementById('checkoutItemId').value;
  const qtyToRemove = parseInt(document.getElementById('checkoutQty').value, 10);
  const tech = document.getElementById('checkoutTech').value;
  const destination = document.getElementById('checkoutDestination').value.trim();

  const item = items.find(i => i.id === id);
  if (!item) return;

  if (qtyToRemove > item.qty) {
    alert('A quantidade solicitada é maior do que o estoque disponível!');
    return;
  }

  const now = new Date();
  const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');

  const isHeadset = item.category === 'Áudio' || item.name.toLowerCase().includes('headset') || item.name.toLowerCase().includes('head');

  if (isHeadset) {
    // Buscar headsets que estejam com status "NOVO" / "DISPONÍVEL EM ESTOQUE"
    const availableLogs = headsetLogs.filter(l => 
      (l.statusDelivery && l.statusDelivery.toUpperCase().includes('NOVO')) || 
      l.destination === 'DISPONÍVEL EM ESTOQUE'
    );

    if (availableLogs.length < qtyToRemove) {
      alert(`Erro: Há apenas ${availableLogs.length} headset(s) com status de disponível na tabela.`);
      return;
    }

    // Altera a situação dos itens selecionados de "NOVO" para "ENTREGUE"
    for (let i = 0; i < qtyToRemove; i++) {
      const logToUpdate = availableLogs[i];
      await window.dbUpdate(getRef(`headset_logs/${logToUpdate.id}`), {
        statusDelivery: 'ENTREGUE',
        destination: destination || 'Filial',
        dateTimeFormatted: formattedDate,
        timestamp: now.toISOString(),
        technician: tech
      });
    }
  } else {
    // Se for outro periférico, apenas subtrai da quantidade
    const newQty = Number(item.qty) - qtyToRemove;
    await window.dbUpdate(getRef(`perifericos/${id}`), { qty: newQty });
  }

  bootstrap.Modal.getInstance(document.getElementById('modalCheckout')).hide();
  alert(`Saída de ${qtyToRemove} unidade(s) registrada com sucesso por ${tech}!`);
}

// ➕ EXECUÇÃO DE ENTRADA / NOVO ESTOQUE DE HEADSETS
async function executeCheckin(e) {
  e.preventDefault();
  const id = document.getElementById('checkinItemId').value;
  const qtyToAdd = parseInt(document.getElementById('checkinQty').value, 10);

  const item = items.find(i => i.id === id);
  if (!item) return;

  const isHeadset = item.category === 'Áudio' || item.name.toLowerCase().includes('headset') || item.name.toLowerCase().includes('head');

  if (isHeadset) {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    const techName = currentUser ? currentUser : 'Suporte TI';

    // Cria novos registros de headset com status "NOVO" e "DISPONÍVEL EM ESTOQUE"
    for (let i = 0; i < qtyToAdd; i++) {
      const newRecord = {
        model: item.name.includes("MASTERVOX") ? "MTX BLACK" : item.name,
        brand: "MASTERVOX",
        statusStock: "EM ESTOQUE",
        statusDelivery: "NOVO",
        destination: "DISPONÍVEL EM ESTOQUE",
        dateTimeFormatted: formattedDate,
        timestamp: now.toISOString(),
        technician: techName
      };
      const newLogRef = window.dbPush(getRef('headset_logs'));
      await window.dbSet(newLogRef, newRecord);
    }
  } else {
    const newQty = Number(item.qty) + qtyToAdd;
    await window.dbUpdate(getRef(`perifericos/${id}`), { qty: newQty });
  }

  bootstrap.Modal.getInstance(document.getElementById('modalCheckin')).hide();
  alert(`Entrada de ${qtyToAdd} unidade(s) cadastrada com sucesso!`);
}

// Modais Gerais e Salvar Edição
function openAddModal() {
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('modalTitle').innerText = 'Cadastrar Periférico';
  new bootstrap.Modal(document.getElementById('modalAddItem')).show();
}

function openEditModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('itemId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemQty').value = item.qty;
  document.getElementById('itemMinQty').value = item.minQty;
  document.getElementById('modalTitle').innerText = 'Editar Periférico';

  new bootstrap.Modal(document.getElementById('modalAddItem')).show();
}

function openCheckinModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('checkinItemId').value = item.id;
  document.getElementById('checkinItemInfo').innerHTML = `Item selecionado: <strong>${item.name}</strong> (Disponível Atual: ${item.qty})`;
  document.getElementById('checkinQty').value = 1;

  new bootstrap.Modal(document.getElementById('modalCheckin')).show();
}

function openCheckoutModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('checkoutItemId').value = item.id;
  document.getElementById('checkoutItemInfo').innerHTML = `Item selecionado: <strong>${item.name}</strong> (Disponível Atual: ${item.qty})`;
  document.getElementById('checkoutQty').value = 1;
  document.getElementById('checkoutDestination').value = '';

  if (currentUser) {
    document.getElementById('checkoutTech').value = currentUser;
  }

  new bootstrap.Modal(document.getElementById('modalCheckout')).show();
}

async function saveItem(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const qty = parseInt(document.getElementById('itemQty').value, 10);
  const minQty = parseInt(document.getElementById('itemMinQty').value, 10);

  if (id) {
    await window.dbUpdate(getRef(`perifericos/${id}`), { name, category, qty, minQty });
  } else {
    const newItemRef = window.dbPush(getRef('perifericos'));
    await window.dbSet(newItemRef, { name, category, qty, minQty });
  }

  bootstrap.Modal.getInstance(document.getElementById('modalAddItem')).hide();
}

// 🔒 Regra de exclusão exclusiva para o Gabriel
function deleteHeadsetLog(id) {
  if (!currentUser) {
    alert('Acesso negado! Você precisa estar logado para realizar esta ação.');
    openLoginModal();
    return;
  }

  if (currentUser.toLowerCase() !== 'gabriel') {
    alert('Ação Não Permitida!\nApenas o usuário GABRIEL possui permissão para excluir registros desta tabela.');
    return;
  }

  if (confirm('Atenção Gabriel, deseja realmente excluir permanentemente este registro de headset do banco de dados?')) {
    window.dbRemove(getRef(`headset_logs/${id}`));
  }
}

function deleteItem(id) {
  if (!currentUser || currentUser.toLowerCase() !== 'gabriel') {
    alert('Ação Não Permitida!\nApenas o usuário GABRIEL possui permissão para excluir itens.');
    return;
  }
  if (confirm('Confirma a exclusão deste item?')) {
    window.dbRemove(getRef(`perifericos/${id}`));
  }
}

// Funções de Login / Autenticação
function openLoginModal() {
  new bootstrap.Modal(document.getElementById('modalLogin')).show();
}

async function executeLogin(e) {
  e.preventDefault();
  const selectedUser = document.getElementById('loginUserSelect').value;
  const inputPass = document.getElementById('loginPassword').value;

  if (!selectedUser) return;

  const userSnap = await window.dbGet(getRef(`usuarios/${selectedUser}`));
  if (userSnap.exists()) {
    const userData = userSnap.val();
    if (userData.pass === inputPass) {
      currentUser = selectedUser;
      localStorage.setItem('ti_logged_user', currentUser);
      updateUserUI();
      bootstrap.Modal.getInstance(document.getElementById('modalLogin')).hide();
      document.getElementById('loginForm').reset();
      alert(`Bem-vindo, ${currentUser}!`);
    } else {
      alert('Senha incorreta!');
    }
  }
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('ti_logged_user');
  updateUserUI();
}

function updateUserUI() {
  const display = document.getElementById('loggedUserDisplay');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnChangePass = document.getElementById('btnChangePass');

  if (currentUser) {
    const adminTag = currentUser === 'Gabriel' ? ' (Admin)' : '';
    display.innerHTML = `<i class="fa-solid fa-user-check text-success me-1"></i> Logado: <strong>${currentUser}${adminTag}</strong>`;
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'inline-block';
    btnChangePass.style.display = 'inline-block';
  } else {
    display.innerHTML = `<i class="fa-solid fa-user-circle me-1"></i> Não autenticado`;
    btnLogin.style.display = 'inline-block';
    btnLogout.style.display = 'none';
    btnChangePass.style.display = 'none';
  }
}

function openChangePasswordModal() {
  if (!currentUser) return alert('Faça login primeiro.');
  document.getElementById('changePassUserDisplay').value = currentUser;
  new bootstrap.Modal(document.getElementById('modalChangePass')).show();
}

async function executeChangePassword(e) {
  e.preventDefault();
  const currentPass = document.getElementById('currentPassInput').value;
  const newPass = document.getElementById('newPassInput').value;

  const userSnap = await window.dbGet(getRef(`usuarios/${currentUser}`));
  if (userSnap.exists() && userSnap.val().pass === currentPass) {
    await window.dbUpdate(getRef(`usuarios/${currentUser}`), { pass: newPass });
    alert('Senha alterada com sucesso!');
    bootstrap.Modal.getInstance(document.getElementById('modalChangePass')).hide();
    document.getElementById('changePassForm').reset();
  } else {
    alert('Senha atual incorreta!');
  }
}

// Filtros de Busca
function filterItems() {
  const term = document.getElementById('searchInput').value.toLowerCase();
  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(term) || 
    item.category.toLowerCase().includes(term)
  );
  renderTable(filtered);
}

function filterHeadsetLogs() {
  const term = document.getElementById('searchHeadsetLog').value.toLowerCase();
  const filtered = headsetLogs.filter(log => 
    (log.destination && log.destination.toLowerCase().includes(term)) ||
    (log.technician && log.technician.toLowerCase().includes(term)) ||
    (log.statusDelivery && log.statusDelivery.toLowerCase().includes(term)) ||
    (log.model && log.model.toLowerCase().includes(term))
  );
  renderHeadsetLogsTable(filtered);
}

// Exportação Excel
function exportToExcel(type) {
  const now = new Date();
  const exportDateStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');
  
  let dataToExport = [];
  let fileName = "";

  if (type === 'estoque') {
    fileName = `Estoque_Geral_${now.toISOString().slice(0, 10)}.xlsx`;
    dataToExport.push(["RELATÓRIO DE ESTOQUE GERAL - SUPORTE TI"]);
    dataToExport.push([`Data e Hora da Exportação: ${exportDateStr}`]);
    dataToExport.push([]);
    dataToExport.push(["Item", "Categoria", "Quantidade", "Qtd. Mínima", "Status"]);

    items.forEach(i => {
      dataToExport.push([
        i.name,
        i.category,
        i.qty,
        i.minQty,
        i.qty <= i.minQty ? "CRÍTICO" : "NORMAL"
      ]);
    });
  } else if (type === 'headsets') {
    fileName = `Relatorio_Headsets_${now.toISOString().slice(0, 10)}.xlsx`;
    dataToExport.push(["RELATÓRIO DE REGISTRO E SAÍDAS DE HEADSETS - SUPORTE TI"]);
    dataToExport.push([`Data e Hora da Exportação: ${exportDateStr}`]);
    dataToExport.push([]);
    dataToExport.push(["Modelo (UE)", "Marca", "Status", "Situação", "Chamado / Carteira / Destino", "Data/Hora Registro", "Técnico Responsável"]);

    headsetLogs.forEach(l => {
      dataToExport.push([
        l.model || 'MTX BLACK',
        l.brand || 'MASTERVOX',
        l.statusStock || 'EM ESTOQUE',
        l.statusDelivery || 'ENTREGUE',
        l.destination || 'DISPONÍVEL EM ESTOQUE',
        l.dateTimeFormatted || 'Inicial',
        l.technician || 'Sistema'
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  
  XLSX.writeFile(wb, fileName);
}