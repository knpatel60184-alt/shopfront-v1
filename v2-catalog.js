
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
  // INITIALIZATION
  // ==========================================

  setupOnlineReservationsPanel();
  refreshCustomerAccount();
  loadMyOnlineReservations();
  setInterval(updateReservationCountdowns, 1000);

  console.log(
    "Shopfront V2 online catalog and account recognition initialized."
  );
})();
