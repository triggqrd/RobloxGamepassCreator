// State management
let state = {
  userId: null,
  username: null,
  csrfToken: null,
  isCreating: false
};

// Common gamepass values in Robux
const COMMON_VALUES = [2, 5, 10, 15, 25, 50, 75, 100, 150, 200, 250, 350, 500, 750, 1000, 2500, 3500, 5000, 7500, 10000];

// UI Elements
const elements = {
  loading: document.getElementById('loading'),
  notRoblox: document.getElementById('not-roblox'),
  notLoggedIn: document.getElementById('not-logged-in'),
  mainInterface: document.getElementById('main-interface'),
  progressSection: document.getElementById('progress-section'),
  resultsSection: document.getElementById('results-section'),
  errorSection: document.getElementById('error-section'),
  
  username: document.getElementById('username'),
  userid: document.getElementById('userid'),
  
  commonValuesBtn: document.getElementById('common-values-btn'),
  customValueBtn: document.getElementById('custom-value-btn'),
  removeAllBtn: document.getElementById('remove-all-btn'),
  customInput: document.getElementById('custom-input'),
  customAmount: document.getElementById('custom-amount'),
  customCount: document.getElementById('custom-count'),
  createCustomBtn: document.getElementById('create-custom-btn'),
  cancelCustomBtn: document.getElementById('cancel-custom-btn'),
  
  progressFill: document.getElementById('progress-fill'),
  progressCount: document.getElementById('progress-count'),
  progressTotal: document.getElementById('progress-total'),
  progressPercentage: document.getElementById('progress-percentage'),
  statusLog: document.getElementById('status-log'),
  
  resultsList: document.getElementById('results-list'),
  successSummary: document.getElementById('success-summary'),
  doneBtn: document.getElementById('done-btn'),
  
  errorMessage: document.getElementById('error-message'),
  errorBackBtn: document.getElementById('error-back-btn'),
  refreshBtn: document.getElementById('refresh-btn')
};

// Helper function to show only one section
function showSection(sectionName) {
  const sections = ['loading', 'notRoblox', 'notLoggedIn', 'mainInterface', 'progressSection', 'resultsSection', 'errorSection'];
  sections.forEach(section => {
    elements[section].classList.add('hidden');
  });
  elements[sectionName].classList.remove('hidden');
}

// Initialize the popup
async function initialize() {
  showSection('loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('roblox.com')) {
      showSection('notRoblox');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getUserData' });
    
    if (!response.userData || !response.userData.userId) {
      showSection('notLoggedIn');
      return;
    }

    state.userId = response.userData.userId;
    state.username = response.userData.displayName || response.userData.username;
    state.csrfToken = response.csrfToken;

    elements.username.textContent = state.username;
    elements.userid.textContent = state.userId;

    showSection('mainInterface');
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize. Please refresh the page and try again.');
  }
}

// Event Listeners
elements.commonValuesBtn.addEventListener('click', () => {
  createGamepasses(COMMON_VALUES);
});

elements.customValueBtn.addEventListener('click', () => {
  elements.customInput.classList.remove('hidden');
  if (!elements.customCount.value) {
    elements.customCount.value = '1';
  }
  elements.customAmount.focus();
});

elements.removeAllBtn.addEventListener('click', () => {
  showConfirmationModal();
});

elements.createCustomBtn.addEventListener('click', () => {
  const amount = parseInt(elements.customAmount.value, 10);
  const count = parseInt(elements.customCount.value, 10);
  
  if (!amount || amount < 1 || amount > 1000000) {
    alert('Please enter a valid amount between 1 and 1,000,000 Robux');
    elements.customAmount.focus();
    return;
  }

  if (!count || count < 1 || count > 100) {
    alert('Please enter a valid quantity between 1 and 100 gamepasses');
    elements.customCount.focus();
    return;
  }

  const customAmounts = Array(count).fill(amount);
  createGamepasses(customAmounts);
});

elements.cancelCustomBtn.addEventListener('click', () => {
  resetCustomInput();
});

elements.doneBtn.addEventListener('click', () => {
  showSection('mainInterface');
  resetCustomInput();
});

elements.errorBackBtn.addEventListener('click', () => {
  showSection('mainInterface');
});

elements.refreshBtn.addEventListener('click', () => {
  initialize();
});


function resetCustomInput() {
  elements.customInput.classList.add('hidden');
  elements.customAmount.value = '';
  elements.customCount.value = '1';
}

// Show confirmation modal
function showConfirmationModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-icon">⚠️</div>
        <h3>Remove All Gamepasses?</h3>
        <p>This will take <strong>all gamepasses</strong> in your first game off sale. This action cannot be undone.</p>
      </div>
      <div class="modal-buttons">
        <button id="cancel-remove" class="btn btn-ghost">Cancel</button>
        <button id="confirm-remove" class="btn btn-danger">Remove All</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('cancel-remove').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  document.getElementById('confirm-remove').addEventListener('click', () => {
    document.body.removeChild(modal);
    removeAllGamepasses();
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// Check if error is related to gamepass limit
function isGamepassLimitError(errorMessage) {
  if (errorMessage.includes('InternalError') || errorMessage.includes('500')) {
    return true;
  }
  if (errorMessage.toLowerCase().includes('limit') || 
      errorMessage.toLowerCase().includes('maximum') ||
      errorMessage.toLowerCase().includes('too many')) {
    return true;
  }
  return false;
}

// Main gamepass creation function
async function createGamepasses(amounts) {
  if (state.isCreating) return;
  
  state.isCreating = true;
  showSection('progressSection');
  
  elements.statusLog.innerHTML = '';
  elements.progressFill.style.width = '0%';
  
  if (elements.progressCount) elements.progressCount.textContent = '0';
  if (elements.progressTotal) elements.progressTotal.textContent = amounts.length.toString();
  if (elements.progressPercentage) elements.progressPercentage.textContent = '0%';

  try {
    addLog('Fetching your games...', 'info');
    const games = await getUserGames(state.userId);
    
    if (!games || games.length === 0) {
      throw new Error('No games found. You need to have at least one game to create gamepasses.');
    }

    addLog(`Found ${games.length} game(s)`, 'success');

    const universeIds = [];
    for (const game of games) {
      const universeId = await getUniverseId(game.rootPlace.id);
      universeIds.push({ gameId: game.id, universeId, gameName: game.name });
    }

    addLog(`Using game: ${universeIds[0].gameName}`, 'info');
    const targetUniverse = universeIds[0];

    const results = [];
    let successCount = 0;
    let hitLimit = false;

    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];
      
      try {
        addLog(`Creating gamepass for ${amount} Robux...`, 'info');
        
        const gamePassId = await createGamepass(targetUniverse.universeId, amount, state.csrfToken);
        addLog(`Created gamepass #${gamePassId}`, 'success');
        
        await putGamepassOnSale(gamePassId, amount, state.csrfToken);
        addLog(`Listed gamepass for ${amount} Robux`, 'success');
        
        successCount++;
        results.push({ amount, gamePassId, success: true });
        
      } catch (error) {
        if (isGamepassLimitError(error.message)) {
          addLog('⚠️ Gamepass limit reached for this experience', 'error');
          hitLimit = true;
          results.push({ amount, success: false, error: 'Limit reached' });
          
          for (let j = i + 1; j < amounts.length; j++) {
            results.push({ amount: amounts[j], success: false, error: 'Skipped (limit reached)' });
          }
          
          break;
        } else {
          addLog(`Failed to create ${amount} Robux gamepass: ${error.message}`, 'error');
          results.push({ amount, success: false, error: error.message });
        }
      }

      const progress = ((i + 1) / amounts.length) * 100;
      elements.progressFill.style.width = `${progress}%`;

      if (elements.progressCount) elements.progressCount.textContent = (i + 1).toString();
      if (elements.progressTotal) elements.progressTotal.textContent = amounts.length.toString();
      if (elements.progressPercentage) elements.progressPercentage.textContent = `${Math.round(progress)}%`;

      await sleep(500);
    }

    showResults(results, successCount, hitLimit);
    
  } catch (error) {
    console.error('Creation error:', error);
    showError(error.message);
  } finally {
    state.isCreating = false;
  }
}

// Remove all gamepasses function
async function removeAllGamepasses() {
  if (state.isCreating) return;
  
  state.isCreating = true;
  showSection('progressSection');
  
  elements.statusLog.innerHTML = '';
  elements.progressFill.style.width = '0%';
  
  if (elements.progressCount) elements.progressCount.textContent = '0';
  if (elements.progressTotal) elements.progressTotal.textContent = '...';
  if (elements.progressPercentage) elements.progressPercentage.textContent = '0%';

  try {
    addLog('Fetching your games...', 'info');
    const games = await getUserGames(state.userId);
    
    if (!games || games.length === 0) {
      throw new Error('No games found.');
    }

    addLog(`Found ${games.length} game(s)`, 'success');

    const universeIds = [];
    for (const game of games) {
      const universeId = await getUniverseId(game.rootPlace.id);
      universeIds.push({ gameId: game.id, universeId, gameName: game.name });
    }

    addLog(`Using game: ${universeIds[0].gameName}`, 'info');
    const targetUniverse = universeIds[0];

    // Fetch all gamepasses
    addLog('Fetching all gamepasses...', 'info');
    const allGamepasses = await getAllGamepasses(targetUniverse.universeId);
    
    if (!allGamepasses || allGamepasses.length === 0) {
      throw new Error('No gamepasses found in this game.');
    }

    // Filter out gamepasses that are already off-sale (isForSale is false)
    const onsaleGamepasses = allGamepasses.filter(gp => gp.isForSale === true);
    const offsaleCount = allGamepasses.length - onsaleGamepasses.length;
    
    if (offsaleCount > 0) {
      addLog(`Found ${allGamepasses.length} gamepass(es) total (${offsaleCount} already off-sale)`, 'info');
    } else {
      addLog(`Found ${allGamepasses.length} gamepass(es)`, 'success');
    }
    
    if (onsaleGamepasses.length === 0) {
      throw new Error('All gamepasses are already off-sale!');
    }

    addLog(`${onsaleGamepasses.length} gamepass(es) to remove`, 'success');
    
    if (elements.progressTotal) elements.progressTotal.textContent = onsaleGamepasses.length.toString();

    const results = [];
    let successCount = 0;

    for (let i = 0; i < onsaleGamepasses.length; i++) {
      const gamepass = onsaleGamepasses[i];
      
      try {
        addLog(`Removing gamepass: ${gamepass.displayName} (ID: ${gamepass.id})...`, 'info');
        
        await takeGamepassOffSale(gamepass.id, state.csrfToken);
        addLog(`Removed: ${gamepass.displayName}`, 'success');
        
        successCount++;
        results.push({ 
          amount: gamepass.displayName, 
          gamePassId: gamepass.id, 
          price: gamepass.price,
          success: true 
        });
        
      } catch (error) {
        addLog(`Failed to remove ${gamepass.displayName}: ${error.message}`, 'error');
        results.push({ 
          amount: gamepass.displayName, 
          success: false, 
          error: error.message,
          price: gamepass.price
        });
      }

      const progress = ((i + 1) / onsaleGamepasses.length) * 100;
      elements.progressFill.style.width = `${progress}%`;

      if (elements.progressCount) elements.progressCount.textContent = (i + 1).toString();
      if (elements.progressTotal) elements.progressTotal.textContent = onsaleGamepasses.length.toString();
      if (elements.progressPercentage) elements.progressPercentage.textContent = `${Math.round(progress)}%`;

      await sleep(300);
    }

    showRemovalResults(results, successCount, offsaleCount);
    
  } catch (error) {
    console.error('Removal error:', error);
    showError(error.message);
  } finally {
    state.isCreating = false;
  }
}

// API Functions
async function getUserGames(userId) {
  const response = await fetch(`https://games.roblox.com/v2/users/${userId}/games?sortOrder=Asc&limit=50`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch games');
  }

  const data = await response.json();
  return data.data;
}

async function getUniverseId(placeId) {
  const response = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to get universe ID for place ${placeId}`);
  }

  const data = await response.json();
  return data.universeId;
}

async function getAllGamepasses(universeId) {
  let allGamepasses = [];
  let pageToken = '';
  
  do {
    const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    
    const response = await fetch(url, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch gamepasses');
    }

    const data = await response.json();
    allGamepasses = allGamepasses.concat(data.gamePasses);
    pageToken = data.nextPageToken || '';
    
    // Small delay between pagination requests
    if (pageToken) {
      await sleep(200);
    }
    
  } while (pageToken);
  
  return allGamepasses;
}

async function createGamepass(universeId, name, csrfToken) {
  const formData = new FormData();
  formData.append('name', name.toString());
  formData.append('description', '');
  formData.append('universeId', universeId.toString());

  const response = await fetch('https://apis.roblox.com/game-passes/v1/game-passes', {
    method: 'POST',
    headers: {
      'x-csrf-token': csrfToken
    },
    body: formData,
    credentials: 'include',
    mode: 'cors'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create gamepass: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.gamePassId;
}

async function putGamepassOnSale(gamePassId, price, csrfToken) {
  const formData = new FormData();
  formData.append('isForSale', 'true');
  formData.append('price', price.toString());
  formData.append('isRegionalPricingEnabled', 'false');

  const response = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/${gamePassId}/details`, {
    method: 'POST',
    headers: {
      'x-csrf-token': csrfToken
    },
    body: formData,
    credentials: 'include',
    mode: 'cors'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to put gamepass on sale: ${response.status} - ${errorText}`);
  }
}

async function takeGamepassOffSale(gamePassId, csrfToken) {
  const formData = new FormData();
  formData.append('isForSale', 'false');

  const response = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/${gamePassId}/details`, {
    method: 'POST',
    headers: {
      'x-csrf-token': csrfToken
    },
    body: formData,
    credentials: 'include',
    mode: 'cors'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to take gamepass off sale: ${response.status} - ${errorText}`);
  }
}

// Utility Functions
function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  
  let emoji = '';
  switch(type) {
    case 'success':
      emoji = '✓ ';
      break;
    case 'error':
      emoji = '✗ ';
      break;
    case 'info':
      emoji = 'ℹ ';
      break;
  }
  
  entry.textContent = `${emoji}${message}`;
  elements.statusLog.appendChild(entry);
  elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

function showResults(results, successCount, hitLimit = false) {
  showSection('resultsSection');
  
  if (elements.successSummary) {
    let summaryText = `Successfully created ${successCount} out of ${results.length} gamepasses`;
    if (hitLimit) {
      summaryText = `Created ${successCount} gamepasses before hitting the limit`;
    }
    elements.successSummary.textContent = summaryText;
  }
  
  elements.resultsList.innerHTML = '';
  
  if (hitLimit) {
    const warningBanner = document.createElement('div');
    warningBanner.style.cssText = `
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      text-align: center;
    `;
    warningBanner.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
      <div style="font-weight: 700; color: #92400e; margin-bottom: 4px;">Gamepass Limit Reached</div>
      <div style="font-size: 13px; color: #78350f; line-height: 1.5;">
        Each Roblox experience has a maximum limit of <strong>50 gamepasses on sale</strong>.<br>
        Remove some existing gamepasses to create new ones.
      </div>
    `;
    elements.resultsList.appendChild(warningBanner);
  }
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'result-item';
    
    if (result.success) {
      item.innerHTML = `
        <span>✅ <strong>${result.amount} Robux</strong></span>
        <span class="result-amount">ID: ${result.gamePassId}</span>
      `;
    } else {
      const isLimitError = result.error.includes('Limit') || result.error.includes('Skipped');
      const errorColor = isLimitError ? '#f59e0b' : 'var(--error-color)';
      
      item.innerHTML = `
        <span>${isLimitError ? '⚠️' : '❌'} <strong>${result.amount} Robux</strong></span>
        <span style="color: ${errorColor}; font-size: 11px;">${result.error}</span>
      `;
    }
    
    elements.resultsList.appendChild(item);
  });
}

function showRemovalResults(results, successCount, skippedCount = 0) {
  showSection('resultsSection');
  
  if (elements.successSummary) {
    let summaryText = `Successfully removed ${successCount} out of ${results.length} gamepasses`;
    if (skippedCount > 0) {
      summaryText += ` (${skippedCount} already off-sale)`;
    }
    elements.successSummary.textContent = summaryText;
  }
  
  elements.resultsList.innerHTML = '';
  
  // Add info banner if gamepasses were skipped
  if (skippedCount > 0) {
    const infoBanner = document.createElement('div');
    infoBanner.style.cssText = `
      background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      text-align: center;
    `;
    infoBanner.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">ℹ️</div>
      <div style="font-weight: 700; color: #1e40af; margin-bottom: 4px;">Gamepasses Already Off-Sale</div>
      <div style="font-size: 13px; color: #1e3a8a; line-height: 1.5;">
        <strong>${skippedCount}</strong> gamepass(es) were already off-sale and were skipped.
      </div>
    `;
    elements.resultsList.appendChild(infoBanner);
  }
  
  // Show results
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'result-item';
    
    if (result.success) {
      item.innerHTML = `
        <span>✅ <strong>${result.amount}</strong> ${result.price ? `(R$${result.price})` : ''}</span>
        <span class="result-amount">Removed</span>
      `;
    } else {
      item.innerHTML = `
        <span>❌ <strong>${result.amount}</strong> ${result.price ? `(R$${result.price})` : ''}</span>
        <span style="color: var(--error-color); font-size: 11px;">${result.error}</span>
      `;
    }
    
    elements.resultsList.appendChild(item);
  });
}

function showError(message) {
  showSection('errorSection');
  elements.errorMessage.textContent = message;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on load
initialize();