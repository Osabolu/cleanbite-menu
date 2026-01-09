// ============================================================================
// CLEANBITE KITCHEN - OPTIMIZED FRONTEND SCRIPT
// ============================================================================

// Configuration
const CONFIG = {
    backendUrl: 'http://localhost:5000',
    cookingTimes: {
        'soups': 45,
        'mains': 40,
        'sides': 20,
        'drinks': 10,
        'yoghurt': 1440
    }
};

// State Management
const state = {
    cart: JSON.parse(localStorage.getItem('cleanbite_cart')) || [],
    menu: [],
    activeOrder: null,
    paymentMethod: 'transfer'
};

// DOM Elements Cache
const elements = {};

// ==================== INITIALIZATION ====================
async function init() {
    console.log('CleanBite Kitchen initializing...');
    
    // Cache DOM elements
    cacheDOMElements();
    
    // Load menu
    await loadMenu();
    
    // Update cart
    updateCart();
    
    // Setup event listeners
    setupEventListeners();
    
    // Visual effects
    initVisualEffects();
    
    // ======= ADD ENHANCED KITCHEN PULSE INITIALIZATION HERE =======
    initEnhancedKitchenPulse();
    // ==============================================================
    
    // Check for active order
    checkActiveOrder();
    
    console.log('CleanBite Kitchen ready.');
}

function cacheDOMElements() {
    // Menu
    elements.menuGrid = document.getElementById('menuGrid');
    elements.menuCategories = document.getElementById('menuCategories');
    
    // Cart
    elements.cartToggle = document.getElementById('cartToggle');
    elements.cartCount = document.getElementById('cartCount');
    elements.cartSidebar = document.getElementById('cartSidebar');
    elements.cartBody = document.getElementById('cartBody');
    elements.cartEmpty = document.getElementById('cartEmpty');
    elements.cartTotal = document.getElementById('cartTotal');
    elements.cartClose = document.getElementById('cartClose');
    elements.cartOverlay = document.getElementById('cartOverlay');
    elements.checkoutBtn = document.getElementById('checkoutBtn');
    
    // Modals
    elements.checkoutModal = document.getElementById('checkoutModal');
    elements.confirmationModal = document.getElementById('confirmationModal');
    elements.modalClose = document.getElementById('modalClose');
    elements.backToCart = document.getElementById('backToCart');
    
    // Forms
    elements.orderForm = document.getElementById('orderForm');
    
    // Success
    elements.confirmedOrderId = document.getElementById('confirmedOrderId');
    elements.trackOrderLink = document.getElementById('trackOrderLink');
    elements.newOrderBtn = document.getElementById('newOrderBtn');
    
    // ======= ADD KITCHEN PULSE ELEMENTS HERE =======
    // Kitchen Pulse Elements
    elements.prepCountEl = document.getElementById('prepCount');
    elements.cookCountEl = document.getElementById('cookCount');
    elements.packCountEl = document.getElementById('packCount');
    elements.kitchenMessageEl = document.getElementById('kitchenMessage');
    // ===============================================
}

function initVisualEffects() {
    initParallax();
    initTextRotation();
    updateKitchenStatus();
    initCustomerMessaging();
}

// ==================== MENU SYSTEM ====================
async function loadMenu() {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/menu`);
        if (response.ok) {
            const data = await response.json();
            state.menu = data.menu || getLocalMenuData();
        } else {
            state.menu = getLocalMenuData();
        }
        renderMenu();
    } catch (error) {
        console.error('Failed to load menu:', error);
        state.menu = getLocalMenuData();
        renderMenu();
    }
}

function getLocalMenuData() {
    return [
        { 
            id: 1, 
            name: "Cocoa And Moringa", 
            category: "yoghurt", 
            price: 3200, 
            description: "System reboot fuel.",
            image: "IMG_9483.jpg"
        },
        { 
            id: 2, 
            name: "Jollof Cauliflower", 
            category: "mains", 
            price: 2800, 
            description: "Cauliflower rice, smoked tomato sauce.",
            image: "jollof-cauliflower.jpg"
        },
        { 
            id: 3, 
            name: "Plantain Flour Power Sphere", 
            category: "sides", 
            price: 1800, 
            description: "Zero-sugar ancestral intelligence.",
            image: "plantain-power-sphere.jpg"
        },
        { 
            id: 4, 
            name: "Dates And Tahini", 
            category: "yoghurt", 
            price: 2200, 
            description: "Dairy-free, culturized.",
            image: "IMG_9481.jpg"
        },
        { 
            id: 5, 
            name: "Pineapple-Scent Leaf Detox Sparkler", 
            category: "drinks", 
            price: 1500, 
            description: "Naturally alive.",
            image: "pineapple-detox-sparkler.jpg"
        },
        { 
            id: 6, 
            name: "Vanilla And Cinammon", 
            category: "yoghurt", 
            price: 3200, 
            description: "The Warden.",
            image: "IMG_9482.jpg"
        },
        { 
            id: 7, 
            name: "Strawberry And Hibiscus", 
            category: "yoghurt", 
            price: 3500, 
            description: "The Sentinel.",
            image: "IMG_zobo.jpeg"
        }
    ];
}

function renderMenu() {
    if (!elements.menuGrid) return;
    
    if (!state.menu || state.menu.length === 0) {
        elements.menuGrid.innerHTML = `
            <div class="menu-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading menu...</p>
            </div>
        `;
        return;
    }
    
    const menuHTML = state.menu.map(item => {
        const imagePath = `images/${item.image}`;
        const fallbackImage = `https://via.placeholder.com/300x200/FFE5B4/333333?text=${encodeURIComponent(item.name)}`;
        
        return `
            <div class="menu-item" data-category="${item.category}">
                <div class="menu-img-container">
                    <img src="${imagePath}" 
                         alt="${item.name}" 
                         class="menu-img"
                         onerror="this.onerror=null; this.src='${fallbackImage}'">
                </div>
                <div class="menu-details">
                    <h4>${item.name}</h4>
                    <p class="menu-desc">${item.description}</p>
                    <div class="menu-meta">
                        <div class="menu-price">₦${item.price.toLocaleString()}</div>
                        <button class="add-to-cart" data-id="${item.id}">
                            <i class="fas fa-cart-plus"></i> Add
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    elements.menuGrid.innerHTML = menuHTML;
    attachMenuEventListeners();
}

function attachMenuEventListeners() {
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = parseInt(e.currentTarget.dataset.id);
            addToCart(itemId);
        });
    });
}

// ==================== CART SYSTEM ====================
function addToCart(itemId) {
    const item = state.menu.find(i => i.id === itemId);
    if (!item) return;
    
    const existing = state.cart.find(i => i.id === itemId);
    if (existing) {
        existing.quantity += 1;
    } else {
        state.cart.push({
            ...item,
            quantity: 1
        });
    }
    
    updateCart();
    showNotification(`${item.name} added to cart`, 'success');
}

function updateCart() {
    localStorage.setItem('cleanbite_cart', JSON.stringify(state.cart));
    
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (elements.cartCount) {
        elements.cartCount.textContent = totalItems;
    }
    
    renderCart();
    if (elements.checkoutBtn) {
        elements.checkoutBtn.disabled = state.cart.length === 0;
    }
}

function renderCart() {
    if (!elements.cartBody || !elements.cartEmpty) return;
    
    if (state.cart.length === 0) {
        elements.cartEmpty.style.display = 'block';
        elements.cartBody.innerHTML = '';
        if (elements.cartTotal) {
            elements.cartTotal.textContent = '0';
        }
        return;
    }
    
    elements.cartEmpty.style.display = 'none';
    let total = 0;
    
    const cartHTML = state.cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        return `
            <div class="cart-item" data-id="${item.id}">
                <div class="item-info">
                    <h5>${item.name}</h5>
                    <div class="item-meta">
                        <div class="quantity-control">
                            <button class="qty-btn minus" data-id="${item.id}">-</button>
                            <span class="item-quantity">${item.quantity}</span>
                            <button class="qty-btn plus" data-id="${item.id}">+</button>
                        </div>
                        <span class="item-price">₦${itemTotal.toLocaleString()}</span>
                    </div>
                </div>
                <button class="remove-item" data-id="${item.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
    
    elements.cartBody.innerHTML = cartHTML;
    
    if (elements.cartTotal) {
        elements.cartTotal.textContent = total.toLocaleString();
    }
    
    // Add cart event listeners
    elements.cartBody.querySelectorAll('.qty-btn.minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(e.currentTarget.dataset.id);
            updateQuantity(itemId, -1);
        });
    });
    
    elements.cartBody.querySelectorAll('.qty-btn.plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(e.currentTarget.dataset.id);
            updateQuantity(itemId, 1);
        });
    });
    
    elements.cartBody.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(e.currentTarget.dataset.id);
            removeFromCart(itemId);
        });
    });
}

function updateQuantity(itemId, change) {
    const item = state.cart.find(i => i.id === itemId);
    if (!item) return;
    
    item.quantity += change;
    if (item.quantity < 1) {
        removeFromCart(itemId);
    } else {
        updateCart();
    }
}

function removeFromCart(itemId) {
    state.cart = state.cart.filter(item => item.id !== itemId);
    updateCart();
    showNotification('Item removed from cart', 'info');
}

function clearCart() {
    state.cart = [];
    updateCart();
}

// ==================== CHECKOUT & PAYMENT ====================
function calculateTotal() {
    return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function calculateCookingTime() {
    if (state.cart.length === 0) return 45;
    
    const longestTime = Math.max(...state.cart.map(item => 
        CONFIG.cookingTimes[item.category] || 45
    ));
    
    return longestTime;
}

function openCheckout() {
    if (state.cart.length === 0) return;
    
    const total = calculateTotal();
    const cookingTime = calculateCookingTime();
    const modalSummary = document.getElementById('modalOrderSummary');
    
    if (!modalSummary) return;
    
    const summaryHTML = `
        <h4>Order Summary</h4>
        ${state.cart.map(item => `
            <p>${item.quantity} × ${item.name} - ₦${(item.price * item.quantity).toLocaleString()}</p>
        `).join('')}
        <hr>
        <p><strong>Total: ₦${total.toLocaleString()}</strong></p>
        <p><small>Estimated preparation time: ${formatCookingTime(cookingTime)}</small></p>
    `;
    
    modalSummary.innerHTML = summaryHTML;
    if (elements.checkoutModal) {
        elements.checkoutModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

async function submitOrder(orderData) {
    try {
        const cookingTime = calculateCookingTime();
        orderData.estimatedMinutes = cookingTime;
        
        const response = await fetch(`${CONFIG.backendUrl}/api/orders/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Generate invoice
            generateInvoice({
                ...orderData,
                orderId: result.orderId,
                estimatedReady: result.readyBy
            });
            
            // Save customer for messaging
            saveCustomerForMessaging(orderData);
            
            // Show success
            if (elements.confirmedOrderId) {
                elements.confirmedOrderId.textContent = result.orderId;
            }
            if (elements.trackOrderLink) {
                elements.trackOrderLink.href = `${CONFIG.backendUrl}/track.html?order=${result.orderId}`;
            }
            
            // Clear cart
            clearCart();
            
            // Close checkout, show confirmation
            if (elements.checkoutModal) {
                elements.checkoutModal.classList.remove('active');
            }
            if (elements.confirmationModal) {
                elements.confirmationModal.classList.add('active');
            }
            
            // Save order for tracking
            localStorage.setItem('lastOrderId', result.orderId);
            localStorage.setItem('lastOrderTime', Date.now());
            
            showNotification('Order placed successfully!', 'success');
        } else {
            throw new Error(result.message || 'Order failed');
        }
    } catch (error) {
        console.error('Order submission error:', error);
        showNotification(`Order failed: ${error.message}`, 'error');
    }
}

function formatCookingTime(minutes) {
    if (minutes >= 1440) {
        return `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) > 1 ? 's' : ''}`;
    } else if (minutes >= 60) {
        return `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) > 1 ? 's' : ''}`;
    } else {
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 'info-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 2000;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s, fadeOut 0.3s 2.7s;
        max-width: 350px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

// ==================== VISUAL EFFECTS ====================
function initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax-bg');
    if (!parallaxElements.length) return;
    
    function updateParallax() {
        const scrollTop = window.pageYOffset;
        parallaxElements.forEach(element => {
            const speed = 0.5;
            const yPos = -(scrollTop * speed);
            element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });
    }
    
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateParallax();
                ticking = false;
            });
            ticking = true;
        }
    });
    
    updateParallax();
}

function initTextRotation() {
    const taglines = [
        "prepare clean meals",
        "purchase ingredients from trusted sources",
        "prioritize clean energy fuel",
        "never compromise on quality",
        "craft each dish with discipline",
        "honor your body's sovereignty",
        "build meals that build you",
        "transform eating into empowerment"
    ];
    
    const covenants = [
        "Sovereignty starts on your plate",
        "Eat clean. Feel sovereign.",
        "This is metabolic reset",
        "Your body's fuel rebellion",
        "No compromises. Ever.",
        "Clean fuel for a sovereign life",
        "The kitchen is your fortress",
        "Discipline served daily"
    ];
    
    let taglineIndex = 0;
    let covenantIndex = 0;
    const taglineElement = document.getElementById('dynamicTagline');
    const covenantElement = document.getElementById('dynamicCovenant');
    
    if (!taglineElement || !covenantElement) return;
    
    function rotateText() {
        taglineElement.style.opacity = '0';
        covenantElement.style.opacity = '0';
        
        setTimeout(() => {
            taglineElement.textContent = `We ${taglines[taglineIndex]}`;
            covenantElement.textContent = covenants[covenantIndex];
            
            taglineElement.style.opacity = '1';
            covenantElement.style.opacity = '1';
            
            taglineIndex = (taglineIndex + 1) % taglines.length;
            covenantIndex = (covenantIndex + 1) % covenants.length;
        }, 500);
    }
    
    setTimeout(() => {
        rotateText();
        setInterval(rotateText, 6000);
    }, 3000);
}

// ===================================================================
// ======= ENHANCED KITCHEN PULSE SYSTEM - ADD ALL BELOW ============
// ===================================================================

// Kitchen Pulse Data
let kitchenActivity = [];
let kitchenMessages = [
    "All stations operating at optimal levels",
    "Fresh ingredients just arrived from local suppliers",
    "Chef is crafting your meal with precision focus",
    "Temperature control perfect for maximum flavor",
    "Your order is receiving personal attention",
    "Quality check passed - preparing for packaging",
    "Almost ready! Adding finishing touches",
    "Kitchen running at 98% efficiency today"
];

// Initialize kitchen pulse system
function initEnhancedKitchenPulse() {
    updateCurrentTime();
    updateKitchenPulse();
    startKitchenSimulation();
    addActivityItem("Kitchen systems initialized", "system");
    
    // Update every 30 seconds
    setInterval(updateKitchenPulse, 30000);
    
    // Update time every minute
    setInterval(updateCurrentTime, 60000);
}



// Update current time display
function updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        timeElement.textContent = timeString;
    }
}

// Main kitchen pulse update
async function updateKitchenPulse() {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/kitchen/pulse`);
        const data = await response.json();
        
        if (data.success) {
            updateKitchenStats(data);
            updateOrderBubbles(data);
            updateActivityFeed(data);
            updateProgressStats(data);
            
            // Add activity entry
            addActivityItem(`Kitchen pulse updated - ${data.stats.total} orders in system`, "update");
        }
    } catch (error) {
        console.error('Kitchen pulse update failed:', error);
        showKitchenMessage("Connecting to kitchen systems...");
    }
}

// Update kitchen statistics
function updateKitchenStats(data) {
    const stats = data.stats || { prep: 0, cook: 0, pack: 0, total: 0 };
    
    // Update counters
    if (elements.prepCountEl) animateCounter(elements.prepCountEl, stats.prep);
    if (elements.cookCountEl) animateCounter(elements.cookCountEl, stats.cook);
    if (elements.packCountEl) animateCounter(elements.packCountEl, stats.pack);
    
    // Update total orders
    const totalOrdersEl = document.getElementById('totalOrders');
    if (totalOrdersEl) totalOrdersEl.textContent = stats.total;
    
    // Update pulse indicator
    const pulseIndicator = document.querySelector('.pulse-indicator');
    if (pulseIndicator) {
        pulseIndicator.classList.toggle('busy', stats.total > 5);
        pulseIndicator.classList.toggle('active', stats.total > 0);
    }
    
    // Update efficiency
    updateEfficiency(stats);
}

// Animate counter with visual effect
function animateCounter(element, newValue) {
    if (!element) return;
    
    const current = parseInt(element.textContent) || 0;
    if (current === newValue) return;
    
    element.classList.add('counting');
    
    // Quick animation for small changes
    let start = current;
    const duration = Math.min(800, Math.abs(newValue - current) * 50);
    const increment = (newValue - start) / (duration / 16);
    
    const timer = setInterval(() => {
        start += increment;
        if ((increment > 0 && start >= newValue) || (increment < 0 && start <= newValue)) {
            clearInterval(timer);
            start = newValue;
            setTimeout(() => {
                element.classList.remove('counting');
            }, 300);
        }
        element.textContent = Math.round(start);
    }, 16);
}

// Update order bubbles visualization
function updateOrderBubbles(data) {
    const orders = data.orders || [];
    
    // Clear existing bubbles
    ['prepBubbles', 'cookBubbles', 'packBubbles'].forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = '';
    });
    
    // Add new bubbles based on order status
    orders.forEach(order => {
        const status = order.status || 'preparing';
        let containerId;
        
        if (['received', 'preparing'].includes(status)) {
            containerId = 'prepBubbles';
        } else if (status === 'cooking') {
            containerId = 'cookBubbles';
        } else if (['almost-ready', 'ready'].includes(status)) {
            containerId = 'packBubbles';
        }
        
        const container = document.getElementById(containerId);
        if (container && container.children.length < 5) {
            const bubble = document.createElement('div');
            bubble.className = 'order-bubble';
            bubble.textContent = order.id?.substring(0, 3) || 'CB';
            bubble.title = `Order ${order.id || '#'}`;
            container.appendChild(bubble);
        }
    });
}

// Update activity feed
function updateActivityFeed(data) {
    const activityCountEl = document.getElementById('activityCount');
    if (activityCountEl) {
        activityCountEl.textContent = (kitchenActivity.length || 0) + 1;
    }
    
    // Add recent orders to activity
    const recentOrders = (data.orders || []).slice(-3);
    recentOrders.forEach(order => {
        if (!kitchenActivity.includes(order.id)) {
            const timeAgo = getTimeAgo(order.createdAt);
            addActivityItem(`Order ${order.id} moved to ${order.status}`, "order", timeAgo);
            kitchenActivity.push(order.id);
        }
    });
}

// Add activity item to feed
function addActivityItem(message, type = "info", time = "Just now") {
    const activityFeed = document.getElementById('activityFeed');
    if (!activityFeed) return;
    
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    
    const icons = {
        order: 'fas fa-shopping-cart',
        system: 'fas fa-server',
        update: 'fas fa-sync',
        alert: 'fas fa-exclamation-triangle'
    };
    
    const icon = icons[type] || 'fas fa-info-circle';
    
    activityItem.innerHTML = `
        <div class="activity-icon">
            <i class="${icon}"></i>
        </div>
        <div class="activity-content">
            <p>${message}</p>
            <span class="activity-time">${time}</span>
        </div>
    `;
    
    activityFeed.insertBefore(activityItem, activityFeed.firstChild);
    
    // Limit feed to 10 items
    if (activityFeed.children.length > 10) {
        activityFeed.removeChild(activityFeed.lastChild);
    }
}

// Update progress and efficiency
function updateEfficiency(stats) {
    const total = stats.total || 0;
    const completed = Math.floor(total * 0.7); // Simulated completed orders
    
    const efficiency = total > 0 ? Math.min(98, 70 + Math.random() * 25) : 85;
    const avgTime = total > 3 ? '38m' : '45m';
    
    // Update elements
    const efficiencyBar = document.getElementById('efficiencyBar');
    const efficiencyPercent = document.getElementById('efficiencyPercent');
    const completedOrders = document.getElementById('completedOrders');
    const avgTimeEl = document.getElementById('avgTime');
    const accuracyRate = document.getElementById('accuracyRate');
    
    if (efficiencyBar) {
        efficiencyBar.style.width = `${efficiency}%`;
        efficiencyBar.style.background = getEfficiencyColor(efficiency);
    }
    
    if (efficiencyPercent) efficiencyPercent.textContent = `${efficiency}%`;
    if (completedOrders) completedOrders.textContent = completed;
    if (avgTimeEl) avgTimeEl.textContent = avgTime;
    if (accuracyRate) accuracyRate.textContent = `${98 + Math.floor(Math.random() * 2)}%`;
}

// Get color based on efficiency
function getEfficiencyColor(percent) {
    if (percent >= 90) return 'linear-gradient(90deg, #2ecc71, #27ae60)';
    if (percent >= 75) return 'linear-gradient(90deg, #3498db, #2980b9)';
    if (percent >= 60) return 'linear-gradient(90deg, #f39c12, #e67e22)';
    return 'linear-gradient(90deg, #e74c3c, #c0392b)';
}

// Update kitchen message with typing effect
function showKitchenMessage(message) {
    const messageEl = document.getElementById('kitchenMessage');
    if (!messageEl) return;
    
    const messageText = messageEl.querySelector('.message-text');
    const typingIndicator = messageEl.querySelector('.typing-indicator');
    
    if (messageText && typingIndicator) {
        // Show typing indicator
        typingIndicator.style.display = 'flex';
        messageText.textContent = '';
        
        // Simulate typing
        setTimeout(() => {
            let i = 0;
            const typeWriter = () => {
                if (i < message.length) {
                    messageText.textContent += message.charAt(i);
                    i++;
                    setTimeout(typeWriter, 30);
                } else {
                    // Hide typing indicator
                    typingIndicator.style.display = 'none';
                }
            };
            typeWriter();
        }, 500);
    }
}

// Get time ago string
function getTimeAgo(timestamp) {
    if (!timestamp) return "Recently";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
}

// Start kitchen simulation (for demo purposes)
function startKitchenSimulation() {
    // Rotate kitchen messages
    let messageIndex = 0;
    setInterval(() => {
        showKitchenMessage(kitchenMessages[messageIndex]);
        messageIndex = (messageIndex + 1) % kitchenMessages.length;
    }, 10000);
    
    // Simulate occasional kitchen events
    setInterval(() => {
        if (Math.random() > 0.7) {
            const events = [
                { message: "Fresh ingredients restocked", type: "system" },
                { message: "Quality control check completed", type: "update" },
                { message: "New efficiency record achieved", type: "alert" }
            ];
            const event = events[Math.floor(Math.random() * events.length)];
            addActivityItem(event.message, event.type);
        }
    }, 30000);
}

// Update progress stats
function updateProgressStats(data) {
    // This would be calculated from real data in production
    const stats = {
        efficiency: 85 + Math.floor(Math.random() * 15),
        completed: Math.floor((data.stats?.total || 0) * 0.7),
        avgTime: '42m',
        accuracy: 97 + Math.floor(Math.random() * 2)
    };
    
    const efficiencyPercent = document.getElementById('efficiencyPercent');
    const completedOrders = document.getElementById('completedOrders');
    const avgTimeEl = document.getElementById('avgTime');
    const accuracyRate = document.getElementById('accuracyRate');
    
    if (efficiencyPercent) efficiencyPercent.textContent = `${stats.efficiency}%`;
    if (completedOrders) completedOrders.textContent = stats.completed;
    if (avgTimeEl) avgTimeEl.textContent = stats.avgTime;
    if (accuracyRate) accuracyRate.textContent = `${stats.accuracy}%`;
    
    const efficiencyBar = document.getElementById('efficiencyBar');
    if (efficiencyBar) {
        efficiencyBar.style.width = `${stats.efficiency}%`;
    }
}

// ===================================================================
// ======= END OF ENHANCED KITCHEN PULSE SYSTEM ======================
// ===================================================================

// ==================== CUSTOMER MESSAGING ====================
function initCustomerMessaging() {
    const customers = JSON.parse(localStorage.getItem('cleanbite_customers') || '[]');
    console.log(`Loaded ${customers.length} customers for messaging`);
}

function saveCustomerForMessaging(orderData) {
    const customers = JSON.parse(localStorage.getItem('cleanbite_customers') || '[]');
    
    const existingIndex = customers.findIndex(c =>
        c.phone === orderData.customerPhone || c.email === orderData.customerEmail
    );
    
    const customer = {
        name: orderData.customerName,
        email: orderData.customerEmail,
        phone: orderData.customerPhone,
        firstOrder: new Date().toISOString(),
        lastOrder: new Date().toISOString(),
        orderCount: 1,
        birthday: null,
        preferences: []
    };
    
    if (existingIndex > -1) {
        customers[existingIndex].lastOrder = new Date().toISOString();
        customers[existingIndex].orderCount += 1;
    } else {
        customers.push(customer);
    }
    
    localStorage.setItem('cleanbite_customers', JSON.stringify(customers));
    
    console.log(`Customer saved: ${customer.name}`);
}

// ==================== INVOICE GENERATION ====================
function generateInvoice(orderData) {
    const invoiceId = `INV-${orderData.orderId}`;
    const bankDetails = {
        name: 'Emmanuel Osabolu Okpere',
        bank: 'Carbon Micro Finance Bank',
        account: '3034457406',
        note: 'Transfer with Order ID as reference'
    };
    
    const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice ${invoiceId}</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a574; padding-bottom: 20px; }
                .bank-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4a574; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #f2f2f2; }
                .total { font-size: 1.2em; font-weight: bold; }
                .footer { margin-top: 40px; text-align: center; color: #666; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>CleanBite Kitchen</h1>
                <h2>Invoice: ${invoiceId}</h2>
                <p>Order ID: ${orderData.orderId}</p>
                <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="bank-info">
                <h3>Bank Transfer Details</h3>
                <p><strong>Account Name:</strong> ${bankDetails.name}</p>
                <p><strong>Bank:</strong> ${bankDetails.bank}</p>
                <p><strong>Account Number:</strong> ${bankDetails.account}</p>
                <p><strong>Reference:</strong> ${orderData.orderId}</p>
                <p><em>${bankDetails.note}</em></p>
            </div>
            <h3>Order Details</h3>
            <table>
                <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
                ${orderData.items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>₦${item.price.toLocaleString()}</td>
                        <td>₦${(item.price * item.quantity).toLocaleString()}</td>
                    </tr>
                `).join('')}
                <tr class="total">
                    <td colspan="3" style="text-align: right;">Total:</td>
                    <td>₦${orderData.totalAmount.toLocaleString()}</td>
                </tr>
            </table>
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${orderData.customerName}</p>
            <p><strong>Phone:</strong> ${orderData.customerPhone}</p>
            <p><strong>Email:</strong> ${orderData.customerEmail}</p>
            <p><strong>Pickup Time:</strong> ${orderData.estimatedReady}</p>
            <div class="footer">
                <p>Thank you for choosing CleanBite Kitchen.</p>
                <p>Bring this invoice or mention Order ID at pickup.</p>
                <p>Sovereignty starts on your plate.</p>
            </div>
        </body>
        </html>
    `;
    
    const invoiceWindow = window.open('', '_blank');
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
    
    return invoiceId;
}

// ==================== KITCHEN STATUS ====================
function updateKitchenStatus() {
    const now = new Date();
    const hours = now.getHours();
    const isOpen = hours >= 8 && hours < 20;
    
    const statusElement = document.getElementById('kitchenStatus');
    const slotElement = document.getElementById('nextSlot');
    
    if (statusElement) {
        statusElement.innerHTML = `Kitchen: <strong>${isOpen ? 'Open' : 'Closed'}</strong> • ${isOpen ?
            'Orders accepted' : 'Opens at 8AM'}`;
    }
    
    if (slotElement && isOpen) {
        const slots = ['15 min', '30 min', '45 min', '1 hour'];
        const randomSlot = slots[Math.floor(Math.random() * slots.length)];
        slotElement.textContent = randomSlot;
    }
}

function checkActiveOrder() {
    const orderId = localStorage.getItem('lastOrderId');
    const orderTime = localStorage.getItem('lastOrderTime');
    
    if (orderId && orderTime) {
        const elapsed = Date.now() - parseInt(orderTime);
        const cookingTime = 45 * 60000;
        
        if (elapsed < cookingTime) {
            showNotification(`Your order #${orderId} is being prepared`, 'info');
        } else {
            localStorage.removeItem('lastOrderId');
            localStorage.removeItem('lastOrderTime');
        }
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Cart toggle
    if (elements.cartToggle) {
        elements.cartToggle.addEventListener('click', () => {
            if (elements.cartSidebar) elements.cartSidebar.classList.add('active');
            if (elements.cartOverlay) elements.cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Cart close
    if (elements.cartClose) {
        elements.cartClose.addEventListener('click', closeCart);
    }
    
    // Cart overlay
    if (elements.cartOverlay) {
        elements.cartOverlay.addEventListener('click', closeCart);
    }
    
    // Checkout button
    if (elements.checkoutBtn) {
        elements.checkoutBtn.addEventListener('click', openCheckout);
    }
    
    // Modal close
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', () => {
            if (elements.checkoutModal) elements.checkoutModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }
    
    // Back to cart
    if (elements.backToCart) {
        elements.backToCart.addEventListener('click', () => {
            if (elements.checkoutModal) elements.checkoutModal.classList.remove('active');
            if (elements.cartSidebar) elements.cartSidebar.classList.add('active');
            if (elements.cartOverlay) elements.cartOverlay.classList.add('active');
        });
    }
    
    // Order form submission
    if (elements.orderForm) {
        elements.orderForm.addEventListener('submit', handleOrderSubmit);
    }
    
    // New order button
    if (elements.newOrderBtn) {
        elements.newOrderBtn.addEventListener('click', () => {
            if (elements.confirmationModal) elements.confirmationModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            location.reload();
        });
    }
    
    // Menu category filtering
    if (elements.menuCategories) {
        elements.menuCategories.addEventListener('click', (e) => {
            if (!e.target.classList.contains('category-btn')) return;
            
            elements.menuCategories.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');
            
            const category = e.target.dataset.category;
            filterMenu(category);
        });
    }
    
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
}

function closeCart() {
    if (elements.cartSidebar) elements.cartSidebar.classList.remove('active');
    if (elements.cartOverlay) elements.cartOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('#submitOrder');
    const originalText = submitBtn.innerHTML;
    
    // Show loading
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;
    
    // Collect data
    const orderData = {
        customerName: document.getElementById('customerName').value,
        customerEmail: document.getElementById('customerEmail').value,
        customerPhone: document.getElementById('customerPhone').value,
        deliveryNotes: document.getElementById('deliveryNotes').value,
        items: state.cart,
        totalAmount: calculateTotal(),
        paymentMethod: state.paymentMethod,
        estimatedMinutes: calculateCookingTime()
    };
    
    // Submit
    await submitOrder(orderData);
    
    // Reset button
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
}

function filterMenu(category) {
    const items = document.querySelectorAll('.menu-item');
    items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Add CSS animations
function addNotificationStyles() {
    if (document.querySelector('#notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ==================== START APPLICATION ====================
document.addEventListener('DOMContentLoaded', () => {
    addNotificationStyles();
    init();
});