
(function () {
  "use strict";

  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const searchResults = document.getElementById("searchResults");
  const messageBox = document.getElementById("messageBox");
  const shopDetailContent = document.getElementById("shopDetailContent");

  const accountStatus = document.getElementById("customerAccountStatus");
  const accountButton = document.getElementById("customerAccountButton");

  const customerGateway = document.querySelector(
    '.gateway-card[data-role="customer"]'
  );
  const shopkeeperGateway = document.querySelector(
    '.gateway-card[data-role="shopkeeper"]'
  );

  const screens = [
    "gatewayScreen",
    "customerScreen",
    "shopDetailScreen",
    "mapScreen",
    "shopkeeperScreen",
    "deliveryScreen"
  ];

  let client = null;
  let latestSearch = 0;
  let latestAccountCheck = 0;

  // ==========================================
  // SUPABASE CONNECTION
  // ==========================================

  function getClient() {
    if (client) {
      return client;
    }

    const config = window.SHOPFRONT_SUPABASE;

    if (
      !window.supabase ||
      !config ||
      !config.url ||
      !config.publishableKey
    ) {
      throw new Error(
        "Supabase configuration or library is missing."
      );
    }

    client = window.supabase.createClient(
      config.url,
      config.publishableKey
    );

    return client;
  }

  // ==========================================
  // CUSTOMER ACCOUNT
  // ==========================================

  function setAccountStatus(text) {
    accountStatus.textContent = text;
    accountStatus.style.whiteSpace = "pre-line";
  }

  function showGuestAccount() {
    setAccountStatus(
      "You are browsing as a guest.\nLog in to use future online reservations."
    );

    accountButton.textContent = "Log In / Sign Up";
    accountButton.disabled = false;
  }

  async function refreshCustomerAccount() {
    const checkId = ++latestAccountCheck;

    setAccountStatus("Checking your Shopfront account...");

    accountButton.textContent = "Checking Account...";
    accountButton.disabled = true;

    try {
      const supabaseClient = getClient();

      const { data, error } =
        await supabaseClient.auth.getUser();

      if (checkId !== latestAccountCheck) {
        return;
      }

      if (error || !data || !data.user) {
        showGuestAccount();
        return;
      }

      const user = data.user;

      const {
        data: profile,
        error: profileError
      } = await supabaseClient
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (checkId !== latestAccountCheck) {
        return;
      }

      if (profileError) {
        setAccountStatus(
          "Logged in as: " + (user.email || "Account user") +
          "\nProfile could not be loaded: " +
          profileError.message
        );
      } else {
        const name = profile?.full_name || "Not provided";
        const role = profile?.role || "Not assigned";

        setAccountStatus(
          "Logged in as: " + (user.email || "Account user") +
          "\nName: " + name +
          "\nAccount role: " + role
        );
      }

      accountButton.textContent = "Open My Account";
      accountButton.disabled = false;

    } catch (error) {
      if (checkId !== latestAccountCheck) {
        return;
      }

      setAccountStatus(
        "Could not check login status: " + error.message
      );

      accountButton.textContent = "Open Account Page";
      accountButton.disabled = false;
    }
  }

  accountButton.addEventListener("click", () => {
    window.location.href = "auth.html";
  });

  customerGateway.addEventListener("click", () => {
    refreshCustomerAccount();
    loadMyOnlineReservations();
  });

  // ==========================================
  // ELEMENT HELPERS
  // ==========================================

  function makeElement(tag, text, className) {
    const element = document.createElement(tag);

    if (text !== undefined) {
      element.textContent = String(text);
    }

    if (className) {
      element.className = className;
    }

    return element;
  }

  function displayMessage(text) {
    messageBox.textContent = text;
  }

  function showResultMessage(text) {
    searchResults.replaceChildren(
      makeElement("p", text, "empty-result")
    );
  }

  function showScreen(screenId) {
    screens.forEach(id => {
      document.getElementById(id).classList.add("hidden");
    });

    document
      .getElementById(screenId)
      .classList.remove("hidden");
  }

  function addDetailLine(parent, label, value) {
    const paragraph = makeElement("p");
    const strong = makeElement("strong", `${label}: `);

    paragraph.append(
      strong,
      document.createTextNode(String(value))
    );

    parent.appendChild(paragraph);
    return paragraph;
  }

  // ==========================================
  // PRODUCT SEARCH HELPERS
  // ==========================================

  function normalizeWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\bbreak\b/g, "brake")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(word => {
        return word.endsWith("s") && word.length > 3
          ? word.slice(0, -1)
          : word;
      });
  }

  function matchesSearch(product, query) {
    const words = normalizeWords(query);

    const searchableText = normalizeWords(
      `${product.name} ${product.category || ""}`
    ).join(" ");

    return words.every(word =>
      searchableText.includes(word)
    );
  }

  // ==========================================
  // ONLINE SHOP DETAILS
  // ==========================================

  function openOnlineShop(product) {
    const shop = product.shops;

    shopDetailContent.replaceChildren();

    const card = makeElement(
      "div",
      undefined,
      "shop-detail-card"
    );

    card.appendChild(
      makeElement("h2", shop.name)
    );

    card.appendChild(
      makeElement("h3", product.name)
    );

    addDetailLine(card, "Price", `₹${product.price}`);
    const stockLine = addDetailLine(card, "Available stock", product.stock);

    addDetailLine(
      card,
      "Address",
      shop.address || "Not provided"
    );

    addDetailLine(
      card,
      "Phone",
      shop.phone || "Not provided"
    );

    addDetailLine(
      card,
      "Home delivery",
      shop.home_delivery ? "Available" : "Not available"
    );

    const notice = makeElement(
      "p",
      "V2 online pickup reservations are enabled for signed-in customers. Shopkeeper pickup confirmation and online delivery are not connected yet."
    );

    notice.style.marginTop = "22px";
    notice.style.fontWeight = "bold";

    card.appendChild(notice);
    addReserveControls(card, product, stockLine);
    shopDetailContent.appendChild(card);

    showScreen("shopDetailScreen");

    displayMessage(
      `${shop.name} loaded from Supabase.`
    );
  }

  // ==========================================
  // ONLINE SEARCH RESULTS
  // ==========================================

  function renderProducts(products) {
    searchResults.replaceChildren();

    products.forEach(product => {
      const shop = product.shops;

      const card = makeElement(
        "div",
        undefined,
        "shop-result"
      );

      card.appendChild(
        makeElement("h3", shop.name)
      );

      card.appendChild(
        makeElement("p", product.name)
      );

      card.appendChild(
        makeElement("p", `Price: ₹${product.price}`)
      );

      card.appendChild(
        makeElement("p", `In stock: ${product.stock}`)
      );

      card.appendChild(
        makeElement(
          "p",
          shop.home_delivery
            ? "Home delivery: Available"
            : "Home delivery: Not available"
        )
      );

      const button = makeElement(
        "button",
        "View Shop",
        "view-shop-button"
      );

      button.addEventListener("click", () => {
        openOnlineShop(product);
      });

      card.appendChild(button);
      searchResults.appendChild(card);
    });
  }

  // ==========================================
  // SUPABASE PRODUCT SEARCH
  // ==========================================

  async function searchOnline() {
    const requestId = ++latestSearch;
    const query = searchInput.value.trim();

    if (!query) {
      showResultMessage("Please enter a product name.");
      displayMessage("Search cannot be empty.");
      return;
    }

    showResultMessage(
      "Searching the online Shopfront database..."
    );

    displayMessage("Connecting to Supabase...");

    try {
      const supabaseClient = getClient();

      const { data, error } = await supabaseClient
        .from("products")
        .select(`
          id,
          name,
          category,
          price,
          stock,
          shops (
            id,
            name,
            address,
            phone,
            home_delivery,
            latitude,
            longitude
          )
        `)
        .eq("is_active", true)
        .gt("stock", 0)
        .limit(100);

      if (requestId !== latestSearch) {
        return;
      }

      if (error) {
        throw error;
      }

      const matches = (data || [])
        .filter(product =>
          product.shops &&
          matchesSearch(product, query)
        )
        .sort((a, b) =>
          Number(a.price) - Number(b.price)
        );

      if (matches.length === 0) {
        showResultMessage(
          "No matching products found in the online database."
        );

        displayMessage("No matching products found.");
        return;
      }

      renderProducts(matches);

      displayMessage(
        `${matches.length} online product listing(s) found.`
      );

    } catch (error) {
      if (requestId !== latestSearch) {
        return;
      }

      console.error("V2 catalog error:", error);

      showResultMessage(
        `Online search failed: ${error.message}`
      );

      displayMessage(
        "Could not load the online catalog."
      );
    }
  }

  // ==========================================
  // CUSTOMER SEARCH EVENT OVERRIDES
  // ==========================================

  searchButton.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      searchOnline();
    },
    true
  );

  searchInput.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        searchOnline();
      }
    },
    true
  );


  // ==========================================
  // ONLINE PICKUP RESERVATIONS (V2)
  // ==========================================

  let reservationsOutput = null;
  let latestReservationsCheck = 0;

  function setupOnlineReservationsPanel() {
    const accountPanel = document.getElementById("customerAccountPanel");
    const panel = makeElement("section", undefined, "shop-result");
    panel.style.marginBottom = "24px";

    const heading = makeElement("h3", "My Online Reservations");
    const help = makeElement(
      "p",
      "Active reservations and pickup codes are saved online in your account."
    );
    const refresh = makeElement(
      "button", "Refresh Reservations", "view-shop-button"
    );
    refresh.type = "button";
    refresh.addEventListener("click", loadMyOnlineReservations);

    reservationsOutput = makeElement("div");
    reservationsOutput.style.marginTop = "14px";
    reservationsOutput.setAttribute("aria-live", "polite");

    panel.append(heading, help, refresh, reservationsOutput);
    accountPanel.insertAdjacentElement("afterend", panel);
  }

  function updateReservationCountdowns() {
    document.querySelectorAll("[data-shopfront-expires]")
      .forEach(element => {
        const remaining = new Date(element.dataset.shopfrontExpires).getTime() - Date.now();
        if (!Number.isFinite(remaining)) {
          element.textContent = "Unavailable";
        } else if (remaining <= 0) {
          element.textContent = "Expired (awaiting database refresh)";
        } else {
          const seconds = Math.ceil(remaining / 1000);
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          element.textContent = [hours, minutes, secs]
            .map(value => String(value).padStart(2, "0"))
            .join(":");
        }
      });
  }

  function addCountdown(parent, expiresAt) {
    const line = makeElement("p");
    const value = makeElement("strong", "");
    value.dataset.shopfrontExpires = expiresAt;
    line.append("Time remaining: ", value);
    parent.appendChild(line);
    updateReservationCountdowns();
  }

  function displayReservation(parent, reservation, productName, shopName) {
    const card = makeElement("div", undefined, "reservation-card");
    card.appendChild(makeElement("h4", productName || "Reserved product"));
    if (shopName) {
      addDetailLine(card, "Shop", shopName);
    }
    addDetailLine(card, "Pickup code", reservation.pickup_code);
    addDetailLine(
      card, "Expires at",
      new Date(reservation.expires_at).toLocaleString("en-IN")
    );
    addCountdown(card, reservation.expires_at);
    parent.appendChild(card);
  }

  async function loadMyOnlineReservations() {
    if (!reservationsOutput) return;
    const checkId = ++latestReservationsCheck;
    reservationsOutput.replaceChildren(
      makeElement("p", "Loading online reservations...")
    );

    try {
      const supabaseClient = getClient();
      const { data: userInfo, error: loginError } =
        await supabaseClient.auth.getUser();

      if (checkId !== latestReservationsCheck) return;
      if (loginError && loginError.name !== "AuthSessionMissingError") {
        throw loginError;
      }
      if (!userInfo?.user) {
        reservationsOutput.replaceChildren(
          makeElement("p", "Log in to view your online reservations.")
        );
        return;
      }

      const { data, error } = await supabaseClient
        .from("reservations")
        .select("id, pickup_code, expires_at, products(name, shops(name))")
        .eq("customer_id", userInfo.user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("reserved_at", { ascending: false })
        .limit(20);

      if (checkId !== latestReservationsCheck) return;
      if (error) throw error;

      reservationsOutput.replaceChildren();
      if (!data || data.length === 0) {
        reservationsOutput.appendChild(
          makeElement("p", "No active online reservations yet.")
        );
        return;
      }

      data.forEach(reservation => {
        displayReservation(
          reservationsOutput,
          reservation,
          reservation.products?.name,
          reservation.products?.shops?.name
        );
      });
    } catch (error) {
      if (checkId !== latestReservationsCheck) return;
      reservationsOutput.replaceChildren(
        makeElement("p", "Could not load reservations: " + error.message)
      );
    }
  }

  function addReserveControls(card, product, stockLine) {
    const button = makeElement(
      "button", "Reserve for Pickup", "reserve-button"
    );
    button.type = "button";
    const feedback = makeElement("div");
    feedback.setAttribute("aria-live", "polite");

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Reserving...";
      feedback.replaceChildren(
        makeElement("p", "Checking your account and product stock...")
      );
      let succeeded = false;
      try {
        const supabaseClient = getClient();
        const { data: userInfo, error: loginError } =
          await supabaseClient.auth.getUser();
        if (loginError && loginError.name !== "AuthSessionMissingError") {
          throw loginError;
        }
        if (!userInfo?.user) {
          feedback.replaceChildren(
            makeElement("p", "Please log in before reserving a product.")
          );
          const login = makeElement(
            "button", "Log In / Sign Up", "view-shop-button"
          );
          login.type = "button";
          login.addEventListener("click", () => {
            window.location.href = "auth.html";
          });
          feedback.appendChild(login);
          return;
        }

        const { data, error } = await supabaseClient.rpc(
          "shopfront_reserve_product", { p_product_id: product.id }
        );
        if (error) throw error;
        if (!data?.success) {
          const message = data?.reason === "already_reserved"
            ? "You already reserved this product. See your pickup code in My Online Reservations."
            : data?.reason === "out_of_stock"
              ? "This product is currently out of stock. Search again later."
              : "Reservation could not be completed. Please try again.";
          feedback.replaceChildren(makeElement("p", message));
          await loadMyOnlineReservations();
          return;
        }

        succeeded = true;
        product.stock = Number(data.remaining_stock);
        stockLine.lastChild.textContent = String(product.stock);

        const success = makeElement("div", undefined, "reservation-success");
        success.appendChild(makeElement("h3", "Reservation Confirmed!"));
        success.appendChild(makeElement("p", "Show this pickup code at the shop:"));
        success.appendChild(makeElement("div", data.pickup_code, "pickup-code"));
        addCountdown(success, data.expires_at);
        addDetailLine(success, "Remaining stock", product.stock);
        success.appendChild(makeElement(
          "p", "Your reservation is saved online for 2 hours."
        ));
        feedback.replaceChildren(success);
        displayMessage("Online pickup reservation saved successfully.");
        await loadMyOnlineReservations();
      } catch (error) {
        feedback.replaceChildren(
          makeElement("p", "Reservation failed: " + error.message)
        );
      } finally {
        button.disabled = succeeded;
        button.textContent = succeeded
          ? "Reservation Created"
          : "Reserve for Pickup";
      }
    });

    card.append(button, feedback);
  }


  // ==========================================
  // V2 SHOPKEEPER ONLINE RESERVATIONS AND PICKUP VERIFICATION
  // ==========================================

  let shopkeeperAccessStatus = null;
  let shopkeeperReservationsOutput = null;
  let latestShopkeeperCheck = 0;
  let shopkeeperInventoryOutput = null;
  let shopkeeperInventoryNotice = null;
  let latestInventoryCheck = 0;

  function setupOnlineShopkeeperDashboard() {
    const screen = document.getElementById("shopkeeperScreen");
    const localPrototypeLayout = screen.querySelector(".shopkeeper-layout");

    // Prevent the old browser-only inventory and pickup queue from being
    // mistaken for live Supabase information in the V2 dashboard.
    localPrototypeLayout.classList.add("hidden");

    const dashboard = makeElement("section");
    dashboard.style.textAlign = "left";

    const account = makeElement("div", undefined, "shopkeeper-card");
    account.style.marginBottom = "22px";
    account.appendChild(makeElement("h3", "My Shopkeeper Account"));

    shopkeeperAccessStatus = makeElement(
      "p", "Sign in as the owner of a shop to view online reservations."
    );
    shopkeeperAccessStatus.style.whiteSpace = "pre-line";
    shopkeeperAccessStatus.setAttribute("aria-live", "polite");

    const accountButton = makeElement(
      "button", "Open Login / Account", "view-shop-button"
    );
    accountButton.type = "button";
    accountButton.addEventListener("click", () => {
      window.location.href = "auth.html";
    });
    account.append(shopkeeperAccessStatus, accountButton);

    const queueCard = makeElement("div", undefined, "shopkeeper-card");
    queueCard.appendChild(makeElement("h3", "Online Active Reservations"));
    queueCard.appendChild(makeElement(
      "p",
      "Live Supabase reservations for your assigned shops. Confirm collection only after the customer presents their four-digit pickup code in person.",
      "queue-help-text"
    ));

    const refreshButton = makeElement(
      "button", "Refresh Online Reservations", "view-shop-button"
    );
    refreshButton.type = "button";
    refreshButton.addEventListener(
      "click", refreshOnlineShopkeeperReservations
    );

    shopkeeperReservationsOutput = makeElement("div");
    shopkeeperReservationsOutput.style.marginTop = "16px";
    shopkeeperReservationsOutput.style.display = "grid";
    shopkeeperReservationsOutput.style.gap = "12px";
    shopkeeperReservationsOutput.setAttribute("aria-live", "polite");

    queueCard.append(refreshButton, shopkeeperReservationsOutput);

    // Read-only Supabase inventory, separate from the V1 localStorage form.
    const inventoryCard = makeElement("div", undefined, "shopkeeper-card");
    inventoryCard.style.marginBottom = "22px";
    inventoryCard.appendChild(makeElement("h3", "My Online Inventory"));
    inventoryCard.appendChild(makeElement(
      "p",
      "Live Supabase inventory for your shops. Add new products below. Editing existing prices or stock will be added separately.",
      "queue-help-text"
    ));

    const refreshInventoryButton = makeElement(
      "button", "Refresh Online Inventory", "view-shop-button"
    );
    refreshInventoryButton.type = "button";
    refreshInventoryButton.addEventListener(
      "click", refreshOnlineShopkeeperInventory
    );

    shopkeeperInventoryOutput = makeElement("div");
    shopkeeperInventoryOutput.style.marginTop = "16px";
    shopkeeperInventoryOutput.style.display = "grid";
    shopkeeperInventoryOutput.style.gap = "14px";
    shopkeeperInventoryOutput.setAttribute("aria-live", "polite");

    shopkeeperInventoryNotice = makeElement("p", "");
    shopkeeperInventoryNotice.style.marginTop = "12px";
    shopkeeperInventoryNotice.setAttribute("aria-live", "polite");

    inventoryCard.append(
      refreshInventoryButton,
      shopkeeperInventoryNotice,
      shopkeeperInventoryOutput
    );
    dashboard.append(account, inventoryCard, queueCard);
    screen.insertBefore(dashboard, localPrototypeLayout);

    // Capture-phase interception keeps the V1 localStorage shopkeeper
    // handler from opening its unrelated demo queue on V2.
    shopkeeperGateway.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showScreen("shopkeeperScreen");
      displayMessage("V2 online Shopkeeper Dashboard opened.");
      refreshOnlineShopkeeperReservations();
      refreshOnlineShopkeeperInventory();
    }, true);
  }



  // ==========================================
  // OWNER-VERIFIED SUPABASE INVENTORY (READ-ONLY)
  // ==========================================


  // ==========================================
  // SECURE SUPABASE PRODUCT CREATION (V2)
  // ==========================================

  function addShopkeeperProductForm(shopCard, shop) {
    const form = makeElement("form");
    form.style.marginTop = "18px";
    form.style.paddingTop = "18px";
    form.style.borderTop = "1px solid #e5e7eb";

    const heading = makeElement("h4", "Add New Product");
    heading.style.marginBottom = "10px";
    form.appendChild(heading);

    const inputs = makeElement("div");
    inputs.style.display = "grid";
    inputs.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
    inputs.style.gap = "12px";

    function field(title, type, placeholder, required) {
      const wrapper = makeElement("div");
      const label = makeElement("label", title);
      label.style.display = "block";
      label.style.marginBottom = "6px";
      label.style.fontWeight = "600";

      const input = makeElement("input");
      input.type = type;
      input.placeholder = placeholder;
      input.required = required;
      input.style.width = "100%";
      input.style.padding = "12px";
      input.style.border = "1px solid #cbd5e1";
      input.style.borderRadius = "10px";
      input.style.fontSize = "15px";

      const identifier =
        "v2-new-" + title.toLowerCase().replace(/[^a-z0-9]/g, "-") +
        "-" + shop.shop_id;
      input.id = identifier;
      label.htmlFor = identifier;

      wrapper.append(label, input);
      inputs.appendChild(wrapper);
      return input;
    }

    const nameInput = field("Product Name", "text", "e.g. Engine Oil", true);
    nameInput.maxLength = 160;

    const categoryInput = field(
      "Category (optional)", "text", "e.g. Two Wheeler Parts", false
    );
    categoryInput.maxLength = 100;

    const priceInput = field("Price (₹)", "number", "e.g. 350", true);
    priceInput.min = "0";
    priceInput.max = "10000000";
    priceInput.step = "0.01";

    const stockInput = field("Initial Stock", "number", "e.g. 10", true);
    stockInput.min = "0";
    stockInput.max = "1000000";
    stockInput.step = "1";

    const submitButton = makeElement(
      "button", "Add Product to Shop", "save-shop-button"
    );
    submitButton.type = "submit";

    const feedback = makeElement("p", "");
    feedback.style.marginTop = "12px";
    feedback.setAttribute("aria-live", "polite");

    form.append(inputs, submitButton, feedback);
    shopCard.appendChild(form);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const name = nameInput.value.trim();
      const category = categoryInput.value.trim();
      const priceText = priceInput.value.trim();
      const stockText = stockInput.value.trim();

      // Mirror server-side validation for clear feedback.
      if (name.length < 2 || name.length > 160) {
        feedback.textContent = "Product name must contain 2–160 characters.";
        return;
      }
      if (category.length > 100) {
        feedback.textContent = "Category must be at most 100 characters.";
        return;
      }
      if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) ||
          !/^\d+$/.test(stockText)) {
        feedback.textContent =
          "Enter a valid non-negative price (maximum 2 decimals) and whole-number stock.";
        return;
      }

      const price = Number(priceText);
      const stock = Number(stockText);

      if (!Number.isFinite(price) || price > 10000000 ||
          !Number.isSafeInteger(stock) || stock > 1000000) {
        feedback.textContent =
          "Price must not exceed ₹1,00,00,000 and stock must not exceed 10,00,000.";
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Adding Product...";
      feedback.textContent = "Saving product securely in Supabase...";

      try {
        const supabaseClient = getClient();
        const { data, error } = await supabaseClient.rpc(
          "shopfront_add_product",
          {
            p_shop_id: shop.shop_id,
            p_name: name,
            p_category: category || null,
            p_price: price,
            p_stock: stock
          }
        );

        if (error) throw error;
        if (!data?.success || !data.product_id) {
          throw new Error("The database did not confirm product creation.");
        }

        await refreshOnlineShopkeeperInventory();
        shopkeeperInventoryNotice.textContent =
          "Product \"" + name + "\" added successfully to " +
          shop.shop_name + ".";
        displayMessage("New online product added to Supabase.");

      } catch (error) {
        feedback.textContent =
          "Could not add product: " + error.message;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Add Product to Shop";
      }
    });
  }

  async function refreshOnlineShopkeeperInventory() {
    if (!shopkeeperInventoryOutput) return;

    const checkId = ++latestInventoryCheck;
    const isCurrent = () => checkId === latestInventoryCheck;

    shopkeeperInventoryOutput.replaceChildren(
      makeElement("p", "Loading your online inventory...")
    );

    try {
      const supabaseClient = getClient();
      const { data: userInfo, error: loginError } =
        await supabaseClient.auth.getUser();

      if (!isCurrent()) return;
      if (loginError && loginError.name !== "AuthSessionMissingError") {
        throw loginError;
      }

      if (!userInfo?.user) {
        shopkeeperInventoryOutput.replaceChildren(
          makeElement("p", "Log in with your Shopkeeper account to view inventory.")
        );
        return;
      }

      const { data: profile, error: profileError } =
        await supabaseClient.from("profiles")
          .select("role, is_active")
          .eq("id", userInfo.user.id)
          .maybeSingle();

      if (!isCurrent()) return;
      if (profileError) throw profileError;

      if (!profile || !profile.is_active || profile.role !== "shopkeeper") {
        shopkeeperInventoryOutput.replaceChildren(
          makeElement("p", "This account does not have Shopkeeper inventory access.")
        );
        return;
      }

      // The database function independently enforces role and shop ownership.
      const { data: shops, error: inventoryError } =
        await supabaseClient.rpc("shopfront_shopkeeper_inventory");

      if (!isCurrent()) return;
      if (inventoryError) throw inventoryError;
      if (!Array.isArray(shops)) {
        throw new Error("Unexpected inventory response from Supabase.");
      }

      shopkeeperInventoryOutput.replaceChildren();

      if (shops.length === 0) {
        shopkeeperInventoryOutput.appendChild(
          makeElement("p", "No online shops are assigned to this account.", "empty-result")
        );
        return;
      }

      shops.forEach(shop => {
        const shopCard = makeElement("div", undefined, "reservation-card");
        shopCard.appendChild(makeElement("h4", shop.shop_name || "Unnamed shop"));
        const products = Array.isArray(shop.products) ? shop.products : [];

        if (products.length === 0) {
          shopCard.appendChild(
            makeElement("p", "No products have been added to this shop yet.")
          );
        } else {
          products.forEach(product => {
            const item = makeElement("div");
            item.style.padding = "12px 0";
            item.style.borderTop = "1px solid #e5e7eb";
            item.appendChild(makeElement("h4", product.name || "Unnamed product"));
            addDetailLine(item, "Category", product.category || "Not specified");
            addDetailLine(item, "Price", "₹" + product.price);
            addDetailLine(item, "Available stock", product.stock);
            addDetailLine(
              item, "Listing status",
              product.is_active ? "Active" : "Inactive"
            );
            shopCard.appendChild(item);
          });
        }

        addShopkeeperProductForm(shopCard, shop);
        shopkeeperInventoryOutput.appendChild(shopCard);
      });

    } catch (error) {
      if (!isCurrent()) return;
      shopkeeperInventoryOutput.replaceChildren(
        makeElement("p", "Could not load online inventory: " + error.message)
      );
    }
  }

  function addOnlinePickupVerification(entry, booking) {
    const form = makeElement("form");
    form.style.marginTop = "16px";

    const label = makeElement(
      "label",
      "Customer's four-digit pickup code"
    );
    const input = makeElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.pattern = "[0-9]{4}";
    input.autocomplete = "off";
    input.placeholder = "Enter 4-digit code";
    input.required = true;
    input.style.width = "100%";
    input.style.padding = "12px";
    input.style.border = "1px solid #cbd5e1";
    input.style.borderRadius = "10px";
    input.style.marginTop = "8px";
    input.style.fontSize = "16px";

    const id = "shopfront-pickup-" + booking.reservation_id;
    input.id = id;
    label.htmlFor = id;

    const submit = makeElement(
      "button", "Complete Pickup", "complete-pickup-button"
    );
    submit.type = "submit";

    const feedback = makeElement("p");
    feedback.style.marginTop = "10px";
    feedback.setAttribute("aria-live", "polite");

    form.append(label, input, submit, feedback);
    entry.appendChild(form);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const code = input.value.trim();
      if (!/^[0-9]{4}$/.test(code)) {
        feedback.textContent = "Please enter exactly four digits.";
        return;
      }

      // The pickup code is sent only to the secure database RPC.
      // Never print it in logs or display it on the shopkeeper screen.
      submit.disabled = true;
      submit.textContent = "Verifying...";
      feedback.textContent = "Verifying with Supabase...";

      try {
        const supabaseClient = getClient();
        const { data, error } = await supabaseClient.rpc(
          "shopfront_confirm_pickup",
          {
            p_reservation_id: booking.reservation_id,
            p_pickup_code: code
          }
        );

        if (error) throw error;
        input.value = "";

        if (data?.success === true && data.status === "completed") {
          feedback.textContent =
            "Pickup completed successfully. Updating reservations...";
          displayMessage(
            "Pickup completed successfully in Supabase. Stock stays deducted."
          );
          await refreshOnlineShopkeeperReservations();
          return;
        }

        if (data?.reason === "incorrect_code") {
          feedback.textContent =
            "Incorrect code. Attempts remaining: " +
            String(data.attempts_remaining ?? 0) + ".";
        } else if (data?.reason === "temporarily_locked") {
          const until = data.locked_until
            ? new Date(data.locked_until).toLocaleString("en-IN")
            : "later";
          feedback.textContent =
            "Verification temporarily locked. Try again after " +
            until + ".";
        } else if (data?.reason === "expired") {
          feedback.textContent =
            "This reservation has expired and cannot be completed.";
        } else if (data?.reason === "not_active") {
          feedback.textContent =
            "This reservation is no longer active.";
        } else if (data?.reason === "not_found_or_unauthorized") {
          feedback.textContent =
            "Reservation unavailable or not assigned to your shop.";
        } else {
          feedback.textContent =
            "Pickup could not be completed. Please refresh and try again.";
        }
      } catch (error) {
        feedback.textContent =
          "Pickup verification failed: " + error.message;
      } finally {
        submit.disabled = false;
        submit.textContent = "Complete Pickup";
      }
    });
  }

  async function refreshOnlineShopkeeperReservations() {
    if (!shopkeeperReservationsOutput) return;

    const checkId = ++latestShopkeeperCheck;
    shopkeeperAccessStatus.textContent =
      "Checking your Shopkeeper account...";
    shopkeeperReservationsOutput.replaceChildren(
      makeElement("p", "Loading reservations from Supabase...")
    );

    try {
      const supabaseClient = getClient();
      const { data: userInfo, error: loginError } =
        await supabaseClient.auth.getUser();

      if (checkId !== latestShopkeeperCheck) return;
      if (loginError && loginError.name !== "AuthSessionMissingError") {
        throw loginError;
      }

      if (!userInfo?.user) {
        shopkeeperAccessStatus.textContent =
          "Not logged in.\nLog in with your Shopkeeper account.";
        shopkeeperReservationsOutput.replaceChildren(
          makeElement(
            "p",
            "Online reservations are available to assigned Shopkeepers only."
          )
        );
        return;
      }

      const { data: profile, error: profileError } =
        await supabaseClient.from("profiles")
          .select("full_name, role, is_active")
          .eq("id", userInfo.user.id)
          .maybeSingle();

      if (checkId !== latestShopkeeperCheck) return;
      if (profileError) throw profileError;

      if (!profile || !profile.is_active || profile.role !== "shopkeeper") {
        shopkeeperAccessStatus.textContent =
          "Logged in as: " + (userInfo.user.email || "Account user") +
          "\nThis account does not have active Shopkeeper access.";
        shopkeeperReservationsOutput.replaceChildren(
          makeElement("p", "Use your assigned Shopkeeper account.")
        );
        return;
      }

      // Database RPC re-checks shop ownership and Shopkeeper role.
      const { data: bookings, error: bookingsError } =
        await supabaseClient.rpc("shopfront_shopkeeper_reservations");

      if (checkId !== latestShopkeeperCheck) return;
      if (bookingsError) throw bookingsError;
      if (!Array.isArray(bookings)) {
        throw new Error("Unexpected reservation response from Supabase.");
      }

      shopkeeperAccessStatus.textContent =
        "Logged in as: " + (userInfo.user.email || "Account user") +
        "\nRole: Shopkeeper" +
        "\nOnly reservations for your assigned shops are displayed.";

      shopkeeperReservationsOutput.replaceChildren();

      if (bookings.length === 0) {
        shopkeeperReservationsOutput.appendChild(
          makeElement(
            "p",
            "No active online reservations at your shops right now.",
            "empty-result"
          )
        );
      } else {
        shopkeeperReservationsOutput.appendChild(
          makeElement(
            "p",
            bookings.length + " active online reservation(s) found."
          )
        );

        bookings.forEach(booking => {
          const entry = makeElement("div", undefined, "reservation-card");
          entry.appendChild(makeElement("h4", booking.product_name));
          addDetailLine(entry, "Shop", booking.shop_name);
          addDetailLine(
            entry, "Customer", booking.customer_name || "Not provided"
          );
          addDetailLine(entry, "Quantity", booking.quantity);
          addDetailLine(
            entry, "Reserved at",
            new Date(booking.reserved_at).toLocaleString("en-IN")
          );
          addDetailLine(
            entry, "Expires at",
            new Date(booking.expires_at).toLocaleString("en-IN")
          );
          addCountdown(entry, booking.expires_at);
          addOnlinePickupVerification(entry, booking);
          shopkeeperReservationsOutput.appendChild(entry);
        });
      }

      displayMessage(
        "Loaded " + bookings.length + " online shopkeeper reservation(s)."
      );
    } catch (error) {
      if (checkId !== latestShopkeeperCheck) return;
      shopkeeperAccessStatus.textContent =
        "Could not verify Shopkeeper access.";
      shopkeeperReservationsOutput.replaceChildren(
        makeElement("p", "Online reservations failed: " + error.message)
      );
      displayMessage("Could not load online shopkeeper reservations.");
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  setupOnlineReservationsPanel();
  setupOnlineShopkeeperDashboard();
  refreshCustomerAccount();
  loadMyOnlineReservations();
  setInterval(updateReservationCountdowns, 1000);

  console.log(
    "Shopfront V2 online catalog and account recognition initialized."
  );
})();
