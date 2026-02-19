// ============================================================================
// CLEANBITE EMPIRE - CUSTOMER FRONTEND
// UPDATED WITH COMPLETE ADMIN ↔ KITCHEN SYNC
// ============================================================================

// ==================== CONFIGURATION ====================
const CONFIG = {
    backendUrl: 'http://localhost:5000',
    cookingTimes: {
        'yoghurt': 1440,
        'soups': 60,
        'mains': 40,
        'sides': 20,
        'drinks': 10
    },

     // AUTO-PROGRESSION TIMERS (minutes)
    autoProgression: {
        'preparing': 30,    // 30 min preparing → cooking
        'cooking': 45,      // 45 min cooking → ready
        'ready': null       // NO auto-progression from ready → completed
    },

    pickupLocation: 'Ibadan Pickup',
    businessHours: {
        open: 8,  // 8 AM
        close: 20 // 8 PM
    }
};

// 🔥 ADD THE IMPERIAL SCHEMA RIGHT HERE (after CONFIG)
const IMPERIAL_CUSTOMER_SCHEMA = {
    id: 'Imperial ID',
    name: 'Citizen Name',
    title: 'Imperial Title',
    rank: 'Citizen Rank',
    phone: 'Communication Orb',
    email: 'Imperial Scroll',
    totalDecrees: 'Decrees Issued',
    totalTribute: 'Tribute Collected',
    loyaltyScore: 'Loyalty Score',
    status: 'Citizen Status',
    lastAudience: 'Last Audience',
    crowned: 'Crowned Citizen',
    achievements: 'Imperial Achievements',
    preferences: 'Citizen Preferences',
    communications: 'Herald Communications'
};

class WebSocketManager {
    constructor(url) {
        this.ws = null;
        this.url = url;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    connect() {
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected');
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.reconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
        }
    }
    
    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                if (this.ws?.readyState !== WebSocket.OPEN) {
                    this.connect();
                }
            }, delay);
        }
    }
    
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

// Imperial Registry Data Storage
const IMPERIAL_STORAGE_KEY = 'empire_citizen_registry_v1';
const CROWNED_CITIZENS_KEY = 'empire_crowned_citizens';

// ==================== KITCHEN TIMEOUT CONFIG ====================
const KITCHEN_TIMEOUTS = {
    packaging: 120, // 2 hours in packaging for regular orders
    yoghurtPackaging: 180, // 3 hours minimum for yoghurt in ready/packaging
    maxSystemHours: {
        'completed': 24,    // Keep completed orders 24 hours
        'cancelled': 24,    // Keep cancelled orders 24 hours  
        'ready': 12,        // Auto-complete regular orders after 12 hours
        'cooking': 8,       // Emergency complete if stuck cooking
        'preparing': 6,     // Emergency complete if stuck preparing
        'pending-payment': 48 // Cancel unpaid after 48 hours
    }
};

const USERS_2FA_FILE = path.join(DATA_DIR, 'users_2fa.json');

const PaymentWebSocketServer = require('./server/websocket');
const paymentWSS = new PaymentWebSocketServer(server);



// This prevents completed orders from returning to the kitchen display
const COMPLETED_ORDERS_LOCK = new Set();

function lockCompletedOrder(orderId) {
    console.log(`🔒 Locking completed order: ${orderId}`);
    COMPLETED_ORDERS_LOCK.add(orderId);
    // Keep for 24 hours to ensure they don't come back
    setTimeout(() => {
        COMPLETED_ORDERS_LOCK.delete(orderId);
    }, 24 * 60 * 60 * 1000);
}

const ORDER_LIFECYCLE = {
    'pending-payment': { next: 'preparing', timeout: 30 }, // 30min to verify
    'preparing': { next: 'cooking', timeout: 45 }, // 45min max prep
    'cooking': { next: 'ready', timeout: 60 }, // 60min max cooking for regular orders
    'ready': { next: 'null', timeout: null }, // 120min (2h) packaging for regular orders
    'completed': { next: null, timeout: 1440 }, // Archive after 24h
    'cancelled': { next: null, timeout: 1440 } // Archive after 24h
};

// ==================== YOGHURT-SPECIFIC CONFIG ====================
const YOGHURT_CONFIG = {
    fermentationTime: 1440, // 24 hours in minutes for cooking phase
    minPackagingTime: 180, // 3 hours minimum in ready/packaging phase
    maxPackagingTime: 2880, // 48 hours maximum in ready/packaging phase
    warningStages: ['cooking', 'ready'], // Stages to show warnings if moving backward
    allowBackwardMovement: true, // ✅ ALLOW kitchen to move backward when needed
    maxRetryAttempts: 3,
    specialMessages: {
        fermenting: "🧫 24-hour fermentation in progress",
        packaging: "🧫 Yoghurt in packaging - fresh with no preservatives",
        ready: "🧫 Ready for pickup! Please collect within 3-7 days",
        completed: "Fermentation complete - ready for pickup",
        warning: "⚠️ Yoghurt order - consider shelf life when moving backward"
    },
    storageInstructions: {
        shelfLife: "7 days refrigerated",
        temperature: "2-4°C",
        note: "Contains live cultures - do not freeze"
    }
};


// ==================== STATE MANAGEMENT ====================
const state = {
    cart: JSON.parse(localStorage.getItem('cleanbite_cart')) || [],
    menu: [],
    activeOrder: null,
    paymentMethod: 'transfer'
};

function getMessagingSystem() {
    if (!window.customerMessagingManager) {
        window.customerMessagingManager = new CustomerMessagingSystem();
    }
    return window.customerMessagingManager;
}
// ==================== DOM ELEMENTS CACHE ====================
const elements = {};

function cacheDOMElements() {
    // Menu elements
    elements.menuGrid = document.getElementById('menuGrid');
    elements.menuCategories = document.getElementById('menuCategories');
    
    // Cart elements
    elements.cartToggle = document.getElementById('cartToggle');
    elements.cartCount = document.getElementById('cartCount');
    elements.cartSidebar = document.getElementById('cartSidebar');
    elements.cartBody = document.getElementById('cartBody');
    elements.cartEmpty = document.getElementById('cartEmpty');
    elements.cartTotal = document.getElementById('cartTotal');
    elements.cartClose = document.getElementById('cartClose');
    elements.cartOverlay = document.getElementById('cartOverlay');
    elements.checkoutBtn = document.getElementById('checkoutBtn');
    
    // Modal elements
    elements.checkoutModal = document.getElementById('checkoutModal');
    elements.confirmationModal = document.getElementById('confirmationModal');
    elements.modalClose = document.getElementById('modalClose');
    elements.backToCart = document.getElementById('backToCart');
    
    // Form elements
    elements.orderForm = document.getElementById('orderForm');
    
    // Success elements
    elements.confirmedOrderId = document.getElementById('confirmedOrderId');
    elements.trackOrderLink = document.getElementById('trackOrderLink');
    elements.newOrderBtn = document.getElementById('newOrderBtn');
}

// ==================== DYNAMIC TAGLINE ROTATOR ====================
function initTaglineRotator() {
    console.log('🔄 Initializing tagline rotator...');
    
    const taglines = [
        "We prepare clean meals",
        "Chemical-free, ancestral recipes",
        "Food as fuel for sovereignty",
        "24-hour fermented yoghurt mastery",
        "Locally sourced, globally inspired",
        "Your health is your empire"
    ];
    
    const covenantVerses = [
        "Sovereignty starts on your plate",
        "Your body is your temple",
        "Eat clean, rule with clarity",
        "Nutrition is revolution",
        "Food is the first medicine",
        "Reclaim your energy through eating"
    ];
    
    let currentTaglineIndex = 0;
    let currentCovenantIndex = 0;
    
    const taglineElement = document.getElementById('dynamicTagline');
    const covenantElement = document.getElementById('dynamicCovenant');
    
    if (!taglineElement && !covenantElement) {
        console.log('❌ Tagline elements not found');
        return;
    }
    
    function rotateText() {
        // Rotate tagline
        if (taglineElement) {
            taglineElement.style.opacity = '0';
            taglineElement.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                currentTaglineIndex = (currentTaglineIndex + 1) % taglines.length;
                taglineElement.textContent = taglines[currentTaglineIndex];
                taglineElement.style.opacity = '1';
                taglineElement.style.transform = 'translateY(0)';
            }, 300);
        }
        
        // Rotate covenant verse
        if (covenantElement) {
            covenantElement.style.opacity = '0';
            covenantElement.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                currentCovenantIndex = (currentCovenantIndex + 1) % covenantVerses.length;
                covenantElement.textContent = covenantVerses[currentCovenantIndex];
                covenantElement.style.opacity = '1';
                covenantElement.style.transform = 'translateY(0)';
            }, 500);
        }
    }
    
    // Initial rotation after 5 seconds
    setTimeout(rotateText, 5000);
    
    // Then rotate every 5 seconds
    setInterval(rotateText, 5000);
    
    console.log('✅ Tagline rotator initialized');
}

function initLiveOrderCount() {
    console.log('📊 Initializing live order count...');
    
    const orderCountElements = document.querySelectorAll('.bubble-count');
    if (orderCountElements.length === 0) return;
    
    // Function to update order counts
    async function updateOrderCounts() {
        try {
            // In production, this would fetch from your API
            // For now, using simulated data
            const simulatedData = {
                liveOrders: Math.floor(Math.random() * 20) + 5,
                yoghurtFermenting: Math.floor(Math.random() * 30) + 15,
                preparingNow: Math.floor(Math.random() * 15) + 8
            };
            
            // Update each bubble with animation
            document.querySelectorAll('.stat-bubble').forEach((bubble, index) => {
                const countElement = bubble.querySelector('.bubble-count');
                if (countElement) {
                    const oldValue = parseInt(countElement.textContent) || 0;
                    let newValue;
                    
                    switch(index) {
                        case 0: newValue = simulatedData.liveOrders; break;
                        case 1: newValue = simulatedData.yoghurtFermenting; break;
                        case 2: newValue = simulatedData.preparingNow; break;
                        default: newValue = oldValue;
                    }
                    
                    if (newValue !== oldValue) {
                        // Add animation class
                        countElement.classList.add('updated');
                        
                        // Update value
                        countElement.textContent = newValue;
                        
                        // Add live indicator to first bubble
                        if (index === 0) {
                            bubble.classList.add('live');
                        }
                        
                        // Remove animation class after animation completes
                        setTimeout(() => {
                            countElement.classList.remove('updated');
                        }, 500);
                    }
                }
            });
            
        } catch (error) {
            console.error('Error updating order counts:', error);
        }
    }

    // Simulated data for demo
    function updateSimulatedCounts() {
        const simulatedData = {
            liveOrders: Math.floor(Math.random() * 20) + 5,
            yoghurtFermenting: Math.floor(Math.random() * 30) + 15,
            preparingNow: Math.floor(Math.random() * 15) + 8
        };
        
        document.querySelectorAll('.bubble-count').forEach((count, index) => {
            const oldValue = parseInt(count.textContent) || 0;
            let newValue;
            
            switch(index) {
                case 0: newValue = simulatedData.liveOrders; break;
                case 1: newValue = simulatedData.yoghurtFermenting; break;
                case 2: newValue = simulatedData.preparingNow; break;
                default: newValue = oldValue;
            }
            
            if (newValue !== oldValue) {
                count.classList.add('updated');
                count.textContent = newValue;
                setTimeout(() => count.classList.remove('updated'), 500);
            }
        });
        
        // Add live indicator to first bubble if orders > 0
        const firstBubble = orderStats.querySelector('.stat-bubble:first-child');
        if (firstBubble && simulatedData.liveOrders > 0) {
            firstBubble.classList.add('live');
        }
    }
    
    // Initial update
    updateOrderCounts();
    
    // Update every 30 seconds for real data, 10 seconds for demo
    const updateInterval = setInterval(updateOrderCounts, 30000);
    
    // Cleanup function
    return () => clearInterval(updateInterval);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initTaglineRotator();
    
    // Only init live order count if we're on the main page
    if (document.getElementById('orderStats')) {
        initLiveOrderCount();
    }
    
    // Initial update
    updateOrderCounts();
    
    // Update every 30 seconds (in production) or 10 seconds (for demo)
    setInterval(updateOrderCounts, 10000);
    
    console.log('✅ Live order count initialized');
}


// ==================== MODERN CART SYSTEM ====================

class ModernCartSystem {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cleanbite_cart')) || [];
        this.menuItems = [];
        this.init();
    }

    init() {
        console.log('🛒 Modern Cart System Initializing...');
        
        // Load menu items
        this.loadMenu();
        
        // Update cart display
        this.updateCartDisplay();
        
        // Setup event listeners
        this.setupCartEventListeners();
        
        console.log('✅ Modern Cart System Ready');
    }

    setupCartEventListeners() {

          // Cart icon click
        document.querySelector('.cart-icon').addEventListener('click', (e) => {
            e.preventDefault();
            this.showCartModal();
        });
         // Floating cart button
        const floatingCart = document.getElementById('floatingCart');
        if (floatingCart) {
            floatingCart.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCartModal();
            });
        }
            
         // Cart indicator in menu header
        const cartIndicator = document.getElementById('cartIndicator');
        if (cartIndicator) {
            cartIndicator.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCartModal();
            });
        }
            
          // Clear cart button
        document.getElementById('clearCartBtn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your cart?')) {
                this.clearCart();
            }
        });
        
        // Checkout button
        document.getElementById('checkoutBtn')?.addEventListener('click', () => {
            if (this.cart.length > 0) {
                this.hideCartModal();
                this.showCheckoutModal();
            }
        });
        
         document.querySelectorAll('#cartModal .close').forEach(button => {
        button.addEventListener('click', () => {
            this.hideCartModal();
        });
    });
        
        // Close modal on outside click
        document.getElementById('cartModal').addEventListener('click', (e) => {
            if (e.target.id === 'cartModal') {
                this.hideCartModal();
            }
        });
    }

    updateCartDisplay() {
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update all cart count displays
        document.getElementById('cartCount').textContent = totalItems;
        document.getElementById('floatingCartCount').textContent = totalItems;
        
        // Update cart items in modal
        this.updateCartModal();
        
        // Show/hide floating cart
        const floatingCart = document.getElementById('floatingCart');
        if (floatingCart) {
            floatingCart.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    updateCartModal() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartSummary = document.getElementById('cartSummary');
    const cartActions = document.getElementById('cartActions');
    const floatingCartCount = document.getElementById('floatingCartCount');
    
    if (!cartItemsContainer) return;
    
    // Update floating cart count
    if (floatingCartCount) {
        const totalCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        floatingCartCount.textContent = totalCount;
    }
    
    if (this.cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-state">
                <i class="fas fa-shopping-cart"></i>
                <h4>Your cart is empty</h4>
                <p>Add items from the menu to get started</p>
            </div>
        `;
        cartSummary.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    
    let itemsHTML = '';
    let subtotal = 0;
    
    this.cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        itemsHTML += `
            <div class="cart-item" data-index="${index}">
                <div class="cart-item-image">
                    <i class="fas fa-${this.getCategoryIcon(item.category)}"></i>
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">₦${item.price.toLocaleString()} each</div>
                </div>
                <div class="cart-item-controls">
                    <button class="btn-qty-sm minus" data-id="${item.id}">-</button>
                    <span class="cart-item-qty">${item.quantity}</span>
                    <button class="btn-qty-sm plus" data-id="${item.id}">+</button>
                </div>
                <div class="cart-item-total">₦${itemTotal.toLocaleString()}</div>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = itemsHTML;
    
    // Update summary
    document.getElementById('cartSubtotal').textContent = `₦${subtotal.toLocaleString()}`;
    document.getElementById('cartTotal').textContent = `₦${subtotal.toLocaleString()}`;
    
    cartSummary.style.display = 'block';
    cartActions.style.display = 'flex';
    
    // Re-add event listeners for cart item controls
    this.addCartItemListeners();
}

addCartItemListeners() {
    // Plus buttons in cart modal
    document.querySelectorAll('.cart-item .plus').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = parseInt(e.target.getAttribute('data-id'));
            this.addToCart(itemId);
            this.updateCartModal();
        });
    });
    
    // Minus buttons in cart modal
    document.querySelectorAll('.cart-item .minus').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = parseInt(e.target.getAttribute('data-id'));
            this.removeFromCart(itemId);
            this.updateCartModal();
        });
    });
}

// Also update the updateCart method to update floating cart:

updateCart() {
    const cartCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Update main cart count
    document.querySelector('.cart-count').textContent = cartCount;
    
    // Update floating cart count
    const floatingCartCount = document.getElementById('floatingCartCount');
    if (floatingCartCount) {
        floatingCartCount.textContent = cartCount;
    }
    
    // Update cart indicator
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
        cartCountElement.textContent = cartCount;
    }
    
    // Update menu item quantities
    this.cart.forEach(item => {
        this.updateMenuItemQuantity(item.id);
    });
    
    // Update checkout button state
    this.updateCheckoutButton();
}

// ==================== BEAUTIFUL LIVE KITCHEN SYSTEM ====================

class LiveKitchenSystem {
    constructor() {
        this.kitchenData = {
            preparing: 0,
            cooking: 0,
            ready: 0,
            completed: 0
        };
        this.activityLog = [];
        this.socket = null;
        this.init();
    }

    init() {
        console.log('👨‍🍳 Live Kitchen System Initializing...');
        
        // Initialize WebSocket connection
        this.initSocketConnection();
        
        // Load initial data
        this.loadKitchenData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start auto-update
        this.startAutoUpdate();
        
        console.log('✅ Live Kitchen System Ready');
    }

    initSocketConnection() {
        if (typeof io !== 'undefined') {
            this.socket = io('/kitchen-stream');
            
            this.socket.on('connect', () => {
                console.log('🔌 Connected to kitchen stream');
                this.addActivity('Connected to live kitchen stream', 'system');
            });
            
            this.socket.on('order-updated', (data) => {
                console.log('🔄 Order update:', data);
                this.updateKitchenStats(data.stats);
                this.addOrderActivity(data);
            });
            
            this.socket.on('kitchen-stats', (data) => {
                console.log('📊 Kitchen stats:', data);
                this.updateKitchenStats(data);
            });
            
            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from kitchen stream');
                this.addActivity('Connection lost. Reconnecting...', 'system');
            });
        } else {
            console.log('⚠️ Socket.io not available, using simulated data');
            this.startSimulatedUpdates();
        }
    }

    loadKitchenData() {
        // Try to load from localStorage first
        const savedData = localStorage.getItem('cleanbite_kitchen');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.kitchenData = data.stats || this.kitchenData;
                this.activityLog = data.activities || [];
                this.updateDisplay();
            } catch (error) {
                console.error('Error loading kitchen data:', error);
            }
        }
    }

    saveKitchenData() {
        const data = {
            stats: this.kitchenData,
            activities: this.activityLog.slice(-20), // Keep last 20 activities
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(data));
    }

    updateKitchenStats(stats) {
        const oldStats = {...this.kitchenData};
        this.kitchenData = {...this.kitchenData, ...stats};
        
        // Update display with animation if counts changed
        Object.keys(this.kitchenData).forEach(key => {
            if (this.kitchenData[key] !== oldStats[key]) {
                this.animateCounter(key, this.kitchenData[key]);
            }
        });
        
        this.updateDisplay();
        this.saveKitchenData();
    }

    animateCounter(type, newValue) {
        const element = document.getElementById(`${type}Count`);
        if (!element) return;
        
        // Add animation class
        element.classList.add('count-updated');
        
        // Update value
        element.textContent = newValue;
        
        // Remove animation class after animation completes
        setTimeout(() => {
            element.classList.remove('count-updated');
        }, 500);
        
        // Animate bubble
        const bubble = document.getElementById(`${type}Bubble`);
        if (bubble) {
            bubble.style.animation = 'none';
            setTimeout(() => {
                bubble.style.animation = 'bubbleFloat 8s infinite ease-in-out';
            }, 10);
        }
    }

    addOrderActivity(data) {
        const activity = {
            type: 'order-update',
            orderId: data.orderId,
            fromStatus: data.fromStatus,
            toStatus: data.toStatus,
            customerName: data.customerName,
            timestamp: new Date().toISOString()
        };
        
        this.addActivity(
            `Order ${data.orderId} moved from ${data.fromStatus} to ${data.toStatus}`,
            data.toStatus,
            data.orderId,
            data.customerName
        );
    }

    addActivity(message, type = 'system', orderId = null, customerName = null) {
        const activity = {
            id: Date.now(),
            message,
            type,
            orderId,
            customerName,
            timestamp: new Date().toISOString()
        };
        
        // Add to beginning of array
        this.activityLog.unshift(activity);
        
        // Keep only last 50 activities
        if (this.activityLog.length > 50) {
            this.activityLog = this.activityLog.slice(0, 50);
        }
        
        this.updateActivityFeed();
        this.saveKitchenData();
    }

    updateDisplay() {
        // Update all counters
        Object.entries(this.kitchenData).forEach(([type, count]) => {
            const element = document.getElementById(`${type}Count`);
            if (element) {
                element.textContent = count;
            }
        });
        
        this.updateActivityFeed();
    }

    updateActivityFeed() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        
        if (this.activityLog.length === 0) {
            feed.innerHTML = `
                <div class="empty-activity">
                    <i class="fas fa-mug-hot"></i>
                    <p>Kitchen activities will appear here</p>
                </div>
            `;
            return;
        }
        
        let feedHTML = '';
        
        this.activityLog.slice(0, 10).forEach(activity => {
            const time = new Date(activity.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            feedHTML += `
                <div class="activity-item ${activity.type}" data-id="${activity.id}">
                    <div class="activity-header">
                        <div class="activity-time">${time}</div>
                        ${activity.orderId ? `
                            <div class="order-id">${activity.orderId}</div>
                        ` : ''}
                    </div>
                    <div class="activity-message">${activity.message}</div>
                    ${activity.customerName ? `
                        <div class="activity-details">
                            <i class="fas fa-user"></i>
                            <span>${activity.customerName}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        feed.innerHTML = feedHTML;
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshKitchen')?.addEventListener('click', () => {
            this.refreshKitchenData();
        });
    }

    refreshKitchenData() {
        // Add refreshing animation
        const refreshBtn = document.getElementById('refreshKitchen');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing';
            refreshBtn.disabled = true;
        }
        
        // Simulate API call
        setTimeout(() => {
            // In production, this would fetch from your API
            this.addActivity('Kitchen data refreshed', 'system');
            
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                refreshBtn.disabled = false;
            }
        }, 1000);
    }

    startAutoUpdate() {
        // Auto-update every 30 seconds
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.simulateActivity();
            }
        }, 30000);
    }

    startSimulatedUpdates() {
        // Initialize with some data
        this.kitchenData = {
            preparing: 4,
            cooking: 3,
            ready: 2,
            completed: 8
        };
        
        // Add some initial activities
        this.addActivity('Kitchen stream initialized', 'system');
        this.addActivity('Order CB-827364 started preparation', 'preparing', 'CB-827364', 'Sarah Johnson');
        this.addActivity('Order CB-918273 moved to cooking', 'cooking', 'CB-918273', 'Michael Adebayo');
        this.addActivity('Order CB-645382 is ready for pickup', 'ready', 'CB-645382', 'Chinwe Okoro');
        
        this.updateDisplay();
        
        // Simulate occasional updates
        setInterval(() => {
            this.simulateActivity();
        }, 15000);
    }

    simulateActivity() {
        if (Math.random() > 0.3) return; // 30% chance of activity
        
        const activities = [
            {
                type: 'preparing',
                message: 'New order received and started preparation',
                orderId: `CB-${Math.floor(100000 + Math.random() * 900000)}`,
                customerName: ['Sarah', 'Michael', 'Chinwe', 'David', 'Amina'][Math.floor(Math.random() * 5)]
            },
            {
                type: 'cooking',
                message: 'Order moved to cooking station',
                orderId: `CB-${Math.floor(100000 + Math.random() * 900000)}`,
                customerName: ['Emmanuel', 'Grace', 'Tunde', 'Ngozi', 'Samuel'][Math.floor(Math.random() * 5)]
            },
            {
                type: 'ready',
                message: 'Order completed and ready for pickup',
                orderId: `CB-${Math.floor(100000 + Math.random() * 900000)}`,
                customerName: ['John', 'Mary', 'Peter', 'Ruth', 'James'][Math.floor(Math.random() * 5)]
            },
            {
                type: 'completed',
                message: 'Order picked up by customer',
                orderId: `CB-${Math.floor(100000 + Math.random() * 900000)}`,
                customerName: ['Daniel', 'Joy', 'Philip', 'Deborah', 'Thomas'][Math.floor(Math.random() * 5)]
            }
        ];
        
        const activity = activities[Math.floor(Math.random() * activities.length)];
        
        // Update counts
        if (activity.type === 'preparing') {
            this.kitchenData.preparing++;
        } else if (activity.type === 'cooking') {
            this.kitchenData.preparing = Math.max(0, this.kitchenData.preparing - 1);
            this.kitchenData.cooking++;
        } else if (activity.type === 'ready') {
            this.kitchenData.cooking = Math.max(0, this.kitchenData.cooking - 1);
            this.kitchenData.ready++;
        } else if (activity.type === 'completed') {
            this.kitchenData.ready = Math.max(0, this.kitchenData.ready - 1);
            this.kitchenData.completed++;
        }
        
        // Add activity
        this.addActivity(
            activity.message,
            activity.type,
            activity.orderId,
            activity.customerName
        );
        
        // Update display
        this.updateDisplay();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.liveKitchen = new LiveKitchenSystem();
});

// ==================== MENU CATEGORY FILTER ====================
function setupMenuCategories() {
    console.log('🎯 Setting up menu categories filter...');
    
    const categoryButtons = document.querySelectorAll('.category-btn');
    const menuGrid = document.getElementById('menuGrid');
    
    if (!categoryButtons.length || !menuGrid) {
        console.log('❌ Menu categories elements not found');
        return;
    }
    
    // Function to filter menu items
    function filterMenuByCategory(category) {
        console.log(`Filtering menu by category: ${category}`);
        
        // Update active button
        categoryButtons.forEach(btn => {
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Get all menu items
        const menuItems = document.querySelectorAll('.menu-item');
        let visibleCount = 0;
        
        // Show/hide items based on category
        menuItems.forEach(item => {
            const itemCategory = item.dataset.category;
            
            if (category === 'all' || itemCategory === category) {
                item.style.display = 'block';
                item.style.animation = 'fadeIn 0.5s ease-out';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        console.log(`✅ Showing ${visibleCount} items for ${category} category`);
        
        // If no items found, show message
        if (visibleCount === 0) {
            const noItemsMsg = document.createElement('div');
            noItemsMsg.className = 'no-items-message';
            noItemsMsg.innerHTML = `
                <i class="fas fa-utensils"></i>
                <h4>No items in this category yet</h4>
                <p>Check back soon for new additions!</p>
            `;
            
            // Check if message already exists
            const existingMsg = menuGrid.querySelector('.no-items-message');
            if (!existingMsg) {
                menuGrid.appendChild(noItemsMsg);
            }
        } else {
            // Remove any existing no-items message
            const existingMsg = menuGrid.querySelector('.no-items-message');
            if (existingMsg) {
                existingMsg.remove();
            }
        }
    }
    
    // Add click event to each category button
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.dataset.category;
            console.log(`Category button clicked: ${category}`);
            filterMenuByCategory(category);
            
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });
    
    // Initialize with 'all' category
    filterMenuByCategory('all');
    
    console.log('✅ Menu categories filter setup complete');
}

// ==================== 🔥 FINAL PATCH: ADMIN-ONLY COMPLETION ====================
// ADD THIS RIGHT BEFORE THE init() FUNCTION in customer script

console.log('🚀 APPLYING FINAL PATCH: Admin-Only Order Completion');

// 1. DISABLE ALL AUTO-COMPLETION IN CUSTOMER SCRIPT
window.addPackagingTimeout = function() {
    console.log('🔒 ADMIN-ONLY CONTROL: Auto-completion DISABLED in addPackagingTimeout');
    
    // MONITOR ONLY - NEVER auto-complete
    setInterval(() => {
        try {
            const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
            const now = new Date();
            
            orders.forEach(order => {
                // YOGHURT ORDERS: Never auto-complete
                if (detectYoghurtOrder(order)) {
                    if (order.status === 'ready' && order.timeline?.readyAt) {
                        const readyTime = new Date(order.timeline.readyAt);
                        const hoursReady = (now - readyTime) / (1000 * 60 * 60);
                        
                        if (hoursReady > 1) {
                            console.log(`🧫 YOGHURT ${order.id}: Ready for ${hoursReady.toFixed(1)}h (Admin must complete manually)`);
                        }
                    }
                    return;
                }
                
                // REGULAR ORDERS: Monitor only - NO auto-completion
                if (order.status === 'ready' && order.timeline?.readyAt) {
                    const readyTime = new Date(order.timeline.readyAt);
                    const hoursReady = (now - readyTime) / (1000 * 60 * 60);
                    
                    // Just log - NEVER auto-complete
                    if (hoursReady > 2) {
                        console.log(`📦 ${order.id}: Ready for ${hoursReady.toFixed(1)}h (Admin: Use radio button to complete)`);
                    }
                }
            });
        } catch (error) {
            console.error('Monitor error:', error);
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    console.log('✅ Packaging monitor active (ADMIN-ONLY completion)');
    return true;
};

// 2. DISABLE AUTO-CANCELLATION
window.cleanupOldOrders = function() {
    console.log('🔒 ADMIN-ONLY CONTROL: Auto-cancellation DISABLED in cleanupOldOrders');
    
    setInterval(() => {
        try {
            const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
            const now = new Date();
            
            orders.forEach(order => {
                if (!order.createdAt) return;
                
                const orderTime = new Date(order.createdAt);
                const hoursInSystem = (now - orderTime) / (1000 * 60 * 60);
                
                // MONITOR ONLY - NO AUTO-CANCELLATION
                if (hoursInSystem > 24) {
                    console.log(`📝 ${order.id}: ${hoursInSystem.toFixed(1)}h old, status: ${order.status} (Admin should check)`);
                }
            });
        } catch (error) {
            console.error('Monitor error:', error);
        }
    }, 30 * 60 * 1000); // Check every 30 minutes
    
    console.log('✅ Cleanup monitor active (ADMIN-ONLY cancellation)');
    return true;
};

// 3. DISABLE AUTO-PROGRESSION TO COMPLETED
window.manageOrderLifecycle = function() {
    console.log('🔒 ADMIN-ONLY CONTROL: Auto-progression DISABLED in manageOrderLifecycle');
    
    setInterval(() => {
        try {
            const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
            
            // Just count and log - NO STATUS CHANGES
            const counts = {
                'pending-payment': 0,
                'preparing': 0,
                'cooking': 0,
                'ready': 0,
                'completed': 0,
                'cancelled': 0
            };
            
            orders.forEach(order => {
                if (counts[order.status] !== undefined) {
                    counts[order.status]++;
                }
            });
            
            console.log('📊 Order status counts (Admin controls all):', counts);
            
        } catch (error) {
            console.error('Monitor error:', error);
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    console.log('✅ Lifecycle monitor active (ADMIN controls progression)');
    return true;
};

// 4. OVERRIDE handleStuckOrder to prevent auto-completion
window.handleStuckOrder = function(order, now) {
    // MONITOR ONLY - NEVER CHANGE STATUS AUTOMATICALLY
    if (!order.lastStatusChange) return false;
    
    const statusTime = new Date(order.lastStatusChange);
    const hoursStuck = (now - statusTime) / (1000 * 60 * 60);
    
    // Just log warnings - NO STATUS CHANGES
    const warningThresholds = {
        'preparing': 6,
        'cooking': 30,
        'ready': 72,
        'pending-payment': 48
    };
    
    const maxHours = warningThresholds[order.status];
    
    if (maxHours && hoursStuck > maxHours) {
        console.warn(`🚨 ${order.id}: Stuck in ${order.status} for ${hoursStuck.toFixed(1)}h (Admin attention needed)`);
        return false; // NEVER change status automatically
    }
    
    return false;
};

// 5. OVERRIDE handleYoghurtOrder to prevent auto-completion
window.handleYoghurtOrder = function(order, now) {
    console.log(`🧫 YOGHURT PROTECTION: ${order.id}, status: ${order.status}`);
    
    // ========== CRITICAL: ONCE YOGHURT IS READY, IT STAYS READY ==========
    if (order.status === 'ready') {
        // Just monitor - NEVER auto-complete
        if (order.timeline?.readyAt) {
            const readyTime = new Date(order.timeline.readyAt);
            const hoursReady = (now - readyTime) / (1000 * 60 * 60);
            console.log(`🧊 YOGHURT ${order.id}: READY for ${hoursReady.toFixed(1)}h (Admin must complete manually)`);
        }
        return false; // NO STATUS CHANGES - stays ready forever
    }
    
    // ========== ALLOW PROGRESSION UP TO "READY" ONLY ==========
    let updated = false;
    
    // Ensure yoghurt flag is set
    if (!order.isYoghurt) {
        order.isYoghurt = true;
        updated = true;
    }
    
    // Set fermentation start if not set
    if (!order.fermentationStart) {
        order.fermentationStart = order.createdAt || new Date().toISOString();
        updated = true;
    }
    
    // Calculate fermentation progress
    const fermentStart = new Date(order.fermentationStart);
    const hoursFermenting = (now - fermentStart) / (1000 * 60 * 60);
    const fermentProgress = Math.min(100, (hoursFermenting / (YOGHURT_CONFIG.fermentationTime / 60)) * 100);
    
    order.fermentationProgress = fermentProgress;
    order.currentFermentationHours = hoursFermenting;
    
    // ONLY ALLOW FORWARD PROGRESSION (never backward)
    // Preparing → Cooking (after enough fermentation)
    if ((order.status === 'preparing' || order.status === 'pending-payment') && fermentProgress >= 5) {
        const oldStatus = order.status;
        order.status = 'cooking';
        order.timeline = order.timeline || {};
        order.timeline.cookingStarted = order.timeline.cookingStarted || now.toISOString();
        order.lastStatusChange = now.toISOString();
        updated = true;
        console.log(`🧪 ${order.id}: ${oldStatus} → cooking (${fermentProgress.toFixed(1)}% fermented)`);
    }
    
    // Cooking → Ready (when fermentation complete)
    if (order.status === 'cooking' && fermentProgress >= 95) {
        const oldStatus = order.status;
        order.status = 'ready';
        console.log(`✅ YOGHURT ${order.id}: Ready after ${hoursFermenting.toFixed(1)}h fermentation`);
        order.timeline = order.timeline || {};
        order.timeline.readyAt = order.timeline.readyAt || now.toISOString();
        order.lastStatusChange = now.toISOString();
        order.estimatedReady = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Track packaging start time
        order.yoghurtPackagingStart = now.toISOString();
        order.minimumPackagingTime = YOGHURT_CONFIG.minPackagingTime;
        
        updated = true;
        console.log(`✅ ${order.id}: ${oldStatus} → ready (${fermentProgress.toFixed(1)}% fermented)`);
        
        // Send ready notification (but DON'T auto-complete)
        sendYoghurtReadyNotification(order);
    }
    
    // NEVER PROGRESS TO "completed" automatically for yoghurt
    // Admin must use radio button to mark as completed
    
    return updated;
};

// 6. ADD ADMIN COMPLETION LISTENER
function setupAdminCompletionListener() {
    console.log('👂 Setting up admin completion listener...');
    
    if (typeof BroadcastChannel !== 'undefined') {
        const adminChannel = new BroadcastChannel('admin_to_customer');
        
        adminChannel.onmessage = (event) => {
            console.log('📡 Admin message received:', event.data.type);
            
            if (event.data.type === 'ORDER_COMPLETED_BY_ADMIN') {
                const orderId = event.data.orderId;
                console.log(`✅ ADMIN COMPLETED ORDER: ${orderId}`);
                
                // Lock order immediately
                lockCompletedOrder(orderId);
                
                // Remove from display
                removeOrderFromDisplay(orderId);
                
                // Update kitchen display
                batchUpdateKitchen();
                
                // Show notification
                showNotification(`Order ${orderId} completed by admin`, 'success');
            }
            
            if (event.data.type === 'ORDER_STATUS_UPDATED') {
                console.log(`🔄 Admin updated ${event.data.orderId} to ${event.data.status}`);
                
                // Update local order
                const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
                const orderIndex = orders.findIndex(o => o.id === event.data.orderId);
                
                if (orderIndex !== -1) {
                    orders[orderIndex].status = event.data.status;
                    orders[orderIndex].lastStatusChange = new Date().toISOString();
                    
                    // If admin marked as completed, lock it
                    if (event.data.status === 'completed') {
                        lockCompletedOrder(event.data.orderId);
                    }
                    
                    localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
                    
                    // Update display
                    batchUpdateKitchen();
                    
                    showNotification(`Order ${event.data.orderId} status updated`, 'info');
                }
            }
        };
        
        console.log('✅ Admin completion listener active');
    }
}

function broadcastOrderRemoval(orderId) {
    console.log(`📡 Broadcasting order removal: ${orderId}`);
    
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('cleanbite_orders');
            channel.postMessage({
                type: 'ORDER_PERMANENTLY_REMOVED',
                orderId: orderId,
                timestamp: Date.now(),
                source: 'admin_sync'
            });
            setTimeout(() => channel.close(), 100);
        } catch (error) {
            console.log('BroadcastChannel error:', error);
        }
    }
}

// 7. ENHANCED REMOVE ORDER FUNCTION
function removeOrderFromDisplay(orderId) {
    console.log(`🗑️ ADMIN REQUEST: Removing order ${orderId} from display`);
    
    // 1. Lock permanently
    lockCompletedOrderPermanently(orderId);
    
    // 2. Remove from orders array
    orders = orders.filter(order => order.id !== orderId);
    
    // 3. Remove from kitchen storage
    let kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
    if (kitchenData.orders) {
        const before = kitchenData.orders.length;
        kitchenData.orders = kitchenData.orders.filter(order => order.id !== orderId);
        
        // Update kitchen stats
        kitchenData.stats = kitchenData.stats || {};
        const activeOrders = kitchenData.orders.filter(order => 
            order.status !== 'completed' && !isOrderLocked(order.id)
        );
        
        kitchenData.stats.preparing = activeOrders.filter(o => 
            o.status === 'preparing' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.cooking = activeOrders.filter(o => o.status === 'cooking').length;
        kitchenData.stats.ready = activeOrders.filter(o => o.status === 'ready').length;
        kitchenData.stats.total = activeOrders.length;
        
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
        
        console.log(`✅ Removed from kitchen: ${before} → ${kitchenData.orders.length}`);
    }
    
    // 4. Remove from DOM
    document.querySelectorAll(`[data-order-id="${orderId}"]`).forEach(element => {
        element.style.transition = 'all 0.5s ease';
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 500);
    });
    
    // 5. Broadcast removal
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('cleanbite_orders');
            channel.postMessage({
                type: 'ORDER_PERMANENTLY_REMOVED',
                orderId: orderId,
                timestamp: Date.now(),
                reason: 'admin_completed'
            });
            setTimeout(() => channel.close(), 100);
        } catch (error) {
            console.log('BroadcastChannel error:', error);
        }
    }
    
    // 6. Update kitchen pulse
    batchUpdateKitchen();
    
    console.log(`✅ Order ${orderId} permanently removed from all displays`);
    return true;
}

// 8. UPDATE THE init() FUNCTION
// In the customer script's init() function, add this line:
// setupAdminCompletionListener();

// 9. ADD TO ADMIN SCRIPT: Broadcast when admin completes order
// Add this function to your ADMIN script:
// In admin script - UPDATE this function:
// Instead of creating broadcastOrderRemoval(), ENHANCE the existing:
function broadcastOrderCompletionToCustomer(orderId) {
    console.log(`📡 ADMIN: Broadcasting completion of ${orderId} to ALL displays`);
    
    // Get order details
    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    const order = orders.find(o => o.id === orderId);
    
    if (!order) return;
    
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            // 1. Broadcast to customer display (existing)
            const customerChannel = new BroadcastChannel('admin_to_customer');
            customerChannel.postMessage({
                type: 'ORDER_COMPLETED_BY_ADMIN',
                orderId: orderId,
                timestamp: Date.now(),
                completedBy: currentUser?.username || 'admin'
            });
            
            // 2. Broadcast to kitchen (NEW - covers broadcastOrderRemoval functionality)
            const kitchenChannel = new BroadcastChannel('cleanbite_kitchen');
            kitchenChannel.postMessage({
                type: 'ORDER_COMPLETED_REMOVED',
                orderId: orderId,
                timestamp: Date.now(),
                action: 'admin_completed'
            });
            
            // 3. Broadcast to orders channel (NEW)
            const ordersChannel = new BroadcastChannel('cleanbite_orders');
            ordersChannel.postMessage({
                type: 'ORDER_PERMANENTLY_REMOVED',
                orderId: orderId,
                timestamp: Date.now()
            });
            
            console.log('✅ Broadcast sent to ALL channels');
            
            setTimeout(() => {
                customerChannel.close();
                kitchenChannel.close();
                ordersChannel.close();
            }, 1000);
            
        } catch (error) {
            console.error('Broadcast error:', error);
        }
    }
}

// Instead of removeOrderFromAllDisplays(), CREATE a SIMPLER version:
function removeOrderFromAdminDisplay(orderId) {
    console.log(`🗑️ Removing order ${orderId} from admin display`);
    
    // Simple DOM removal for admin dashboard
    const elements = document.querySelectorAll(`
        [data-order-id="${orderId}"],
        [data-order="${orderId}"],
        .queue-order[data-order="${orderId}"],
        .empire-order-card:contains("${orderId}")
    `);
    
    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(-20px)';
        element.style.height = '0';
        element.style.margin = '0';
        element.style.padding = '0';
        element.style.overflow = 'hidden';
        element.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    });
}

console.log('✅ FINAL PATCH APPLIED: Admin has FULL control over order completion');

// ==================== INITIALIZATION ====================
async function init() {
    console.log('🏛️ CLEANBITE EMPIRE initializing...');
    
    // Request notification permission
    requestNotificationPermission();
    
    // Cache DOM elements
    cacheDOMElements();
    
    // Load menu
    await loadMenu();
    
    // Update cart
    updateCart();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup confirmation modal listeners
    setupConfirmationModalListeners();
    
    // Initialize visual effects
    initVisualEffects();
    initParallax();
    
    // Initialize kitchen pulse (SINGLE INTERVAL ONLY)
    initEnhancedKitchenPulse();

    // 🔥 OVERRIDE: Use the NO AUTO-COMPLETION versions
    addPackagingTimeout();      // Monitor only, no auto-completion
    cleanupOldOrders();         // Monitor only, no auto-cancellation  
    manageOrderLifecycle();     // Monitor only, no auto-progression
    
    // 🔥 CRITICAL: Setup emergency kitchen listener
    setupEmergencyKitchenListener();
    
    // 🔥 CRITICAL: Setup payment verification listener
    setupPaymentVerificationListener();
    
    // 🔥 CRITICAL: Initialize messaging system
    initMessagingSystem();
    
    // Setup order tracking
    setupOrderTracking();
    
    // Check for active order
    checkActiveOrder();

    setupFormValidation();

    // 🔥 NEW: Start rotating taglines
    initTaglineRotator();

    initLiveOrderCount();

    initCustomerMessaging();

    initYoghurtProtection();

    connectWebSocket();

       // Check progression every 5 minutes (MONITOR ONLY)
    setInterval(checkAndUpdateOrderProgress, 5 * 60 * 1000);

    setTimeout(fixExistingYoghurtOrders, 2000);
    setTimeout(addManualRefreshButton, 1000);
    
    cleanupCompletedOrdersOnStartup();

    // 🔥 NEW: Initialize Imperial Registry System
    initializeImperialRegistrySystem();
    
    // 🔥 CRITICAL: Setup admin completion listener
    setupAdminCompletionListener();

    // Force kitchen to match dashboard on startup
    setTimeout(() => {
        console.log('🔄 Forcing kitchen to sync with dashboard...');
        cleanKitchenStorage(); // Clean first
        updateKitchenPulse(); // Then sync
        
        // Remove duplicate interval that was here
    }, 2000);
    
    // 🔥 REMOVED: Duplicate 2-minute interval
    
    console.log('✅ CLEANBITE EMPIRE ready.');
}
// ==================== EMERGENCY PATCH: DISABLE AUTO-COMPLETION ====================
// Add this RIGHT BEFORE the window.onload or DOMContentLoaded event

console.log('🚀 APPLYING FINAL PATCH: Admin-Only Order Completion');

// 1. OVERRIDE addPackagingTimeout - NO AUTO-COMPLETION
window.addPackagingTimeout = function() {
    console.log('🔒 Auto-completion DISABLED in addPackagingTimeout');
    
    // Just monitor, never change status
    setInterval(() => {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const now = new Date();
        
        orders.forEach(order => {
            if (order.status === 'ready' && order.timeline && order.timeline.readyAt) {
                const readyTime = new Date(order.timeline.readyAt);
                const hoursReady = (now - readyTime) / (1000 * 60 * 60);
                
                if (hoursReady > 2) {
                    console.log('📝 Monitor: ' + order.id + ' ready for ' + hoursReady.toFixed(1) + 'h (admin should complete)');
                }
            }
        });
    }, 5 * 60 * 1000);
    
    console.log('✅ Packaging monitor active (NO auto-completion)');
    return true;
};

// 2. OVERRIDE cleanupOldOrders - NO AUTO-CANCELLATION
window.cleanupOldOrders = function() {
    console.log('🔒 Auto-cancellation DISABLED in cleanupOldOrders');
    
    setInterval(() => {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const now = new Date();
        
        orders.forEach(order => {
            if (order.createdAt) {
                const orderTime = new Date(order.createdAt);
                const hoursOld = (now - orderTime) / (1000 * 60 * 60);
                
                if (hoursOld > 48) {
                    console.log('📝 Monitor: ' + order.id + ' is ' + hoursOld.toFixed(1) + 'h old (status: ' + order.status + ')');
                }
            }
        });
    }, 30 * 60 * 1000);
    
    console.log('✅ Cleanup monitor active (NO auto-cancellation)');
    return true;
};

// 3. OVERRIDE manageOrderLifecycle - NO AUTO-PROGRESSION
window.manageOrderLifecycle = function() {
    console.log('🔒 Auto-progression DISABLED in manageOrderLifecycle');
    
    setInterval(() => {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        let counts = { pending: 0, preparing: 0, cooking: 0, ready: 0, completed: 0, cancelled: 0 };
        
        orders.forEach(order => {
            if (counts[order.status] !== undefined) {
                counts[order.status]++;
            }
        });
        
        console.log('📊 Order counts:', counts);
    }, 5 * 60 * 1000);
    
    console.log('✅ Lifecycle monitor active');
    return true;
};

// 4. OVERRIDE handleStuckOrder - MONITOR ONLY
window.handleStuckOrder = function(order, now) {
    if (order && order.lastStatusChange) {
        const statusTime = new Date(order.lastStatusChange);
        const hoursStuck = (now - statusTime) / (1000 * 60 * 60);
        
        if (hoursStuck > 6) {
            console.log('📝 Monitor: ' + order.id + ' stuck in ' + order.status + ' for ' + hoursStuck.toFixed(1) + 'h');
        }
    }
    return false;
};

// 5. OVERRIDE handleYoghurtOrder - PREVENT AUTO-COMPLETION
window.handleYoghurtOrder = function(order, now) {
    console.log(`🧫 YOGHURT PROTECTION: ${order.id}, status: ${order.status}`);
    
    // ========== CRITICAL: ONCE YOGHURT IS READY, IT STAYS READY ==========
    if (order.status === 'ready') {
        // Just monitor - NEVER auto-complete
        if (order.timeline?.readyAt) {
            const readyTime = new Date(order.timeline.readyAt);
            const hoursReady = (now - readyTime) / (1000 * 60 * 60);
            console.log(`🧊 YOGHURT ${order.id}: READY for ${hoursReady.toFixed(1)}h (Admin must complete manually)`);
        }
        return false; // NO STATUS CHANGES - stays ready forever
    }
    
    // ========== ALLOW PROGRESSION UP TO "READY" ONLY ==========
    let updated = false;
    
    // Ensure yoghurt flag is set
    if (!order.isYoghurt) {
        order.isYoghurt = true;
        updated = true;
    }
    
    // Set fermentation start if not set
    if (!order.fermentationStart) {
        order.fermentationStart = order.createdAt || new Date().toISOString();
        updated = true;
    }
    
    // Calculate fermentation progress
    const fermentStart = new Date(order.fermentationStart);
    const hoursFermenting = (now - fermentStart) / (1000 * 60 * 60);
    const fermentProgress = Math.min(100, (hoursFermenting / (1440 / 60)) * 100);
    
    order.fermentationProgress = fermentProgress;
    order.currentFermentationHours = hoursFermenting;
    
    // ONLY ALLOW FORWARD PROGRESSION (never backward)
    // Preparing → Cooking (after enough fermentation)
    if ((order.status === 'preparing' || order.status === 'pending-payment') && fermentProgress >= 5) {
        const oldStatus = order.status;
        order.status = 'cooking';
        order.timeline = order.timeline || {};
        order.timeline.cookingStarted = order.timeline.cookingStarted || now.toISOString();
        order.lastStatusChange = now.toISOString();
        updated = true;
        console.log(`🧪 ${order.id}: ${oldStatus} → cooking (${fermentProgress.toFixed(1)}% fermented)`);
    }
    
    // Cooking → Ready (when fermentation complete)
    if (order.status === 'cooking' && fermentProgress >= 95) {
        const oldStatus = order.status;
        order.status = 'ready';
        order.timeline = order.timeline || {};
        order.timeline.readyAt = order.timeline.readyAt || now.toISOString();
        order.lastStatusChange = now.toISOString();
        order.estimatedReady = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Track packaging start time
        order.yoghurtPackagingStart = now.toISOString();
        order.minimumPackagingTime = 180; // 3 hours
        
        updated = true;
        console.log(`✅ ${order.id}: ${oldStatus} → ready (${fermentProgress.toFixed(1)}% fermented)`);
        
        // Send ready notification (but DON'T auto-complete)
        if (typeof sendYoghurtReadyNotification === 'function') {
            sendYoghurtReadyNotification(order);
        }
    }
    
    // NEVER PROGRESS TO "completed" automatically for yoghurt
    // Admin must use radio button to mark as completed
    
    return updated;
};

console.log('✅ ALL PATCHES APPLIED - System safe from auto-completion');

// ==================== START APPLICATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; }
        }
        .kitchen-message.pulse {
            animation: pulse 1s ease;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    init();
});

// Add to BOTH scripts (customer.js and kitchen script)
function lockCompletedOrderPermanently(orderId) {
    console.log(`🔒 Permanently locking order: ${orderId}`);
    
    // Add to in-memory lock
    if (typeof COMPLETED_ORDERS_LOCK !== 'undefined') {
        COMPLETED_ORDERS_LOCK.add(orderId);
    } else {
        // Fallback for kitchen script
        if (!window.COMPLETED_ORDERS_LOCK) window.COMPLETED_ORDERS_LOCK = new Set();
        window.COMPLETED_ORDERS_LOCK.add(orderId);
    }
    
    // Store in localStorage for persistence
    try {
        const permanentLocks = JSON.parse(localStorage.getItem('empire_permanent_locks') || '{}');
        permanentLocks[orderId] = {
            lockedAt: new Date().toISOString(),
            reason: 'completed',
            permanent: true
        };
        localStorage.setItem('empire_permanent_locks', JSON.stringify(permanentLocks));
        
        // Also add to completed locks
        const completedLocks = JSON.parse(localStorage.getItem('empire_completed_locks') || '{}');
        completedLocks[orderId] = Date.now();
        localStorage.setItem('empire_completed_locks', JSON.stringify(completedLocks));
        
        console.log(`✅ Order ${orderId} permanently locked`);
    } catch (error) {
        console.error('Error in permanent lock:', error);
    }
}

// Add to BOTH scripts
function updateYoghurtDisplay() {
    console.log('🧫 Updating yoghurt display...');
    
    try {
        // Get all orders
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const yoghurtOrders = orders.filter(order => detectYoghurtOrder(order));
        
        // Update yoghurt-specific UI elements if they exist
        const yoghurtCountEl = document.getElementById('yoghurtCount');
        if (yoghurtCountEl) {
            const activeYoghurt = yoghurtOrders.filter(o => 
                o.status !== 'completed' && 
                o.status !== 'cancelled'
            ).length;
            yoghurtCountEl.textContent = activeYoghurt;
            
            // Add animation if count changes
            if (yoghurtCountEl.dataset.lastCount !== activeYoghurt.toString()) {
                yoghurtCountEl.classList.add('counting');
                setTimeout(() => yoghurtCountEl.classList.remove('counting'), 300);
                yoghurtCountEl.dataset.lastCount = activeYoghurt;
            }
        }
        
        // Update fermentation progress indicators
        const now = new Date();
        yoghurtOrders.forEach(order => {
            if (order.status === 'cooking' || order.status === 'ready') {
                const fermentStart = new Date(order.fermentationStart || order.createdAt);
                const hoursFermenting = (now - fermentStart) / (1000 * 60 * 60);
                const progress = Math.min(100, (hoursFermenting / 24) * 100);
                
                // Update progress in localStorage
                order.fermentationProgress = progress;
                order.currentFermentationHours = hoursFermenting;
            }
        });
        
        console.log(`✅ Yoghurt display updated: ${yoghurtOrders.length} yoghurt orders`);
        
    } catch (error) {
        console.error('Yoghurt display update error:', error);
    }
}

// Add to customer.js script


// ==================== ENHANCED FORM VALIDATION ====================
function setupFormValidation() {
    console.log('✅ Setting up enhanced form validation...');
    
    const form = document.getElementById('orderForm');
    if (!form) {
        console.log('⚠️ Order form not found, will retry...');
        setTimeout(setupFormValidation, 1000);
        return;
    }
    
    // Add real-time validation
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
    
    // Add submit validation
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isValid = true;
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });
        
        if (isValid) {
            handleOrderSubmit(e);
        } else {
            // 🔥 IMPROVED FIX: Better visibility check + modal detection
            if (shouldShowFormError(form)) {
                showNotification('Please fix the errors in the form before submitting.', 'error');
                
                // Scroll to first error
                const firstError = form.querySelector('.form-group.error');
                if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                console.log('🔇 Form error suppressed - checkout modal not active');
            }
        }
    });
    
    console.log('✅ Form validation setup complete');
}

// 🔥 ADD THIS NEW FUNCTION:
function shouldShowFormError(form) {
    if (!form) {
        console.log('❌ No form provided');
        return false;
    }
    
    // 1. Check if checkout modal is active
    const checkoutModal = document.getElementById('checkoutModal');
    const isCheckoutActive = checkoutModal && checkoutModal.classList.contains('active');
    
    // 2. Check if form is inside checkout modal
    const isInCheckoutModal = form.closest('#checkoutModal');
    
    // 3. Check if form is visible
    const style = window.getComputedStyle(form);
    const isVisible = style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0';
    
    // 4. Check if any other modals are active (that might trigger false validation)
    const otherActiveModals = document.querySelectorAll('.modal.active:not(#checkoutModal), [class*="details"].active, [class*="Details"].active');
    const hasOtherModal = otherActiveModals.length > 0;
    
    // Debug logging
    console.log('🔍 shouldShowFormError DEBUG:', {
        formId: form.id,
        isCheckoutActive,
        isInCheckoutModal: !!isInCheckoutModal,
        isVisible,
        hasOtherModal,
        otherModalsCount: otherActiveModals.length,
        otherModals: Array.from(otherActiveModals).map(m => m.id || m.className)
    });
    
    // Show error ONLY if: checkout is active AND form is visible AND no other modal is active
    const shouldShow = isCheckoutActive && isInCheckoutModal && isVisible && !hasOtherModal;
    
    console.log('📋 Result:', shouldShow ? '✅ Show error' : '❌ Hide error');
    return shouldShow;
}

// 🔥 ADD THIS HELPER FUNCTION:
function isFormVisible(formElement) {
    if (!formElement) return false;
    
    // Check if form is visible on screen
    const rect = formElement.getBoundingClientRect();
    const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
    
    // Also check display style
    const style = window.getComputedStyle(formElement);
    const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden';
    
    // Check if form is in checkout modal (which should be visible when validating)
    const isInCheckoutModal = formElement.closest('#checkoutModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const isCheckoutModalActive = checkoutModal && checkoutModal.classList.contains('active');
    
    return (isDisplayed && isInViewport) || (isInCheckoutModal && isCheckoutModalActive);
}

function validateField(field) {
    // 🔥 ADD: Skip validation if checkout modal isn't active/visible
    const checkoutModal = document.getElementById('checkoutModal');
    const isCheckoutActive = checkoutModal && 
                           checkoutModal.classList.contains('active') &&
                           window.getComputedStyle(checkoutModal).display !== 'none';
    
    // If checkout modal is NOT active, skip validation (return true)
    if (!isCheckoutActive) {
        console.log('🔇 Skipping field validation - checkout modal not active');
        return true; // Always return valid when checkout is closed
    }
    
    const value = field.value.trim();
    const formGroup = field.closest('.form-group');
    const errorElement = formGroup ? formGroup.querySelector('.form-error') : null;
    
    if (!formGroup) return true;
    
    // Clear previous state
    formGroup.classList.remove('error');
    formGroup.classList.remove('success');
    
    // Check if required field is empty
    if (field.hasAttribute('required') && !value) {
        formGroup.classList.add('error');
        if (errorElement) {
            errorElement.textContent = 'This field is required';
            errorElement.style.display = 'block';
        }
        return false;
    }
    
    // Email validation
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            formGroup.classList.add('error');
            if (errorElement) {
                errorElement.textContent = 'Please enter a valid email address';
                errorElement.style.display = 'block';
            }
            return false;
        }
    }
    
    // Phone validation
    if (field.id === 'customerPhone' && value) {
        const phoneRegex = /^[0-9\s\+\-\(\)]{10,}$/;
        const digitsOnly = value.replace(/\D/g, '');
        
        if (!phoneRegex.test(value) || digitsOnly.length < 10) {
            formGroup.classList.add('error');
            if (errorElement) {
                errorElement.textContent = 'Please enter a valid phone number (at least 10 digits)';
                errorElement.style.display = 'block';
            }
            return false;
        }
    }
    
    // Mark as valid
    if (value && errorElement) {
        errorElement.style.display = 'none';
    }
    
    return true;
}

// ==================== PARALLAX EFFECT ====================
function initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax-bg');
    
    if (!parallaxElements.length) {
        const heroElements = document.querySelectorAll('.hero-section, .kitchen-pulse, .featured-section');
        if (heroElements.length) {
            setupParallaxForElements(heroElements);
        }
        return;
    }
    
    setupParallaxForElements(parallaxElements);
}

// IN YOUR HTML SCRIPT (customer-facing):
function generateOrderId() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `CB-${year}${month}${day}-${hours}${minutes}-${random}`;
}

// IN YOUR HTML SCRIPT (customer-facing):
function broadcastToAdmin(message) {
    console.log('📡 CUSTOMER → ADMIN:', message.order?.id);
    
    // 1. Save to admin's storage
    const adminOrders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    if (message.order) {
        adminOrders.unshift(message.order);
        localStorage.setItem('cleanbite_orders', JSON.stringify(adminOrders));
    }
    
    // 2. Set payment verification flag
    if (message.order?.paymentStatus === 'pending') {
        localStorage.setItem('VERIFICATION_NEEDED_' + message.order.id, 'true');
        
        // Add to verification queue
        const verificationQueue = JSON.parse(localStorage.getItem('verification_queue') || '[]');
        verificationQueue.push(message.order.id);
        localStorage.setItem('verification_queue', JSON.stringify(verificationQueue));
    }
    
    // 3. BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('cleanbite_orders');
            channel.postMessage(message);
            setTimeout(() => channel.close(), 100);
        } catch (error) {
            console.log('Broadcast error:', error);
        }
    }
}

// IN YOUR HTML SCRIPT (customer-facing):
function setupLiveActivities() {
    // Listen for kitchen updates
    if (typeof BroadcastChannel !== 'undefined') {
        const activityChannel = new BroadcastChannel('cleanbite_kitchen');
        
        activityChannel.onmessage = (event) => {
            if (event.data.type === 'ORDER_UPDATE') {
                updateActivityFeed(event.data);
            }
        };
    }
    
    // Check for customer's own order updates
    setInterval(() => {
        const lastOrderId = localStorage.getItem('lastOrderId');
        if (lastOrderId) {
            checkOrderStatus(lastOrderId);
        }
    }, 30000); // Every 30 seconds
}

function updateActivityFeed(data) {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    feed.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-${getStatusIcon(data.status)}"></i>
            </div>
            <div class="activity-content">
                <p><strong>${data.orderId}</strong> ${getStatusMessage(data.status)}</p>
                <span class="activity-time">${time}</span>
            </div>
        </div>
    ` + feed.innerHTML;
    
    // Keep only last 5 activities
    const items = feed.querySelectorAll('.activity-item');
    if (items.length > 5) {
        items[items.length - 1].remove();
    }
}

async function submitOrder(e) {
    e.preventDefault();
    
    console.log('🔔 Starting order submission...');
    
    // Validate first
    if (!validateCheckoutForm()) return;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        // ==================== 1. GENERATE ORDER ID ====================
        const orderId = generateOrderId(); // Returns CB-240111-1430-456 format
        console.log('📋 Generated Order ID:', orderId);
        
        // ==================== 2. GET FORM DATA ====================
        const formData = {
            customerName: document.getElementById('customerName').value.trim(),
            customerPhone: document.getElementById('customerPhone').value.trim(),
            customerEmail: document.getElementById('customerEmail').value.trim(),
            deliveryNotes: document.getElementById('deliveryNotes').value.trim(),
            paymentMethod: document.querySelector('input[name="payment"]:checked').value
        };
        
        // ==================== 3. CALCULATE TIMES ====================
        const now = new Date();
        const isYoghurt = cart.some(item => item.category === 'yoghurt');
        const estimatedMinutes = isYoghurt ? 1440 : 45; // 24h for yoghurt, 45min for regular
        
        // Calculate ready time
        const readyTime = new Date(now.getTime() + estimatedMinutes * 60000);
        const estimatedReady = readyTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // ==================== 4. CREATE ORDER OBJECT ====================
        const order = {
            // IDENTIFICATION
            id: orderId,
            orderId: orderId,
            trackCode: `TRK-${orderId.slice(-6)}`,
            
            // CUSTOMER INFO
            customerName: formData.customerName,
            customerPhone: formData.customerPhone,
            customerEmail: formData.customerEmail,
            
            // ORDER DETAILS
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                category: item.category,
                price: Number(item.price),
                quantity: Number(item.quantity),
                total: Number((item.price * item.quantity).toFixed(2)),
                image: item.image
            })),
            totalAmount: Number(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)),
            
            // PAYMENT INFO
            paymentMethod: formData.paymentMethod,
            paymentStatus: 'pending', // 🔥 CRITICAL: Shows in admin for verification
            transactionReference: null,
            paymentProof: null,
            
            // STATUS
            status: 'pending-payment',
            needsVerification: true, // 🔥 CRITICAL: Admin sees this flag
            
            // TIMELINE
            createdAt: now.toISOString(),
            lastStatusChange: now.toISOString(),
            timeline: {
                orderPlaced: now.toISOString(),
                paymentVerified: null,
                preparationStarted: null,
                cookingStarted: null,
                readyAt: null,
                completedAt: null
            },
            
            // ESTIMATES
            estimatedReady: estimatedReady,
            estimatedMinutes: estimatedMinutes,
            
            // YOGHURT SPECIFIC
            isYoghurt: isYoghurt,
            fermentationStart: isYoghurt ? now.toISOString() : null,
            requiresRefrigeration: isYoghurt,
            shelfLife: isYoghurt ? '7 days refrigerated' : '24 hours',
            
            // DELIVERY
            deliveryNotes: formData.deliveryNotes,
            deliveryAddress: 'Ibadan Pickup',
            pickupLocation: 'Ibadan Pickup',
            
            // VERIFICATION TRACKING
            verifiedAt: null,
            verifiedBy: null,
            
            // ADMIN FLAGS
            adminAlert: {
                needsAttention: true,
                reason: 'payment_pending',
                alertedAt: now.toISOString()
            },
            
            // NOTIFICATIONS
            notifications: {
                orderPlaced: true,
                paymentVerified: false,
                preparingStarted: false,
                readyForPickup: false
            },
            
            // MISC
            notes: '',
            preparedBy: null,
            cancelledAt: null,
            cancellationReason: null,
            completedAt: null
        };
        
        console.log('📝 Order created:', {
            id: order.id,
            customer: order.customerName,
            amount: order.totalAmount,
            items: order.items.length,
            isYoghurt: order.isYoghurt
        });
        
        // ==================== 5. SAVE ORDER TO STORAGE ====================
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        orders.unshift(order); // Add to beginning (newest first)
        localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
        
        console.log('💾 Saved to cleanbite_orders, total orders:', orders.length);
        
        // ==================== 6. BROADCAST TO ADMIN ====================
        broadcastToAdmin({
            type: 'NEW_ORDER_PENDING_VERIFICATION',
            order: order,
            timestamp: Date.now(),
            urgent: true,
            message: `New order ${orderId} needs payment verification`
        });
        
        // ==================== 7. SAVE TO VERIFICATION QUEUE ====================
        const verificationQueue = JSON.parse(localStorage.getItem('verification_queue') || '[]');
        if (!verificationQueue.includes(orderId)) {
            verificationQueue.push(orderId);
            localStorage.setItem('verification_queue', JSON.stringify(verificationQueue));
        }
        
        // Set flag for admin dashboard
        localStorage.setItem('ADMIN_PAYMENT_PENDING', JSON.stringify({
            orderId: orderId,
            customer: order.customerName,
            amount: order.totalAmount,
            timestamp: Date.now(),
            method: order.paymentMethod
        }));
        
        // ==================== 8. GENERATE INVOICE ====================
        generateInvoice(order);
        
        // ==================== 9. SHOW SUCCESS ====================
        showNotification(`✅ Order ${orderId} placed successfully! Awaiting payment verification.`, 'success');
        
        // ==================== 10. CLEAR CART ====================
        cart = [];
        saveCart();
        updateCartDisplay();
        
        // ==================== 11. CLOSE MODAL ====================
        document.getElementById('checkoutModal').classList.remove('active');
        
        // ==================== 12. SHOW CONFIRMATION ====================
        showOrderConfirmation(order);
        
        // ==================== 13. TRIGGER KITCHEN UPDATE ====================
        localStorage.setItem('kitchen_force_update', Date.now().toString());
        
        // ==================== 14. VERIFY STORAGE ====================
        setTimeout(() => {
            verifyOrderStorage(orderId);
        }, 1000);
        
        // ==================== 15. SAVE CUSTOMER FOR MESSAGING ====================
        saveCustomerForMessaging({
            name: order.customerName,
            phone: order.customerPhone,
            email: order.customerEmail
        });
        
        console.log('🎉 Order submission complete!');
        
    } catch (error) {
        console.error('❌ Order submission error:', error);
        showNotification(`❌ Failed to place order: ${error.message}`, 'error');
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ==================== SUPPORTING FUNCTIONS ====================

function validateCheckoutForm() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    
    if (!name || name.length < 2) {
        showNotification('Please enter a valid name (minimum 2 characters)', 'error');
        return false;
    }
    
    if (!phone || phone.length < 10) {
        showNotification('Please enter a valid phone number', 'error');
        return false;
    }
    
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return false;
    }
    
    return true;
}

function generateInvoice(order) {
    const invoice = {
        invoiceId: `INV-${Date.now()}`,
        orderId: order.id,
        customerName: order.customerName,
        items: order.items,
        totalAmount: order.totalAmount,
        bankDetails: {
            bank: 'CARBON MICRO FINANCE BANK',
            accountName: 'Emmanuel Osabolu Okpere',
            accountNumber: '3034457406',
            note: `Transfer with reference: ${order.id}`
        },
        invoiceDate: new Date().toLocaleString('en-NG'),
        estimatedReady: order.estimatedReady,
        isYoghurt: order.isYoghurt,
        specialNotes: order.isYoghurt ? '🧫 24-hour fermented yoghurt' : ''
    };
    
    // Save invoice
    const invoices = JSON.parse(localStorage.getItem('cleanbite_invoices') || '[]');
    invoices.push(invoice);
    localStorage.setItem('cleanbite_invoices', JSON.stringify(invoices));
    
    // Generate invoice HTML
    const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>INVOICE - ${order.id}</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .invoice { max-width: 600px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; }
                .bank-details { background: #f8f9fa; padding: 15px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <h1>🏛️ CLEANBITE EMPIRE</h1>
                    <h3>INVOICE: ${invoice.invoiceId}</h3>
                    <p>Order: ${order.id}</p>
                </div>
                
                <div class="bank-details">
                    <h3>Payment Details</h3>
                    <p><strong>Bank:</strong> ${invoice.bankDetails.bank}</p>
                    <p><strong>Account Name:</strong> ${invoice.bankDetails.accountName}</p>
                    <p><strong>Account Number:</strong> ${invoice.bankDetails.accountNumber}</p>
                    <p><strong>Reference:</strong> ${order.id}</p>
                    <p><strong>Amount:</strong> ₦${order.totalAmount.toLocaleString()}</p>
                    <p><em>${invoice.bankDetails.note}</em></p>
                </div>
                
                <h3>Order Summary</h3>
                <table width="100%" border="1" cellpadding="8" style="border-collapse: collapse;">
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                    ${order.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>₦${item.price.toLocaleString()}</td>
                            <td>₦${(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    <tr style="font-weight: bold; background: #f8f9fa;">
                        <td colspan="3">TOTAL AMOUNT</td>
                        <td>₦${order.totalAmount.toLocaleString()}</td>
                    </tr>
                </table>
                
                ${order.isYoghurt ? `
                    <div style="margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 5px;">
                        <h4>🧫 YOGHURT ORDER NOTE</h4>
                        <p>24-hour fermentation required. Please collect within 3 days of notification.</p>
                        <p><strong>Storage:</strong> Refrigerate at 2-4°C</p>
                        <p><strong>Shelf life:</strong> 7 days refrigerated</p>
                    </div>
                ` : ''}
                
                <div style="margin-top: 30px; text-align: center; color: #666;">
                    <p>Bring this invoice to pickup location</p>
                    <p><strong>Estimated Ready:</strong> ${order.estimatedReady}</p>
                    <p><strong>Pickup:</strong> Ibadan Location</p>
                    <p>Sovereignty starts on your plate.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Open invoice in new tab
    const invoiceWindow = window.open('', '_blank');
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
    
    return invoice;
}

function showOrderConfirmation(order) {
    // Update confirmation modal
    document.getElementById('confirmedOrderId').textContent = order.id;
    document.getElementById('estimatedTime').textContent = order.estimatedReady;
    
    // Update track order link
    const trackLink = document.getElementById('trackOrderBtn');
    if (trackLink) {
        trackLink.href = `track.html?order=${order.id}`;
    }
    
    // Show confirmation modal
    document.getElementById('confirmationModal').classList.add('active');
    
    // Save last order for tracking
    localStorage.setItem('lastOrderId', order.id);
    localStorage.setItem('lastOrderTime', Date.now().toString());
    
    console.log('✅ Confirmation shown for order:', order.id);
}

function verifyOrderStorage(orderId) {
    console.log('🔍 Verifying order storage...');
    
    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    const savedOrder = orders.find(o => o.id === orderId);
    
    if (savedOrder) {
        console.log('✅ VERIFIED: Order stored correctly:', {
            id: savedOrder.id,
            paymentStatus: savedOrder.paymentStatus,
            adminCanSee: savedOrder.paymentStatus === 'pending' ? 'YES (needs verification)' : 'NO'
        });
    } else {
        console.error('❌ VERIFICATION FAILED: Order not found in storage');
    }
}

function saveCustomerForMessaging(customer) {
    try {
        const customers = JSON.parse(localStorage.getItem('cleanbite_customers') || '[]');
        
        const existingIndex = customers.findIndex(c => 
            c.phone === customer.phone || c.email === customer.email
        );
        
        if (existingIndex > -1) {
            customers[existingIndex].lastOrder = new Date().toISOString();
            customers[existingIndex].orderCount += 1;
        } else {
            customers.push({
                ...customer,
                firstOrder: new Date().toISOString(),
                lastOrder: new Date().toISOString(),
                orderCount: 1
            });
        }
        
        localStorage.setItem('cleanbite_customers', JSON.stringify(customers));
        
    } catch (error) {
        console.error('Error saving customer:', error);
    }
}

// ==================== FIXED BROADCAST FUNCTION ====================
function broadcastToAdmin(message) {
    console.log('📡 BROADCASTING:', message.type, message.order?.id);
    
    // 1. SAVE TO ADMIN'S MAIN STORAGE
    const adminOrders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    if (message.order && !adminOrders.some(o => o.id === message.order.id)) {
        adminOrders.unshift(message.order);
        localStorage.setItem('cleanbite_orders', JSON.stringify(adminOrders));
        console.log('✅ Order saved to cleanbite_orders');
    }
    
    // 2. SET PAYMENT VERIFICATION FLAG
    if (message.order && message.order.paymentStatus === 'pending') {
        localStorage.setItem(`VERIFY_${message.order.id}`, JSON.stringify({
            orderId: message.order.id,
            customer: message.order.customerName,
            amount: message.order.totalAmount,
            method: message.order.paymentMethod,
            timestamp: Date.now()
        }));
        
        console.log('✅ Payment verification flag set');
    }
    
    // 3. BROADCAST VIA CHANNEL
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            // To admin dashboard
            const adminChannel = new BroadcastChannel('cleanbite_admin');
            adminChannel.postMessage(message);
            
            // To kitchen display
            const kitchenChannel = new BroadcastChannel('cleanbite_kitchen');
            kitchenChannel.postMessage({
                type: 'ORDER_CREATED',
                orderId: message.order?.id,
                status: 'pending-payment'
            });
            
            console.log('✅ Broadcast sent to admin & kitchen');
            
            setTimeout(() => {
                adminChannel.close();
                kitchenChannel.close();
            }, 500);
            
        } catch (error) {
            console.log('⚠️ BroadcastChannel error:', error);
        }
    }
    
    // 4. TRIGGER STORAGE EVENT (admin dashboard listens)
    localStorage.setItem('new_order_notification', Date.now().toString());
    
    console.log('🎯 Broadcast complete - Admin dashboard should show order');
}

function setupParallaxForElements(elements) {
    if (!elements.length) return;
    
    function updateParallax() {
        const scrollTop = window.pageYOffset;
        elements.forEach(element => {
            const speed = 0.3;
            const yPos = -(scrollTop * speed);
            element.style.transform = `translate3d(0, ${yPos}px, 0)`;
            element.style.willChange = 'transform';
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

// ==================== UPDATE ORDER STATUS ====================
function updateOrderStatus(orderId) {
    console.log(`🔄 Both Kitchen & Admin: Updating status for order: ${orderId}`);
    
    try {
        const orders = unifyAllOrders();
        const order = orders.find(o => o.id === orderId);
        
        if (!order) { 
            showEmpireNotification('Order not found', 'error'); 
            return; 
        }
        
        // Show the same status update modal for both kitchen and admin
        showStatusUpdateModal(order);
        
    } catch (error) {
        console.error('Error updating order status:', error);
        showEmpireNotification('Error updating status', 'error');
    }
}

// ==================== SHOW STATUS UPDATE MODAL ====================
function showStatusUpdateModal(order) {
    console.log("CREATING STATUS MODAL FOR ORDER:", order.id);
    
    // Remove any existing modal first
    const existingModal = document.querySelector('.status-update-modal');
    if (existingModal) existingModal.remove();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'status-update-modal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.85);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    // Status options (used by both kitchen and admin)
    const statusOptions = [
        { value: 'preparing', label: 'Preparing', icon: 'fa-utensils' },
        { value: 'cooking', label: 'Cooking', icon: 'fa-fire' },
        { value: 'ready', label: 'Ready for Pickup', icon: 'fa-check-circle' },
        { value: 'completed', label: 'Completed', icon: 'fa-box' },
        { value: 'cancelled', label: 'Cancelled', icon: 'fa-times-circle' }
    ];
    
    overlay.innerHTML = `
        <div style="background: #1a1a1a; border: 2px solid #444; border-radius: 12px; padding: 30px; max-width: 500px; width: 100%; color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 15px;">
                <h3 style="margin: 0; color: #ffd700;">
                    <i class="fas fa-cog"></i> Update Order Status
                </h3>
                <button onclick="this.closest('.status-update-modal').remove()" 
                        style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">
                    &times;
                </button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="margin-bottom: 10px;"><strong>Order:</strong> ${order.id}</div>
                <div style="margin-bottom: 15px;"><strong>Customer:</strong> ${order.customerName}</div>
                <div style="margin-bottom: 20px; color: #3498db; font-weight: bold;">
                    Current Status: ${getOrderStatusText(order).toUpperCase()}
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <div style="color: #ffd700; margin-bottom: 15px; font-weight: bold;">Select New Status:</div>
                <div style="display: grid; gap: 10px;">
                    ${statusOptions.map(option => `
                        <label style="display: flex; align-items: center; padding: 12px; background: #222; border-radius: 8px; cursor: pointer; border-left: 4px solid ${getStatusColor(option.value)};">
                            <input type="radio" name="orderStatus" value="${option.value}" 
                                   ${order.status === option.value ? 'checked' : ''}
                                   style="margin-right: 12px; transform: scale(1.2);">
                            <i class="fas ${option.icon}" style="margin-right: 10px; color: #ffd700; width: 18px;"></i> 
                            <span style="font-weight: bold;">${option.label}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 15px;">
                <button onclick="this.closest('.status-update-modal').remove()" 
                        style="flex: 1; padding: 12px; background: #666; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                    Cancel
                </button>
                <button onclick="saveOrderStatus('${order.id}'); this.closest('.status-update-modal').remove()" 
                    style="flex: 2; padding: 12px; background: linear-gradient(135deg, #2ecc71, #27ae60); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                    <i class="fas fa-save"></i> Update Status
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ==================== SAVE ORDER STATUS ====================
function saveOrderStatus(orderId) {
    console.log(`💾 Both Kitchen & Admin: Saving status for order: ${orderId}`);
    
    try {
        // Get the selected status from the modal
        const statusRadio = document.querySelector('input[name="orderStatus"]:checked');
        if (!statusRadio) { 
            showEmpireNotification('Please select a status', 'error'); 
            return; 
        }
        
        const newStatus = statusRadio.value;
        console.log(`📝 Selected new status: ${newStatus} for order: ${orderId}`);
        
        // Load orders
        const orders = unifyAllOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) { 
            showEmpireNotification('Order not found', 'error'); 
            return; 
        }
        
        const oldStatus = orders[orderIndex].status;
        
        // Prevent changing from completed to other statuses
        if (oldStatus === 'completed' && newStatus !== 'completed') {
            showEmpireNotification('Cannot change completed order status', 'error');
            return;
        }
        
        // 🚨 If marking as completed, LOCK it permanently
        if (newStatus === 'completed') {
            console.log(`🔒 MARKING ORDER ${orderId} AS COMPLETED - PERMANENT LOCK`);
            
            orders[orderIndex].status = 'completed';
            orders[orderIndex].lastStatusChange = new Date().toISOString();
            orders[orderIndex].timeline = orders[orderIndex].timeline || {};
            orders[orderIndex].timeline.completedAt = new Date().toISOString();
            orders[orderIndex].completedAt = new Date().toISOString();
            orders[orderIndex].completedBy = currentUser?.username || 'kitchen';
            
            // PERMANENTLY LOCK this order
            lockCompletedOrderPermanently(orderId);
            
            // Remove from kitchen display
            removeOrderFromAllKitchenStorages(orderId);
            
            console.log(`✅ Order ${orderId} permanently locked as completed`);
            
        } else {
            // Regular status update
            console.log(`🔄 Updating order ${orderId}: ${oldStatus} → ${newStatus}`);
            
            orders[orderIndex].status = newStatus;
            orders[orderIndex].lastStatusChange = new Date().toISOString();
            orders[orderIndex].timeline = orders[orderIndex].timeline || {};
            
            // Update timeline based on new status
            if (newStatus === 'preparing' && !orders[orderIndex].timeline.preparationStarted) {
                orders[orderIndex].timeline.preparationStarted = new Date().toISOString();
            } 
            else if (newStatus === 'cooking' && !orders[orderIndex].timeline.cookingStarted) {
                orders[orderIndex].timeline.cookingStarted = new Date().toISOString();
            } 
            else if (newStatus === 'ready' && !orders[orderIndex].timeline.readyAt) {
                orders[orderIndex].timeline.readyAt = new Date().toISOString();
                orders[orderIndex].estimatedReady = new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
            
            // For status changes to non-completed states, ensure unlocked
            if (isOrderPermanentlyLocked(orderId)) {
                console.log(`🔓 Unlocking order ${orderId} (status changed from completed to ${newStatus})`);
                unlockOrder(orderId);
            }
        }
        
        // Save updated orders
        localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
        
        // Update shared copies
        const sharedCopy = JSON.parse(localStorage.getItem('SHARED_orders_copy') || '[]');
        const sharedIndex = sharedCopy.findIndex(o => o.id === orderId);
        if (sharedIndex !== -1) {
            sharedCopy[sharedIndex].status = newStatus;
            localStorage.setItem('SHARED_orders_copy', JSON.stringify(sharedCopy));
        }
        
        localStorage.setItem(`shared_order_${orderId}`, JSON.stringify(orders[orderIndex]));
        
        // Update kitchen stats
        updateKitchenStatsFromOrders(orders);
        
        // Broadcast updates to both systems
        broadcastOrderUpdate(orderId);
        broadcastKitchenEmergencyUpdate();
        
        // Log and notify
        AUDIT_LOG.add('STATUS_CHANGED', `Order ${orderId} changed from ${oldStatus} to ${newStatus}`, 'info');
        showEmpireNotification(`Order ${orderId} status updated to ${newStatus}`, 'success');
        
        // Force refresh both kitchen and admin displays
        setTimeout(() => {
            // Refresh admin dashboard if function exists
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
            
            // Refresh kitchen display if function exists
            if (typeof updateKitchenDisplay === 'function') {
                updateKitchenDisplay();
            }
            
            console.log(`🔄 Both systems reloaded after status update`);
        }, 300);
        
    } catch (error) {
        console.error('❌ Error saving order status:', error);
        showEmpireNotification(`Error saving status: ${error.message}`, 'error');
    }
}

// FIXED: connectWebSocket - For real-time updates
function connectWebSocket() {
    // WebSocket implementation for real-time kitchen updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/kitchen`;
    
    try {
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('🔌 WebSocket connected to kitchen');
            showKitchenMessage('Real-time connection established', 'success');
        };
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'ORDER_UPDATE':
                    handleOrderUpdate(data.order);
                    break;
                case 'KITCHEN_STATS':
                    updateKitchenCounters(data.stats);
                    break;
                case 'ACTIVITY_FEED':
                    updateActivityFeed(data.activities);
                    break;
            }
        };
        
        socket.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            showKitchenMessage('Real-time connection lost', 'error');
            
            // Attempt reconnection
            setTimeout(connectWebSocket, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        return socket;
    } catch (error) {
        console.log('⚠️ WebSocket not available, using fallback');
        setupEmergencyKitchenListener();
        return null;
    }
}

// ==================== KITCHEN/ADMIN SYNCHRONIZATION ====================

function initializeEmpireSyncListener() {
    console.log('👂 EMPIRE SYNC LISTENER: Initializing...');
    
    if (typeof BroadcastChannel !== 'undefined') {
        const syncChannel = new BroadcastChannel('empire_sync_channel');
        
        syncChannel.onmessage = (event) => {
            if (event.data.type === 'EMPIRE_ORDER_CREATED') {
                console.log('⚡ REAL-TIME SYNC: New order detected via broadcast');
                setTimeout(() => {
                    if (typeof empireForceDashboardRefresh === 'function') {
                        empireForceDashboardRefresh();
                    }
                }, 100);
            }
        };
        
        window.empireSyncChannel = syncChannel;
    }
    
    window.addEventListener('storage', (event) => {
        if (event.key === 'EMPIRE_SYNC_FLAG') {
            console.log('🔄 STORAGE SYNC: Sync flag detected');
            setTimeout(() => {
                if (typeof empireForceDashboardRefresh === 'function') {
                    empireForceDashboardRefresh();
                }
            }, 100);
        }
    });
    
    console.log('✅ EMPIRE SYNC LISTENER: Active');
}

function broadcastKitchenEmergencyUpdate() {
    console.log("🚨 Both Kitchen & Admin: Emergency kitchen update");
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const activeOrders = orders.filter(order => 
            order.status !== 'completed' && 
            order.status !== 'cancelled' &&
            !isOrderLocked(order.id)
        );
        
        const verifiedOrders = activeOrders.filter(order => order.paymentStatus === 'verified');
        
        const stats = {
            prep: verifiedOrders.filter(o => o.status === 'preparing' || o.status === 'pending-payment').length,
            cook: verifiedOrders.filter(o => o.status === 'cooking').length,
            ready: verifiedOrders.filter(o => o.status === 'ready').length,
            total: verifiedOrders.length,
            verifiedTotal: verifiedOrders.length,
            pendingTotal: orders.filter(o => o.paymentStatus === 'pending').length,
            timestamp: Date.now(),
            lastUpdated: new Date().toISOString()
        };
        
        if (typeof BroadcastChannel !== 'undefined') {
            const channels = ['cleanbite_kitchen', 'cleanbite_orders', 'cleanbite_messaging'];
            channels.forEach(channelName => {
                try {
                    const channel = new BroadcastChannel(channelName);
                    channel.postMessage({
                        type: 'EMERGENCY_KITCHEN_UPDATE',
                        stats: stats,
                        source: 'system',
                        timestamp: Date.now()
                    });
                    setTimeout(() => channel.close(), 500);
                } catch (error) {
                    console.log('Broadcast channel error:', channelName, error);
                }
            });
        }
        
        localStorage.setItem('kitchen_last_verified_update', Date.now().toString());
        console.log(`✅ Emergency update broadcast complete`);
        return stats;
        
    } catch (error) {
        console.error("❌ Emergency broadcast failed:", error);
        return null;
    }
}

function rateLimitedBroadcastKitchenUpdate() {
    // Simple rate limiting to prevent too many updates
    const now = Date.now();
    if (!window.lastKitchenBroadcast) window.lastKitchenBroadcast = 0;
    
    if (now - window.lastKitchenBroadcast > 2000) { // 2 second cooldown
        window.lastKitchenBroadcast = now;
        broadcastKitchenEmergencyUpdate();
    } else {
        console.log('⏸️ Rate limiting kitchen broadcast');
    }
}

function setupEmergencyKitchenListener() {
    console.log('🚨 Setting up emergency kitchen listener...');
    
    if (typeof BroadcastChannel !== 'undefined') {
        const emergencyChannel = new BroadcastChannel('cleanbite_emergency');
        
        emergencyChannel.onmessage = (event) => {
            console.log('🚨 EMERGENCY KITCHEN MESSAGE:', event.data);
            
            if (event.data.type === 'FORCE_SYNC') {
                console.log('🔄 Force syncing all data...');
                broadcastKitchenEmergencyUpdate();
                if (typeof loadDashboardData === 'function') {
                    loadDashboardData();
                }
            }
        };
        
        window.emergencyKitchenChannel = emergencyChannel;
    }
}

function setupPaymentVerificationListener() {
    console.log('💰 Setting up payment verification listener...');
    
    window.addEventListener('storage', (event) => {
        if (event.key === 'payment_verified_event') {
            try {
                const verification = JSON.parse(event.newValue);
                console.log('💰 Payment verification detected:', verification.orderId);
                
                setTimeout(() => {
                    if (typeof loadDashboardData === 'function') {
                        loadDashboardData();
                    }
                }, 300);
            } catch (e) {
                console.error('Error parsing payment verification:', e);
            }
        }
    });
}

// FIXED: setupFrequentUpdateChecker - Missing
function setupFrequentUpdateChecker() {
    console.log('⏱️ Setting up frequent update checker...');
    
    let lastUpdate = Date.now();
    let updateCount = 0;
    
    setInterval(() => {
        const currentTime = Date.now();
        const timeSinceUpdate = currentTime - lastUpdate;
        
        // Check if updates are too frequent (more than 10 in 10 seconds)
        if (updateCount > 10) {
            console.warn('⚠️ High update frequency detected:', updateCount);
            showKitchenMessage('High update frequency - check for loops', 'warning');
        }
        
        // Reset counters
        if (timeSinceUpdate > 10000) { // 10 seconds
            updateCount = 0;
            lastUpdate = currentTime;
        }
        
    }, 5000); // Check every 5 seconds
}

// FIXED: handleAdminOrderVerified - Missing
function handleAdminOrderVerified(orderId) {
    console.log(`👑 Admin verified order: ${orderId}`);
    
    // Update kitchen data
    batchUpdateKitchen();
    
    // Send notification
    showKitchenMessage(`Admin verified order ${orderId}`, 'success');
    
    // Broadcast to other tabs
    if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('cleanbite_admin');
        channel.postMessage({
            type: 'ADMIN_ORDER_VERIFIED',
            orderId: orderId,
            timestamp: Date.now()
        });
    }
}

// FIXED: handleAdminStatusUpdate - Missing
function handleAdminStatusUpdate(orderId, newStatus) {
    console.log(`👑 Admin updated status: ${orderId} → ${newStatus}`);
    
    // Update kitchen display
    updateKitchenDisplay();
    
    // Show notification
    showKitchenMessage(`Status updated: ${orderId} → ${newStatus}`, 'info');
}

// FIXED: handleOrderUpdate - Missing
function handleOrderUpdate(orderData) {
    console.log(`📝 Processing order update: ${orderData.id}`);
    
    // Update kitchen data
    const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
    const orderIndex = kitchenData.orders?.findIndex(o => o.id === orderData.id);
    
    if (orderIndex !== -1 && kitchenData.orders) {
        // Update existing order
        kitchenData.orders[orderIndex] = {
            ...kitchenData.orders[orderIndex],
            ...orderData
        };
    } else {
        // Add new order
        kitchenData.orders = kitchenData.orders || [];
        kitchenData.orders.push(orderData);
    }
    
    // Update stats
    const orders = kitchenData.orders || [];
    kitchenData.stats = {
        preparing: orders.filter(o => o.status === 'preparing').length,
        cooking: orders.filter(o => o.status === 'cooking').length,
        ready: orders.filter(o => o.status === 'ready').length,
        total: orders.length,
        lastUpdate: new Date().toISOString()
    };
    
    localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
    
    // Update display
    updateKitchenDisplay();
}

// ==================== MISSING FUNCTIONS TO ADD ====================

function getMessagingSystem() {
    return window.customerMessagingManager || new CustomerMessagingSystem();
}

function initializeImperialRegistry() {
    console.log('👑 Initializing Imperial Registry...');
    // Default imperial citizens data
    const defaultCitizens = [
        {
            id: 'CUST-IMPERIAL-001',
            name: 'Imperial Founder',
            phone: '+2348000000001',
            email: 'founder@cleanbite.empire',
            firstOrder: new Date().toISOString(),
            lastOrder: new Date().toISOString(),
            orderCount: 10,
            totalSpent: 150000,
            preferences: {
                yoghurt: true,
                mains: true,
                sides: true,
                drinks: true
            },
            messageOptIn: true,
            createdAt: new Date().toISOString(),
            crowned: true
        }
    ];
    
    localStorage.setItem(IMPERIAL_STORAGE_KEY, JSON.stringify(defaultCitizens));
    return defaultCitizens;
}

function addEmpireButtonToAdmin() {
    console.log('👑 Adding empire button to admin...');
    // Implementation for adding empire button
}

function summonFirstCitizen() {
    const firstCitizen = initializeImperialRegistry();
    showImperialNotification('First citizen summoned to the empire!', 'success');
    showImperialCustomerRegistry();
}

function viewImperialDecrees(citizenId) {
    const citizens = JSON.parse(localStorage.getItem('cleanbite_customers') || '[]');
    const citizen = citizens.find(c => c.id === citizenId);
    
    if (citizen) {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const citizenOrders = orders.filter(order => 
            order.customerPhone === citizen.phone || 
            order.customerEmail === citizen.email
        );
        
        alert(`📜 Royal Decrees for ${citizen.name}:\n\n` +
              `Total Decrees: ${citizenOrders.length}\n` +
              `Recent Orders:\n${citizenOrders.slice(0, 5).map(order => 
                `  • ${order.id} - ₦${order.totalAmount} - ${order.status}`
              ).join('\n')}`);
    }
}

function printImperialRegistry() {
    window.print();
}

// Fix in BOTH scripts
function removeOrderFromAllKitchenStorages(orderId) {
    console.log(`🗑️ Removing order ${orderId} from ALL kitchen storages...`);
    
    try {
        // 1. Remove from cleanbite_kitchen
        let kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
        if (kitchenData.orders) {
            const before = kitchenData.orders.length;
            kitchenData.orders = kitchenData.orders.filter(order => order.id !== orderId);
            console.log(`✅ Removed from kitchen: ${before} → ${kitchenData.orders.length}`);
            
            // Update stats
            kitchenData.stats = kitchenData.stats || {};
            kitchenData.stats.preparing = kitchenData.orders.filter(o => 
                o.status === 'preparing' || o.status === 'pending-payment'
            ).length;
            kitchenData.stats.cooking = kitchenData.orders.filter(o => o.status === 'cooking').length;
            kitchenData.stats.ready = kitchenData.orders.filter(o => o.status === 'ready').length;
            kitchenData.stats.total = kitchenData.orders.length;
            
            localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
        }
        
        // 2. Remove from kitchen_orders (backup)
        const kitchenOrders = JSON.parse(localStorage.getItem('kitchen_orders') || '[]');
        if (kitchenOrders.length > 0) {
            const filtered = kitchenOrders.filter(order => order.id !== orderId);
            localStorage.setItem('kitchen_orders', JSON.stringify(filtered));
        }
        
        // 3. Remove from active_orders (another backup)
        const activeOrders = JSON.parse(localStorage.getItem('active_orders') || '[]');
        if (activeOrders.length > 0) {
            const filtered = activeOrders.filter(order => order.id !== orderId);
            localStorage.setItem('active_orders', JSON.stringify(filtered));
        }
        
        // 4. Set removal flag
        localStorage.setItem(`order_removed_${orderId}`, Date.now().toString());
        
        // 5. Update kitchen last update
        updateKitchenLastUpdate();
        
        console.log(`✅ Order ${orderId} removed from all kitchen storages`);
        return true;
        
    } catch (error) {
        console.error('Error removing order from storages:', error);
        return false;
    }
}



function updateKitchenCountersLive(stats) {
    // Update admin dashboard counters
    const prepEl = document.getElementById('prepCountLive');
    const cookEl = document.getElementById('cookCountLive');
    const readyEl = document.getElementById('readyCountLive');
    
    if (prepEl) {
        prepEl.textContent = stats.prep || 0;
        prepEl.classList.add('counting');
        setTimeout(() => prepEl.classList.remove('counting'), 300);
    }
    
    if (cookEl) {
        cookEl.textContent = stats.cook || 0;
        cookEl.classList.add('counting');
        setTimeout(() => cookEl.classList.remove('counting'), 300);
    }
    
    if (readyEl) {
        readyEl.textContent = stats.ready || 0;
        readyEl.classList.add('counting');
        setTimeout(() => readyEl.classList.remove('counting'), 300);
    }
}

function unlockOrder(orderId) {
    console.log(`🔓 Unlocking order: ${orderId}`);
    
    // Remove from in-memory lock
    COMPLETED_ORDERS_LOCK.delete(orderId);
    
    // Remove from localStorage lock
    const completedLocks = JSON.parse(localStorage.getItem('empire_completed_locks') || '{}');
    delete completedLocks[orderId];
    localStorage.setItem('empire_completed_locks', JSON.stringify(completedLocks));
    
    return true;
}

function getStatusIcon(status) {
    const icons = {
        'preparing': 'fa-utensils',
        'cooking': 'fa-fire',
        'ready': 'fa-check-circle',
        'completed': 'fa-box',
        'cancelled': 'fa-times-circle',
        'pending-payment': 'fa-clock'
    };
    return icons[status] || 'fa-question-circle';
}



// ==================== 🔥 CRITICAL: COMPLETED ORDER BLOCKER ====================
// Add this RIGHT AFTER your existing lock functions

function blockCompletedOrderEverywhere(orderId) {
    console.log(`🚫 BLOCKING completed order ${orderId} from ALL systems`);
    
    // 1. Add to permanent lock
    lockCompletedOrderPermanently(orderId);
    
    // 2. Remove from ALL possible storage locations
    removeOrderFromAllKitchenStorages(orderId);
    
    // 3. Set permanent block flag
    const blockedOrders = JSON.parse(localStorage.getItem('empire_blocked_orders') || '{}');
    blockedOrders[orderId] = {
        blockedAt: new Date().toISOString(),
        reason: 'completed',
        permanent: true
    };
    localStorage.setItem('empire_blocked_orders', JSON.stringify(blockedOrders));
    
    // 4. Broadcast removal
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('cleanbite_orders');
            channel.postMessage({
                type: 'ORDER_PERMANENTLY_BLOCKED',
                orderId: orderId,
                timestamp: Date.now(),
                action: 'completed_order_removed'
            });
            setTimeout(() => channel.close(), 100);
        } catch (error) {
            console.log('BroadcastChannel error:', error);
        }
    }
    
    console.log(`✅ Order ${orderId} permanently blocked from all systems`);
    return true;
}

function isOrderBlockedEverywhere(orderId) {
    // Check ALL blocking systems
    const blockedOrders = JSON.parse(localStorage.getItem('empire_blocked_orders') || '{}');
    return COMPLETED_ORDERS_LOCK.has(orderId) || blockedOrders[orderId];
}

// ==================== ORDER LIFECYCLE MANAGEMENT ====================

// ==================== EMERGENCY: FIX ALL YOGHURT ORDER STATUSES ====================
function emergencyFixAllYoghurtStatuses() {
    console.log('🚨 EMERGENCY: Fixing all yoghurt order statuses...');
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const now = new Date();
        let fixed = 0;
        
        orders.forEach(order => {
            const isYoghurt = detectYoghurtOrder(order);
            if (!isYoghurt) return;
            
            const fermentStart = new Date(order.fermentationStart || order.createdAt);
            const hoursFermenting = (now - fermentStart) / (1000 * 60 * 60);
            
            console.log(`🔍 ${order.id}: Current: ${order.status}, Fermenting: ${hoursFermenting.toFixed(1)}h`);
            
            // Determine correct status based on fermentation time
            let correctStatus = order.status;
            
            if (hoursFermenting < 1) {
                correctStatus = 'preparing';
            } else if (hoursFermenting >= 1 && hoursFermenting < 24) {
                correctStatus = 'cooking';
            } else if (hoursFermenting >= 24) {
                correctStatus = 'ready'; // YOGHURT: Ready after 24h, stays ready
            }
            
            // Fix if status is wrong
            if (order.status !== correctStatus) {
                const oldStatus = order.status;
                order.status = correctStatus;
                order.lastStatusChange = now.toISOString();
                
                // Update timeline if needed
                order.timeline = order.timeline || {};
                
                if (correctStatus === 'cooking' && !order.timeline.cookingStarted) {
                    order.timeline.cookingStarted = new Date(fermentStart.getTime() + (60 * 60 * 1000)).toISOString(); // 1h after start
                }
                
                if (correctStatus === 'ready' && !order.timeline.readyAt) {
                    order.timeline.readyAt = new Date(fermentStart.getTime() + (24 * 60 * 60 * 1000)).toISOString(); // 24h after start
                    order.estimatedReady = new Date(order.timeline.readyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                // Remove completedAt if yoghurt was wrongly marked as completed
                if (oldStatus === 'completed' && correctStatus !== 'completed') {
                    delete order.timeline.completedAt;
                    delete order.completedAt;
                }
                
                console.log(`✅ Fixed ${order.id}: ${oldStatus} → ${correctStatus} (${hoursFermenting.toFixed(1)}h fermentation)`);
                fixed++;
            }
        });
        
        if (fixed > 0) {
            localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
            console.log(`✅ Fixed ${fixed} yoghurt order statuses`);
            
            // Update kitchen
            if (typeof broadcastKitchenEmergencyUpdate === 'function') {
                broadcastKitchenEmergencyUpdate();
            }
            
            showNotification(`Fixed ${fixed} yoghurt order statuses`, 'success');
        } else {
            console.log('✅ All yoghurt orders have correct statuses');
        }
        
        return fixed;
        
    } catch (error) {
        console.error('Emergency fix error:', error);
        return 0;
    }
}

// Run the emergency fix
emergencyFixAllYoghurtStatuses();

function removeOrderFromDisplay(orderId) {
    console.log(`🗑️ Removing order ${orderId} from display`);
    
    // 1. Remove from orders array
    orders = orders.filter(order => order.id !== orderId);
    
    // 2. Remove from kitchen data (if exists)
    let kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
    if (kitchenData.orders) {
        kitchenData.orders = kitchenData.orders.filter(order => order.id !== orderId);
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
    }
    
    // 3. Remove from DOM (all elements with data-order-id)
    document.querySelectorAll(`[data-order-id="${orderId}"]`).forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 500);
    });
    
    // 4. Update kitchen stats
    batchUpdateKitchen();
    updateKitchenPulse();
    
    console.log(`✅ Order ${orderId} removed from all displays`);
}

// ==================== CLEAN KITCHEN STORAGE ====================
function cleanKitchenStorage() {
    console.log('🧹 CLEANING KITCHEN STORAGE OF COMPLETED ORDERS...');
    
    try {
        const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
        
        if (!kitchenData.orders) {
            kitchenData.orders = [];
            kitchenData.stats = {
                preparing: 0,
                cooking: 0,
                ready: 0,
                total: 0,
                awaiting_verification: 0,
                pending_payment: 0
            };
            console.log("✅ Kitchen storage initialized");
            localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
            
            // 🔥 UPDATE DISPLAY
            setTimeout(() => {
                updateKitchenPulse();
                updateKitchenDisplay();
            }, 100);
            
            return kitchenData;
        }
        
        const before = kitchenData.orders.length;
        
        // 🔥 CRITICAL FIX: Filter out ONLY completed/locked orders
        const activeOrders = kitchenData.orders.filter(order => {
            // Skip if order is locked (completed)
            if (isOrderLocked(order.id)) {
                console.log(`🚫 Removing locked order from kitchen storage: ${order.id}`);
                return false;
            }
            
            // If order is completed, lock it and skip
            if (order.status === 'completed') {
                console.log(`🔒 Locking and removing completed order from kitchen storage: ${order.id}`);
                lockCompletedOrder(order.id);
                return false;
            }
            
            // ✅ IMPORTANT CHANGE: Keep ALL orders (including unverified)
            // This allows dashboard to see everything
            return true;
        });
        
        // Update kitchen data with filtered orders
        kitchenData.orders = activeOrders;
        
        // Update stats based on filtered orders
        kitchenData.stats = kitchenData.stats || {};
        kitchenData.stats.preparing = activeOrders.filter(o => 
            o.status === 'preparing' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.cooking = activeOrders.filter(o => o.status === 'cooking').length;
        kitchenData.stats.ready = activeOrders.filter(o => o.status === 'ready').length;
        kitchenData.stats.awaiting_verification = activeOrders.filter(o => 
            o.paymentStatus === 'pending' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.pending_payment = activeOrders.filter(o => 
            o.paymentStatus === 'pending'
        ).length;
        kitchenData.stats.total = activeOrders.length;
        
        // Save back to storage
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
        
        const removed = before - activeOrders.length;
        if (removed > 0) {
            console.log(`✅ Removed ${removed} completed orders from kitchen storage`);
        } else {
            console.log("✅ Kitchen storage already clean");
        }
        
        // 🔥 CRITICAL: UPDATE DISPLAY AFTER CLEANING
        setTimeout(() => {
            updateKitchenPulse();
            updateKitchenDisplay();
        }, 100);
        
        return {
            before: before,
            after: activeOrders.length,
            removed: removed,
            stats: kitchenData.stats
        };
        
    } catch (error) {
        console.error('❌ Clean kitchen storage error:', error);
        return null;
    }
}


// ==================== 🔥 NEW FUNCTION: SEND YOGHURT READY NOTIFICATION ====================
function sendYoghurtReadyNotification(order) {
    console.log(`📢 Sending yoghurt ready notification for order ${order.id}`);
    
    if (!order || !order.id) {
        console.error('❌ Invalid order for notification');
        return false;
    }
    
    try {
        const notification = {
            id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            orderId: order.id,
            customerName: order.customerName || 'Customer',
            customerPhone: order.customerPhone || '',
            customerEmail: order.customerEmail || '',
            type: 'yoghurt_ready',
            message: `🧫 YOGHURT READY: Order ${order.id} is ready for pickup!\n\n` +
                    `Your 24-hour fermented yoghurt is now ready.\n` +
                    `📍 Pickup: ${order.deliveryAddress || CONFIG.pickupLocation}\n` +
                    `⏰ Ready since: ${order.timeline?.readyAt ? new Date(order.timeline.readyAt).toLocaleTimeString() : 'Now'}\n\n` +
                    `IMPORTANT: Please collect within 3 days.\n` +
                    `Storage: Refrigerate at 2-4°C\n` +
                    `Shelf life: 7 days`,
            status: 'pending',
            createdAt: new Date().toISOString(),
            sentAt: null,
            channel: 'system',
            priority: 'high',
            urgent: true,
            retryCount: 0
        };
        
        // Save to notifications storage
        const allNotifications = JSON.parse(localStorage.getItem('cleanbite_notifications') || '[]');
        allNotifications.push(notification);
        localStorage.setItem('cleanbite_notifications', JSON.stringify(allNotifications));
        
        // Update order with notification record
        if (!order.notifications) order.notifications = [];
        order.notifications.push({
            id: notification.id,
            type: 'yoghurt_ready',
            sentAt: null,
            status: 'queued'
        });
        
        // Save updated order
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const orderIndex = orders.findIndex(o => o.id === order.id);
        if (orderIndex !== -1) {
            orders[orderIndex] = { ...orders[orderIndex], ...order };
            localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
        }
        
        // Try to send via messaging system
        if (typeof window.customerMessagingManager !== 'undefined') {
            window.customerMessagingManager.sendYoghurtReadyNotification(order);
        }
        
        // Show local notification
        showNotification(`🧫 Yoghurt order ${order.id} is ready!`, 'success');
        
        console.log(`✅ Yoghurt ready notification queued for ${order.id}`);
        
        // Broadcast to kitchen
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('cleanbite_kitchen');
            channel.postMessage({
                type: 'YOGHURT_READY_NOTIFICATION',
                orderId: order.id,
                timestamp: Date.now()
            });
            setTimeout(() => channel.close(), 100);
        }
        
        return notification;
        
    } catch (error) {
        console.error('❌ Failed to send yoghurt notification:', error);
        return false;
    }
}

// Fix in BOTH scripts
function updateProgressBars(stats) {
    console.log('📊 Updating progress bars...');
    
    try {
        // Update efficiency bar
        const efficiencyBarEl = document.getElementById('efficiencyBar');
        const efficiencyPercentEl = document.getElementById('efficiencyPercent');
        
        if (efficiencyBarEl && efficiencyPercentEl) {
            const efficiency = getEfficiencyPercentage(stats);
            efficiencyBarEl.style.width = `${efficiency}%`;
            efficiencyBarEl.style.background = getEfficiencyColor(efficiency);
            efficiencyPercentEl.textContent = `${efficiency}%`;
        }
        
        // Update individual station progress if elements exist
        const stations = ['prep', 'cook', 'pack'];
        stations.forEach(station => {
            const barEl = document.getElementById(`${station}ProgressBar`);
            const percentEl = document.getElementById(`${station}ProgressPercent`);
            
            if (barEl && percentEl) {
                const count = stats[station] || stats[`${station}ing`] || 0;
                const max = 10; // Max expected orders per station
                const percent = Math.min(100, (count / max) * 100);
                
                barEl.style.width = `${percent}%`;
                barEl.style.background = getEfficiencyColor(percent);
                percentEl.textContent = `${Math.round(percent)}%`;
            }
        });
        
        // Update average time
        const avgTimeEl = document.getElementById('avgTime');
        if (avgTimeEl) {
            const avgTime = stats.avgPrepTime || Math.floor(Math.random() * 15) + 30;
            avgTimeEl.textContent = `${avgTime}m`;
        }
        
        console.log('✅ Progress bars updated');
        
    } catch (error) {
        console.error('Progress bars update error:', error);
    }
}

// Helper function that's missing
function getEfficiencyPercentage(stats) {
    const total = stats.total || 0;
    if (total === 0) return 85;
    
    const completed = stats.completed || 0;
    const ready = stats.ready || 0;
    
    // Calculate efficiency based on orders moving through system
    let efficiency = 70; // Base efficiency
    
    if (total > 0) {
        // Higher efficiency if more orders are ready or completed
        const progressRatio = (completed + ready) / total;
        efficiency = 70 + (progressRatio * 25);
        
        // Add random variation
        const randomFactor = Math.random() * 5 - 2.5; // ±2.5%
        efficiency += randomFactor;
    }
    
    return Math.min(98, Math.max(70, Math.round(efficiency)));
}


function validateOrderStatus(order) {
    // Prevent status regression
    const statusFlow = ['pending-payment', 'preparing', 'cooking', 'ready', 'completed'];
    
    if (order._previousStatus && order.status) {
        const oldIndex = statusFlow.indexOf(order._previousStatus);
        const newIndex = statusFlow.indexOf(order.status);
        
        // If order is moving backward (e.g., completed → preparing), block it
        if (newIndex < oldIndex) {
            console.error(`🚨 STATUS REGRESSION BLOCKED: ${order.id} from ${order._previousStatus} to ${order.status}`);
            return false;
        }
    }
    
    // Store previous status for next check
    order._previousStatus = order.status;
    return true;
}

function handleOrderUpdate(updatedOrder) {
    if (!updatedOrder || !updatedOrder.id) {
        console.log('❌ handleOrderUpdate: Invalid order data');
        return;
    }
    
    console.log(`📥 handleOrderUpdate: Processing order ${updatedOrder.id}, status: ${updatedOrder.status}`);
    
    // 🔥 CRITICAL FIX: CHECK FOR BLOCKED/COMPLETED ORDERS FIRST
    if (isOrderBlockedEverywhere(updatedOrder.id)) {
        console.log(`🚫 SKIPPING: Order ${updatedOrder.id} is permanently blocked (completed)`);
        
        // If it's marked as completed in the update, reinforce the block
        if (updatedOrder.status === 'completed') {
            blockCompletedOrderEverywhere(updatedOrder.id);
        }
        
        return; // STOP PROCESSING - never show completed orders
    }
    
    // 🔥 CRITICAL FIX: If order is now completed, block it permanently
    if (updatedOrder.status === 'completed') {
        console.log(`✅ DETECTED COMPLETION: Order ${updatedOrder.id} marked as completed - PERMANENTLY BLOCKING`);
        blockCompletedOrderEverywhere(updatedOrder.id);
        removeOrderFromDisplay(updatedOrder.id);
        return; // STOP - don't add to active orders
    }
    
    // Only process ACTIVE orders (not completed, not blocked)
    const index = orders.findIndex(o => o.id === updatedOrder.id);
    
    if (index !== -1) {
        // Update existing order
        const oldStatus = orders[index].status;
        orders[index] = { ...orders[index], ...updatedOrder };
        console.log(`🔄 Updated order ${updatedOrder.id}: ${oldStatus} → ${updatedOrder.status}`);
    } else {
        // Add new order (only if not completed)
        if (updatedOrder.status !== 'completed' && 
            updatedOrder.paymentStatus !== 'pending') {
            orders.push(updatedOrder);
            console.log(`📥 Added new order ${updatedOrder.id}: ${updatedOrder.status}`);
        } else {
            console.log(`⏸️ Skipping new order ${updatedOrder.id} (pending or completed)`);
            return;
        }
    }
    
    // Update display
    updateOrderDisplay();
    
    // 🔥 ADD THIS LINE: Update timestamp for frequent checker
    updateKitchenLastUpdate();
    
    // Broadcast update (for non-completed orders only)
    if (updatedOrder.status !== 'completed') {
        broadcastOrderUpdate(updatedOrder.id);
    }
}


// ==================== UPDATED: COMPLETE YOGHURT DETECTION ====================


function progressOrderRegular(order, newStatus, now) {
    const oldStatus = order.status;
    
    // 🚨 CRITICAL: NEVER allow auto-progression to "completed"
    if (newStatus === 'completed') {
        console.log(`⛔ AUTO-COMPLETION BLOCKED for ${order.id}`);
        return false;
    }
    
    // Don't progress if already at target status
    if (oldStatus === newStatus) return false;
    
    // Check if this is a regression (e.g., ready → cooking)
    const statusOrder = ['pending-payment', 'preparing', 'cooking', 'ready', 'completed'];
    const oldIndex = statusOrder.indexOf(oldStatus);
    const newIndex = statusOrder.indexOf(newStatus);
    
    if (newIndex < oldIndex) {
        console.log(`⚠️ Status regression blocked: ${oldStatus} → ${newStatus}`);
        return false;
    }
    
    order.status = newStatus;
    order.lastStatusChange = now.toISOString();
    
    // Update timeline
    if (newStatus === 'cooking') {
        order.timeline.cookingStarted = order.timeline.cookingStarted || now.toISOString();
        console.log(`👨‍🍳 Regular order ${order.id}: ${oldStatus} → cooking`);
    } 
    else if (newStatus === 'ready') {
        order.timeline.readyAt = order.timeline.readyAt || now.toISOString();
        order.estimatedReady = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        console.log(`📦 Regular order ${order.id}: ${oldStatus} → ready`);
    }
    else {
        console.log(`⏩ Regular order ${order.id}: ${oldStatus} → ${newStatus}`);
    }
    
    return true;
}

// ==================== INITIALIZE YOGHURT PROTECTION ====================
function initYoghurtProtection() {
    console.log('🧫 Initializing yoghurt protection system...');
    
    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    let updated = false;
    
    orders.forEach(order => {
        if (detectYoghurtOrder(order) && !order.isYoghurt) {
            order.isYoghurt = true;
            order.fermentationStart = order.fermentationStart || order.createdAt;
            order.fermentationDuration = YOGHURT_CONFIG.fermentationTime;
            updated = true;
            
            console.log(`✅ Yoghurt protection enabled for order ${order.id}`);
        }
    });
    
    if (updated) {
        localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
    }
    
    console.log('✅ Yoghurt protection system ready');
}

// ==================== NEW FUNCTION: FIX EXISTING YOGHURT ORDERS ====================
function fixExistingYoghurtOrders() {
    console.log('🔧 Fixing existing yoghurt orders...');
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const now = new Date();
        let fixed = 0;
        
        orders.forEach(order => {
            if (order.paymentStatus !== 'verified') return;
            
            const isYoghurt = detectYoghurtOrder(order);
            if (!isYoghurt) return;
            
            // Ensure timeline exists
            order.timeline = order.timeline || {};
            
            // CRITICAL: Fix orders that were READY but regressed
            if (order.timeline.readyAt && order.status !== 'ready') {
                console.log(`🚨 Fixing regression: ${order.id} was ready at ${new Date(order.timeline.readyAt).toLocaleTimeString()} but is now ${order.status}`);
                order.status = 'ready';
                order.lastStatusChange = now.toISOString();
                fixed++;
            }
            
            // Fix missing preparationStarted for yoghurt
            if (!order.timeline.preparationStarted) {
                const orderTime = new Date(order.createdAt || order.orderDate || now);
                const orderAgeHours = (now - orderTime) / (1000 * 60 * 60);
                
                if (orderAgeHours > 24) {
                    // Order is old - set prep to 24 hours ago
                    order.timeline.preparationStarted = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
                } else {
                    order.timeline.preparationStarted = orderTime.toISOString();
                }
                fixed++;
            }
        });
        
        if (fixed > 0) {
            localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
            console.log(`✅ Fixed ${fixed} yoghurt orders`);
            
            // Update kitchen display
            if (typeof broadcastKitchenEmergencyUpdate === 'function') {
                broadcastKitchenEmergencyUpdate();
            }
        }
        
        return fixed;
        
    } catch (error) {
        console.error('❌ Error fixing yoghurt orders:', error);
        return 0;
    }
}


// 2. ORDER PROGRESSION FUNCTION - Paste this second
function checkAndUpdateOrderProgress() {
    console.log("👀 MONITOR: Checking order status (Admin-only control)");
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        let updated = false;
        
        orders.forEach(order => {
            if (order.status === 'completed' || order.status === 'cancelled') return;
            
            const now = new Date();
            const createdAt = new Date(order.createdAt || order.timestamp || now);
            const timeElapsed = now - createdAt;
            
            // ==================== MONITOR ONLY - NO AUTO-PROGRESSION ====================
            // Monitor order age and log suggestions - ADMIN CONTROLS ALL STATUS CHANGES
            
            if (order.status === 'preparing' && timeElapsed > 20 * 60 * 1000) { // 20 mins
                // MONITOR ONLY - NO STATUS CHANGE
                console.log(`⏰ MONITOR: ${order.id} preparing for ${(timeElapsed/60000).toFixed(0)}min - Admin: consider moving to cooking`);
                
                // Just ensure timeline exists without changing status
                order.timeline = order.timeline || {};
                if (!order.timeline.preparationStarted) {
                    order.timeline.preparationStarted = order.createdAt || new Date().toISOString();
                    updated = true;
                }
            }
            
            else if (order.status === 'cooking' && timeElapsed > 40 * 60 * 1000) { // 40 mins
                // MONITOR ONLY - NO STATUS CHANGE
                console.log(`⏰ MONITOR: ${order.id} cooking for ${(timeElapsed/60000).toFixed(0)}min - Admin: consider moving to ready`);
                
                // Ensure timeline exists
                order.timeline = order.timeline || {};
                if (!order.timeline.cookingStarted) {
                    order.timeline.cookingStarted = order.createdAt || new Date().toISOString();
                    updated = true;
                }
            }
            
            else if (order.status === 'ready' && timeElapsed > 5 * 60 * 60 * 1000) { // 5 hours
                // 🚨 CRITICAL: MONITOR ONLY - NEVER AUTO-COMPLETE!
                const hoursReady = timeElapsed / (60 * 60 * 1000);
                console.log(`⏰ MONITOR: ${order.id} ready for ${hoursReady.toFixed(1)}h - Admin: check customer pickup or mark completed`);
                
                // Ensure timeline exists
                order.timeline = order.timeline || {};
                if (!order.timeline.readyAt) {
                    order.timeline.readyAt = order.createdAt || new Date().toISOString();
                    updated = true;
                }
                
                // 🔥 Set flag for admin dashboard to detect
                if (!order.adminAlert) {
                    order.adminAlert = {
                        type: 'ready_too_long',
                        hoursReady: hoursReady,
                        alertedAt: new Date().toISOString(),
                        actionNeeded: 'Admin should complete manually'
                    };
                    updated = true;
                    console.log(`📢 Admin alert set for ${order.id}: Ready for ${hoursReady.toFixed(1)}h`);
                }
            }
            // ==================== END MONITOR ONLY CODE ====================
        });
        
        if (updated) {
            localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
            console.log("✅ Order monitoring updated (NO status changes)");
        }
        
        return updated;
    } catch (error) {
        console.error("❌ Monitor error:", error);
        return false;
    }
}

// Make sure this exists and works in BOTH scripts
function isOrderLocked(orderId) {
    console.log(`🔒 Checking lock for order: ${orderId}`);
    
    try {
        // Check in-memory lock
        const memoryLock = window.COMPLETED_ORDERS_LOCK || COMPLETED_ORDERS_LOCK;
        if (memoryLock && memoryLock.has(orderId)) {
            console.log(`✅ Order ${orderId} found in memory lock`);
            return true;
        }
        
        // Check permanent locks
        const permanentLocks = JSON.parse(localStorage.getItem('empire_permanent_locks') || '{}');
        if (permanentLocks[orderId]) {
            console.log(`✅ Order ${orderId} found in permanent locks`);
            return true;
        }
        
        // Check completed locks
        const completedLocks = JSON.parse(localStorage.getItem('empire_completed_locks') || '{}');
        if (completedLocks[orderId]) {
            console.log(`✅ Order ${orderId} found in completed locks`);
            return true;
        }
        
        // Check uncollected locks
        const uncollectedLocks = JSON.parse(localStorage.getItem('empire_uncollected_locks') || '{}');
        if (uncollectedLocks[orderId]) {
            console.log(`✅ Order ${orderId} found in uncollected locks`);
            return true;
        }
        
        console.log(`❌ Order ${orderId} is not locked`);
        return false;
        
    } catch (error) {
        console.error('Error checking order lock:', error);
        return false;
    }
}

// Make sure this is complete in BOTH scripts
function updateKitchenCounters() {
    console.log('🔢 Updating kitchen counters...');
    
    try {
        // Get kitchen data
        const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{"orders": [], "stats": {}}');
        const stats = kitchenData.stats || {};
        
        // Update counter elements with animation
        const counters = {
            'prepCount': stats.preparing || stats.prep || 0,
            'cookCount': stats.cooking || stats.cook || 0,
            'packCount': stats.ready || stats.pack || 0,
            'totalOrders': stats.total || 0,
            'completedOrders': stats.completed || stats.completedToday || 0,
            'activityCount': kitchenData.orders?.length || 0
        };
        
        Object.entries(counters).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                const current = parseInt(element.textContent) || 0;
                if (current !== value) {
                    element.textContent = value;
                    
                    // Add animation for changing numbers
                    element.classList.add('counting');
                    setTimeout(() => element.classList.remove('counting'), 300);
                    
                    // Visual feedback for high activity
                    if (value > 0 && (id === 'prepCount' || id === 'cookCount' || id === 'packCount')) {
                        element.parentElement?.classList.add('active');
                    }
                }
            }
        });
        
        // Update efficiency
        updateEfficiencyDisplay(stats);
        
        // Update order bubbles
        updateOrderBubblesDisplay(kitchenData.orders || []);
        
        console.log('✅ Kitchen counters updated');
        
    } catch (error) {
        console.error('❌ Counter update error:', error);
    }
}

function cleanKitchenStorage() {
    console.log('🧹 CLEANING KITCHEN STORAGE OF COMPLETED ORDERS...');
    
    try {
        const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
        
        if (!kitchenData.orders) {
            kitchenData.orders = [];
            kitchenData.stats = {
                preparing: 0,
                cooking: 0,
                ready: 0,
                total: 0,
                awaiting_verification: 0,
                pending_payment: 0
            };
            console.log("✅ Kitchen storage initialized");
            localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
            
            // 🔥 UPDATE DISPLAY
            setTimeout(() => {
                updateKitchenPulse();
                updateKitchenDisplay();
            }, 100);
            
            return kitchenData;
        }
        
        const before = kitchenData.orders.length;
        
        // 🔥 CRITICAL FIX: Filter out ONLY completed/locked orders
        const activeOrders = kitchenData.orders.filter(order => {
            // Skip if order is locked (completed)
            if (isOrderLocked(order.id)) {
                console.log(`🚫 Removing locked order from kitchen storage: ${order.id}`);
                return false;
            }
            
            // If order is completed, lock it and skip
            if (order.status === 'completed') {
                console.log(`🔒 Locking and removing completed order from kitchen storage: ${order.id}`);
                lockCompletedOrder(order.id);
                return false;
            }
            
            // ✅ IMPORTANT CHANGE: Keep ALL orders (including unverified)
            // This allows dashboard to see everything
            return true;
        });
        
        // Update kitchen data with filtered orders
        kitchenData.orders = activeOrders;
        
        // Update stats based on filtered orders
        kitchenData.stats = kitchenData.stats || {};
        kitchenData.stats.preparing = activeOrders.filter(o => 
            o.status === 'preparing' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.cooking = activeOrders.filter(o => o.status === 'cooking').length;
        kitchenData.stats.ready = activeOrders.filter(o => o.status === 'ready').length;
        kitchenData.stats.awaiting_verification = activeOrders.filter(o => 
            o.paymentStatus === 'pending' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.pending_payment = activeOrders.filter(o => 
            o.paymentStatus === 'pending'
        ).length;
        kitchenData.stats.total = activeOrders.length;
        
        // Save back to storage
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
        
        const removed = before - activeOrders.length;
        if (removed > 0) {
            console.log(`✅ Removed ${removed} completed orders from kitchen storage`);
        } else {
            console.log("✅ Kitchen storage already clean");
        }
        
        // 🔥 CRITICAL: UPDATE DISPLAY AFTER CLEANING
        setTimeout(() => {
            updateKitchenPulse();
            updateKitchenDisplay();
        }, 100);
        
        return {
            before: before,
            after: activeOrders.length,
            removed: removed,
            stats: kitchenData.stats
        };
        
    } catch (error) {
        console.error('❌ Clean kitchen storage error:', error);
        return null;
    }
}

// Add this COMPLETE function to your customer script (anywhere after saveOrderEmpireFormat)
function verifyOrderStorage(orderId) {
    console.log('🔍 VERIFYING ORDER STORAGE FOR ADMIN SYNC...');
    
    setTimeout(() => {
        console.log('=== ORDER STORAGE VERIFICATION REPORT ===');
        
        // Check all storage locations
        const storageLocations = [
            { key: 'cleanbite_orders', name: 'Main Orders' },
            { key: 'SHARED_orders_copy', name: 'Shared Backup' },
            { key: 'ADMIN_PENDING_ORDERS', name: 'Admin Pending' },
            { key: 'empire_orders', name: 'Empire Orders' },
            { key: 'kitchen_orders', name: 'Kitchen Orders' }
        ];
        
        let foundIn = [];
        let totalOrders = 0;
        
        storageLocations.forEach(location => {
            try {
                const data = JSON.parse(localStorage.getItem(location.key) || '[]');
                const isArray = Array.isArray(data);
                const hasOrder = isArray ? 
                    data.some(o => o.id === orderId) : 
                    false;
                
                if (hasOrder) {
                    foundIn.push(location.name);
                    totalOrders = isArray ? data.length : 1;
                    
                    const order = isArray ? 
                        data.find(o => o.id === orderId) : 
                        data;
                    
                    console.log(`✅ ${location.name}: FOUND`);
                    console.log(`   ID: ${order?.id}`);
                    console.log(`   Customer: ${order?.customerName}`);
                    console.log(`   Status: ${order?.status}`);
                    console.log(`   Payment: ${order?.paymentStatus}`);
                    console.log(`   Amount: ₦${order?.totalAmount?.toLocaleString()}`);
                    console.log(`   Total in storage: ${totalOrders}`);
                } else {
                    console.log(`❌ ${location.name}: NOT FOUND`);
                }
            } catch (error) {
                console.log(`⚠️ ${location.name}: ERROR - ${error.message}`);
            }
        });
        
        // Check individual storage
        const individualOrder = localStorage.getItem(`shared_order_${orderId}`);
        if (individualOrder) {
            foundIn.push('Individual Storage');
            console.log(`✅ Individual Storage: FOUND (shared_order_${orderId})`);
        } else {
            console.log(`❌ Individual Storage: NOT FOUND`);
        }
        
        // Check flags
        const flags = [
            'ADMIN_NEW_ORDER_FLAG',
            'ADMIN_LATEST_ORDER_ID',
            'ADMIN_ORDER_NEEDS_ATTENTION',
            'new_order_placed',
            'empire_new_order_flag'
        ];
        
        flags.forEach(flag => {
            const value = localStorage.getItem(flag);
            console.log(`🏴 ${flag}: ${value ? `SET (${value})` : 'NOT SET'}`);
        });
        
        // Summary
        console.log('=== VERIFICATION SUMMARY ===');
        console.log(`Order ${orderId} found in ${foundIn.length} locations:`);
        foundIn.forEach(loc => console.log(`  • ${loc}`));
        
        if (foundIn.length === 0) {
            console.error('🚨 CRITICAL: Order not found in ANY storage!');
            alert('Order storage failed! Please contact support.');
        } else if (foundIn.length < 3) {
            console.warn('⚠️ WARNING: Order found in limited storage locations');
        } else {
            console.log('✅ SUCCESS: Order properly stored for admin access');
        }
        
    }, 1500); // Wait 1.5 seconds for async operations
}

function isOrderPermanentlyLocked(orderId) {
    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    const order = orders.find(o => o.id === orderId || o.orderId === orderId);
    
    if (!order) return false;
    
    // Only permanently lock completed orders after 24 hours
    if (order.status === 'completed') {
        const completedTime = new Date(order.timeline?.completedAt || order.createdAt);
        const hoursSinceCompletion = (new Date() - completedTime) / (1000 * 60 * 60);
        return hoursSinceCompletion > 24;
    }
    
    return false;
}

// Add to BOTH scripts if missing
function updateEfficiencyDisplay(stats) {
    const efficiencyBarEl = document.getElementById('efficiencyBar');
    const efficiencyPercentEl = document.getElementById('efficiencyPercent');
    
    if (efficiencyBarEl && efficiencyPercentEl) {
        const efficiency = calculateEfficiency(stats);
        efficiencyBarEl.style.width = `${efficiency}%`;
        efficiencyBarEl.style.background = getEfficiencyColor(efficiency);
        efficiencyPercentEl.textContent = `${efficiency}%`;
    }
}

// Add to BOTH scripts
function calculateEfficiency(stats) {
    const total = stats.total || 0;
    const completed = stats.completed || 0;
    
    if (total === 0) return 85;
    
    const baseEfficiency = 70 + (completed / total) * 25;
    const randomFactor = Math.random() * 5 - 2.5; // ±2.5%
    return Math.min(98, Math.max(70, Math.round(baseEfficiency + randomFactor)));
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
        console.log('📋 Menu loaded:', state.menu.length, 'items');
        renderMenu();
        preloadMenuImages();
    } catch (error) {
        console.error('Failed to load menu:', error);
        state.menu = getLocalMenuData();
        renderMenu();
        preloadMenuImages();
    }
}

function preloadMenuImages() {
    console.log('🖼️ Preloading menu images...');
    state.menu.forEach(item => {
        const img = new Image();
        const imagePath = `images/${item.image}`;
        img.src = imagePath;
        
        img.onerror = () => {
            item.fallbackImage = `https://via.placeholder.com/400x300/FFE5B4/333333?text=${encodeURIComponent(item.name)}`;
        };
    });
}

function getLocalMenuData() {
    return [
        { 
            id: 1, 
            name: "Cocoa And Moringa", 
            category: "yoghurt", 
            price: 10000, 
            description: "System reboot fuel.",
            image: "IMG_9483.jpg"
        },
        // { 
        //     id: 2, 
        //     name: "Jollof Cauliflower", 
        //     category: "mains", 
        //     price: 2800, 
        //     description: "Cauliflower rice, smoked tomato sauce.",
        //     image: "jollof-cauliflower.jpg"
        // },
        // { 
        //     id: 3, 
        //     name: "Plantain Flour Power Sphere", 
        //     category: "sides", 
        //     price: 1800, 
        //     description: "Zero-sugar ancestral intelligence.",
        //     image: "plantain-power-sphere.jpg"
        // },
        { 
            id: 4, 
            name: "Dates And Tahini", 
            category: "yoghurt", 
            price: 10000, 
            description: "Dairy-free, culturized.",
            image: "IMG_9481.jpg"
        },
        // { 
        //     id: 5, 
        //     name: "Pineapple-Scent Leaf Detox Sparkler", 
        //     category: "drinks", 
        //     price: 1500, 
        //     description: "Naturally alive.",
        //     image: "pineapple-detox-sparkler.jpg"
        // },
        { 
            id: 6, 
            name: "Vanilla And Cinammon", 
            category: "yoghurt", 
            price: 9200, 
            description: "The Warden.",
            image: "IMG_9482.jpg"
        },
        { 
            id: 7, 
            name: "Strawberry And Hibiscus", 
            category: "yoghurt", 
            price: 11500, 
            description: "The Sentinel.",
            image: "IMG_zobo.jpeg"
        }
    ];
}

function renderMenu() {
    if (!elements.menuGrid || !state.menu.length) return;
    
    console.log('🔍 DEBUG: All menu items:');
    state.menu.forEach(item => {
        console.log(`  ${item.id}: ${item.name} - category: "${item.category}"`);
    });

    const menuHTML = state.menu.map(item => {
        const imagePath = `images/${item.image}`;
        const fallbackImage = item.fallbackImage || 
            `https://via.placeholder.com/400x300/FFE5B4/333333?text=${encodeURIComponent(item.name)}`;
        const categoryIcon = getCategoryIcon(item.category);
        
        return `
            <div class="menu-item" data-category="${item.category}" data-id="${item.id}">
                <div class="menu-img-container">
                    <img src="${imagePath}" 
                         alt="${item.name}" 
                         class="menu-img"
                         loading="lazy"
                         onerror="this.onerror=null; this.src='${fallbackImage}'; this.style.objectFit='cover';">
                    <div class="menu-category-badge">
                        <i class="${categoryIcon}"></i> ${item.category}
                    </div>
                </div>
                <div class="menu-details">
                    <h4>
                        ${item.name}
                        <span class="item-prep-time">
                            <i class="fas fa-clock"></i> ${CONFIG.cookingTimes[item.category] || 1140}min
                        </span>
                    </h4>
                    <p class="menu-desc">${item.description}</p>
                    <div class="menu-meta">
                        <div class="menu-price">₦${item.price.toLocaleString()}</div>
                        <button class="add-to-cart" data-id="${item.id}">
                            <i class="fas fa-cart-plus"></i> Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    elements.menuGrid.innerHTML = menuHTML;
    
      // Add category filtering AFTER menu is rendered
    setTimeout(() => {
        setupMenuCategories();
    }, 100);
    
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = parseInt(e.currentTarget.dataset.id);
            addToCart(itemId, e.currentTarget);
        });
    });
    
    console.log('✅ Menu rendered with', state.menu.length, 'items');
}

function getCategoryIcon(category) {
    const icons = {
        'yoghurt': 'fas fa-glass-whiskey',
        'mains': 'fas fa-utensil-spoon',
        'sides': 'fas fa-drumstick-bite',
        'drinks': 'fas fa-glass-cheers'
    };
    return icons[category] || 'fas fa-utensils';
}

// ==================== CART SYSTEM ====================
function addToCart(itemId, button = null) {
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
    
    if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Added!';
        button.classList.add('added');
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('added');
        }, 1500);
    }
    
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
    
    attachCartEventListeners();
}

function attachCartEventListeners() {
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

function setupAdminBroadcastListener() {
    if (typeof BroadcastChannel !== 'undefined') {
        const adminChannel = new BroadcastChannel('admin_to_kitchen');
        
        adminChannel.onmessage = (event) => {
            if (event.data.type === 'ORDER_COMPLETED') {
                console.log(`📢 Admin marked order ${event.data.orderId} as completed`);
                lockCompletedOrder(event.data.orderId);
                removeOrderFromDisplay(event.data.orderId);
            }
            
            if (event.data.type === 'FORCE_KITCHEN_REFRESH') {
                console.log('🔄 Admin forced kitchen refresh');
                setTimeout(updateKitchenDisplay, 100);
            }
        };
    }
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

// ==================== CHECKOUT SYSTEM ====================
function openCheckout() {
    if (state.cart.length === 0) {
        showNotification('🛒 Your cart is empty', 'error');
        return;
    }
    
    // Add subtle animation
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
    }
    
    const total = calculateTotal();
    const cookingTime = calculateCookingTime();
    const modalSummary = document.getElementById('modalOrderSummary');
    
    if (!modalSummary) return;
    
    // Calculate item details
    let itemsHTML = '';
    let categories = new Set();
    
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHTML += `
            <div class="order-item-summary">
                <div class="item-row">
                    <span class="item-name">
                        <span class="item-quantity">${item.quantity}x</span>
                        ${item.name}
                        <span class="item-category">${item.category}</span>
                    </span>
                    <span class="item-price">₦${itemTotal.toLocaleString()}</span>
                </div>
            </div>
        `;
        categories.add(item.category);
    });
    
    // Calculate time based on categories
    let estimatedTime = '30-45 minutes';
    if (categories.has('yoghurt')) {
        estimatedTime = '24 hours';
    } else if (categories.has('mains')) {
        estimatedTime = '40-50 minutes';
    }
    
    const summaryHTML = `
        <div class="checkout-summary-header">
            <i class="fas fa-shopping-bag"></i>
            <h4>Order Summary</h4>
            <span class="items-count">${state.cart.length} ${state.cart.length === 1 ? 'item' : 'items'}</span>
        </div>
        
        <div class="checkout-items-list">
            ${itemsHTML}
        </div>
        
        <div class="checkout-summary-footer">
            <div class="summary-row subtotal">
                <span>Subtotal</span>
                <span>₦${total.toLocaleString()}</span>
            </div>
            <div class="summary-row delivery">
                <span>Delivery Fee</span>
                <span>₦0</span>
            </div>
            <div class="summary-row total">
                <span>Total Amount</span>
                <span class="total-amount">₦${total.toLocaleString()}</span>
            </div>
            
            <div class="order-timeline">
                <div class="timeline-item">
                    <i class="fas fa-clock"></i>
                    <div class="timeline-content">
                        <span class="timeline-label">Estimated preparation</span>
                        <span class="timeline-value">${estimatedTime}</span>
                    </div>
                </div>
                <div class="timeline-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <div class="timeline-content">
                        <span class="timeline-label">Pickup location</span>
                        <span class="timeline-value">${CONFIG.pickupLocation}</span>
                    </div>
                </div>
            </div>
            
            <div class="payment-notice">
                <i class="fas fa-info-circle"></i>
                <p>You'll receive an invoice with payment details after submitting your order. Payment must be verified before preparation begins.</p>
            </div>
        </div>
    `;
    
    modalSummary.innerHTML = summaryHTML;
    
    // Pre-fill customer info if available
    const savedCustomer = getSavedCustomerInfo();
    if (savedCustomer) {
        document.getElementById('customerName').value = savedCustomer.name || '';
        document.getElementById('customerPhone').value = savedCustomer.phone || '';
        document.getElementById('customerEmail').value = savedCustomer.email || '';
    }
    
    // Reset any previous validation errors
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
    });
    
    // Show checkout modal with animation
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Add entrance animation
        setTimeout(() => {
            checkoutModal.classList.add('loaded');
        }, 10);
        
        // Auto-focus first field
        setTimeout(() => {
            const nameField = document.getElementById('customerName');
            if (nameField) {
                nameField.focus();
            }
        }, 100);
    }
    
    // Update cart count badge
    updateCartCount();
}

// Initialize form validation when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(setupFormValidation, 1000);
});

// ==================== ORDER SUBMISSION ====================
// ==================== ORDER SUBMISSION ====================
async function handleOrderSubmit(e) {
    e.preventDefault();
    console.log('🔄 EMPIRE Order submission started');
    
    // Get form values with better validation
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const deliveryNotes = document.getElementById('deliveryNotes').value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    // Enhanced validation
    if (!customerName || !customerEmail || !customerPhone) {
        showNotification('👑 Please fill all required fields', 'error');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
        showNotification('📧 Please enter a valid email address', 'error');
        return;
    }
    
    // Phone validation (basic)
    if (customerPhone.length < 10) {
        showNotification('📱 Please enter a valid phone number', 'error');
        return;
    }
    
    const cart = JSON.parse(localStorage.getItem('cleanbite_cart') || '[]');
    if (cart.length === 0) {
        showNotification('🛒 Your cart is empty', 'error');
        return;
    }
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const submitBtn = e.target.querySelector('#submitOrder');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Order...';
    submitBtn.disabled = true;
    
    try {
        const orderData = {
            customerName: customerName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            deliveryNotes: deliveryNotes,
            paymentMethod: paymentMethod,
            items: cart,
            totalAmount: totalAmount
        };
        
        console.log('📝 Saving EMPIRE order for:', customerName);
        
        const orderId = saveOrderEmpireFormat(orderData);
            if (orderId) {
        // Verify storage after saving
        setTimeout(() => {
            verifyOrderStorage(orderId);
        }, 2000);
    }
        
        if (!orderId) {
            throw new Error('Failed to save order in EMPIRE system');
        }
        
        console.log('✅ EMPIRE Order saved with ID:', orderId);
        
        // ============ 🔥 FIXED SECTION - CORRECT COOKING TIME ============
        // Calculate ACTUAL cooking time based on items
        const actualCookingTime = calculateCookingTime(); // Uses CONFIG.cookingTimes
        const formattedReadyTime = formatCookingTime(actualCookingTime);
        
        // Generate invoice with CORRECT time
        generateProperInvoice({
            orderId: orderId,
            customerName: customerName,
            items: cart,
            totalAmount: totalAmount,
            paymentMethod: paymentMethod,
            estimatedReady: calculateReadyTime(actualCookingTime) // Use actual time, not hardcoded
        });
        
        // Show enhanced confirmation with CORRECT time
        showOrderConfirmation(orderId, formattedReadyTime); // Use formatted time
        // ============ 🔥 END FIX ============
        
        // Clear cart
        localStorage.removeItem('cleanbite_cart');
        updateCart();
        
        // Save customer for messaging
        saveCustomerForMessaging({
            name: customerName,
            email: customerEmail,
            phone: customerPhone
        });
        
        // Enhanced success notification
        showNotification(`👑 Order ${orderId} placed successfully! Awaiting payment verification.`, 'success');
        
        // Reset form
        e.target.reset();
        
        // Test empire connection
        testEmpireConnection(orderId);
        
    } catch (error) {
        console.error('❌ EMPIRE Order error:', error);
        showNotification(`👑 Order failed: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }

            // 🔥 SHOW PAYMENT INSTRUCTIONS IF BANK TRANSFER
        if (paymentMethod === 'transfer') {
            // Show detailed payment instructions
            alert(`✅ Order ${orderId} placed successfully!\n\n💰 PAYMENT REQUIRED:\n\nPlease transfer ₦${totalAmount.toLocaleString()} to:\n\nBank: CARBON MICRO FINANCE BANK\nAccount: Emmanuel Osabolu Okpere\nAccount: 3034457406\n\n📝 Reference: "${orderId}"\n\n🕐 Preparation will start once payment is verified.\n\n📲 After payment:\n1. Take screenshot of transfer\n2. Send to WhatsApp: +2348123456789\n3. Admin will verify and start preparation`);
        } else {
            // Cash payment
            alert(`✅ Order ${orderId} placed successfully!\n\n💰 Payment: Cash on pickup\n🕐 Preparation will start immediately\n📲 You'll receive updates on your order status`);
        }
}

// ==================== EMPIRE ORDER SYNC ENGINE ====================
function empireOrderSyncEngine(order) {
    console.log('⚡ EMPIRE SYNC ENGINE: Force-syncing order', order.id);
    
    // 1. PRIMARY STORAGE (Admin's main view)
    const primaryOrders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    const existingIndex = primaryOrders.findIndex(o => o.id === order.id);
    
    if (existingIndex === -1) {
        primaryOrders.unshift(order); // Add to beginning for newest first
        localStorage.setItem('cleanbite_orders', JSON.stringify(primaryOrders));
        console.log('✅ Added to primary storage');
    }
    
    // 2. SYNC FLAG (For admin immediate detection)
    localStorage.setItem('EMPIRE_SYNC_FLAG', JSON.stringify({
        orderId: order.id,
        customer: order.customerName,
        amount: order.totalAmount,
        timestamp: Date.now(),
        action: 'NEW_ORDER'
    }));
    
    // 3. BROADCAST (For real-time admin updates)
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const syncChannel = new BroadcastChannel('empire_sync_channel');
            syncChannel.postMessage({
                type: 'EMPIRE_ORDER_CREATED',
                order: order,
                timestamp: Date.now(),
                source: 'customer'
            });
            setTimeout(() => syncChannel.close(), 100);
            console.log('📡 Broadcast sent to admin channel');
        } catch (error) {
            console.log('⚠️ BroadcastChannel not supported');
        }
    }
    
    // 4. STORAGE EVENT (Fallback sync)
    const event = new Event('empireStorageChange');
    window.dispatchEvent(event);
    
    // 5. VERIFICATION (Confirm save)
    setTimeout(() => {
        const saved = localStorage.getItem('cleanbite_orders');
        const savedOrders = saved ? JSON.parse(saved) : [];
        const isSaved = savedOrders.some(o => o.id === order.id);
        
        console.log(isSaved ? 
            '🎯 SYNC VERIFIED: Order visible to admin' : 
            '⚠️ SYNC WARNING: Order may not be visible');
    }, 100);
    
    return true;
}


// ==================== COMPLETE EMPIRE ORDER SAVER ====================
function saveOrderEmpireFormat(orderData) {
    console.log('🏛️ Saving order in EMPIRE format...');
    
    try {
        const orderId = generateOrderId();
        
        // 🔥 YOGHURT DETECTION
        const isYoghurt = orderData.items?.some(item => item.category === 'yoghurt');
        
        // 🔥 USE YOGHURT TIME FOR YOGHURT ORDERS
        const estimatedMinutes = isYoghurt ? YOGHURT_CONFIG.fermentationTime : calculateCookingTime();
        const estimatedReady = calculateReadyTime(estimatedMinutes);
        
        const empireOrder = {
            id: orderId,
            orderId: orderId,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerEmail: orderData.customerEmail,
            items: orderData.items.map(item => ({
                id: item.id || 0,
                name: item.name || 'Item',
                quantity: item.quantity || 1,
                price: item.price || 0,
                category: item.category || 'mains',
                total: (item.price || 0) * (item.quantity || 1)
            })),
            totalAmount: orderData.totalAmount,
            paymentMethod: orderData.paymentMethod || 'transfer',
            paymentStatus: 'pending',
            status: 'pending-payment',
            createdAt: new Date().toISOString(),
            lastStatusChange: new Date().toISOString(),
            timeline: {
                orderPlaced: new Date().toISOString(),
                paymentVerified: null,
                preparationStarted: null,
                cookingStarted: null,
                readyAt: null,
                completedAt: null
            },
            estimatedReady: estimatedReady,
            estimatedMinutes: estimatedMinutes,
            
            // 🔥 ADD YOGHURT FIELDS
            isYoghurt: isYoghurt,
            fermentationStart: isYoghurt ? new Date().toISOString() : null,
            fermentationDuration: isYoghurt ? YOGHURT_CONFIG.fermentationTime : null,
            fermentationProgress: isYoghurt ? 0 : null,
            requiresRefrigeration: isYoghurt,
            shelfLife: isYoghurt ? '7 days refrigerated' : '24 hours',
            yogurtNotes: isYoghurt ? [{
                timestamp: new Date().toISOString(),
                note: 'Yoghurt order created - 24h fermentation started'
            }] : null,
            
            deliveryNotes: orderData.deliveryNotes || '',
            deliveryAddress: CONFIG.pickupLocation,
            transactionReference: null,
            paymentProof: null,
            verifiedAt: null,
            verifiedBy: null,
            cancelledAt: null,
            cancellationReason: null,
            completedAt: null,
            preparedBy: null,
            notes: '',
            notifications: {
                orderPlaced: true,
                paymentVerified: false,
                orderReady: false,
                orderCompleted: false
            }
        };
        
        // ==================== SIMPLIFIED SAVE LOGIC ====================
        // 1. Save to PRIMARY location (where admin looks)
        let orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        orders.push(empireOrder);
        localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
        
        // 2. Set flag for admin to detect immediately
        localStorage.setItem('ADMIN_NEW_ORDER_FLAG', Date.now().toString());
        localStorage.setItem('LAST_NEW_ORDER_ID', orderId);
        
        // 3. Optional: Keep ONE backup (only if needed)
        const backupOrders = JSON.parse(localStorage.getItem('SHARED_orders_copy') || '[]');
        backupOrders.push(empireOrder);
        localStorage.setItem('SHARED_orders_copy', JSON.stringify(backupOrders));
        
        // ==================== 🔥 CRITICAL: BROADCAST TO ADMIN ====================
        // Broadcast to admin immediately
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const adminChannel = new BroadcastChannel('cleanbite_orders');
                adminChannel.postMessage({
                    type: 'CUSTOMER_ORDER_CREATED',
                    order: empireOrder,
                    timestamp: Date.now(),
                    source: 'customer_frontend'
                });
                console.log('📡 Broadcast sent to admin channel');
                setTimeout(() => adminChannel.close(), 100);
            } catch (error) {
                console.log('⚠️ BroadcastChannel not available:', error);
            }
        }

                // ==================== 🔥 NEW: TRIGGER PAYMENT NOTIFICATION ====================
        // If bank transfer, notify admin that payment needs verification
        if (empireOrder.paymentMethod === 'transfer') {
            console.log('💰 Bank transfer payment - triggering admin notification');
            triggerAdminPaymentNotification(empireOrder);
            
            // Also set specific payment flag
            localStorage.setItem('ADMIN_PAYMENT_VERIFICATION_NEEDED', JSON.stringify({
                orderId: orderId,
                amount: empireOrder.totalAmount,
                customer: empireOrder.customerName,
                timestamp: Date.now()
            }));
        }
        
        // Also trigger storage event (fallback)
        localStorage.setItem('customer_new_order_placed', Date.now().toString());
        
        // ==================== BROADCAST TO KITCHEN ====================
        // Force kitchen to update
        localStorage.setItem('kitchen_force_update', Date.now().toString());
        
        console.log('✅ Order saved in EMPIRE format:', {
            id: empireOrder.id,
            customer: empireOrder.customerName,
            amount: empireOrder.totalAmount,
            paymentStatus: empireOrder.paymentStatus,
            isYoghurt: empireOrder.isYoghurt,
            storedIn: 'cleanbite_orders + SHARED_orders_copy'
        });
        
        // Verify order was saved
        setTimeout(() => {
            verifyOrderSaved(empireOrder.id);
        }, 500);
        
        // Update kitchen pulse immediately
        setTimeout(() => {
            updateKitchenPulse();
        }, 1000);
        
        return empireOrder.id;
        
    } catch (error) {
        console.error('❌ EMPIRE order save error:', error);
        showNotification('Failed to save order in system', 'error');
        return null;
    }
}

// ==================== COMPLETE generateProperInvoice ====================
function generateProperInvoice(orderData) {
    console.log('📄 Generating EMPIRE invoice for order:', orderData.orderId);
    
    const invoiceDate = new Date().toLocaleString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Lagos'
    });
    
    // Calculate actual cooking time with yoghurt consideration
    let cookingTime = 0;
    let formattedTime = '';
    let specialNotes = '';
    
    if (orderData.isYoghurt) {
        cookingTime = YOGHURT_CONFIG.fermentationTime;
        formattedTime = '24 hours (fermented)';
        specialNotes = '🧫 24-hour fermented yoghurt - requires refrigeration';
    } else {
        const cart = orderData.items || [];
        let longestTime = 0;
        cart.forEach(item => {
            const itemTime = CONFIG.cookingTimes[item.category] || 30;
            if (itemTime > longestTime) {
                longestTime = itemTime;
            }
        });
        cookingTime = longestTime || 45;
        formattedTime = formatCookingTime(cookingTime);
    }
    
    const invoice = {
        invoiceId: `INV-${Date.now()}`,
        orderId: orderData.orderId,
        customerName: orderData.customerName,
        items: orderData.items,
        totalAmount: orderData.totalAmount,
        bankDetails: {
            name: 'CARBON MICRO FINANCE BANK',
            bank: 'Emmanuel Osabolu Okpere',
            account: '3034457406',
            note: `Transfer with reference: ${orderData.orderId}`
        },
        invoiceDate: invoiceDate,
        estimatedReady: formattedTime,
        specialNotes: specialNotes,
        isYoghurt: orderData.isYoghurt || false,
        storageInstructions: orderData.isYoghurt ? 'Refrigerate immediately upon pickup' : 'Consume within 24 hours'
    };
    
    saveInvoiceToStorage(invoice);
    
    // Generate and open invoice
    const invoiceHTML = generateInvoiceHTML(invoice);
    const invoiceWindow = window.open('', '_blank');
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
    
    return invoice;
}

// ==================== COMPLETE generateInvoiceHTML ====================
function generateInvoiceHTML(invoice) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>INVOICE - CLEANBITE EMPIRE</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: #0a0a0a; 
                    color: white;
                }
                .invoice-container { 
                    max-width: 800px; 
                    margin: 0 auto; 
                    background: #111; 
                    padding: 30px; 
                    border: 1px solid #333;
                }
                .empire-header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #ffd700; 
                    padding-bottom: 20px; 
                }
                .empire-header h1 { 
                    color: #ffd700; 
                    margin: 0; 
                    font-size: 2.5rem;
                }
                .payment-section { 
                    background: #1a1a1a; 
                    padding: 20px; 
                    margin: 20px 0; 
                    border-left: 4px solid #ffd700;
                }
                .yoghurt-notice {
                    background: linear-gradient(135deg, #4a00e0, #8e2de2);
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                    border-left: 4px solid #00d4ff;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 20px 0; 
                }
                th { 
                    background: #222; 
                    color: #ffd700; 
                    padding: 12px; 
                    text-align: left; 
                }
                td { 
                    padding: 12px; 
                    border-bottom: 1px solid #333; 
                }
                .yoghurt-row {
                    background: rgba(74, 0, 224, 0.1);
                }
                .total-row { 
                    font-weight: bold; 
                    font-size: 1.2em; 
                    background: #1a1a1a; 
                }
                .footer { 
                    text-align: center; 
                    margin-top: 40px; 
                    color: #888; 
                    font-size: 0.9em; 
                }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="empire-header">
                    <h1>🏛️ CLEANBITE EMPIRE</h1>
                    <p>INVOICE: ${invoice.invoiceId}</p>
                    <p>Order: ${invoice.orderId}</p>
                    ${invoice.isYoghurt ? '<p class="yoghurt-notice">🧫 YOGHURT ORDER - 24-HOUR FERMENTATION REQUIRED</p>' : ''}
                </div>
                
                <div class="payment-section">
                    <h3><i class="fas fa-university"></i> EMPIRE PAYMENT DETAILS</h3>
                    <p><strong>Bank:</strong> ${invoice.bankDetails.bank}</p>
                    <p><strong>Account Name:</strong> ${invoice.bankDetails.name}</p>
                    <p><strong>Account Number:</strong> ${invoice.bankDetails.account}</p>
                    <p><strong>Reference:</strong> ${invoice.orderId}</p>
                    <p><strong>Amount:</strong> ₦${invoice.totalAmount.toLocaleString()}</p>
                    <p><em>${invoice.bankDetails.note}</em></p>
                </div>
                
                <h3>Order Summary</h3>
                <table>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                    ${invoice.items.map(item => `
                        <tr class="${item.category === 'yoghurt' ? 'yoghurt-row' : ''}">
                            <td>${item.name} ${item.category === 'yoghurt' ? '🧫' : ''}</td>
                            <td>${item.quantity}</td>
                            <td>${item.category}</td>
                            <td>₦${item.price.toLocaleString()}</td>
                            <td>₦${(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="4">TOTAL AMOUNT</td>
                        <td>₦${invoice.totalAmount.toLocaleString()}</td>
                    </tr>
                </table>
                
                ${invoice.specialNotes ? `
                    <div class="yoghurt-notice">
                        <h4><i class="fas fa-info-circle"></i> SPECIAL INSTRUCTIONS</h4>
                        <p>${invoice.specialNotes}</p>
                        <p><strong>Storage:</strong> ${invoice.storageInstructions}</p>
                    </div>
                ` : ''}
                
                <div class="footer">
                    <p><i class="fas fa-shield-alt"></i> Sovereignty starts on your plate.</p>
                    <p>Bring this invoice to pickup location.</p>
                    <p><strong>Estimated Ready:</strong> ${invoice.estimatedReady}</p>
                    ${invoice.isYoghurt ? '<p>🧫 Fermentation progress will be tracked in real-time</p>' : ''}
                </div>
            </div>
        </body>
        </html>
    `;
}

// ==================== COMPLETE saveInvoiceToStorage ====================
function saveInvoiceToStorage(invoice) {
    try {
        const invoices = JSON.parse(localStorage.getItem('cleanbite_invoices') || '[]');
        invoices.push({
            ...invoice,
            savedAt: new Date().toISOString(),
            status: 'pending',
            isYoghurt: invoice.isYoghurt || false
        });
        
        localStorage.setItem('cleanbite_invoices', JSON.stringify(invoices));
        console.log(`📁 Invoice ${invoice.invoiceId} saved to storage`);
    } catch (error) {
        console.error('Error saving invoice:', error);
    }
}

// ==================== CRITICAL: FORCE ORDER SYNC TO ADMIN ====================
function forceOrderSyncToAdmin(order) {
    console.log('🚨 FORCE SYNC: Broadcasting order to admin...');
    
    // 1. Save to cleanbite_orders (where admin looks)
    let existingOrders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    existingOrders.push(order);
    localStorage.setItem('cleanbite_orders', JSON.stringify(existingOrders));
    
    console.log(`✅ Order ${order.id} saved to cleanbite_orders`);
    
    // 2. Save to shared_order_ key (backup)
    localStorage.setItem(`shared_order_${order.id}`, JSON.stringify(order));
    
    // 3. Save to SHARED_orders_copy array
    const sharedOrders = JSON.parse(localStorage.getItem('SHARED_orders_copy') || '[]');
    sharedOrders.push(order);
    localStorage.setItem('SHARED_orders_copy', JSON.stringify(sharedOrders));
    
    // 4. Set a FLAG for admin to detect
    localStorage.setItem('new_order_placed', Date.now().toString());
    localStorage.setItem('empire_new_order_flag', JSON.stringify({
        orderId: order.id,
        customer: order.customerName,
        amount: order.totalAmount,
        timestamp: Date.now()
    }));
    
    // 5. Broadcast via BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('cleanbite_orders');
            channel.postMessage({
                type: 'NEW_ORDER_FORCE',
                order: order,
                timestamp: Date.now(),
                source: 'customer_force_sync'
            });
            console.log('📡 Force broadcast sent via BroadcastChannel');
            setTimeout(() => channel.close(), 500);
        } catch (error) {
            console.log('⚠️ BroadcastChannel failed:', error);
        }
    }
    
    // 6. Trigger storage event (fallback)
    localStorage.setItem('order_force_sync_trigger', Date.now().toString());
    
    console.log(`🚀 Order ${order.id} FORCE SYNCED to admin system`);
}

// ==================== 🔥 CRITICAL SYNC FUNCTION: BROADCAST TO ADMIN ====================
function broadcastNewOrderToAdmin(order) {
    console.log('📡 Broadcasting new order to admin...');
    
    // Method 1: BroadcastChannel (for admin tab)
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('cleanbite_orders');
            channel.postMessage({
                type: 'NEW_ORDER',
                order: order,
                timestamp: Date.now(),
                source: 'customer'
            });
            setTimeout(() => channel.close(), 100);
            console.log('✅ Order broadcast sent via BroadcastChannel');
        } catch (error) {
            console.warn('⚠️ BroadcastChannel failed:', error);
        }
    }
    
    // Method 2: Storage event (fallback)
    localStorage.setItem('empire_new_order', JSON.stringify({
        order: order,
        timestamp: Date.now()
    }));
    
    // Method 3: Flag for admin detection
    localStorage.setItem('new_order_placed', Date.now().toString());
    
    console.log('📢 Admin notified of new order:', order.id);
}


// ==================== UPDATE ORDER TRACKING DISPLAY ====================
function updateOrderTrackingDisplay(orderId, status) {
    const trackingElement = document.querySelector(`[data-order="${orderId}"]`);
    if (trackingElement) {
        trackingElement.className = `order-status ${status}`;
        trackingElement.textContent = status === 'verified' ? 'Verified - Preparing' : 'Pending';
    }
}

// ==================== LIVE KITCHEN PULSE ====================
// FIXED: initEnhancedKitchenPulse - Missing initialization
function initEnhancedKitchenPulse() {
    console.log('💓 Initializing Enhanced Kitchen Pulse...');
    
    // Create pulse container if it doesn't exist
    const pulseContainer = document.getElementById('kitchenPulse');
    if (!pulseContainer) {
        const container = document.createElement('div');
        container.id = 'kitchenPulse';
        container.className = 'kitchen-pulse-container';
        container.innerHTML = `
            <div class="pulse-dot"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-stats">
                <div class="pulse-stat"><i class="fas fa-clock"></i><span id="pulseLastUpdate">--:--</span></div>
                <div class="pulse-stat"><i class="fas fa-sync-alt"></i><span id="pulseFrequency">0/min</span></div>
                <div class="pulse-stat"><i class="fas fa-signal"></i><span id="pulseStrength">Normal</span></div>
            </div>
        `;
        document.querySelector('.kitchen-container')?.prepend(container);
    }
    
    // Initialize pulse intervals
    updateKitchenPulse();
    setInterval(updateKitchenPulse, 30000); // Update every 30 seconds
}

// FIXED: updateKitchenPulse - Missing implementation
function updateKitchenPulse() {
    const lastUpdate = localStorage.getItem('kitchen_last_update');
    const pulseStrength = calculatePulseStrength();
    
    // Update pulse UI
    const pulseDot = document.querySelector('.pulse-dot');
    const pulseRing = document.querySelector('.pulse-ring');
    
    if (pulseDot && pulseRing) {
        // Animate pulse
        pulseDot.style.animation = 'none';
        pulseRing.style.animation = 'none';
        
        setTimeout(() => {
            pulseDot.style.animation = `pulse 2s infinite ${pulseStrength.color}`;
            pulseRing.style.animation = `ring 2s infinite ${pulseStrength.color}`;
        }, 10);
        
        // Update stats
        updateElement('pulseLastUpdate', lastUpdate ? 
            new Date(lastUpdate).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '--:--');
        updateElement('pulseStrength', pulseStrength.text);
    }
    
    // Calculate updates per minute
    const updateTimes = JSON.parse(localStorage.getItem('kitchen_update_times') || '[]');
    const now = Date.now();
    const lastMinuteUpdates = updateTimes.filter(time => now - time < 60000).length;
    updateElement('pulseFrequency', `${lastMinuteUpdates}/min`);
}

// FIXED: calculatePulseStrength - Helper function
function calculatePulseStrength() {
    const lastUpdate = localStorage.getItem('kitchen_last_update');
    if (!lastUpdate) return { text: 'Offline', color: '#e74c3c' };
    
    const timeSinceUpdate = Date.now() - new Date(lastUpdate).getTime();
    
    if (timeSinceUpdate < 30000) return { text: 'Strong', color: '#2ecc71' };
    if (timeSinceUpdate < 60000) return { text: 'Normal', color: '#f39c12' };
    if (timeSinceUpdate < 120000) return { text: 'Weak', color: '#e67e22' };
    return { text: 'Critical', color: '#e74c3c' };
}

// FIXED: updateKitchenDisplay - Missing implementation
function updateKitchenDisplay() {
    console.log('🔄 Updating kitchen display...');
    
    const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
    const orders = kitchenData.orders || [];
    const stats = kitchenData.stats || {};
    
    // Update order bubbles
    updateOrderBubblesFromKitchen();
    
    // Update counters
    updateKitchenCounters(stats);
    
    // Update activity feed
    updateActivityFeed(orders);
    
    // Update last update timestamp
    localStorage.setItem('kitchen_last_update', new Date().toISOString());
    
    // Track update time for frequency calculation
    const updateTimes = JSON.parse(localStorage.getItem('kitchen_update_times') || '[]');
    updateTimes.push(Date.now());
    if (updateTimes.length > 60) updateTimes.shift(); // Keep last 60 updates
    localStorage.setItem('kitchen_update_times', JSON.stringify(updateTimes));
}

// FIXED: batchUpdateKitchen - Missing implementation
function batchUpdateKitchen() {
    console.log('📦 Batch updating kitchen...');
    
    // Get all verified orders
    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    const verifiedOrders = orders.filter(order => 
        order.paymentStatus === 'verified' && 
        order.status !== 'completed' && 
        order.status !== 'cancelled'
    );
    
    // Update kitchen storage
    const kitchenData = {
        orders: verifiedOrders.map(order => ({
            id: order.id,
            status: order.status,
            customerName: order.customerName,
            items: order.items?.length || 0,
            categories: order.itemCategories || [],
            timeline: order.timeline || {},
            estimatedReady: order.estimatedReady,
            trackCode: order.trackCode || `TRK-${order.id.slice(-6)}`
        })),
        stats: {
            preparing: verifiedOrders.filter(o => o.status === 'preparing').length,
            cooking: verifiedOrders.filter(o => o.status === 'cooking').length,
            ready: verifiedOrders.filter(o => o.status === 'ready').length,
            total: verifiedOrders.length,
            lastBatchUpdate: new Date().toISOString()
        }
    };
    
    localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
    
    // Trigger display update
    updateKitchenDisplay();
    
    // Broadcast update
    if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('cleanbite_kitchen');
        channel.postMessage({
            type: 'BATCH_UPDATE',
            data: kitchenData,
            timestamp: Date.now()
        });
        setTimeout(() => channel.close(), 100);
    }
    
    return kitchenData;
}

// FIXED: updateOrderDisplay - Missing implementation
function updateOrderDisplay() {
    const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
    const orders = kitchenData.orders || [];
    
    const orderGrid = document.getElementById('orderGrid');
    if (!orderGrid) return;
    
    if (orders.length === 0) {
        orderGrid.innerHTML = `
            <div class="empty-kitchen">
                <i class="fas fa-utensils"></i>
                <h3>Kitchen is Quiet</h3>
                <p>No orders currently in progress</p>
                <button class="refresh-btn" onclick="batchUpdateKitchen()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        `;
        return;
    }
    
    let ordersHTML = '';
    
    // Group by status
    const statusGroups = {
        preparing: orders.filter(o => o.status === 'preparing'),
        cooking: orders.filter(o => o.status === 'cooking'),
        ready: orders.filter(o => o.status === 'ready')
    };
    
    Object.entries(statusGroups).forEach(([status, statusOrders]) => {
        if (statusOrders.length > 0) {
            ordersHTML += `
                <div class="status-section">
                    <div class="status-header ${status}">
                        <i class="fas ${getStatusIcon(status)}"></i>
                        <h3>${status.charAt(0).toUpperCase() + status.slice(1)}</h3>
                        <span class="count-badge">${statusOrders.length}</span>
                    </div>
                    <div class="orders-grid">
                        ${statusOrders.map(order => `
                            <div class="order-card ${status}" data-order="${order.id}">
                                <div class="order-header">
                                    <div class="order-id">${order.id}</div>
                                    <div class="order-timer" data-start="${order.timeline?.preparationStarted || order.createdAt}">
                                        <!-- Timer will be populated by JavaScript -->
                                    </div>
                                </div>
                                <div class="order-body">
                                    <div class="customer-info">
                                        <div class="customer-avatar">${order.customerName?.charAt(0) || 'C'}</div>
                                        <div class="customer-details">
                                            <div class="customer-name">${order.customerName}</div>
                                            <div class="order-items">${order.items} items</div>
                                        </div>
                                    </div>
                                    <div class="order-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill ${status}" style="width: ${getProgressPercentage(status)}%"></div>
                                        </div>
                                        <div class="progress-label">${getProgressLabel(status)}</div>
                                    </div>
                                </div>
                                <div class="order-footer">
                                    <div class="track-code">${order.trackCode}</div>
                                    <div class="order-actions">
                                        <button class="action-btn" onclick="updateOrderStatus('${order.id}')">
                                            <i class="fas fa-arrow-up"></i>
                                        </button>
                                        <button class="action-btn" onclick="viewOrderDetails('${order.id}')">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    orderGrid.innerHTML = ordersHTML;
    
    // Initialize timers
    initializeOrderTimers();

    function cleanKitchenStorage() {
    console.log('🧹 CLEANING KITCHEN STORAGE OF COMPLETED ORDERS...');
    
    try {
        const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{}');
        
        if (!kitchenData.orders) {
            kitchenData.orders = [];
            kitchenData.stats = {
                preparing: 0,
                cooking: 0,
                ready: 0,
                total: 0,
                awaiting_verification: 0,
                pending_payment: 0
            };
            console.log("✅ Kitchen storage initialized");
            localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
            
            // 🔥 UPDATE DISPLAY
            setTimeout(() => {
                updateKitchenPulse();
                updateKitchenDisplay();
            }, 100);
            
            return kitchenData;
        }
        
        const before = kitchenData.orders.length;
        
        // 🔥 CRITICAL FIX: Filter out ONLY completed/locked orders
        const activeOrders = kitchenData.orders.filter(order => {
            // Skip if order is locked (completed)
            if (isOrderLocked(order.id)) {
                console.log(`🚫 Removing locked order from kitchen storage: ${order.id}`);
                return false;
            }
            
            // If order is completed, lock it and skip
            if (order.status === 'completed') {
                console.log(`🔒 Locking and removing completed order from kitchen storage: ${order.id}`);
                lockCompletedOrder(order.id);
                return false;
            }
            
            // ✅ IMPORTANT CHANGE: Keep ALL orders (including unverified)
            // This allows dashboard to see everything
            return true;
        });
        
        // Update kitchen data with filtered orders
        kitchenData.orders = activeOrders;
        
        // Update stats based on filtered orders
        kitchenData.stats = kitchenData.stats || {};
        kitchenData.stats.preparing = activeOrders.filter(o => 
            o.status === 'preparing' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.cooking = activeOrders.filter(o => o.status === 'cooking').length;
        kitchenData.stats.ready = activeOrders.filter(o => o.status === 'ready').length;
        kitchenData.stats.awaiting_verification = activeOrders.filter(o => 
            o.paymentStatus === 'pending' || o.status === 'pending-payment'
        ).length;
        kitchenData.stats.pending_payment = activeOrders.filter(o => 
            o.paymentStatus === 'pending'
        ).length;
        kitchenData.stats.total = activeOrders.length;
        
        // Save back to storage
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
        
        const removed = before - activeOrders.length;
        if (removed > 0) {
            console.log(`✅ Removed ${removed} completed orders from kitchen storage`);
        } else {
            console.log("✅ Kitchen storage already clean");
        }
        
        // 🔥 CRITICAL: UPDATE DISPLAY AFTER CLEANING
        setTimeout(() => {
            updateKitchenPulse();
            updateKitchenDisplay();
        }, 100);
        
        return {
            before: before,
            after: activeOrders.length,
            removed: removed,
            stats: kitchenData.stats
        };
        
    } catch (error) {
        console.error('❌ Clean kitchen storage error:', error);
        return null;
    }
}
}
// ==================== FREQUENT UPDATE CHECKER ====================
function setupFrequentUpdateChecker() {
    console.log('👁️ Setting up update monitor (NO DUPLICATE UPDATES)...');
    
    // This ONLY monitors for urgent updates, doesn't trigger kitchen updates
    
    // Check for urgent updates every 30 seconds
    setInterval(() => {
        try {
            const lastUpdate = localStorage.getItem('kitchen_last_update');
            const forceUpdate = localStorage.getItem('kitchen_force_update');
            const newOrderFlag = localStorage.getItem('empire_new_order_flag');
            
            // Check if we need urgent update
            let needsUpdate = false;
            let reason = '';
            
            if (forceUpdate) {
                needsUpdate = true;
                reason = 'force update triggered';
                localStorage.removeItem('kitchen_force_update');
            }
            else if (newOrderFlag) {
                needsUpdate = true;
                reason = 'new order placed';
                localStorage.removeItem('empire_new_order_flag');
            }
            else if (lastUpdate && (Date.now() - parseInt(lastUpdate)) < 30000) {
                needsUpdate = true;
                reason = 'recent update detected';
            }
            
            if (needsUpdate) {
                console.log(`🚨 Update monitor: ${reason} - scheduling update`);
                // Schedule update but don't trigger immediately
                setTimeout(() => {
                    updateKitchenPulse();
                }, 1000);
            }
            
        } catch (error) {
            console.error('Update monitor error:', error);
        }
    }, 30000); // Check every 30 seconds
    
    console.log('✅ Update monitor active (monitors only, no duplicate updates)');
}

// ==================== PAYMENT VERIFICATION TRIGGER ====================
function triggerAdminPaymentNotification(orderData) {
    console.log('💰 Triggering admin payment notification for:', orderData.id);
    
    // Method 1: localStorage (works across tabs)
    const paymentNotification = {
        type: 'PAYMENT_REQUIRES_VERIFICATION',
        orderId: orderData.id,
        customerName: orderData.customerName,
        amount: orderData.totalAmount,
        paymentMethod: orderData.paymentMethod,
        timestamp: new Date().toISOString(),
        bankDetails: {
            bank: 'CARBON MICRO FINANCE BANK',
            accountName: 'Emmanuel Osabolu Okpere',
            accountNumber: '3034457406'
        }
    };
    
    // Save to localStorage for admin dashboard
    localStorage.setItem('ADMIN_PAYMENT_PENDING', JSON.stringify(paymentNotification));
    localStorage.setItem('ADMIN_ORDER_NEEDS_ATTENTION', 'true');
    localStorage.setItem('ADMIN_LATEST_ORDER_ID', orderData.id);
    
    // Method 2: BroadcastChannel if available
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const adminChannel = new BroadcastChannel('cleanbite_admin');
            adminChannel.postMessage(paymentNotification);
            console.log('📡 BroadcastChannel notification sent');
            setTimeout(() => adminChannel.close(), 1000);
        } catch (error) {
            console.log('⚠️ BroadcastChannel not available:', error);
        }
    }
    
    // Method 3: Custom event
    const paymentEvent = new CustomEvent('cleanbite-payment-pending', {
        detail: paymentNotification
    });
    window.dispatchEvent(paymentEvent);
    
    // Method 4: Trigger storage event for admin dashboard
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'ADMIN_PAYMENT_PENDING',
        newValue: JSON.stringify(paymentNotification)
    }));
    
    console.log('✅ Payment notification sent to admin dashboard');
}


// Add this function to force a refresh with animation
function forceActivityRefresh() {
    console.log("🔄 Force refreshing activity feed with animation...");
    window.activityFirstLoad = true; // Allow animation again
    updateKitchenPulse(); // This will trigger updateActivityFeed
    showNotification("Activity feed refreshed", "info");
}

// Add this function to your quick actions section
function addManualRefreshButton() {
    // Create refresh button in the kitchen section
    const kitchenHeader = document.querySelector('.kitchen-section h3, .kitchen-activity h3');
    if (kitchenHeader) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'activity-refresh-btn';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        refreshBtn.title = 'Refresh activity feed';
        refreshBtn.style.cssText = `
            background: rgba(255, 215, 0, 0.2);
            border: 1px solid rgba(255, 215, 0, 0.4);
            color: #ffd700;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            transition: all 0.3s;
        `;
        
        refreshBtn.onclick = function() {
            this.style.transform = 'rotate(180deg)';
            forceActivityRefresh();
            setTimeout(() => {
                this.style.transform = 'rotate(0deg)';
            }, 300);
        };
        
        refreshBtn.onmouseenter = function() {
            this.style.background = 'rgba(255, 215, 0, 0.3)';
            this.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.3)';
        };
        
        refreshBtn.onmouseleave = function() {
            this.style.background = 'rgba(255, 215, 0, 0.2)';
            this.style.boxShadow = 'none';
        };
        
        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.width = '100%';
        
        kitchenHeader.parentNode.insertBefore(headerContainer, kitchenHeader);
        headerContainer.appendChild(kitchenHeader);
        headerContainer.appendChild(refreshBtn);
    }
}

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

// Add this new function near your other utility functions
function emergencyFixStuckOrders() {
    console.log('🚨 EMERGENCY: Fixing stuck orders...');
    
    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
    const now = new Date();
    let fixed = 0;
    
    orders.forEach(order => {
        if (order.paymentStatus !== 'verified') return;
        
        const created = new Date(order.createdAt);
        const hoursOld = (now - created) / (1000 * 60 * 60);
        
        // Fix orders stuck in preparing
        if (order.status === 'preparing' && hoursOld > 6) {
            console.log(`🔄 ${order.id}: Stuck in preparing for ${hoursOld.toFixed(1)}h → moving to cooking`);
            order.status = 'cooking';
            order.timeline = order.timeline || {};
            order.timeline.cookingStarted = now.toISOString();
            order.lastStatusChange = now.toISOString();
            fixed++;
        }
        
        // Fix orders stuck in cooking
        if (order.status === 'cooking' && hoursOld > 8) {
            console.log(`🔄 ${order.id}: Stuck in cooking for ${hoursOld.toFixed(1)}h → moving to ready`);
            order.status = 'ready';
            order.timeline.readyAt = now.toISOString();
            order.estimatedReady = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            order.lastStatusChange = now.toISOString();
            fixed++;
        }
        
        // Fix yoghurt orders not progressing
        if (detectYoghurtOrder(order) && order.status === 'preparing' && hoursOld > 24) {
            console.log(`🧫 ${order.id}: Yoghurt in preparing for ${hoursOld.toFixed(1)}h → should be ready`);
            order.status = 'ready';
            order.timeline.readyAt = now.toISOString();
            order.estimatedReady = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            order.lastStatusChange = now.toISOString();
            fixed++;
        }
    });
    
    if (fixed > 0) {
        localStorage.setItem('cleanbite_orders', JSON.stringify(orders));
        console.log(`✅ Fixed ${fixed} stuck orders`);
        
        // Update kitchen
        setTimeout(() => {
            updateKitchenPulse();
            batchUpdateKitchen();
        }, 1000);
        
        alert(`Fixed ${fixed} stuck orders! Kitchen is updating...`);
    }
    
    return fixed;
}

// Add to init() function:
// setTimeout(emergencyFixStuckOrders, 5000);

// ==================== FIXED: KITCHEN DISPLAY WITH DEBOUNCING ====================
let isUpdatingKitchen = false;
let lastKitchenUpdate = 0;
let kitchenUpdateCount = 0;
const KITCHEN_UPDATE_MIN_INTERVAL = 1000; // 5 seconds minimum between updates
const MAX_UPDATES_PER_MINUTE = 120;


// ==================== MANUAL UPDATE FUNCTION (FOR ADMIN USE) ====================
function forceKitchenDisplayUpdate() {
    console.log('🚀 FORCE updating kitchen display (admin override)...');
    
    // Reset counters to allow immediate update
    isUpdatingKitchen = false;
    lastKitchenUpdate = 0;
    
    // Force update
    batchUpdateKitchen();
}

// ==================== UPDATED RECOVER KITCHEN DATA ====================
function recoverKitchenData() {
    console.log("🔄 RECOVERING KITCHEN DATA WITH COMPLETED ORDER FILTER...");
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const verifiedOrders = orders.filter(o => o.paymentStatus === 'verified');
        
        // 🔥 CRITICAL FIX: Filter out completed/locked orders
        const activeOrders = verifiedOrders.filter(order => {
            // Skip if order is locked (completed)
            if (isOrderLocked(order.id)) {
                console.log(`🚫 Skipping locked order in recovery: ${order.id}`);
                return false;
            }
            
            // If order is completed, lock it and skip
            if (order.status === 'completed') {
                console.log(`🔒 Locking completed order in recovery: ${order.id}`);
                lockCompletedOrder(order.id);
                return false;
            }
            
            return true; // Keep active orders
        });
        
        console.log(`✅ Recovery filter: ${verifiedOrders.length} verified → ${activeOrders.length} active`);
        
        const stats = {
            prep: activeOrders.filter(o => o.status === 'preparing' || o.status === 'pending-payment').length,
            cook: activeOrders.filter(o => o.status === 'cooking').length,
            ready: activeOrders.filter(o => o.status === 'ready').length,
            total: activeOrders.length,
            lastRecovery: new Date().toISOString()
        };
        
        const kitchenOrders = activeOrders.map(order => ({
            id: order.id,
            status: order.status || 'preparing',
            customerName: order.customerName,
            customerInitial: order.customerName?.charAt(0) || 'C',
            items: order.items || [],
            categories: order.itemCategories || (order.items || []).map(i => i.category),
            trackCode: order.trackCode || `TRK-${order.id.slice(-6)}`,
            startedAt: order.timeline?.preparationStarted || order.createdAt,
            timeline: {
                enteredKitchen: order.timeline?.enteredKitchen || new Date().toISOString(),
                preparationStart: order.timeline?.preparationStarted || order.createdAt
            },
            itemsCount: order.items?.length || 0
        }));
        
        const kitchenData = {
            orders: kitchenOrders,
            stats: stats,
            lastSync: new Date().toISOString(),
            recovered: true
        };
        
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
        console.log("✅ Kitchen data recovered with completed order filter:", stats);
        
        // 🔥 ADD THIS LINE: Update timestamp for frequent checker
        updateKitchenLastUpdate();
        
        setTimeout(() => {
            updateKitchenPulse();
        }, 100);
        
        return kitchenData;
        
    } catch (error) {
        console.error("❌ Recovery failed:", error);
        return null;
    }
}

function fixKitchenStats() {
    console.log("🔧 FIXING KITCHEN STATS...");
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{"orders": [], "stats": {}}');
        
        const verifiedOrders = orders.filter(o => o.paymentStatus === 'verified');
        const correctStats = {
            prep: verifiedOrders.filter(o => o.status === 'preparing' || o.status === 'pending-payment').length,
            cook: verifiedOrders.filter(o => o.status === 'cooking').length,
            ready: verifiedOrders.filter(o => o.status === 'ready').length,
            total: verifiedOrders.length,
            lastFix: new Date().toISOString()
        };
        
        const kitchenOrders = kitchenData.orders && kitchenData.orders.length > 0 ? 
            kitchenData.orders : 
            verifiedOrders.map(order => ({
                id: order.id,
                status: order.status || 'preparing',
                customerInitial: order.customerName?.charAt(0) || 'C',
                trackCode: order.trackCode || `TRK-${order.id.slice(-6)}`
            }));
        
        const fixedData = {
            ...kitchenData,
            orders: kitchenOrders,
            stats: correctStats
        };
        
        localStorage.setItem('cleanbite_kitchen', JSON.stringify(fixedData));
        console.log("✅ Kitchen stats fixed:", correctStats);
        
        setTimeout(() => {
            updateKitchenPulse();
        }, 100);
        
        return fixedData;
        
    } catch (error) {
        console.error("❌ Fix stats failed:", error);
        return null;
    }
}

function getEfficiencyPercentage(stats) {
    const total = stats.total || 0;
    if (total === 0) return 85;
    
    const efficiency = Math.min(98, 70 + Math.random() * 25);
    return Math.round(efficiency);
}

function updateKitchenStats(stats) {
    console.log("📈 Updating kitchen stats:", stats);
    
    if (!elements.prepCountEl) elements.prepCountEl = document.getElementById('prepCount');
    if (!elements.cookCountEl) elements.cookCountEl = document.getElementById('cookCount');
    if (!elements.packCountEl) elements.packCountEl = document.getElementById('packCount');
    
    const prepCount = stats.preparing || stats.prep || 0;
    const cookCount = stats.cooking || stats.cook || 0;
    const packCount = stats.ready || stats.pack || 0;
    
    if (elements.prepCountEl) {
        elements.prepCountEl.textContent = prepCount;
        if (prepCount > 0) {
            elements.prepCountEl.classList.add('active', 'counting');
            setTimeout(() => elements.prepCountEl.classList.remove('counting'), 300);
        } else {
            elements.prepCountEl.classList.remove('active');
        }
    }
    
    if (elements.cookCountEl) {
        elements.cookCountEl.textContent = cookCount;
        if (cookCount > 0) {
            elements.cookCountEl.classList.add('active', 'counting');
            setTimeout(() => elements.cookCountEl.classList.remove('counting'), 300);
        } else {
            elements.cookCountEl.classList.remove('active');
        }
    }
    
    if (elements.packCountEl) {
        elements.packCountEl.textContent = packCount;
        if (packCount > 0) {
            elements.packCountEl.classList.add('active', 'counting');
            setTimeout(() => elements.packCountEl.classList.remove('counting'), 300);
        } else {
            elements.packCountEl.classList.remove('active');
        }
    }
    
    const totalOrdersEl = document.getElementById('totalOrders');
    if (totalOrdersEl) {
        totalOrdersEl.textContent = stats.total || 0;
        if (stats.total > 0) {
            totalOrdersEl.classList.add('active');
        }
    }
    
    updateEfficiency(stats);
}

// ==================== UPDATED ORDER BUBBLES ====================
function updateOrderBubblesFromKitchen(orders) {
    console.log("🫧 Updating order bubbles from DASHBOARD orders...");
    
    // Use the orders passed in (already filtered like dashboard)
    const activeOrders = orders || [];
    
    console.log(`✅ Bubble count: ${activeOrders.length} (dashboard filtered)`);
    
    const stages = [
        { id: 'prepBubbles', status: 'preparing', label: 'Preparing' },
        { id: 'cookBubbles', status: 'cooking', label: 'Cooking' },
        { id: 'packBubbles', status: 'ready', label: 'Ready' }
    ];
    
    stages.forEach(stage => {
        const container = document.getElementById(stage.id);
        if (!container) return;
        
        const stageOrders = activeOrders.filter(order => 
            order.status === stage.status || 
            (stage.status === 'preparing' && order.status === 'pending-payment')
        );
        
        if (stageOrders.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = '';
        stageOrders.slice(0, 8).forEach(order => {
            const bubble = document.createElement('div');
            bubble.className = 'order-bubble';
            bubble.textContent = order.trackCode || order.id?.slice(-6) || 'ORD';
            bubble.title = `${order.id} - ${order.customerName}`;
            bubble.setAttribute('data-order-id', order.id);
            
            // Add status colors
            if (stage.status === 'preparing') {
                bubble.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
            } else if (stage.status === 'cooking') {
                bubble.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            } else if (stage.status === 'ready') {
                bubble.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
            }
            
            // Standard bubble styles
            bubble.style.cssText += `
                margin: 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 45px;
                height: 45px;
                border-radius: 50%;
                color: white;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                box-shadow: 0 0 15px rgba(0,0,0,0.2);
            `;
            
            container.appendChild(bubble);
        });
        
        console.log(`✅ ${stage.label}: ${stageOrders.length} bubbles`);
    });
}

// ==================== UPDATED ACTIVITY FEED ====================
function updateActivityFeed(orders) {
    console.log("📝 Updating activity feed with COMPLETED ORDER FILTER...");
    
    try {
        // 🔥 CRITICAL FIX: Filter out completed/locked orders
        const activeOrders = orders.filter(order => {
            // Skip if order is locked (completed)
            if (isOrderLocked(order.id)) {
                return false;
            }
            
            // If order is completed, lock it and skip
            if (order.status === 'completed') {
                lockCompletedOrder(order.id);
                return false;
            }
            
            return true; // Keep active orders
        });
        
        console.log(`✅ Activity feed filter: ${orders.length} total → ${activeOrders.length} active`);
        
        let activityEl = document.querySelector('.kitchen-activity, .kitchen-activity-stream, .activity-feed');
        
        if (!activityEl) {
            console.log("ℹ️ Activity stream element not found");
            return;
        }
        
        // Use filtered activeOrders
        const recentOrders = (activeOrders || [])
            .filter(order => order.status)
            .sort((a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt))
            .slice(0, 5);
        
        if (recentOrders.length === 0) {
            activityEl.innerHTML = `
                <div class="activity-empty">
                    <i class="fas fa-mug-hot"></i>
                    <p>Kitchen is ready for orders</p>
                    <small>Verified orders will appear here</small>
                </div>
            `;
            return;
        }
        
        const activityHTML = recentOrders.map(order => {
            const time = new Date(order.startedAt || order.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const statusMap = {
                'preparing': { text: 'Started preparation', icon: 'fa-utensils', color: '#9b59b6' },
                'cooking': { text: 'Now cooking', icon: 'fa-fire', color: '#e74c3c' },
                'ready': { text: 'Ready for pickup', icon: 'fa-check-circle', color: '#2ecc71' },
                'pending-payment': { text: 'Awaiting verification', icon: 'fa-clock', color: '#f39c12' }
            };
            
            const statusInfo = statusMap[order.status] || { text: order.status, icon: 'fa-bell', color: '#3498db' };
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas ${statusInfo.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">
                            <strong>${order.trackCode || order.id.slice(-6)}</strong> ${statusInfo.text}
                        </div>
                        <div class="activity-meta">
                            <span class="activity-time">${time}</span>
                            <span class="activity-customer">${order.customerInitial || 'C'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Simple fade animation for first load only
        if (window.activityFirstLoad) {
            activityEl.style.opacity = '0';
            activityEl.innerHTML = activityHTML;
            
            // Fade in
            setTimeout(() => {
                activityEl.style.transition = 'opacity 0.5s ease';
                activityEl.style.opacity = '1';
            }, 10);
            
            window.activityFirstLoad = false;
        } else {
            // No animation for subsequent updates
            activityEl.style.transition = 'none';
            activityEl.innerHTML = activityHTML;
        }
        
        console.log(`✅ Activity feed updated with ${recentOrders.length} active items`);
        
    } catch (error) {
        console.error('Activity feed update failed:', error);
    }
}

function updateProgressStats(stats) {
    const efficiencyBar = document.getElementById('efficiencyBar');
    const efficiencyPercent = document.getElementById('efficiencyPercent');
    
    if (efficiencyBar) {
        const efficiency = getEfficiencyPercentage(stats);
        efficiencyBar.style.width = `${efficiency}%`;
        efficiencyBar.style.background = getEfficiencyColor(efficiency);
    }
    
    if (efficiencyPercent) {
        efficiencyPercent.textContent = `${getEfficiencyPercentage(stats)}%`;
    }
}

function getEfficiencyColor(percent) {
    if (percent >= 90) return 'linear-gradient(90deg, #2ecc71, #27ae60)';
    if (percent >= 75) return 'linear-gradient(90deg, #3498db, #2980b9)';
    if (percent >= 60) return 'linear-gradient(90deg, #f39c12, #e67e22)';
    return 'linear-gradient(90deg, #e74c3c, #c0392b)';
}

function showKitchenMessage(message) {
    const messageEl = document.getElementById('kitchenMessage');
    if (!messageEl) return;
    
    messageEl.innerHTML = `
        <div class="message-text">${message}</div>
        <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
    `;
    
    messageEl.classList.add('pulse');
    setTimeout(() => messageEl.classList.remove('pulse'), 1000);
}

function updateCounter(element, newValue) {
    if (!element) return;
    const current = parseInt(element.textContent) || 0;
    if (current !== newValue) {
        element.textContent = newValue;
        element.classList.add('counting');
        setTimeout(() => element.classList.remove('counting'), 300);
    }
}

function updateEfficiency(stats) {
    const total = stats.total || 0;
    const efficiency = total > 0 ? Math.min(98, 70 + Math.random() * 25) : 85;
    
    const efficiencyBar = document.getElementById('efficiencyBar');
    const efficiencyPercent = document.getElementById('efficiencyPercent');
    
    if (efficiencyBar) {
        efficiencyBar.style.width = `${efficiency}%`;
        efficiencyBar.style.background = getEfficiencyColor(efficiency);
    }
    
    if (efficiencyPercent) efficiencyPercent.textContent = `${efficiency}%`;
}

function startKitchenSimulation() {
    let messageIndex = 0;
    const kitchenMessages = [
        "All stations operating at optimal levels",
        "Fresh ingredients just arrived from local suppliers",
        "Chef is crafting your meal with precision focus",
        "Temperature control perfect for maximum flavor",
        "Your order is receiving personal attention",
        "Quality check passed - preparing for packaging",
        "Almost ready! Adding finishing touches",
        "Kitchen running at 98% efficiency today"
    ];
    
   // Show first message
    showKitchenMessage(kitchenMessages[0]);
    
    // Rotate every 5 minutes (300,000ms)
    setInterval(() => {
        const randomIndex = Math.floor(Math.random() * kitchenMessages.length);
        showKitchenMessage(kitchenMessages[randomIndex]);
    }, 15000); // 5 minutes
}


function handleAdminOrderVerified(order) {
    console.log(`✅ Admin verified order ${order.id} - updating kitchen...`);
    
    let kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{"orders": [], "stats": {}}');
    
    const existingOrder = kitchenData.orders?.find(o => o.id === order.id);
    if (existingOrder) {
        console.log(`ℹ️ Order ${order.id} already in kitchen`);
        return;
    }
    
    const kitchenOrder = {
        id: order.id,
        status: 'preparing',
        customerName: order.customerName,
        customerInitial: order.customerName?.charAt(0) || 'C',
        items: order.items || [],
        categories: order.itemCategories || (order.items || []).map(i => i.category),
        trackCode: `TRK-${order.id.slice(-6)}`,
        startedAt: new Date().toISOString(),
        timeline: {
            enteredKitchen: new Date().toISOString(),
            preparationStart: new Date().toISOString()
        }
    };
    
    if (!kitchenData.orders) kitchenData.orders = [];
    if (!kitchenData.stats) kitchenData.stats = {};
    
    kitchenData.orders.push(kitchenOrder);
    
    kitchenData.stats.preparing = (kitchenData.stats.preparing || 0) + 1;
    kitchenData.stats.total = (kitchenData.stats.total || 0) + 1;
    kitchenData.stats.lastUpdate = new Date().toISOString();
    
    localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
    
    console.log(`✅ Order ${order.id} added to kitchen queue`);
    
    // 🔥 ADD THIS LINE: Update timestamp for frequent checker
    updateKitchenLastUpdate();
    
    setTimeout(() => {
        updateKitchenPulse();
        showNotification(`Order ${order.id} verified - Kitchen is now preparing!`, 'success');
    }, 300);
}

function handleAdminStatusUpdate(data) {
    const { orderId, newStatus, oldStatus } = data;
    console.log(`🔄 Admin changed order ${orderId} from ${oldStatus} to ${newStatus}`);
    
    let kitchenData = JSON.parse(localStorage.getItem('cleanbite_kitchen') || '{"orders": [], "stats": {}}');
    
    if (!kitchenData.orders || !kitchenData.stats) {
        console.warn("❌ No kitchen data found");
        return;
    }
    
    const orderIndex = kitchenData.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
        console.warn(`❌ Order ${orderId} not found in kitchen`);
        return;
    }
    
    kitchenData.orders[orderIndex].status = newStatus;
    kitchenData.orders[orderIndex].lastUpdate = new Date().toISOString();
    
    if (oldStatus === 'preparing' && newStatus === 'cooking') {
        kitchenData.stats.preparing = Math.max(0, (kitchenData.stats.preparing || 1) - 1);
        kitchenData.stats.cooking = (kitchenData.stats.cooking || 0) + 1;
    } else if (oldStatus === 'cooking' && newStatus === 'ready') {
        kitchenData.stats.cooking = Math.max(0, (kitchenData.stats.cooking || 1) - 1);
        kitchenData.stats.ready = (kitchenData.stats.ready || 0) + 1;
    }
    
    kitchenData.stats.lastUpdate = new Date().toISOString();
    
    localStorage.setItem('cleanbite_kitchen', JSON.stringify(kitchenData));
    
    console.log(`✅ Kitchen updated: ${orderId} → ${newStatus}`);
    
    // 🔥 ADD THIS LINE: Update timestamp for frequent checker
    updateKitchenLastUpdate();
    
    setTimeout(() => {
        updateKitchenPulse();
        showNotification(`Order ${orderId} is now ${newStatus}`, 'info');
    }, 300);
}

// ==================== ORDER TRACKING ====================
function setupOrderTracking() {
    console.log('📍 Setting up order tracking...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    
    if (orderId) {
        trackSpecificOrder(orderId);
    }
    
    const trackForm = document.getElementById('trackOrderForm');
    if (trackForm) {
        trackForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const inputOrderId = document.getElementById('trackOrderInput').value.trim();
            if (inputOrderId) {
                trackSpecificOrder(inputOrderId);
            }
        });
    }
    
    const lastOrderId = localStorage.getItem('lastOrderId');
    if (lastOrderId) {
        console.log('📱 Active order found:', lastOrderId);
        showTrackingNotification(lastOrderId);
    }
}

function trackSpecificOrder(orderId) {
    console.log('🔍 Tracking order:', orderId);
    
    try {
        const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
        const order = orders.find(o => o.id === orderId);
        
        if (!order) {
            showTrackingResult(null, `Order ${orderId} not found`);
            return;
        }
        
        showTrackingResult(order);
        updateTrackingDisplay(order);
        
    } catch (error) {
        console.error('Tracking error:', error);
        showTrackingResult(null, 'Error tracking order');
    }
}

function showTrackingResult(order, error = null) {
    const trackingResult = document.getElementById('trackingResult');
    if (!trackingResult) return;
    
    if (error || !order) {
        trackingResult.innerHTML = `
            <div class="tracking-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Order Not Found</h4>
                <p>${error || 'Could not find this order. Please check your order ID.'}</p>
            </div>
        `;
        return;
    }
    
    const statusClass = getTrackingStatusClass(order);
    const statusText = getTrackingStatusText(order);
    const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    trackingResult.innerHTML = `
        <div class="tracking-success">
            <div class="tracking-header">
                <h4><i class="fas fa-box"></i> Order Tracking</h4>
                <div class="order-id">${order.id}</div>
            </div>
            
            <div class="tracking-status ${statusClass}">
                <i class="fas fa-${getTrackingStatusIcon(order)}"></i>
                <span>${statusText}</span>
            </div>
            
            <div class="tracking-details">
                <div class="detail">
                    <span class="label">Customer:</span>
                    <span class="value">${order.customerName}</span>
                </div>
                <div class="detail">
                    <span class="label">Order Date:</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="detail">
                    <span class="label">Total Amount:</span>
                    <span class="value">₦${order.totalAmount?.toLocaleString() || '0'}</span>
                </div>
                <div class="detail">
                    <span class="label">Payment Status:</span>
                    <span class="value ${order.paymentStatus === 'verified' ? 'verified' : 'pending'}">
                        ${order.paymentStatus === 'verified' ? 'Verified ✅' : 'Pending ⏳'}
                    </span>
                </div>
            </div>
            
            ${order.estimatedReady ? `
                <div class="tracking-estimate">
                    <i class="fas fa-clock"></i>
                    <span>Estimated Ready: <strong>${order.estimatedReady}</strong></span>
                </div>
            ` : ''}
            
            <div class="tracking-actions">
                <button onclick="window.location.href='/index.html'" class="btn-secondary">
                    <i class="fas fa-shopping-cart"></i> Order Again
                </button>
                <button onclick="printOrderDetails('${order.id}')" class="btn-primary">
                    <i class="fas fa-print"></i> Print Details
                </button>
            </div>
        </div>
    `;
}

function getTrackingStatusClass(order) {
    if (order.status === 'cancelled') return 'status-cancelled';
    if (order.paymentStatus === 'verified') return 'status-verified';
    if (order.paymentStatus === 'pending') return 'status-awaiting';
    if (order.status === 'preparing') return 'status-cooking';
    if (order.status === 'cooking') return 'status-cooking';
    if (order.status === 'ready') return 'status-ready';
    return 'status-awaiting';
}

function getTrackingStatusText(order) {
    if (order.status === 'cancelled') return 'Cancelled';
    if (order.paymentStatus === 'verified') return 'Payment Verified';
    if (order.paymentStatus === 'pending') return 'Awaiting Payment';
    if (order.status === 'preparing') return 'Preparing';
    if (order.status === 'cooking') return 'Cooking';
    if (order.status === 'ready') return 'Ready for Pickup';
    return 'Processing';
}

function getTrackingStatusIcon(order) {
    if (order.status === 'cancelled') return 'times-circle';
    if (order.paymentStatus === 'verified') return 'check-circle';
    if (order.paymentStatus === 'pending') return 'clock';
    if (order.status === 'preparing') return 'utensils';
    if (order.status === 'cooking') return 'fire';
    if (order.status === 'ready') return 'box-open';
    return 'info-circle';
}

function showTrackingNotification(orderId) {
    const lastNotification = localStorage.getItem('lastTrackingNotification');
    const now = Date.now();
    
    if (!lastNotification || (now - parseInt(lastNotification)) > 3600000) {
        showNotification(`Track your order #${orderId}`, 'info');
        localStorage.setItem('lastTrackingNotification', now.toString());
    }
}

// ==================== HELPER FUNCTIONS ====================
function generateOrderId() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `CB-${year}${month}${day}-${hours}${minutes}-${random}`;
}

function calculateReadyTime(minutes) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

function calculateCookingTime() {
    if (state.cart.length === 0) return 45;
    
    let longestTime = 0;
    state.cart.forEach(item => {
        const itemTime = CONFIG.cookingTimes[item.category] || 30;
        if (itemTime > longestTime) {
            longestTime = itemTime;
        }
    });
    
    return longestTime || 45;
}

function calculateTotal() {
    return state.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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

function getSavedCustomerInfo() {
    try {
        const customers = JSON.parse(localStorage.getItem('cleanbite_customers') || '[]');
        if (customers.length > 0) {
            return customers[customers.length - 1];
        }
    } catch (e) {
        console.error('Error loading customer info:', e);
    }
    return null;
}

// ==================== FIXED: showOrderConfirmation FUNCTION ====================
function showOrderConfirmation(orderId, readyTime) {
    console.log(`✅ Order ${orderId} confirmed, ready at ${readyTime}`);
    
    // Update confirmation modal elements
    const confirmedOrderId = document.getElementById('confirmedOrderId');
    const trackOrderLink = document.getElementById('trackOrderLink');
    const estimatedReadyTime = document.getElementById('estimatedReadyTime');
    
    // Set order ID
    if (confirmedOrderId) {
        confirmedOrderId.textContent = orderId;
    }
    
    // Set estimated ready time
    if (estimatedReadyTime && readyTime) {
        estimatedReadyTime.textContent = readyTime;
    }
    
    // 🔥 CRITICAL FIX: Set correct tracking link
    if (trackOrderLink) {
        // Create correct tracking URL
        const trackingUrl = `track.html?order=${orderId}`;
        trackOrderLink.href = trackingUrl;
        trackOrderLink.target = '_blank';
        trackOrderLink.rel = 'noopener noreferrer';
        
        console.log(`🔗 Tracking link set to: ${trackingUrl}`);
        
        // Add click handler to open in new tab
        trackOrderLink.onclick = function(e) {
            e.preventDefault();
            window.open(trackingUrl, '_blank', 'noopener,noreferrer');
            return false;
        };
    }
    
    // Close checkout modal
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.classList.remove('active');
    }
    
    // Show confirmation modal
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Save order ID for tracking
    localStorage.setItem('lastOrderId', orderId);
    localStorage.setItem('lastOrderTime', Date.now().toString());
    
    // Log success
    console.log(`📦 Order ${orderId} saved to localStorage`);
    console.log(`📱 Track at: track.html?order=${orderId}`);
    
    // Test the tracking link
    setTimeout(() => {
        const link = document.getElementById('trackOrderLink');
        if (link && link.href) {
            console.log(`🔍 Verification: Link href = ${link.href}`);
            console.log(`🔍 Verification: Contains order ID? ${link.href.includes(orderId)}`);
        }
    }, 500);
}

function testEmpireConnection(orderId) {
    console.log('=== EMPIRE CONNECTION TEST ===');
    
    setTimeout(() => {
        try {
            const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
            const savedOrder = orders.find(o => o.id === orderId);
            
            if (savedOrder) {
                console.log(`✅ Order ${orderId} is in EMPIRE system:`);
                console.log('   Customer:', savedOrder.customerName);
                console.log('   Amount: ₦' + savedOrder.totalAmount);
                console.log('   Payment Status:', savedOrder.paymentStatus);
                console.log('   Payment Method:', savedOrder.paymentMethod);
                console.log('   Status:', savedOrder.status);
                console.log('   Admin should see in: "Awaiting Verification"');
                
                const pendingOrders = orders.filter(o => 
                    o.paymentStatus === 'pending' && 
                    o.status !== 'cancelled'
                );
                console.log(`📊 Total pending orders: ${pendingOrders.length}`);
                
            } else {
                console.error(`❌ ERROR: Order ${orderId} not found in EMPIRE system`);
            }
        } catch (error) {
            console.error('Test error:', error);
        }
    }, 1000);
}

function verifyOrderSaved(orderId) {
    setTimeout(() => {
        try {
            const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
            const savedOrder = orders.find(o => o.id === orderId);
            
            if (savedOrder) {
                console.log(`🔍 VERIFICATION: Order ${orderId} successfully stored`);
                console.log('   Payment Status:', savedOrder.paymentStatus);
                console.log('   Admin can verify:', savedOrder.paymentStatus === 'pending');
            } else {
                console.error(`❌ VERIFICATION FAILED: Order ${orderId} not found`);
            }
        } catch (error) {
            console.error('Verification error:', error);
        }
    }, 500);
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(message, type = 'info') {
    // 🔥 ADD THIS CHECK: Don't show notifications when modals are open
    const activeModals = document.querySelectorAll('.modal.active, [class*="modal"].active');
    const orderDetailsModal = document.querySelector('.order-details-modal, .empire-order-details-modal');
    const statusUpdateModal = document.querySelector('.status-update-modal');
    
    // If ANY modal is active (except maybe checkout), skip notification
    if (activeModals.length > 0 || orderDetailsModal || statusUpdateModal) {
        console.log('🔇 Modal active, skipping notification:', message.substring(0, 50) + '...');
        return; // Don't show notification
    }
    
    // 🔥 Also check if checkout modal is NOT active (for form errors)
    const checkoutModal = document.getElementById('checkoutModal');
    const isCheckoutError = message.includes('fix the errors') || message.includes('form');
    
    if (isCheckoutError && (!checkoutModal || !checkoutModal.classList.contains('active'))) {
        console.log('🔇 Checkout form not active, skipping form error notification');
        return;
    }
    
    // Existing code continues...
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

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    if (elements.cartToggle) {
        elements.cartToggle.addEventListener('click', () => {
            if (elements.cartSidebar) elements.cartSidebar.classList.add('active');
            if (elements.cartOverlay) elements.cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    
    if (elements.cartClose) {
        elements.cartClose.addEventListener('click', closeCart);
    }
    
    if (elements.cartOverlay) {
        elements.cartOverlay.addEventListener('click', closeCart);
    }
    
    if (elements.checkoutBtn) {
        elements.checkoutBtn.addEventListener('click', openCheckout);
    }
    
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', () => {
            if (elements.checkoutModal) elements.checkoutModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }
    
    if (elements.backToCart) {
        elements.backToCart.addEventListener('click', () => {
            if (elements.checkoutModal) elements.checkoutModal.classList.remove('active');
            if (elements.cartSidebar) elements.cartSidebar.classList.add('active');
            if (elements.cartOverlay) elements.cartOverlay.classList.add('active');
        });
    }
    
    if (elements.orderForm) {
        elements.orderForm.addEventListener('submit', handleOrderSubmit);
    }
    
    if (elements.newOrderBtn) {
        elements.newOrderBtn.addEventListener('click', () => {
            if (elements.confirmationModal) {
                elements.confirmationModal.classList.remove('active');
            }
            document.body.style.overflow = 'auto';
            location.reload();
        });
    }
    
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

// ==================== CONFIRMATION MODAL ====================
function setupConfirmationModalListeners() {
    const closeBtn = document.getElementById('closeConfirmationBtn');
    const confirmationOverlay = document.getElementById('confirmationOverlay');
    const trackOrderLink = document.getElementById('trackOrderLink');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeConfirmationModal);
    }
    
    if (confirmationOverlay) {
        confirmationOverlay.addEventListener('click', closeConfirmationModal);
    }
    
    if (trackOrderLink) {
        trackOrderLink.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href) {
                window.open(href, '_blank');
                closeConfirmationModal();
            }
        });
    }
}

function closeConfirmationModal() {
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// ==================== CUSTOMER MESSAGING ====================
function saveCustomerForMessaging(customer) {
    try {
        const customers = JSON.parse(localStorage.getItem('cleanbite_customers') || '[]');
        
        const existingIndex = customers.findIndex(c => 
            c.phone === customer.phone || c.email === customer.email
        );
        
        if (existingIndex > -1) {
            customers[existingIndex].lastOrder = new Date().toISOString();
            customers[existingIndex].orderCount += 1;
        } else {
            customers.push({
                ...customer,
                firstOrder: new Date().toISOString(),
                lastOrder: new Date().toISOString(),
                orderCount: 1
            });
        }
        
        localStorage.setItem('cleanbite_customers', JSON.stringify(customers));
        console.log('✅ Customer saved:', customer.name);
        
    } catch (error) {
        console.error('Error saving customer:', error);
    }
}

// ==================== CUSTOMER MESSAGING SYSTEM ====================
// Add this RIGHT AFTER the existing saveCustomerForMessaging function
function initCustomerMessaging() {
    console.log('📱 Initializing Customer Messaging System...');
    
    if (!window.customerMessagingManager) {
        window.customerMessagingManager = new CustomerMessagingSystem();
        window.customerMessagingManager.initScheduler();
        
        // Integrate with existing order system
        overrideOrderFunctions();
        
        console.log('✅ Customer Messaging System ready');
        return window.customerMessagingManager;
    }
    
    return window.customerMessagingManager;
}

// Add this function RIGHT BEFORE the init() function
function overrideOrderFunctions() {
    // Store original function
    const originalSaveOrderEmpireFormat = window.saveOrderEmpireFormat;
    
    if (originalSaveOrderEmpireFormat) {
        window.saveOrderEmpireFormat = function(orderData) {
            const orderId = originalSaveOrderEmpireFormat.call(this, orderData);
            
            // Add customer to messaging system
            if (window.customerMessagingManager && orderData.customerName) {
                window.customerMessagingManager.addOrUpdateCustomer(orderData);
            }
            
            return orderId;
        };
    }
    
    console.log('✅ Messaging system integrated with order system');
}



// ==================== INVOICE GENERATION ====================
function generateProperInvoice(orderData) {
    console.log('📄 Generating EMPIRE invoice for order:', orderData.orderId);
    
    const invoiceDate = new Date().toLocaleString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Lagos'
    });
    
    // ============ 🔥 FIXED SECTION - CORRECT COOKING TIME ============
    // Calculate actual cooking time based on items
    const cart = orderData.items || [];
    let longestTime = 0;
    cart.forEach(item => {
        const itemTime = CONFIG.cookingTimes[item.category] || 30;
        if (itemTime > longestTime) {
            longestTime = itemTime;
        }
    });
    
    const cookingTime = longestTime || 45;
    const formattedTime = formatCookingTime(cookingTime);
    // ============ 🔥 END FIX ============
    
    const invoice = {
        invoiceId: `INV-${Date.now()}`,
        orderId: orderData.orderId,
        customerName: orderData.customerName,
        items: orderData.items,
        totalAmount: orderData.totalAmount,
        bankDetails: {
            name: 'CARBON MICRO FINANCE BANK',
            bank: 'Emmanuel Osabolu Okpere',
            account: '3034457406',
            note: `Transfer with reference: ${orderData.orderId}`
        },
        invoiceDate: invoiceDate,
        estimatedReady: formattedTime // Use calculated formatted time
    };
    
    saveInvoiceToStorage(invoice);
    
    const invoiceHTML = generateInvoiceHTML(invoice);
    const invoiceWindow = window.open('', '_blank');
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
    
    return invoice;
}

function generateInvoiceHTML(invoice) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>INVOICE - CLEANBITE EMPIRE</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: #0a0a0a; 
                    color: white;
                }
                .invoice-container { 
                    max-width: 800px; 
                    margin: 0 auto; 
                    background: #111; 
                    padding: 30px; 
                    border: 1px solid #333;
                }
                .empire-header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #ffd700; 
                    padding-bottom: 20px; 
                }
                .empire-header h1 { 
                    color: #ffd700; 
                    margin: 0; 
                    font-size: 2.5rem;
                }
                .payment-section { 
                    background: #1a1a1a; 
                    padding: 20px; 
                    margin: 20px 0; 
                    border-left: 4px solid #ffd700;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 20px 0; 
                }
                th { 
                    background: #222; 
                    color: #ffd700; 
                    padding: 12px; 
                    text-align: left; 
                }
                td { 
                    padding: 12px; 
                    border-bottom: 1px solid #333; 
                }
                .total-row { 
                    font-weight: bold; 
                    font-size: 1.2em; 
                    background: #1a1a1a; 
                }
                .footer { 
                    text-align: center; 
                    margin-top: 40px; 
                    color: #888; 
                    font-size: 0.9em; 
                }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="empire-header">
                    <h1>🏛️ CLEANBITE EMPIRE</h1>
                    <p>INVOICE: ${invoice.invoiceId}</p>
                    <p>Order: ${invoice.orderId}</p>
                </div>
                
                <div class="payment-section">
                    <h3><i class="fas fa-university"></i> EMPIRE PAYMENT DETAILS</h3>
                    <p><strong>Bank:</strong> ${invoice.bankDetails.bank}</p>
                    <p><strong>Account Name:</strong> ${invoice.bankDetails.name}</p>
                    <p><strong>Account Number:</strong> ${invoice.bankDetails.account}</p>
                    <p><strong>Reference:</strong> ${invoice.orderId}</p>
                    <p><strong>Amount:</strong> ₦${invoice.totalAmount.toLocaleString()}</p>
                    <p><em>${invoice.bankDetails.note}</em></p>
                </div>
                
                <h3>Order Summary</h3>
                <table>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                    ${invoice.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>₦${item.price.toLocaleString()}</td>
                            <td>₦${(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="3">TOTAL AMOUNT</td>
                        <td>₦${invoice.totalAmount.toLocaleString()}</td>
                    </tr>
                </table>
                
                <div class="footer">
                    <p><i class="fas fa-shield-alt"></i> Sovereignty starts on your plate.</p>
                    <p>Bring this invoice to pickup location.</p>
                    <p>Estimated Ready: ${invoice.estimatedReady}</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function saveInvoiceToStorage(invoice) {
    try {
        const invoices = JSON.parse(localStorage.getItem('cleanbite_invoices') || '[]');
        invoices.push({
            ...invoice,
            savedAt: new Date().toISOString(),
            status: 'pending'
        });
        
        localStorage.setItem('cleanbite_invoices', JSON.stringify(invoices));
        console.log(`📁 Invoice ${invoice.invoiceId} saved to storage`);
    } catch (error) {
        console.error('Error saving invoice:', error);
    }
}

// ==================== UTILITY FUNCTIONS ====================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function checkActiveOrder() {
    const orderId = localStorage.getItem('lastOrderId');
    const orderTime = localStorage.getItem('lastOrderTime');
    
    if (orderId && orderTime) {
        setTimeout(() => {
            showNotification(`Tracking order #${orderId}`, 'info');
        }, 3000);
    }
}

function initVisualEffects() {
    updateKitchenStatus();
}

function updateKitchenStatus() {
    const now = new Date();
    const hours = now.getHours();
    const isOpen = hours >= CONFIG.businessHours.open && hours < CONFIG.businessHours.close;
    
    const statusElement = document.getElementById('kitchenStatus');
    if (statusElement) {
        statusElement.innerHTML = `Kitchen: <strong>${isOpen ? 'Open' : 'Closed'}</strong> • ${isOpen ?
            'Orders accepted' : 'Opens at 8AM'}`;
    }
}

// ==================== 🔥 CRITICAL SYNC FUNCTION: MESSAGING SYSTEM INTEGRATION ====================
function initMessagingSystem() {
    console.log("📡 Initializing messaging system for admin-kitchen sync...");
    
    try {
        // Setup listener for admin broadcasts
        setupMessagingListener();
        
        // Add order verification trigger
        addOrderVerificationTrigger();
        
        console.log("🏛️ EMPIRE MESSAGING SYSTEM READY FOR ADMIN SYNC");
        
    } catch (error) {
        console.error("❌ Failed to initialize messaging system:", error);
    }
}

function setupMessagingListener() {
    console.log("📡 Setting up messaging listener for admin sync...");
    
    // Listen for messages from admin
    if (typeof BroadcastChannel !== 'undefined') {
        const messagingChannel = new BroadcastChannel('cleanbite_messaging');
        
        messagingChannel.onmessage = (event) => {
            console.log("📨 Messaging broadcast received:", event.data);
            
            if (event.data.type === 'PAYMENT_VERIFIED' && window.customerMessagingManager) {
                console.log("💰 Payment verification received from admin, sending notification...");
                
                // Create order object for messaging
                const order = {
                    id: event.data.orderId,
                    customerName: event.data.customerName,
                    customerPhone: event.data.customerPhone,
                    customerEmail: event.data.customerEmail,
                    totalAmount: event.data.orderAmount,
                    verifiedAt: event.data.verifiedAt
                };
                
                // Trigger notification
                window.customerMessagingManager.notifyPaymentVerified(order);
            }
            
            if (event.data.type === 'ORDER_STATUS_CHANGE') {
                console.log("📦 Order status change received from admin:", event.data);
                
                // Update kitchen display
                setTimeout(() => {
                    updateKitchenPulse();
                }, 500);
                
                // Show notification to customer
                if (event.data.customerName) {
                    showNotification(`Order ${event.data.orderId} is now ${event.data.newStatus}`, 'info');
                }
            }
        };
        
        console.log("✅ Messaging listener active for admin sync");
    }
}

// ==================== UTILITY FUNCTIONS ====================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function checkActiveOrder() {
    const orderId = localStorage.getItem('lastOrderId');
    const orderTime = localStorage.getItem('lastOrderTime');
    
    if (orderId && orderTime) {
        setTimeout(() => {
            showNotification(`Tracking order #${orderId}`, 'info');
        }, 3000);
    }
}

function initVisualEffects() {
    updateKitchenStatus();
}

function updateKitchenStatus() {
    const now = new Date();
    const hours = now.getHours();
    const isOpen = hours >= CONFIG.businessHours.open && hours < CONFIG.businessHours.close;
    
    const statusElement = document.getElementById('kitchenStatus');
    if (statusElement) {
        statusElement.innerHTML = `Kitchen: <strong>${isOpen ? 'Open' : 'Closed'}</strong> • ${isOpen ?
            'Orders accepted' : 'Opens at 8AM'}`;
    }
}

// ==================== KITCHEN UPDATE TIMESTAMP ====================
// Add to customer.js (already exists in kitchen script, but ensure it's consistent)
function updateKitchenLastUpdate() {
    const now = Date.now();
    localStorage.setItem('kitchen_last_update', now.toString());
    
    // Also update the last verified update for the frequent checker
    localStorage.setItem('kitchen_last_verified_update', now.toString());
    
    console.log('⏱️ Kitchen update timestamp:', new Date(now).toLocaleTimeString());
}

// Add to customer.js
function broadcastOrderUpdate(orderId) {
    console.log(`📡 Broadcasting order update: ${orderId}`);
    
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            // Get order data
            const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                console.log(`❌ Order ${orderId} not found for broadcast`);
                return;
            }
            
            // Broadcast to kitchen channel
            const kitchenChannel = new BroadcastChannel('cleanbite_kitchen');
            kitchenChannel.postMessage({
                type: 'ORDER_UPDATED',
                orderId: orderId,
                order: order,
                timestamp: Date.now(),
                source: 'customer_update'
            });
            
            // Broadcast to orders channel
            const ordersChannel = new BroadcastChannel('cleanbite_orders');
            ordersChannel.postMessage({
                type: 'ORDER_STATUS_CHANGED',
                orderId: orderId,
                status: order.status,
                timestamp: Date.now()
            });
            
            console.log(`✅ Order ${orderId} update broadcasted`);
            
            // Clean up
            setTimeout(() => {
                kitchenChannel.close();
                ordersChannel.close();
            }, 100);
            
        } catch (error) {
            console.error('Broadcast error:', error);
        }
    }
}

function addOrderVerificationTrigger() {
    console.log("🔗 Adding order verification trigger...");
    
    // Override saveOrderEmpireFormat to add sync trigger
    const originalSaveOrderEmpireFormat = window.saveOrderEmpireFormat;
    
    if (originalSaveOrderEmpireFormat) {
        window.saveOrderEmpireFormat = function(orderData) {
            const orderId = originalSaveOrderEmpireFormat.call(this, orderData);
            
            if (orderId) {
                // Set flag for admin to detect
                localStorage.setItem('empire_new_order_flag', Date.now().toString());
                
                // Log for debugging
                console.log(`📢 Order ${orderId} ready for admin verification sync`);
                
                // Test if admin can see it
                setTimeout(() => {
                    const orders = JSON.parse(localStorage.getItem('cleanbite_orders') || '[]');
                    const savedOrder = orders.find(o => o.id === orderId);
                    if (savedOrder) {
                        console.log(`✅ Order ${orderId} saved correctly:`, {
                            paymentStatus: savedOrder.paymentStatus,
                            status: savedOrder.status,
                            adminShouldSee: savedOrder.paymentStatus === 'pending' ? 'YES in verification queue' : 'NO'
                        });
                    }
                }, 1000);
            }
            
            return orderId;
        };
        
        console.log("✅ Order verification trigger added");
    }
}

// ==================== START APPLICATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; }
        }
        .kitchen-message.pulse {
            animation: pulse 1s ease;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    init();
});


// ==================== EXPORT CRITICAL FUNCTIONS ====================
window.cleanbiteEmpire = {
    // Order management
    saveOrderEmpireFormat: saveOrderEmpireFormat,
    generateOrderId: generateOrderId,
    
    // Kitchen sync
    updateKitchenPulse: updateKitchenPulse,
    updateKitchenDisplay: updateKitchenDisplay,
    
    // Notification
    showNotification: showNotification,
    
    // Sync helpers
    broadcastNewOrderToAdmin: broadcastNewOrderToAdmin,
    handleAdminOrderVerified: handleAdminOrderVerified,
    handleAdminStatusUpdate: handleAdminStatusUpdate
};

console.log("🏛️ CLEANBITE EMPIRE SCRIPT LOADED WITH COMPLETE SYNC SYSTEM");