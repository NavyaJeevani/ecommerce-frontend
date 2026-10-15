const API_BASE_URL = 'http://localhost:8090/rest/api/v1/catalogues';
const CART_API_URL = "http://localhost:8090/api/cart";
const ORDER_API_URL = "http://localhost:8090/api/orders";

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Auth Header & Cart Badge State
  updateAuthHeader();

  // Initialize Category Navigation and Product Grid if on index page
  if (document.getElementById('categoryBar')) {
    loadCategories();
    loadAllProducts();
  }
});

/**
 * Helper to get active user ID (checks localStorage first, falls back to input or default ID 1)
 */
function getCurrentUserId() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (currentUser && currentUser.id) return currentUser.id;
  
  const userInput = document.getElementById("activeUserId");
  return userInput ? userInput.value : 1;
}

/**
 * Check localStorage for logged-in user and update header actions accordingly
 */
function updateAuthHeader() {
  const headerActions = document.querySelector('.header-actions') || document.getElementById('authHeader');
  if (!headerActions) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Always include the Amazon/Flipkart-style Cart button
  const cartButtonHtml = `
    <a href="cart.html" class="btn-cart-nav">
      🛒 Cart <span id="cartCountBadge" class="cart-badge">0</span>
    </a>
  `;

  if (currentUser && currentUser.firstName) {
    headerActions.innerHTML = `
      ${cartButtonHtml}
      <span style="font-weight: 600; color: #333; margin-left: 8px; margin-right: 8px;">Hi, ${currentUser.firstName}</span>
      <button id="logoutBtn" class="btn-auth" style="background-color: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 600;">Sign Out</button>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      alert('You have been signed out.');
      window.location.reload();
    });
  } else {
    headerActions.innerHTML = `
      ${cartButtonHtml}
      <a href="signin.html" class="btn-auth btn-signin">Sign In</a>
      <a href="signup.html" class="btn-auth btn-signup">Sign Up</a>
    `;
  }

  // Fetch initial cart badge count
  updateCartBadgeCount();
}

/**
 * Fetch and update cart badge quantity counter
 */
async function updateCartBadgeCount() {
  const badge = document.getElementById("cartCountBadge");
  if (!badge) return;

  const userId = getCurrentUserId();
  try {
    const response = await fetch(`${CART_API_URL}/${userId}`);
    if (response.ok) {
      const items = await response.json();
      const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
      badge.textContent = totalCount;
    }
  } catch (error) {
    console.error("Could not load cart count badge", error);
  }
}

/**
 * Fetch categories and render main parent categories with click-to-toggle dropdowns
 */
async function loadCategories() {
  const categoryBar = document.getElementById('categoryBar');
  if (!categoryBar) return;

  try {
    const response = await fetch(`${API_BASE_URL}/categories`);
    if (!response.ok) throw new Error('Failed to load categories');

    const categories = await response.json();

    const getParentId = (cat) => {
      if (cat.parentId !== undefined) return cat.parentId;
      if (cat.parent_id !== undefined) return cat.parent_id;
      if (cat.parent && cat.parent.id !== undefined) return cat.parent.id;
      return null;
    };

    const mainCategories = categories.filter(cat => getParentId(cat) === null);
    categoryBar.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'cat-btn active';
    allBtn.textContent = 'All Products';
    allBtn.onclick = function () {
      closeAllDropdowns();
      loadAllProducts(this);
    };
    categoryBar.appendChild(allBtn);

    mainCategories.forEach(parent => {
      const subcategories = categories.filter(c => {
        const pId = getParentId(c);
        return pId === parent.id || pId === Number(parent.id);
      });

      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'nav-dropdown';

      const parentBtn = document.createElement('button');
      parentBtn.className = 'cat-btn parent-btn';
      parentBtn.innerHTML = `${parent.name} <span class="arrow">▾</span>`;

      dropdownContainer.appendChild(parentBtn);

      if (subcategories.length > 0) {
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';

        subcategories.forEach(sub => {
          const subItem = document.createElement('a');
          subItem.href = '#';
          subItem.textContent = sub.name;
          subItem.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeAllDropdowns();
            filterByCategory(sub.id, sub.name, parentBtn);
          };
          dropdownMenu.appendChild(subItem);
        });

        dropdownContainer.appendChild(dropdownMenu);

        parentBtn.onclick = function (e) {
          e.stopPropagation();
          const isOpen = dropdownMenu.classList.contains('show');
          closeAllDropdowns();

          if (!isOpen) {
            dropdownMenu.classList.add('show');
            parentBtn.classList.add('open');
          }

          filterByCategory(parent.id, parent.name, this);
        };
      } else {
        parentBtn.onclick = function () {
          closeAllDropdowns();
          filterByCategory(parent.id, parent.name, this);
        };
      }

      categoryBar.appendChild(dropdownContainer);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-dropdown')) {
        closeAllDropdowns();
      }
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    categoryBar.innerHTML = '<p style="color: red;">Failed to load categories.</p>';
  }
}

/**
 * Utility to close all open subcategory dropdown menus
 */
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
  document.querySelectorAll('.parent-btn').forEach(btn => btn.classList.remove('open'));
}

/**
 * Fetch all active products
 */
async function loadAllProducts(clickedBtn) {
  if (clickedBtn) setActiveButton(clickedBtn);

  const title = document.getElementById('sectionTitle');
  if (title) title.textContent = 'All Products';

  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = '<p>Loading products...</p>';

  try {
    const response = await fetch(`${API_BASE_URL}/viewall`);
    if (!response.ok) throw new Error('Failed to load products');

    const products = await response.json();

    const isLandingPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
    const productsToDisplay = isLandingPage ? products.slice(0, 8) : products;

    renderProducts(productsToDisplay);
  } catch (error) {
    console.error('Error loading products:', error);
    grid.innerHTML = '<p style="color: red;">Unable to connect to backend server.</p>';
  }
}

/**
 * Filter products by category ID
 */
async function filterByCategory(categoryId, categoryName, clickedBtn) {
  if (clickedBtn) setActiveButton(clickedBtn);

  const title = document.getElementById('sectionTitle');
  if (title) title.textContent = categoryName;

  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = `<p>Loading ${categoryName}...</p>`;

  try {
    const response = await fetch(`${API_BASE_URL}/categories/${categoryId}/products`);
    if (!response.ok) throw new Error('Failed to load category products');

    const products = await response.json();

    const isLandingPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
    const productsToDisplay = isLandingPage ? products.slice(0, 8) : products;

    renderProducts(productsToDisplay);
  } catch (error) {
    console.error('Error loading category products:', error);
    grid.innerHTML = '<p style="color: red;">Failed to load products for this category.</p>';
  }
}

/**
 * Helper to render product array into card grid with Add to Cart & Buy Now action buttons
 */
function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  if (!products || products.length === 0) {
    grid.innerHTML = '<p>No products available in this category.</p>';
    return;
  }

  grid.innerHTML = products.map(product => {
    const rawImageUrl = product.imageUrl || product.image_url;
    const imageSrc = rawImageUrl || 'https://via.placeholder.com/400?text=No+Image';

    const numericPrice = (product.price !== null && product.price !== undefined) ? Number(product.price) : 499.00;
    const displayPrice = `₹${numericPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const safeProductName = (product.name || 'Product').replace(/'/g, "\\'");

    return `
      <div class="product-card">
        <div>
          <div class="img-container">
            <img 
              src="${imageSrc}" 
              alt="${product.name}" 
              onerror="this.onerror=null; this.src='https://via.placeholder.com/400?text=Image+Unavailable';"
            />
          </div>
          <span class="brand">${product.brand || 'Generic'}</span>
          <h4 title="${product.name}">${product.name}</h4>
          <p>${product.description || 'No description available.'}</p>
        </div>
        <div>
          <div class="price">${displayPrice}</div>
          <div class="product-actions" style="display: flex; gap: 8px; margin-top: 10px;">
            <button onclick="handleAddToCart(${product.id})" class="btn-cart" style="flex: 1; background-color: #27ae60; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: 600;">Add to Cart</button>
            <button onclick="handleBuyNow(${product.id}, '${safeProductName}', ${numericPrice})" class="btn-buynow" style="flex: 1; background-color: #2980b9; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: 600;">Buy Now</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Utility to switch active status on category filter buttons
 */
function setActiveButton(activeBtn) {
  const buttons = document.querySelectorAll('.cat-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  if (activeBtn) activeBtn.classList.add('active');
}

/**
 * 1. Add to Cart Handler (POST /api/cart/add)
 */
async function handleAddToCart(productId) {
  const userId = getCurrentUserId();
  const quantity = 1;

  try {
    const response = await fetch(`${CART_API_URL}/add?userId=${userId}&productId=${productId}&quantity=${quantity}`, {
      method: "POST"
    });

    if (!response.ok) throw new Error("Failed to add item to cart.");

    alert(`Success! Product added to your cart.`);
    updateCartBadgeCount();
  } catch (error) {
    console.error("Cart error:", error);
    alert("Could not add item to cart. Make sure your Spring Boot backend is running.");
  }
}

/**
 * 2. Buy Now Handler - Saves details to localStorage and redirects to checkout.html
 */
function handleBuyNow(productId, productName, price) {
  const userId = getCurrentUserId();
  const quantity = 1;

  // Save product details temporarily for checkout.html form processing
  localStorage.setItem('buyNowProductId', productId);
  localStorage.setItem('buyNowProductName', productName);
  localStorage.setItem('buyNowPrice', price);
  localStorage.setItem('buyNowQuantity', quantity);
  localStorage.setItem('buyNowUserId', userId);

  // Smoothly navigate to the dedicated checkout page
  window.location.href = "checkout.html";
}

/**
 * 3. Load Cart Items for `cart.html`
 */
async function loadCartItems() {
  const listContainer = document.getElementById('cartItemsList');
  const summarySection = document.getElementById('cartSummarySection');
  if (!listContainer) return;

  const userId = getCurrentUserId();
  listContainer.innerHTML = '<p>Loading cart items...</p>';

  try {
    const response = await fetch(`${CART_API_URL}/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch cart items");

    const items = await response.json();

    if (!items || items.length === 0) {
      listContainer.innerHTML = '<p>Your cart is empty.</p>';
      if (summarySection) summarySection.style.display = 'none';
      updateCartBadgeCount();
      return;
    }

    let totalPrice = 0;

    listContainer.innerHTML = items.map(item => {
      const itemTotal = (item.price || 499.00) * item.quantity;
      totalPrice += itemTotal;

      return `
        <div class="cart-item">
          <div class="cart-item-details">
            <img src="${item.imageUrl || 'https://via.placeholder.com/150'}" alt="Product" onerror="this.src='https://via.placeholder.com/150'">
            <div>
              <h4 style="margin: 0 0 5px 0;">Product ID: ${item.productId}</h4>
              <p style="margin: 0; color: #6c757d; font-size: 14px;">Quantity: ${item.quantity} | Price: ₹${item.price || 499.00}</p>
            </div>
          </div>
          <div>
            <span style="font-weight: bold; margin-right: 15px;">₹${itemTotal.toFixed(2)}</span>
            <button onclick="handleRemoveFromCart(${item.productId})" class="btn-remove">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    const totalEl = document.getElementById('cartTotalPrice');
    if (totalEl) totalEl.textContent = `₹${totalPrice.toFixed(2)}`;
    if (summarySection) summarySection.style.display = 'block';

    updateCartBadgeCount();
  } catch (error) {
    console.error("Error loading cart items:", error);
    listContainer.innerHTML = '<p style="color: red;">Failed to load cart items from server.</p>';
    if (summarySection) summarySection.style.display = 'none';
  }
}

/**
 * 4. Remove Item from Cart Handler (DELETE /api/cart/remove)
 */
async function handleRemoveFromCart(productId) {
  const userId = getCurrentUserId();

  try {
    const response = await fetch(`${CART_API_URL}/remove?userId=${userId}&productId=${productId}`, {
      method: "DELETE"
    });

    if (!response.ok) throw new Error("Failed to remove item from cart.");

    alert("Item removed from cart successfully!");
    loadCartItems(); // Reload list
  } catch (error) {
    console.error("Remove cart error:", error);
    alert("Could not remove item from cart.");
  }
}

/**
 * 5. Checkout Cart Items redirection
 */
function handleCheckout() {
  window.location.href = "checkout.html";
}