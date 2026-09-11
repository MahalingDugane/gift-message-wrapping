/**
 * Gift Message & Wrapping Storefront Integration
 */

const KNOWN_WRAPPING_VARIANT_ID = 48293918605364;

document.addEventListener("DOMContentLoaded", () => {
  initGiftMessageWidgets();
});

document.addEventListener("shopify:section:load", () => {
  initGiftMessageWidgets();
});

document.addEventListener("shopify:section:select", () => {
  initGiftMessageWidgets();
});

document.addEventListener("cart:refresh", () => {
  const cartContainers = document.querySelectorAll(".gm-cart-luxury-container");
  cartContainers.forEach((container) => initCartReadOnlyWidget(container));
});

function initGiftMessageWidgets() {
  const productContainers = document.querySelectorAll(".gift-message-container:not([data-initialized])");
  productContainers.forEach((container) => {
    container.setAttribute("data-initialized", "true");
    initProductWidget(container);
  });

  const cartContainers = document.querySelectorAll(".gm-cart-luxury-container:not([data-initialized])");
  cartContainers.forEach((container) => {
    container.setAttribute("data-initialized", "true");
    initCartReadOnlyWidget(container);
  });

  setupBuyItNowIntegration();
}

function formatMoney(amount, currencyCode) {
  const currency = currencyCode || window.Shopify?.currency?.active || "USD";
  try {
    return new Intl.NumberFormat(document.documentElement.lang || "en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  } catch (e) {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>'"]/g,
    (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)
  );
}

function getNumericVariantId(rawId) {
  if (rawId === null || rawId === undefined || rawId === "") return null;
  const digits = String(rawId).replace(/\D/g, "");
  if (!digits) return null;
  const numericId = Number(digits);
  return Number.isSafeInteger(numericId) ? numericId : null;
}

function isWrappingCartItem(item) {
  if (!item) return false;
  const hasWrapProp =
    (item.properties && item.properties._is_gift_wrapping === "true") ||
    (item.properties && item.properties["_is_gift_wrapping"] === "true");
  const isWrapId = Number(item.variant_id) === KNOWN_WRAPPING_VARIANT_ID;
  return Boolean(hasWrapProp || isWrapId);
}

async function fetchAppSettings() {
  const shop = window.Shopify?.shop || "";
  const endpoints = [
    "/apps/gift-message-wrapping/api/gift-settings",
    "/apps/gift-settings",
    `/api/gift-settings?shop=${encodeURIComponent(shop)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const raw = await res.json();
        const config = raw.settings || raw;
        const designs = raw.designs || config.designs || [];
        const parsed = {
          isEnabled: config.isEnabled ?? true,
          giftWrapEnabled: config.giftWrapEnabled ?? true,
          giftWrapLabel: config.giftWrapLabel || "Add Premium Gift Wrapping",
          characterLimit: config.characterLimit || 250,
          designs: Array.isArray(designs) ? designs : [],
        };
        window.__giftAppSettings = parsed;
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

/* ==========================================
   PRODUCT PAGE LOGIC
   ========================================== */
function initProductWidget(container) {
  const toggleCheckbox = container.querySelector(".gift-message-checkbox");
  const fieldsWrapper = container.querySelector(".gift-message-fields");
  const wrappingCheckbox = container.querySelector(".gift-wrapping-checkbox");
  const wrappingFieldsWrapper = container.querySelector(".gift-wrapping-fields");

  container._activeVariantId = KNOWN_WRAPPING_VARIANT_ID;
  container._activeDesignName = "Classic Kraft";
  container._activeDesignObj = null;

  loadAndRenderSettings(container);

  if (toggleCheckbox && fieldsWrapper) {
    toggleCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) fieldsWrapper.classList.add("is-active");
      else fieldsWrapper.classList.remove("is-active");
      syncHiddenInputs(container);
      debounceCartUpdate(container);
    });
  }

  if (wrappingCheckbox && wrappingFieldsWrapper) {
    wrappingCheckbox.addEventListener("change", async (e) => {
      if (e.target.checked) {
        wrappingFieldsWrapper.classList.add("is-active");
      } else {
        wrappingFieldsWrapper.classList.remove("is-active");
        await removeAllWrappingFromCart();
        await refreshCartUI();
      }
      syncHiddenInputs(container);
      debounceCartUpdate(container);
    });
  }

  setupProductFormIntegration(container);

  const allInputs = container.querySelectorAll("input, textarea");
  allInputs.forEach((input) => {
    const triggerSync = () => {
      syncHiddenInputs(container);
      debounceCartUpdate(container);
    };
    input.addEventListener("input", triggerSync);
    input.addEventListener("change", triggerSync);
  });

  const textarea = container.querySelector(".gift-textarea");
  const counter = container.querySelector(".gift-char-counter");
  const maxChars = parseInt(container.getAttribute("data-max-chars") || "500", 10);

  const emojiButtons = container.querySelectorAll(".gift-emoji-btn");
  emojiButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const emoji = btn.getAttribute("data-emoji");
      if (textarea && emoji) {
        const start = textarea.selectionStart || textarea.value.length;
        const end = textarea.selectionEnd || textarea.value.length;
        const text = textarea.value;
        textarea.value = text.substring(0, start) + emoji + text.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        if (counter) counter.textContent = `(${textarea.value.length} / ${maxChars} characters)`;
        syncHiddenInputs(container);
        debounceCartUpdate(container);
      }
    });
  });

  if (textarea) {
    textarea.addEventListener("input", () => {
      if (counter) counter.textContent = `(${textarea.value.length} / ${maxChars} characters)`;
    });
  }
}

async function loadAndRenderSettings(container) {
  try {
    const settings = await fetchAppSettings();
    if (!settings || !settings.isEnabled) {
      container.style.display = "none";
      return;
    }

    const wrapOption = container.querySelector(".gift-wrapping-option");

    if (settings.giftWrapEnabled && settings.designs && settings.designs.length > 0) {
      if (wrapOption) wrapOption.style.display = "block";
      const titleDisplay = container.querySelector(".gift-wrapping-title-display");
      if (titleDisplay && settings.giftWrapLabel) titleDisplay.textContent = settings.giftWrapLabel;

      const grid = container.querySelector(".gift-design-grid");
      if (grid) {
        grid.innerHTML = "";

        let defaultDesign = settings.designs.find((d) => d.isDefault) || settings.designs[0];
        container._activeVariantId = getNumericVariantId(defaultDesign.variantId) || KNOWN_WRAPPING_VARIANT_ID;
        container._activeDesignName = defaultDesign.name;
        container._activeDesignObj = defaultDesign;

        settings.designs.forEach((design) => {
          const card = document.createElement("div");
          card.className = `gm-lux-card ${design.id === defaultDesign.id ? "selected" : ""}`;

          const imgHTML = design.imageUrl
            ? `<img src="${design.imageUrl}" class="gm-lux-card-img" alt="${escapeHTML(design.name)}"/>`
            : `<div class="gm-lux-card-img" style="display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:2rem;background:#f3f4f6;">🎁</div>`;

          card.innerHTML = `
            <div class="gm-lux-card-img-wrap">
              ${imgHTML}
              <div class="gm-lux-checkmark">✓</div>
            </div>
            <div class="gm-lux-card-info">
              <div class="gm-lux-card-name">${escapeHTML(design.name)}</div>
              <div class="gm-lux-card-price">+ ${formatMoney(design.price)}</div>
            </div>
          `;

          card.addEventListener("click", async () => {
            grid.querySelectorAll(".gm-lux-card").forEach((c) => c.classList.remove("selected"));
            card.classList.add("selected");
            container._activeVariantId = getNumericVariantId(design.variantId) || KNOWN_WRAPPING_VARIANT_ID;
            container._activeDesignName = design.name;
            container._activeDesignObj = design;
            renderSelectedPreview(container);
            syncHiddenInputs(container);

            const isWrap = Boolean(container.querySelector(".gift-wrapping-checkbox")?.checked);
            if (isWrap) {
              await updateWrappingInCart(container._activeVariantId, design.name);
            }
          });

          grid.appendChild(card);
        });

        renderSelectedPreview(container);
      }
    } else {
      if (wrapOption) wrapOption.style.display = "none";
    }
    syncHiddenInputs(container);
  } catch (err) {
    console.warn("Settings sync failed:", err);
  }
}

function renderSelectedPreview(container) {
  const previewWrapper = container.querySelector(".gm-lux-selected-preview");
  const design = container._activeDesignObj;

  if (!previewWrapper || !design) return;

  const imgHTML = design.imageUrl
    ? `<img src="${design.imageUrl}" class="gm-preview-img" alt="${escapeHTML(design.name)}"/>`
    : `<div class="gm-preview-img" style="display:flex;align-items:center;justify-content:center;background:#f3f4f6;font-size:1.5rem;">🎁</div>`;

  previewWrapper.innerHTML = `
    <div class="gm-preview-box">
      ${imgHTML}
      <div class="gm-preview-details">
        <div class="gm-preview-label">Selected Wrapping</div>
        <div class="gm-preview-name">${escapeHTML(design.name)}</div>
      </div>
      <div class="gm-preview-price">
        + ${formatMoney(design.price)}
      </div>
    </div>
  `;
}

function syncHiddenInputs(container) {
  const form = container.closest('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
  if (!form) return;

  const isGiftChecked = Boolean(container.querySelector(".gift-message-checkbox")?.checked);
  const toVal = container.querySelector('input[id*="gift-to"]')?.value || "";
  const fromVal = container.querySelector('input[id*="gift-from"]')?.value || "";
  const msgVal = container.querySelector('textarea[id*="gift-msg"]')?.value || "";
  const wrapChecked = Boolean(container.querySelector(".gift-wrapping-checkbox")?.checked);

  const attrs = {
    "Is Gift": isGiftChecked ? "Yes" : "No",
    "To": isGiftChecked ? toVal : "",
    "From": isGiftChecked ? fromVal : "",
    "Gift Message": isGiftChecked ? msgVal : "",
    "Gift Wrapping": wrapChecked ? "Yes" : "No",
    "Design": wrapChecked ? container._activeDesignName || "" : "",
  };

  Object.entries(attrs).forEach(([key, value]) => {
    let hiddenInput = form.querySelector(`input[name="attributes[${key}]"]`);
    if (!hiddenInput) {
      hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = `attributes[${key}]`;
      form.appendChild(hiddenInput);
    }
    hiddenInput.value = value;
  });
}

let debounceTimer = null;
function debounceCartUpdate(container) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncCartAttributes(container);
  }, 500);
}

async function syncCartAttributes(container) {
  const isGiftChecked = Boolean(container?.querySelector(".gift-message-checkbox")?.checked);
  const toVal = container?.querySelector('input[id*="gift-to"]')?.value || "";
  const fromVal = container?.querySelector('input[id*="gift-from"]')?.value || "";
  const msgVal = container?.querySelector('textarea[id*="gift-msg"]')?.value || "";
  const wrapChecked = Boolean(container?.querySelector(".gift-wrapping-checkbox")?.checked);

  const attributes = {
    "Is Gift": isGiftChecked ? "Yes" : "No",
    "To": isGiftChecked ? toVal : "",
    "From": isGiftChecked ? fromVal : "",
    "Gift Message": isGiftChecked ? msgVal : "",
    "Gift Wrapping": wrapChecked ? "Yes" : "No",
    "Design": wrapChecked ? container?._activeDesignName || "" : "",
  };

  try {
    await fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ attributes }),
    });
  } catch (err) {}
}

/* ========================================================
   NORMAL ADD TO CART: ROBUST SEQUENTIAL PIPELINE
   ======================================================== */
function setupProductFormIntegration(container) {
  if (window._giftFetchIntercepted) return;
  window._giftFetchIntercepted = true;
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

    if (url.includes("/cart/add") && !window._isAddingGift) {
      const activeContainer =
        document.querySelector('.gift-message-container[data-context="product"]') ||
        document.querySelector(".gift-message-container") ||
        container;

      if (activeContainer) {
        syncHiddenInputs(activeContainer);
      }

      const response = await originalFetch.apply(this, args);

      if (response.ok) {
        const isWrap = Boolean(activeContainer?.querySelector(".gift-wrapping-checkbox")?.checked);
        const wrappingVariantId =
          getNumericVariantId(activeContainer?._activeVariantId) ||
          KNOWN_WRAPPING_VARIANT_ID;
        const selectedDesignName = activeContainer?._activeDesignName || "Classic Kraft";

        window._isAddingGift = true;
        try {
          await removeAllWrappingFromCart();

          if (isWrap && wrappingVariantId) {
            await originalFetch("/cart/add.js", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                items: [
                  {
                    id: Number(wrappingVariantId),
                    quantity: 1,
                    properties: {
                      _is_gift_wrapping: "true",
                      Design: selectedDesignName,
                    },
                  },
                ],
              }),
            });
          }

          if (activeContainer) {
            await syncCartAttributes(activeContainer);
          }
          await refreshCartUI();
        } catch (err) {
          console.error("[Gift Wrap] Error in Add to Cart wrapping flow:", err);
        } finally {
          window._isAddingGift = false;
        }
      }

      return response;
    }

    return originalFetch.apply(this, args);
  };
}

/* ========================================================
   BUY IT NOW & DYNAMIC CHECKOUT (CAPTURE PHASE)
   ======================================================== */
function setupBuyItNowIntegration() {
  if (window._giftBuyItNowInitialized) return;
  window._giftBuyItNowInitialized = true;

  window.addEventListener("pageshow", () => {
    window._giftBuyItNowProcessing = false;
    window._isAddingGift = false;
  });

  const buyItNowSelector = [
    ".shopify-payment-button__button",
    ".shopify-payment-button [role='button']",
    ".shopify-payment-button button",
    "[data-testid='Checkout-button']",
    "[data-buy-it-now]",
    ".buy-it-now",
  ].join(", ");

  document.addEventListener(
    "click",
    async function (event) {
      const targetBtn = event.target.closest(buyItNowSelector);
      if (!targetBtn) return;

      const form =
        targetBtn.closest('form[action*="/cart/add"]') ||
        document.querySelector('form[action*="/cart/add"]') ||
        targetBtn.closest("form");

      const activeContainer =
        document.querySelector('.gift-message-container[data-context="product"]') ||
        document.querySelector(".gift-message-container") ||
        form?.querySelector(".gift-message-container");

      const isWrap = Boolean(activeContainer?.querySelector(".gift-wrapping-checkbox")?.checked);

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (window._giftBuyItNowProcessing) return;
      window._giftBuyItNowProcessing = true;
      window._isAddingGift = true;

      try {
        if (activeContainer) {
          syncHiddenInputs(activeContainer);
        }

        let mainVariantId = null;
        if (form) {
          try {
            const fd = new FormData(form);
            mainVariantId = getNumericVariantId(fd.get("id"));
          } catch (e) {}
          if (!mainVariantId) {
            const idInput = form.querySelector('[name="id"]');
            if (idInput) mainVariantId = getNumericVariantId(idInput.value);
          }
        }
        if (!mainVariantId) {
          const urlVariant = new URLSearchParams(window.location.search).get("variant");
          if (urlVariant) mainVariantId = getNumericVariantId(urlVariant);
        }

        let mainQuantity = 1;
        if (form) {
          const qtyInput = form.querySelector('[name="quantity"]');
          if (qtyInput) mainQuantity = parseInt(qtyInput.value, 10) || 1;
        }

        const productProperties = {};
        if (form) {
          form.querySelectorAll('[name^="properties["]').forEach((el) => {
            const match = el.name.match(/^properties\[(.*?)\]$/);
            if (match && match[1] && el.value && match[1] !== "_is_gift_wrapping") {
              productProperties[match[1]] = String(el.value);
            }
          });
        }

        const wrappingVariantId =
          getNumericVariantId(activeContainer?._activeVariantId) ||
          KNOWN_WRAPPING_VARIANT_ID;
        const selectedDesignName = activeContainer?._activeDesignName || "Classic Kraft";

        await removeAllWrappingFromCart();

        const itemsToAdd = [];
        if (mainVariantId) {
          itemsToAdd.push({
            id: Number(mainVariantId),
            quantity: mainQuantity,
            properties: productProperties,
          });
        }

        if (isWrap && wrappingVariantId) {
          itemsToAdd.push({
            id: Number(wrappingVariantId),
            quantity: 1,
            properties: {
              _is_gift_wrapping: "true",
              Design: selectedDesignName,
            },
          });
        }

        await fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ items: itemsToAdd }),
        });

        if (activeContainer) {
          await syncCartAttributes(activeContainer);
        }

        window.location.href = "/checkout";
      } catch (err) {
        console.error("[Gift Wrap] Buy It Now error:", err);
        window._giftBuyItNowProcessing = false;
        window._isAddingGift = false;
      }
    },
    true
  );
}

async function updateWrappingInCart(newVariantId, designName) {
  try {
    const cartRes = await fetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!cartRes.ok) return;
    const cart = await cartRes.json();
    const hasWrap = (cart.items || []).some((item) => isWrappingCartItem(item));

    if (hasWrap) {
      await removeAllWrappingFromCart();
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: Number(newVariantId),
              quantity: 1,
              properties: {
                _is_gift_wrapping: "true",
                Design: designName || "",
              },
            },
          ],
        }),
      });
      await refreshCartUI();
    }
  } catch (err) {
    console.error("[Gift Wrap] Error updating wrapping in cart:", err);
  }
}

async function removeAllWrappingFromCart() {
  try {
    const cartRes = await fetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!cartRes.ok) return;
    const cart = await cartRes.json();
    const updates = {};
    let needsUpdate = false;

    (cart.items || []).forEach((item) => {
      if (isWrappingCartItem(item)) {
        updates[item.key] = 0;
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ updates }),
      });
    }
  } catch (err) {
    console.error("[Gift Wrap] removeAllWrappingFromCart error:", err);
  }
}

async function refreshCartUI() {
  try {
    const cartRes = await fetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!cartRes.ok) return;
    const cart = await cartRes.json();

    const sectionsToFetch = [
      "main-cart-items",
      "main-cart-footer",
      "cart-drawer",
      "CartDrawer",
      "cart-icon-bubble",
    ].filter((id) => document.getElementById(id) || document.querySelector(id));

    if (sectionsToFetch.length > 0) {
      const sectionRes = await fetch(`/cart?sections=${sectionsToFetch.join(",")}`);
      if (sectionRes.ok) {
        const sectionsData = await sectionRes.json();
        const parser = new DOMParser();
        for (const [id, html] of Object.entries(sectionsData)) {
          const doc = parser.parseFromString(html, "text/html");
          const current = document.getElementById(id) || document.querySelector(id);
          const updated = doc.getElementById(id) || doc.querySelector(id);
          if (current && updated) current.innerHTML = updated.innerHTML;
        }
      }
    }

    document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true, detail: { cart } }));
    document.dispatchEvent(new CustomEvent("cart:updated", { bubbles: true, detail: { cart } }));
    document.dispatchEvent(new CustomEvent("shopify:cart:updated", { bubbles: true, detail: { cart } }));
  } catch (err) {}
}

/* ========================================================
   CART PAGE (EMPTY-CART CHECK & READ-ONLY PREVIEW)
   ======================================================== */
async function initCartReadOnlyWidget(container) {
  try {
    const [cartRes, settings] = await Promise.all([
      fetch("/cart.js", { headers: { Accept: "application/json" } }).catch(() => null),
      fetchAppSettings(),
    ]);

    const cart = cartRes ? await cartRes.json() : { attributes: {}, items: [] };
    const attrs = cart.attributes || {};
    const items = cart.items || [];

    // Separate normal products from gift wrapping products
    const normalItems = items.filter((item) => !isWrappingCartItem(item));
    const wrapItems = items.filter((item) => isWrappingCartItem(item));

    // CASE 1: NO NORMAL PRODUCTS EXIST IN CART
    // When the customer deletes the last normal product, purge wrapping and clear attributes
    if (normalItems.length === 0) {
      container.innerHTML = "";
      container.style.display = "none";

      const hasGiftAttrs =
        Boolean(attrs["Gift Wrapping"]) ||
        Boolean(attrs["Gift Message"]) ||
        Boolean(attrs["Is Gift"]) ||
        Boolean(attrs["To"]) ||
        Boolean(attrs["From"]) ||
        Boolean(attrs["Design"]);

      if (wrapItems.length > 0 || hasGiftAttrs) {
        const updates = {};
        wrapItems.forEach((item) => {
          updates[item.key] = 0;
        });

        await fetch("/cart/update.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            updates,
            attributes: {
              "Is Gift": "",
              "To": "",
              "From": "",
              "Gift Message": "",
              "Gift Wrapping": "",
              "Design": "",
            },
          }),
        });

        // Trigger native sections update to make Cart Total $0.00 and show empty cart state
        await refreshCartUI();
      }
      return;
    }

    // CASE 2: NORMAL PRODUCT(S) EXIST
    // Self-healing: Restore wrapping variant ONLY if at least 1 normal product is in the cart
    const hasWrapAttr = attrs["Gift Wrapping"] === "Yes";
    if (hasWrapAttr && wrapItems.length === 0 && !window._giftCartHealing) {
      window._giftCartHealing = true;
      const designName = attrs["Design"] || "Classic Kraft";

      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: KNOWN_WRAPPING_VARIANT_ID,
              quantity: 1,
              properties: {
                _is_gift_wrapping: "true",
                Design: designName,
              },
            },
          ],
        }),
      });
      window.location.reload();
      return;
    }

    // Enforce strictly 1 wrapping line item
    if (wrapItems.length > 1 || (wrapItems.length === 1 && wrapItems[0].quantity > 1)) {
      const updates = {};
      wrapItems.forEach((item, index) => {
        updates[item.key] = index === 0 ? 1 : 0;
      });
      await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ updates }),
      });
      await refreshCartUI();
      return;
    }

    const wrapItem = wrapItems[0] || null;

    if (wrapItem) {
      hideWrappingLineItems(cart);
    }

    const isGift =
      attrs["Is Gift"] === "Yes" ||
      Boolean(wrapItem) ||
      attrs["Gift Message"] ||
      attrs["Gift Wrapping"] === "Yes";

    if (isGift) {
      const toVal = attrs["To"] ? escapeHTML(attrs["To"]) : "";
      const fromVal = attrs["From"] ? escapeHTML(attrs["From"]) : "";
      const msgVal = attrs["Gift Message"] ? escapeHTML(attrs["Gift Message"]).replace(/\n/g, "<br>") : "";
      const designAttr = attrs["Design"];

      let wrapDesign = "";
      let wrapPriceFormatted = "";
      let activeImageUrl = null;

      if (wrapItem) {
        wrapDesign = wrapItem.properties.Design ? escapeHTML(wrapItem.properties.Design) : "";
        wrapPriceFormatted = formatMoney(wrapItem.price / 100, cart.currency);
      } else if (hasWrapAttr && designAttr && settings?.designs) {
        wrapDesign = escapeHTML(designAttr);
        const design = settings.designs.find((d) => d.name === designAttr);
        if (design) {
          wrapPriceFormatted = formatMoney(design.price, cart.currency);
        }
      }

      if (settings?.designs && settings.designs.length > 0) {
        let targetDesign = null;
        if (wrapDesign) {
          targetDesign = settings.designs.find((d) => d.name === wrapDesign);
        }
        if (!targetDesign) {
          targetDesign = settings.designs.find((d) => d.isDefault) || settings.designs[0];
        }
        if (targetDesign && targetDesign.imageUrl) {
          activeImageUrl = targetDesign.imageUrl;
        }
      }

      const showWrapDetails = Boolean(wrapItem || (hasWrapAttr && wrapDesign));

      const giftIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v13"></path><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"></path><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"></path></svg>`;
      const userIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
      const wrapIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-9"></path><path d="M15.17 2.38a2 2 0 0 0-2.83 0L2 12.72l9.17 9.17a2 2 0 0 0 2.83 0l9.17-9.17z"></path></svg>`;
      const tagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;

      const imageHTML = activeImageUrl
        ? `<img src="${activeImageUrl}" alt="Gift" class="gm-cart-wrap-img" />`
        : `<div class="gm-cart-fallback-img">🎁</div>`;

      container.innerHTML = `
        <div class="gm-cart-luxury-card">
          <div class="gm-cart-col-image">
            ${imageHTML}
          </div>

          <div class="gm-cart-col-info">
            <div class="gm-cart-header">
              ${giftIcon}
              <h3>Gift Message</h3>
            </div>

            <div class="gm-info-grid">
              ${
                toVal
                  ? `
              <div class="gm-info-block">
                <div class="gm-info-icon">${userIcon}</div>
                <div class="gm-info-text">
                  <span class="gm-info-label">To</span>
                  <span class="gm-info-value">${toVal}</span>
                </div>
              </div>`
                  : ""
              }

              ${
                showWrapDetails
                  ? `
              <div class="gm-info-block">
                <div class="gm-info-icon">${wrapIcon}</div>
                <div class="gm-info-text">
                  <span class="gm-info-label">Gift Wrapping</span>
                  <span class="gm-info-value">${wrapDesign}</span>
                </div>
              </div>`
                  : ""
              }

              ${
                fromVal
                  ? `
              <div class="gm-info-block">
                <div class="gm-info-icon">${userIcon}</div>
                <div class="gm-info-text">
                  <span class="gm-info-label">From</span>
                  <span class="gm-info-value">${fromVal}</span>
                </div>
              </div>`
                  : ""
              }

              ${
                showWrapDetails
                  ? `
              <div class="gm-info-block">
                <div class="gm-info-icon">${tagIcon}</div>
                <div class="gm-info-text">
                  <span class="gm-info-label">Wrapping Price</span>
                  <span class="gm-info-value gm-info-price">${wrapPriceFormatted}</span>
                </div>
              </div>`
                  : ""
              }
            </div>
          </div>

          ${
            msgVal
              ? `
          <div class="gm-cart-col-quote">
            <div class="gm-quote-box">
              <span class="gm-quote-mark open">“</span>
              <div class="gm-quote-text">
                ${msgVal}
              </div>
              <span class="gm-quote-mark close">”</span>
            </div>
          </div>`
              : ""
          }
        </div>
      `;
      container.style.display = "block";
    } else {
      container.innerHTML = "";
      container.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading cart attributes:", err);
    container.innerHTML = "";
    container.style.display = "none";
  }
}

function hideWrappingLineItems(cart) {
  const wrapItems = (cart.items || []).filter((item) => isWrappingCartItem(item));

  wrapItems.forEach((item) => {
    const elements = document.querySelectorAll(
      `a[href*="variant=${item.variant_id}"], [id*="${item.key}"], [data-key="${item.key}"], [data-cart-item-key="${item.key}"]`
    );
    elements.forEach((el) => {
      const row = el.closest("tr, .cart-item, .cart__item, .cart-drawer__item, .item");
      if (row) {
        row.style.display = "none";
      }
    });
  });
}