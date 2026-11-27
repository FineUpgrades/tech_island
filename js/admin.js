// Tech Island Admin Dashboard Logic
// 100% Free Spark Plan Compatible (No Blaze Plan or Credit Card Required)

import {
  isFirebaseConfigured,
  loginAdmin,
  logoutAdmin,
  onAdminAuthChange,
  getProductsFromDb,
  addProductToDb,
  updateProductInDb,
  deleteProductFromDb,
  compressImageToDataUrl,
  seedInitialProducts
} from "./firebase-config.js";

(() => {
  "use strict";

  // Persistent Elements (Available in unauthenticated DOM)
  const configWarning = document.getElementById("config-warning");
  const loginSection = document.getElementById("login-section");
  const authActions = document.getElementById("auth-actions");
  const adminUserEmail = document.getElementById("admin-user-email");
  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginAlert = document.getElementById("login-alert");
  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const dashboardMount = document.getElementById("dashboard-mount");
  const dashboardTpl = document.getElementById("dashboard-tpl");
  const toastContainer = document.getElementById("toast-container");

  // Dynamic Elements (Bound after dashboard template mounting)
  let statTotal, statStandard, statSublime, statCategories;
  let searchInput, categoryFilter, tbody, noProductsMsg, seedBtn;
  let productModal, modalHeading, productForm, editProductId, existingImageUrl;
  let productNameInput, productCategoryInput, productDescInput;
  let productImageFileInput, productImageManualInput, productIsSublime;
  let specsContainer, addSpecRowBtn, uploadZone, uploadPrompt, imagePreview;
  let openAddModalBtn, emptyAddBtn, modalCloseBtn, modalCancelBtn, saveProductBtn;
  let deleteModal, deleteProductName, deleteCloseBtn, deleteCancelBtn, confirmDeleteBtn;

  // State
  let currentProducts = [];
  let selectedFile = null;
  let productToDelete = null;

  // 1. Check Configuration Status
  if (configWarning && !isFirebaseConfigured()) {
    configWarning.style.display = "flex";
  }

  // 2. Auth State Listener
  onAdminAuthChange(async (user) => {
    if (user) {
      if (loginSection) loginSection.style.display = "none";
      if (authActions) authActions.style.display = "flex";
      if (adminUserEmail) adminUserEmail.textContent = user.email || "Admin";

      // Instantiate and mount dashboard from template
      mountDashboard();
      await loadProducts();
    } else {
      unmountDashboard();
      if (loginSection) loginSection.style.display = "block";
      if (authActions) authActions.style.display = "none";
      if (adminUserEmail) adminUserEmail.textContent = "";
    }
  });

  // 3. Login Action
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginAlert.style.display = "none";
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = "Signing In…";

      try {
        await loginAdmin(loginEmail.value.trim(), loginPassword.value);
        showToast("Welcome back, Admin!", "success");
      } catch (err) {
        console.error("Login failed:", err);
        loginAlert.textContent = formatAuthError(err.message);
        loginAlert.style.display = "block";
      } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = "Sign In";
      }
    });
  }

  // 4. Logout Action
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await logoutAdmin();
        showToast("Signed out successfully.", "info");
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }

  // 5. Template Mount & Unmount
  function mountDashboard() {
    if (!dashboardMount || !dashboardTpl) return;
    dashboardMount.replaceChildren(dashboardTpl.content.cloneNode(true));
    attachDashboardBindings();
  }

  function unmountDashboard() {
    if (dashboardMount) {
      dashboardMount.replaceChildren();
    }
    currentProducts = [];
    selectedFile = null;
    productToDelete = null;
  }

  // 6. Bind Elements and Events after Mount
  function attachDashboardBindings() {
    statTotal = document.getElementById("stat-total");
    statStandard = document.getElementById("stat-standard");
    statSublime = document.getElementById("stat-sublime");
    statCategories = document.getElementById("stat-categories");
    searchInput = document.getElementById("admin-search");
    categoryFilter = document.getElementById("admin-category-filter");
    tbody = document.getElementById("products-tbody");
    noProductsMsg = document.getElementById("no-products-msg");
    seedBtn = document.getElementById("seed-btn");

    productModal = document.getElementById("product-modal");
    modalHeading = document.getElementById("modal-heading");
    productForm = document.getElementById("product-form");
    editProductId = document.getElementById("edit-product-id");
    existingImageUrl = document.getElementById("existing-image-url");
    productNameInput = document.getElementById("product-name");
    productCategoryInput = document.getElementById("product-category");
    productDescInput = document.getElementById("product-desc");
    productImageFileInput = document.getElementById("product-image-file");
    productImageManualInput = document.getElementById("product-image-url-manual");
    productIsSublime = document.getElementById("product-is-sublime");
    specsContainer = document.getElementById("specs-container");
    addSpecRowBtn = document.getElementById("add-spec-row-btn");
    uploadZone = document.getElementById("upload-zone");
    uploadPrompt = document.getElementById("upload-prompt");
    imagePreview = document.getElementById("image-preview");
    openAddModalBtn = document.getElementById("open-add-modal-btn");
    emptyAddBtn = document.getElementById("empty-add-btn");
    modalCloseBtn = document.getElementById("modal-close-btn");
    modalCancelBtn = document.getElementById("modal-cancel-btn");
    saveProductBtn = document.getElementById("save-product-btn");

    deleteModal = document.getElementById("delete-modal");
    deleteProductName = document.getElementById("delete-product-name");
    deleteCloseBtn = document.getElementById("delete-close-btn");
    deleteCancelBtn = document.getElementById("delete-cancel-btn");
    confirmDeleteBtn = document.getElementById("confirm-delete-btn");

    if (searchInput) searchInput.addEventListener("input", renderTable);
    if (categoryFilter) categoryFilter.addEventListener("change", renderTable);

    if (openAddModalBtn) openAddModalBtn.addEventListener("click", openAddModal);
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", openAddModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
    if (productModal) {
      productModal.addEventListener("click", (e) => {
        if (e.target === productModal) closeModal();
      });
    }

    if (addSpecRowBtn) {
      addSpecRowBtn.addEventListener("click", () => addSpecRow());
    }

    if (uploadZone) {
      uploadZone.addEventListener("click", () => productImageFileInput.click());
      uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = "var(--green)";
      });
      uploadZone.addEventListener("dragleave", () => {
        uploadZone.style.borderColor = "var(--line)";
      });
      uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = "var(--line)";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (productImageFileInput) {
      productImageFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageFile(e.target.files[0]);
        }
      });
    }

    if (productForm) {
      productForm.addEventListener("submit", handleProductSave);
    }

    if (deleteCloseBtn) deleteCloseBtn.addEventListener("click", closeDeleteModal);
    if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", closeDeleteModal);
    if (deleteModal) {
      deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) closeDeleteModal();
      });
    }

    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener("click", handleConfirmDelete);
    }

    if (seedBtn) {
      seedBtn.addEventListener("click", handleSeedData);
    }
  }

  // 7. Load Products from Database
  async function loadProducts() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--muted);">Loading products…</td></tr>`;
    try {
      const data = await getProductsFromDb();
      if (data && data.length > 0) {
        currentProducts = data;
        if (seedBtn) seedBtn.style.display = "none"; // Database populated
      } else {
        currentProducts = [];
        if (seedBtn) seedBtn.style.display = "inline-flex";
      }
      renderTable();
    } catch (err) {
      console.error("Error loading products:", err);
      showToast("Error loading products from database.", "danger");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--danger);">Failed to load products. Check Firestore rules.</td></tr>`;
      }
    }
  }

  // 8. Render Table & Statistics
  function renderTable() {
    if (!tbody || !statTotal) return;

    const query = (searchInput?.value || "").trim().toLowerCase();
    const cat = categoryFilter?.value || "";

    const filtered = currentProducts.filter((p) => {
      const matchesSearch = !query || 
        (p.name && p.name.toLowerCase().includes(query)) || 
        (p.description && p.description.toLowerCase().includes(query));
      const matchesCategory = !cat || p.category === cat;
      return matchesSearch && matchesCategory;
    });

    // Update Stats
    statTotal.textContent = currentProducts.length;
    statStandard.textContent = currentProducts.filter(p => !p.isSublime).length;
    statSublime.textContent = currentProducts.filter(p => p.isSublime).length;
    
    const uniqueCats = new Set(currentProducts.map(p => p.category));
    statCategories.textContent = uniqueCats.size;

    // Table Content
    if (filtered.length === 0) {
      tbody.innerHTML = "";
      if (noProductsMsg) noProductsMsg.style.display = "block";
      return;
    }

    if (noProductsMsg) noProductsMsg.style.display = "none";
    tbody.innerHTML = filtered
      .map((product) => {
        const imgSrc = resolveImageSrc(product.imageUrl || product.image);
        return `
          <tr data-id="${product.id}">
            <td>
              <img src="${imgSrc}" class="product-thumb" alt="${escapeHtml(product.name)}" onerror="this.src='../assets/logo.png';" />
            </td>
            <td>
              <div class="product-title-cell">${escapeHtml(product.name)}</div>
              ${product.isSublime ? `<span style="font-size: 10px; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">Sublime Series</span>` : ""}
            </td>
            <td>
              <span class="category-tag">${escapeHtml(product.category || "General")}</span>
            </td>
            <td>
              <div class="product-desc-cell" title="${escapeHtml(product.description || "")}">
                ${escapeHtml(product.description || "—")}
              </div>
            </td>
            <td style="text-align: right;">
              <div class="actions-cell" style="justify-content: flex-end;">
                <button type="button" class="btn btn-secondary btn-sm edit-btn" data-id="${product.id}">
                  Edit
                </button>
                <button type="button" class="btn btn-danger btn-sm delete-btn" data-id="${product.id}">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });
    tbody.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => openDeleteModal(btn.dataset.id));
    });
  }

  // 9. Specifications Builder Helpers
  function addSpecRow(key = "", val = "") {
    if (!specsContainer) return;
    const row = document.createElement("div");
    row.className = "spec-row";
    row.innerHTML = `
      <input type="text" class="form-control spec-key" placeholder="Attribute (e.g. Dimensions)" value="${escapeAttr(key)}" />
      <input type="text" class="form-control spec-val" placeholder="Value (e.g. 86×86×36mm)" value="${escapeAttr(val)}" />
      <button type="button" class="remove-spec-btn" title="Remove attribute">✕</button>
    `;
    row.querySelector(".remove-spec-btn").addEventListener("click", () => row.remove());
    specsContainer.appendChild(row);
  }

  function getSpecificationsFromForm() {
    const specs = {};
    if (!specsContainer) return specs;
    specsContainer.querySelectorAll(".spec-row").forEach((row) => {
      const k = (row.querySelector(".spec-key")?.value || "").trim();
      const v = (row.querySelector(".spec-val")?.value || "").trim();
      if (k && v) {
        specs[k] = v;
      }
    });
    return specs;
  }

  // 10. Add / Edit Modal Logic
  function openAddModal() {
    if (!productForm) return;
    productForm.reset();
    editProductId.value = "";
    existingImageUrl.value = "";
    selectedFile = null;
    imagePreview.style.display = "none";
    imagePreview.src = "";
    uploadPrompt.style.display = "block";
    if (specsContainer) {
      specsContainer.innerHTML = "";
      addSpecRow();
    }
    modalHeading.textContent = "Add New Product";
    productModal.classList.add("is-active");
  }

  function openEditModal(id) {
    const product = currentProducts.find((p) => p.id === id);
    if (!product || !productModal) return;

    editProductId.value = product.id;
    existingImageUrl.value = product.imageUrl || product.image || "";
    productNameInput.value = product.name || "";
    productCategoryInput.value = product.category || "Central Control";
    productDescInput.value = product.description || "";
    productIsSublime.checked = Boolean(product.isSublime);
    productImageManualInput.value = product.imageUrl || product.image || "";

    // Populate Specifications
    if (specsContainer) {
      specsContainer.innerHTML = "";
      let specs = product.specifications;
      if ((!specs || Object.keys(specs).length === 0) && window.productSpecifications) {
        const match = window.productSpecifications.find(
          (s) => s.title.toLowerCase() === (product.name || "").toLowerCase()
        );
        if (match && match.specifications) {
          specs = match.specifications;
        }
      }

      if (specs && Object.keys(specs).length > 0) {
        Object.entries(specs).forEach(([k, v]) => addSpecRow(k, v));
      } else {
        addSpecRow();
      }
    }

    selectedFile = null;
    const currentSrc = resolveImageSrc(product.imageUrl || product.image);
    if (currentSrc) {
      imagePreview.src = currentSrc;
      imagePreview.style.display = "block";
      uploadPrompt.style.display = "none";
    } else {
      imagePreview.style.display = "none";
      uploadPrompt.style.display = "block";
    }

    modalHeading.textContent = `Edit "${product.name}"`;
    productModal.classList.add("is-active");
  }

  function closeModal() {
    if (productModal) productModal.classList.remove("is-active");
  }

  async function handleImageFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = "block";
      uploadPrompt.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  // Save Product (Add or Edit)
  async function handleProductSave(e) {
    e.preventDefault();
    saveProductBtn.disabled = true;
    saveProductBtn.textContent = "Saving…";

    try {
      let finalImageUrl = existingImageUrl.value;

      if (selectedFile) {
        saveProductBtn.textContent = "Optimizing Image…";
        finalImageUrl = await compressImageToDataUrl(selectedFile, 800, 800, 0.82);
      } else if (productImageManualInput.value.trim()) {
        finalImageUrl = productImageManualInput.value.trim();
      }

      const productPayload = {
        name: productNameInput.value.trim(),
        category: productCategoryInput.value,
        description: productDescInput.value.trim(),
        imageUrl: finalImageUrl,
        specifications: getSpecificationsFromForm(),
        isSublime: productIsSublime.checked
      };

      if (editProductId.value) {
        await updateProductInDb(editProductId.value, productPayload);
        showToast(`Updated "${productPayload.name}" successfully!`, "success");
      } else {
        await addProductToDb(productPayload);
        showToast(`Added "${productPayload.name}" to catalog!`, "success");
      }

      closeModal();
      await loadProducts();
    } catch (err) {
      console.error("Save error:", err);
      showToast("Error saving product: " + err.message, "danger");
    } finally {
      saveProductBtn.disabled = false;
      saveProductBtn.textContent = "Save Product";
    }
  }

  // 11. Delete Modal Logic
  function openDeleteModal(id) {
    const product = currentProducts.find((p) => p.id === id);
    if (!product || !deleteModal) return;
    productToDelete = product;
    deleteProductName.textContent = `"${product.name}"`;
    deleteModal.classList.add("is-active");
  }

  function closeDeleteModal() {
    if (deleteModal) deleteModal.classList.remove("is-active");
    productToDelete = null;
  }

  async function handleConfirmDelete() {
    if (!productToDelete) return;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = "Deleting…";

    try {
      await deleteProductFromDb(productToDelete.id);
      showToast(`Deleted "${productToDelete.name}" successfully.`, "success");
      closeDeleteModal();
      await loadProducts();
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Error deleting product: " + err.message, "danger");
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Delete Permanently";
    }
  }

  // 12. Seed Existing Products
  async function handleSeedData() {
    if (!confirm("This will import all 65 existing products from data/products.json into your online Firebase database. Proceed?")) {
      return;
    }
    seedBtn.disabled = true;
    seedBtn.textContent = "Fetching products.json…";

    try {
      const response = await fetch("../data/products.json");
      const productsList = await response.json();

      await seedInitialProducts(productsList, (current, total) => {
        seedBtn.textContent = `Importing (${current}/${total})…`;
      });

      showToast(`Successfully imported ${productsList.length} products to Firebase!`, "success");
      await loadProducts();
    } catch (err) {
      console.error("Seed error:", err);
      showToast("Error importing products: " + err.message, "danger");
    } finally {
      seedBtn.disabled = false;
      seedBtn.textContent = "📥 Import 65 Existing Products to Firebase";
    }
  }

  // 13. Helpers
  function resolveImageSrc(path) {
    if (!path) return "../assets/logo.png";
    if (path.startsWith("https://") || path.startsWith("http://") || path.startsWith("data:image/")) {
      return path;
    }
    if (path.startsWith("../")) return path;
    if (/^[a-zA-Z0-9_\-./]+$/.test(path)) {
      return `../${path}`;
    }
    return "../assets/logo.png";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatAuthError(msg) {
    if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
      return "Incorrect email or password. Please verify your credentials.";
    }
    if (msg.includes("too-many-requests")) {
      return "Access temporarily blocked due to multiple failed login attempts. Try again in a few minutes.";
    }
    return msg;
  }

  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "danger") toast.style.background = "var(--danger)";
    if (type === "success") toast.style.background = "var(--forest)";
    toast.innerHTML = `<span>${type === "danger" ? "⚠️" : type === "success" ? "✓" : "ℹ️"}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
})();
