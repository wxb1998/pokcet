// 商店界面
import { gameState } from '../state.js';
import { CAPTURE_ITEMS } from '../constants/index.js';
import { showToast } from '../utils.js';
import { renderHeader } from './header-ui.js';

window._buyItem = function(itemId, price) {
  if (gameState.gold < price) { showToast('金币不足', 'info'); return; }
  gameState.gold -= price;
  gameState.materials[itemId] = (gameState.materials[itemId] || 0) + 1;
  const names = {rope:'草绳', seal:'封灵符', talent_fruit:'天赋果'};
  showToast('购买成功: ' + (names[itemId] || itemId), 'info');
  renderShop();
  renderHeader();
};

window._buyItemBulk = function(itemId, price, count) {
  const total = price * count;
  if (gameState.gold < total) { showToast('金币不足', 'info'); return; }
  gameState.gold -= total;
  gameState.materials[itemId] = (gameState.materials[itemId] || 0) + count;
  const names = {rope:'草绳', seal:'封灵符', talent_fruit:'天赋果'};
  showToast('购买成功: ' + (names[itemId] || itemId) + ' x' + count, 'info');
  renderShop();
  renderHeader();
};

export function renderShop() {
  const el = document.getElementById('shop-list');
  if (!el) return;
  el.innerHTML = '';

  // Capture items section
  el.innerHTML += '<h4 style="color:#ffd700;margin-bottom:8px;">捕捉道具</h4>';

  ['rope', 'seal'].forEach(itemId => {
    const item = CAPTURE_ITEMS[itemId];
    if (!item.shopPrice) return;
    const stock = gameState.materials[itemId] || 0;
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = '<div class="shop-item-info">'
      + '<span style="color:' + item.color + ';font-weight:bold;">' + item.name + '</span>'
      + ' - ' + item.desc
      + '<span style="color:#888;margin-left:8px;">库存:' + stock + '</span>'
      + '</div>'
      + '<div class="shop-item-actions">'
      + '<span style="color:#ffd700;">' + item.shopPrice + '金</span>'
      + ' <button class="btn-sm" onclick="window._buyItem(\'' + itemId + '\',' + item.shopPrice + ')">买1个</button>'
      + ' <button class="btn-sm" onclick="window._buyItemBulk(\'' + itemId + '\',' + item.shopPrice + ',10)">买10个</button>'
      + '</div>';
    el.appendChild(div);
  });

  // Talent fruit section
  el.innerHTML += '<h4 style="color:#4caf50;margin-top:16px;margin-bottom:8px;">特殊道具</h4>';
  const fruitDiv = document.createElement('div');
  fruitDiv.className = 'shop-item';
  const fruitStock = gameState.materials.talent_fruit || 0;
  fruitDiv.innerHTML = '<div class="shop-item-info">'
    + '<span style="color:#4caf50;font-weight:bold;">天赋果</span>'
    + ' - 重随宠物单项个体值'
    + '<span style="color:#888;margin-left:8px;">库存:' + fruitStock + '</span>'
    + '</div>'
    + '<div class="shop-item-actions">'
    + '<span style="color:#ffd700;">500金</span>'
    + ' <button class="btn-sm" onclick="window._buyItem(\'talent_fruit\',500)">买1个</button>'
    + '</div>';
  el.appendChild(fruitDiv);
}
