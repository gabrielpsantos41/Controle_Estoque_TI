let items = [];

// Lista de itens padrão da imagem
const initialItems = [
  { name: "Mouse USB", category: "Periféricos Padrão", qty: 20, minQty: 5 },
  { name: "Teclado USB", category: "Periféricos Padrão", qty: 20, minQty: 5 },
  { name: "Headset", category: "Áudio", qty: 9, minQty: 3 },
  { name: "Monitor", category: "Outros", qty: 15, minQty: 2 },
  { name: "Notebook", category: "Outros", qty: 0, minQty: 2 },
  { name: "Máquina (Desktop)", category: "Outros", qty: 3, minQty: 1 },
  { name: "Adaptador de Rede", category: "Adaptadores", qty: 0, minQty: 2 },
  { name: "Adaptador HDMI", category: "Adaptadores", qty: 2, minQty: 3 },
  { name: "Adaptador DisplayPort", category: "Adaptadores", qty: 0, minQty: 3 }
];

// Referência para a coleção "perifericos" no Firebase
function getItemsRef() {
  return window.dbRef(window.db, 'perifericos');
}

// Povoa o banco caso esteja vazio
async function seedInitialData() {
  const itemsRef = getItemsRef();
  const snapshot = await window.dbGet(itemsRef);
  
  if (!snapshot.exists()) {
    initialItems.forEach(item => {
      const newItemRef = window.dbPush(itemsRef);
      window.dbSet(newItemRef, item);
    });
  }
}

// 1. Escutar alterações no Firebase em tempo real
document.addEventListener('DOMContentLoaded', () => {
  const checkFirebase = setInterval(() => {
    if (window.db) {
      clearInterval(checkFirebase);
      
      // Insere os dados padrão se a base estiver vazia
      seedInitialData();

      const itemsRef = getItemsRef();

      window.dbOnValue(itemsRef, (snapshot) => {
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
    }
  }, 100);
});
// 2. Renderizar Tabela de Itens
function renderTable(filteredItems = null) {
  const tableBody = document.getElementById('inventoryTable');
  const displayItems = filteredItems || items;

  tableBody.innerHTML = '';

  if (displayItems.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          Nenhum periférico cadastrado ou encontrado.
        </td>
      </tr>`;
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
      <td><strong class="${isCritical ? 'text-danger' : ''}">${item.qty}</strong></td>
      <td>${item.minQty}</td>
      <td>${statusBadge}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-success me-1" onclick="openCheckinModal('${item.id}')" title="Dar Entrada">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="openCheckoutModal('${item.id}')" title="Dar Baixa">
          <i class="fa-solid fa-minus"></i>
        </button>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal('${item.id}')" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${item.id}')" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// 3. Atualizar Indicadores do Dashboard
function updateDashboard() {
  const totalTypes = items.length;
  const totalUnits = items.reduce((acc, item) => acc + Number(item.qty), 0);
  const criticalItems = items.filter(item => item.qty <= item.minQty).length;

  document.getElementById('totalTypes').innerText = totalTypes;
  document.getElementById('totalUnits').innerText = totalUnits;
  document.getElementById('criticalItems').innerText = criticalItems;
}

// 4. Filtrar Itens na Busca
function filterItems() {
  const term = document.getElementById('searchInput').value.toLowerCase();
  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(term) || 
    item.category.toLowerCase().includes(term)
  );
  renderTable(filtered);
}

// 5. Abrir Modais (Adicionar, Editar, Entrada e Saída)
function openAddModal() {
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('modalTitle').innerText = 'Cadastrar Periférico';
  
  const modal = new bootstrap.Modal(document.getElementById('modalAddItem'));
  modal.show();
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

  const modal = new bootstrap.Modal(document.getElementById('modalAddItem'));
  modal.show();
}

function openCheckinModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('checkinItemId').value = item.id;
  document.getElementById('checkinItemInfo').innerHTML = `Item selecionado: <strong>${item.name}</strong> (Atual: ${item.qty})`;
  document.getElementById('checkinQty').value = 1;

  const modal = new bootstrap.Modal(document.getElementById('modalCheckin'));
  modal.show();
}

function openCheckoutModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('checkoutItemId').value = item.id;
  document.getElementById('checkoutItemInfo').innerHTML = `Item selecionado: <strong>${item.name}</strong> (Disponível: ${item.qty})`;
  document.getElementById('checkoutQty').value = 1;
  document.getElementById('checkoutReason').value = '';

  const modal = new bootstrap.Modal(document.getElementById('modalCheckout'));
  modal.show();
}

// 6. Salvar Item (Cadastrar / Editar)
function saveItem(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const qty = parseInt(document.getElementById('itemQty').value, 10);
  const minQty = parseInt(document.getElementById('itemMinQty').value, 10);

  if (id) {
    const itemRef = window.dbRef(window.db, `perifericos/${id}`);
    window.dbUpdate(itemRef, { name, category, qty, minQty });
  } else {
    const newItemRef = window.dbPush(getItemsRef());
    window.dbSet(newItemRef, { name, category, qty, minQty });
  }

  const modalEl = document.getElementById('modalAddItem');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
}

// 7. Executar Entrada de Estoque
function executeCheckin(e) {
  e.preventDefault();
  const id = document.getElementById('checkinItemId').value;
  const qtyToAdd = parseInt(document.getElementById('checkinQty').value, 10);

  const item = items.find(i => i.id === id);
  if (item && qtyToAdd > 0) {
    const newQty = Number(item.qty) + qtyToAdd;
    const itemRef = window.dbRef(window.db, `perifericos/${id}`);

    window.dbUpdate(itemRef, { qty: newQty });

    const modalEl = document.getElementById('modalCheckin');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

// 8. Executar Baixa no Estoque
function executeCheckout(e) {
  e.preventDefault();
  const id = document.getElementById('checkoutItemId').value;
  const qtyToRemove = parseInt(document.getElementById('checkoutQty').value, 10);

  const item = items.find(i => i.id === id);
  if (item) {
    if (qtyToRemove > item.qty) {
      alert('A quantidade solicitada é maior do que o estoque disponível!');
      return;
    }

    const newQty = Number(item.qty) - qtyToRemove;
    const itemRef = window.dbRef(window.db, `perifericos/${id}`);

    window.dbUpdate(itemRef, { qty: newQty });

    const modalEl = document.getElementById('modalCheckout');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

// 9. Excluir Item
function deleteItem(id) {
  if (confirm('Tem certeza que deseja remover este item do cadastro?')) {
    const itemRef = window.dbRef(window.db, `perifericos/${id}`);
    window.dbRemove(itemRef);
  }
}