
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
  const deliveryGateway = document.querySelector(
    '.gateway-card[data-role="delivery"]'
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
    loadMyDeliveryRequests();
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
      shop.home_delivery ? "V2 test requests only" : "Not available"
    );

    const notice = makeElement(
      "p",
      "Pickup reservations are available. Home delivery requests are enabled for controlled V2 prototype testing only. No physical delivery, payment or fulfilment service is live."
    );

    notice.style.marginTop = "22px";
    notice.style.fontWeight = "bold";

    card.appendChild(notice);
    addReserveControls(card, product, stockLine);
    if (shop.home_delivery === true) {
      addDeliveryRequestControls(card, product, stockLine);
    }
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
            ? "Home delivery: V2 test requests"
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
  let deliveryHistoryOutput = null;
  let deliveryHistoryNotice = null;
  let latestDeliveryHistoryCheck = 0;

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


  // ==========================================
  // V2 CUSTOMER DELIVERY HISTORY AND CANCELLATION
  // ==========================================

  function setupCustomerDeliveryRequestsPanel() {
    const accountPanel = document.getElementById("customerAccountPanel");
    const panel = makeElement("section", undefined, "shop-result");
    panel.style.marginBottom = "24px";

    const heading = makeElement("h3", "My Delivery Requests");
    const help = makeElement(
      "p",
      "View your Supabase delivery-request history. Unassigned requests can be cancelled before assignment; accepted or later-stage requests cannot be cancelled here. V2 delivery requests are enabled for controlled prototype testing only; no actual delivery is arranged."
    );

    const refresh = makeElement(
      "button", "Refresh Delivery Requests", "view-shop-button"
    );
    refresh.type = "button";
    refresh.addEventListener("click", loadMyDeliveryRequests);

    deliveryHistoryNotice = makeElement("p", "");
    deliveryHistoryNotice.style.marginTop = "10px";
    deliveryHistoryNotice.setAttribute("aria-live", "polite");

    deliveryHistoryOutput = makeElement("div");
    deliveryHistoryOutput.style.marginTop = "14px";
    deliveryHistoryOutput.style.display = "grid";
    deliveryHistoryOutput.style.gap = "12px";
    deliveryHistoryOutput.setAttribute("aria-live", "polite");

    panel.append(
      heading, help, refresh, deliveryHistoryNotice, deliveryHistoryOutput
    );

    const reservationsPanel = accountPanel.nextElementSibling;
    if (reservationsPanel) {
      reservationsPanel.insertAdjacentElement("afterend", panel);
    } else {
      accountPanel.insertAdjacentElement("afterend", panel);
    }
  }

  function displayCustomerDeliveryRequest(request) {
    const entry = makeElement("div", undefined, "reservation-card");
    entry.appendChild(makeElement(
      "h4", request.product_name || "Delivery request"
    ));
    addDetailLine(entry, "Shop", request.shop_name || "Not available");
    addDetailLine(entry, "Status", ({
      requested: "Requested — Awaiting Assignment",
      accepted: "Accepted — Assigned to Delivery Partner",
      picked_up: "Picked Up",
      delivered: "Delivered",
      cancelled: "Cancelled",
      expired: "Expired — Stock Restored"
    })[request.status] || request.status || "Unknown");
    addDetailLine(entry, "Quantity", request.quantity);
    addDetailLine(entry, "Delivery address", request.delivery_address || "Not provided");

    const timeLine = [
      ["Requested at", request.requested_at],
      ["Assign before", request.status === "requested" ? request.expires_at : null],
      ["Accepted at", request.accepted_at],
      ["Picked up at", request.picked_up_at],
      ["Delivered at", request.delivered_at],
      ["Cancelled at", request.cancelled_at],
      ["Expired at", request.expired_at]
    ];
    timeLine.forEach(([label, value]) => {
      if (value) {
        const date = new Date(value);
        addDetailLine(entry, label, Number.isFinite(date.getTime())
          ? date.toLocaleString("en-IN")
          : "Unavailable");
      }
    });

    if (request.can_cancel === true && request.status === "requested") {
      const cancel = makeElement(
        "button", "Cancel Unassigned Request", "view-shop-button"
      );
      cancel.type = "button";
      cancel.style.marginTop = "12px";

      const feedback = makeElement("p", "");
      feedback.setAttribute("aria-live", "polite");
      entry.append(cancel, feedback);

      cancel.addEventListener("click", async () => {
        if (!window.confirm(
          "Cancel this unassigned delivery request? " +
          "One reserved unit will return to the shop's available stock. " +
          "This action cannot be undone."
        )) {
          return;
        }

        cancel.disabled = true;
        cancel.textContent = "Cancelling...";
        feedback.textContent = "Checking request ownership and status...";

        try {
          const supabaseClient = getClient();
          const { data, error } = await supabaseClient.rpc(
            "shopfront_cancel_delivery_request",
            { p_delivery_id: request.delivery_id }
          );

          if (error) throw error;
          if (!data?.success ||
              data.delivery_id !== request.delivery_id ||
              data.status !== "cancelled" ||
              Number(data.restored_quantity) !== Number(request.quantity)) {
            throw new Error("Database did not confirm cancellation and stock restoration.");
          }

          await loadMyDeliveryRequests();
          deliveryHistoryNotice.textContent =
            "Delivery request cancelled successfully. Reserved stock was restored.";
          displayMessage("Customer delivery request cancelled in Supabase.");
        } catch (error) {
          feedback.textContent =
            "Cancellation failed: " + error.message +
            " Refresh requests to see the latest status.";
          cancel.disabled = false;
          cancel.textContent = "Cancel Unassigned Request";
        }
      });
    }

    return entry;
  }

  async function loadMyDeliveryRequests() {
    if (!deliveryHistoryOutput || !deliveryHistoryNotice) return;
    const checkId = ++latestDeliveryHistoryCheck;
    const isCurrent = () => checkId === latestDeliveryHistoryCheck;
    deliveryHistoryNotice.textContent = "";
    deliveryHistoryOutput.replaceChildren(
      makeElement("p", "Loading your delivery requests from Supabase...")
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
        deliveryHistoryOutput.replaceChildren(
          makeElement("p", "Log in with your Customer account to view delivery requests.")
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

      if (!profile || profile.role !== "customer" ||
          profile.is_active !== true) {
        deliveryHistoryOutput.replaceChildren(
          makeElement("p", "Only an active Customer account can view its delivery requests.")
        );
        return;
      }

      // This RPC independently rechecks Customer role and filters
      // strictly by auth.uid(). Never query other customers' jobs.
      const { data, error } =
        await supabaseClient.rpc("shopfront_customer_delivery_requests");

      if (!isCurrent()) return;
      if (error) throw error;
      if (!Array.isArray(data)) {
        throw new Error("Unexpected delivery history response from Supabase.");
      }

      deliveryHistoryOutput.replaceChildren();

      if (data.length === 0) {
        deliveryHistoryOutput.appendChild(
          makeElement("p", "No delivery requests in your account yet.", "empty-result")
        );
        return;
      }

      data.forEach(request => {
        deliveryHistoryOutput.appendChild(
          displayCustomerDeliveryRequest(request)
        );
      });
    } catch (error) {
      if (!isCurrent()) return;
      deliveryHistoryOutput.replaceChildren(
        makeElement("p", "Could not load delivery requests: " + error.message)
      );
    }
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
  // V2 CUSTOMER DELIVERY REQUEST FORM (CONTROLLED TESTING)
  // ==========================================

  // Database protections for customer ownership, stock reservation,
  // cancellation, expiry and partner assignment have been tested.
  // V2 submissions are now enabled for prototype testing ONLY.
  // The published V1 site and real-world fulfillment are unaffected.
  const DELIVERY_REQUEST_SUBMISSION_ENABLED = true;

  function addDeliveryRequestControls(card, product, stockLine) {
    const section = makeElement("section");
    section.style.marginTop = "24px";
    section.style.padding = "16px";
    section.style.border = "1px solid #cbd5e1";
    section.style.borderRadius = "12px";

    section.appendChild(makeElement("h3", "Request Home Delivery"));
    section.appendChild(makeElement(
      "p",
      "V2 prototype testing only. A request temporarily reserves one available unit for up to 30 minutes while awaiting Shopkeeper assignment. You can cancel before assignment; unassigned requests expire and restore stock automatically. No payment, delivery promise or actual physical service is offered.",
      "queue-help-text"
    ));

    const form = makeElement("form");
    form.style.marginTop = "12px";

    const label = makeElement("label", "Delivery Address");
    label.style.display = "block";
    label.style.fontWeight = "600";
    label.style.marginBottom = "8px";

    const address = makeElement("textarea");
    address.id = "v2-delivery-address-" + product.id;
    label.htmlFor = address.id;
    address.rows = 3;
    address.required = true;
    address.minLength = 10;
    address.maxLength = 500;
    address.placeholder = "Enter your delivery address (10–500 characters)";
    address.style.display = "block";
    address.style.width = "100%";
    address.style.padding = "12px";
    address.style.border = "1px solid #cbd5e1";
    address.style.borderRadius = "10px";
    address.style.fontSize = "15px";
    address.style.boxSizing = "border-box";

    const submit = makeElement(
      "button",
      DELIVERY_REQUEST_SUBMISSION_ENABLED
        ? "Submit Delivery Request"
        : "Delivery Request — Not Yet Enabled",
      "save-shop-button"
    );
    submit.type = "submit";
    submit.disabled = !DELIVERY_REQUEST_SUBMISSION_ENABLED;

    const feedback = makeElement("p");
    feedback.style.marginTop = "10px";
    feedback.setAttribute("aria-live", "polite");

    feedback.textContent =
      "Testing only: use a dummy address and do not enter real customer information. No physical delivery will occur.";

    form.append(label, address, submit, feedback);
    section.appendChild(form);
    card.appendChild(section);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!DELIVERY_REQUEST_SUBMISSION_ENABLED) {
        feedback.textContent = "Delivery requests are not enabled yet.";
        return;
      }

      const destination = address.value.trim();
      if (destination.length < 10 || destination.length > 500) {
        feedback.textContent =
          "Please enter a delivery address containing 10–500 characters.";
        return;
      }

      submit.disabled = true;
      submit.textContent = "Requesting Delivery...";
      feedback.textContent = "Checking your account and available stock...";

      let succeeded = false;
      try {
        const supabaseClient = getClient();
        const { data: userInfo, error: loginError } =
          await supabaseClient.auth.getUser();

        if (loginError && loginError.name !== "AuthSessionMissingError") {
          throw loginError;
        }

        if (!userInfo?.user) {
          feedback.textContent =
            "Please log in with an active Customer account to request delivery.";
          return;
        }

        const { data, error } = await supabaseClient.rpc(
          "shopfront_request_delivery",
          {
            p_product_id: product.id,
            p_delivery_address: destination
          }
        );

        if (error) throw error;

        if (!data?.success) {
          const reasons = {
            already_requested: "You already have an active delivery request for this product.",
            pickup_already_reserved: "You already reserved this product for pickup.",
            out_of_stock: "The product has no available stock."
          };
          feedback.textContent =
            reasons[data?.reason] ||
            "Delivery request was not created. Please refresh and try again.";
          return;
        }

        succeeded = true;
        product.stock = Number(data.remaining_stock);
        stockLine.lastChild.textContent = String(product.stock);

        feedback.textContent =
          "Test delivery request saved. Status: Awaiting Assignment. Open My Delivery Requests to track or cancel before assignment. No real delivery has been scheduled.";
        displayMessage("V2 test delivery request saved in Supabase.");
        await loadMyDeliveryRequests();
      } catch (error) {
        feedback.textContent =
          "Delivery request failed: " + error.message;
      } finally {
        submit.disabled = succeeded || !DELIVERY_REQUEST_SUBMISSION_ENABLED;
        submit.textContent = succeeded
          ? "Delivery Requested"
          : "Submit Delivery Request";
      }
    });
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
  let shopkeeperDeliveryRequestsOutput = null;
  let shopkeeperDeliveryNotice = null;
  let latestDeliveryQueueCheck = 0;

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

    const deliveryQueueCard = makeElement("div", undefined, "shopkeeper-card");
    deliveryQueueCard.style.marginBottom = "22px";
    deliveryQueueCard.appendChild(makeElement("h3", "Pending Delivery Requests"));
    deliveryQueueCard.appendChild(makeElement(
      "p",
      "Pending requests for your own shops from Supabase. Assign only to a verified Delivery Partner. Unassigned requests expire after 30 minutes. This is a V2 prototype: do not arrange physical delivery.",
      "queue-help-text"
    ));

    const deliveryRefreshButton = makeElement(
      "button", "Refresh Pending Deliveries", "view-shop-button"
    );
    deliveryRefreshButton.type = "button";
    deliveryRefreshButton.addEventListener(
      "click", refreshShopkeeperDeliveryQueue
    );

    shopkeeperDeliveryNotice = makeElement("p", "");
    shopkeeperDeliveryNotice.style.marginTop = "12px";
    shopkeeperDeliveryNotice.setAttribute("aria-live", "polite");

    shopkeeperDeliveryRequestsOutput = makeElement("div");
    shopkeeperDeliveryRequestsOutput.style.display = "grid";
    shopkeeperDeliveryRequestsOutput.style.gap = "14px";
    shopkeeperDeliveryRequestsOutput.style.marginTop = "16px";
    shopkeeperDeliveryRequestsOutput.setAttribute("aria-live", "polite");

    deliveryQueueCard.append(
      deliveryRefreshButton,
      shopkeeperDeliveryNotice,
      shopkeeperDeliveryRequestsOutput
    );

    // Read-only Supabase inventory, separate from the V1 localStorage form.
    const inventoryCard = makeElement("div", undefined, "shopkeeper-card");
    inventoryCard.style.marginBottom = "22px";
    inventoryCard.appendChild(makeElement("h3", "My Online Inventory"));
    inventoryCard.appendChild(makeElement(
      "p",
      "Manage your Supabase inventory: edit prices and stock, add products, or deactivate and reactivate listings. Existing reservations remain valid.",
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
    dashboard.append(account, inventoryCard, queueCard, deliveryQueueCard);
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
      refreshShopkeeperDeliveryQueue();
    }, true);
  }




  // ==========================================
  // V2 SHOPKEEPER PENDING DELIVERY ASSIGNMENTS
  // ==========================================

  async function refreshShopkeeperDeliveryQueue() {
    if (!shopkeeperDeliveryRequestsOutput || !shopkeeperDeliveryNotice) return;

    const requestId = ++latestDeliveryQueueCheck;
    const isCurrent = () => requestId === latestDeliveryQueueCheck;
    shopkeeperDeliveryNotice.textContent = "";
    shopkeeperDeliveryRequestsOutput.replaceChildren(
      makeElement("p", "Checking your pending deliveries in Supabase...")
    );

    try {
      const supabaseClient = getClient();
      const { data: userData, error: authError } =
        await supabaseClient.auth.getUser();
      if (!isCurrent()) return;
      if (authError && authError.name !== "AuthSessionMissingError") {
        throw authError;
      }

      if (!userData?.user) {
        shopkeeperDeliveryRequestsOutput.replaceChildren(makeElement(
          "p", "Log in as your assigned Shopkeeper to view pending deliveries."
        ));
        return;
      }

      const { data: profile, error: profileError } =
        await supabaseClient.from("profiles")
          .select("role, is_active")
          .eq("id", userData.user.id)
          .maybeSingle();

      if (!isCurrent()) return;
      if (profileError) throw profileError;
      if (!profile || profile.role !== "shopkeeper" ||
          profile.is_active !== true) {
        shopkeeperDeliveryRequestsOutput.replaceChildren(makeElement(
          "p", "This account does not have Shopkeeper delivery-management access."
        ));
        return;
      }

      // Server independently filters requests by owned shops and
      // returns only active, verified partner account IDs and names.
      const { data: queue, error: queueError } =
        await supabaseClient.rpc("shopfront_shopkeeper_delivery_queue");
      if (!isCurrent()) return;
      if (queueError) throw queueError;

      if (!queue || !Array.isArray(queue.requests) ||
          !Array.isArray(queue.partners)) {
        throw new Error("Unexpected delivery queue response from Supabase.");
      }

      shopkeeperDeliveryRequestsOutput.replaceChildren();

      if (queue.requests.length === 0) {
        shopkeeperDeliveryRequestsOutput.appendChild(makeElement(
          "p", "No pending delivery requests for your shops right now.",
          "empty-result"
        ));
        return;
      }

      shopkeeperDeliveryRequestsOutput.appendChild(makeElement(
        "p", String(queue.requests.length) + " pending delivery request(s)."
      ));

      for (const request of queue.requests) {
        const entry = makeElement("div", undefined, "reservation-card");
        entry.appendChild(makeElement(
          "h4", request.product_name || "Delivery request"
        ));
        addDetailLine(entry, "Shop", request.shop_name || "Not provided");
        addDetailLine(
          entry, "Customer", request.customer_name || "Not provided"
        );
        addDetailLine(
          entry, "Customer phone", request.customer_phone || "Not provided"
        );
        addDetailLine(entry, "Delivery address", request.delivery_address);
        addDetailLine(entry, "Quantity", request.quantity);
        addDetailLine(entry, "Status", "Requested (unassigned)");

        if (request.expires_at) {
          addDetailLine(
            entry,
            "Assign before",
            new Date(request.expires_at).toLocaleString("en-IN")
          );
          addCountdown(entry, request.expires_at);
        }

        if (queue.partners.length === 0) {
          entry.appendChild(makeElement(
            "p",
            "No verified active Delivery Partner accounts are available for assignment."
          ));
        } else {
          addShopkeeperDeliveryAssignment(entry, request, queue.partners);
        }

        shopkeeperDeliveryRequestsOutput.appendChild(entry);
      }

    } catch (error) {
      if (!isCurrent()) return;
      shopkeeperDeliveryRequestsOutput.replaceChildren(
        makeElement("p", "Could not load pending deliveries: " + error.message)
      );
    }
  }

  function addShopkeeperDeliveryAssignment(entry, request, partners) {
    const form = makeElement("form");
    form.style.marginTop = "16px";

    const label = makeElement("label", "Assign to verified Delivery Partner");
    label.style.display = "block";
    label.style.fontWeight = "600";
    label.style.marginBottom = "8px";

    const selector = makeElement("select");
    selector.required = true;
    selector.style.width = "100%";
    selector.style.maxWidth = "440px";
    selector.style.padding = "12px";
    selector.style.border = "1px solid #cbd5e1";
    selector.style.borderRadius = "10px";

    const emptyOption = makeElement("option", "Choose a Delivery Partner");
    emptyOption.value = "";
    selector.appendChild(emptyOption);

    for (const partner of partners) {
      if (!partner.partner_id) continue;
      const option = makeElement(
        "option", partner.partner_name || "Delivery Partner"
      );
      option.value = partner.partner_id;
      selector.appendChild(option);
    }

    const submit = makeElement(
      "button", "Assign Delivery", "save-shop-button"
    );
    submit.type = "submit";
    submit.style.display = "block";
    submit.style.marginTop = "12px";

    const feedback = makeElement("p", "");
    feedback.style.marginTop = "10px";
    feedback.setAttribute("aria-live", "polite");

    form.append(label, selector, submit, feedback);
    entry.appendChild(form);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const partnerId = selector.value;
      const selectedPartner = partners.find(
        partner => partner.partner_id === partnerId
      );
      if (!selectedPartner) {
        feedback.textContent = "Choose a verified Delivery Partner.";
        return;
      }

      if (!window.confirm(
        "Assign \"" + request.product_name + "\" to " +
        selectedPartner.partner_name + "? " +
        "This will mark the request Accepted/Assigned. " +
        "Only the chosen Partner may complete pickup and delivery."
      )) {
        return;
      }

      submit.disabled = true;
      selector.disabled = true;
      submit.textContent = "Assigning...";
      feedback.textContent = "Verifying shop ownership and request status...";

      try {
        const supabaseClient = getClient();
        const { data, error } = await supabaseClient.rpc(
          "shopfront_assign_delivery",
          {
            p_delivery_id: request.delivery_id,
            p_partner_id: partnerId
          }
        );

        if (error) throw error;
        if (!data?.success ||
            data.delivery_id !== request.delivery_id ||
            data.delivery_partner_id !== partnerId ||
            data.status !== "accepted") {
          throw new Error("Database did not confirm this delivery assignment.");
        }

        await refreshShopkeeperDeliveryQueue();
        shopkeeperDeliveryNotice.textContent =
          "Delivery assigned to " + selectedPartner.partner_name +
          " successfully. Status: Accepted (assigned).";
        displayMessage("Shopkeeper delivery assignment saved in Supabase.");

      } catch (error) {
        feedback.textContent =
          "Assignment failed: " + error.message +
          " Refresh pending deliveries and try again.";
      } finally {
        submit.disabled = false;
        selector.disabled = false;
        submit.textContent = "Assign Delivery";
      }
    });
  }

  // ==========================================
  // OWNER-VERIFIED SUPABASE INVENTORY AND UPDATES
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


  // ==========================================
  // SECURE SUPABASE PRICE / AVAILABLE STOCK EDITING
  // ==========================================

  function addShopkeeperProductEditControls(item, product) {
    const editButton = makeElement(
      "button", "Edit Price / Stock", "view-shop-button"
    );
    editButton.type = "button";
    editButton.style.marginTop = "12px";

    const form = makeElement("form");
    form.style.display = "none";
    form.style.marginTop = "14px";
    form.style.padding = "14px";
    form.style.border = "1px solid #cbd5e1";
    form.style.borderRadius = "10px";

    const note = makeElement(
      "p",
      "Stock means units available to reserve now (it excludes units already reserved). Refresh inventory before saving if another customer may have booked.",
      "queue-help-text"
    );
    note.style.marginBottom = "12px";

    const fields = makeElement("div");
    fields.style.display = "grid";
    fields.style.gridTemplateColumns = "repeat(auto-fit, minmax(160px, 1fr))";
    fields.style.gap = "12px";

    function addNumberField(title, initialValue, step, max) {
      const wrapper = makeElement("div");
      const label = makeElement("label", title);
      label.style.display = "block";
      label.style.fontWeight = "600";
      label.style.marginBottom = "6px";

      const input = makeElement("input");
      input.type = "number";
      input.required = true;
      input.min = "0";
      input.max = String(max);
      input.step = String(step);
      input.value = String(initialValue);
      input.style.width = "100%";
      input.style.padding = "12px";
      input.style.border = "1px solid #cbd5e1";
      input.style.borderRadius = "10px";
      input.style.fontSize = "15px";

      const id = "v2-edit-" + title.toLowerCase().replace(/[^a-z0-9]/g, "-")
        + "-" + product.product_id;
      input.id = id;
      label.htmlFor = id;

      wrapper.append(label, input);
      fields.appendChild(wrapper);
      return input;
    }

    const priceInput = addNumberField("Price (₹)", product.price, 0.01, 10000000);
    const stockInput = addNumberField(
      "Available Stock", product.stock, 1, 1000000
    );

    const actions = makeElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "10px";
    actions.style.marginTop = "14px";

    const saveButton = makeElement(
      "button", "Save Price / Stock", "save-shop-button"
    );
    saveButton.type = "submit";

    const cancelButton = makeElement("button", "Cancel", "view-shop-button");
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => {
      form.style.display = "none";
      editButton.textContent = "Edit Price / Stock";
    });

    actions.append(saveButton, cancelButton);
    const feedback = makeElement("p", "");
    feedback.style.marginTop = "10px";
    feedback.setAttribute("aria-live", "polite");

    form.append(note, fields, actions, feedback);
    item.append(editButton, form);

    editButton.addEventListener("click", () => {
      const opening = form.style.display === "none";
      form.style.display = opening ? "block" : "none";
      editButton.textContent = opening ? "Hide Editor" : "Edit Price / Stock";
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const priceText = priceInput.value.trim();
      const stockText = stockInput.value.trim();
      if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) ||
          !/^\d+$/.test(stockText)) {
        feedback.textContent =
          "Enter a non-negative price (up to two decimals) and whole-number stock.";
        return;
      }

      const price = Number(priceText);
      const stock = Number(stockText);
      if (!Number.isFinite(price) || price > 10000000 ||
          !Number.isSafeInteger(stock) || stock > 1000000) {
        feedback.textContent = "Price or stock is outside the allowed range.";
        return;
      }

      saveButton.disabled = true;
      cancelButton.disabled = true;
      feedback.textContent = "Saving securely in Supabase...";

      try {
        const supabaseClient = getClient();
        const { data, error } = await supabaseClient.rpc(
          "shopfront_update_product",
          {
            p_product_id: product.product_id,
            p_price: price,
            p_stock: stock,
            p_expected_price: Number(product.price),
            p_expected_stock: Number(product.stock)
          }
        );

        if (error) throw error;
        if (!data?.success || data.product_id !== product.product_id) {
          throw new Error("Database did not confirm the product update.");
        }

        await refreshOnlineShopkeeperInventory();
        shopkeeperInventoryNotice.textContent =
          "Updated \"" + product.name + "\" successfully. Price: ₹" +
          String(data.price) + ", available stock: " + String(data.stock) + ".";
        displayMessage("Product price and available stock saved to Supabase.");

      } catch (error) {
        feedback.textContent =
          "Update failed: " + error.message +
          " If inventory changed, refresh it before trying again.";
      } finally {
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    });
  }


  // ==========================================
  // SECURE SUPABASE LISTING ACTIVATION CONTROLS
  // ==========================================

  function addShopkeeperListingControls(item, product) {
    const currentlyActive = product.is_active === true;
    const targetActive = !currentlyActive;
    const actionText = currentlyActive
      ? "Deactivate Listing"
      : "Reactivate Listing";

    const button = makeElement("button", actionText, "view-shop-button");
    button.type = "button";
    button.style.marginTop = "12px";
    button.style.marginLeft = "10px";

    const feedback = makeElement("p", "");
    feedback.style.marginTop = "10px";
    feedback.setAttribute("aria-live", "polite");

    const explanation = makeElement(
      "p",
      "Deactivating hides the product from new Customer searches and reservations. Existing reservations stay active until collected or expired.",
      "queue-help-text"
    );
    explanation.style.marginTop = "10px";

    item.append(button, feedback);
    if (currentlyActive) item.appendChild(explanation);

    button.addEventListener("click", async () => {
      if (currentlyActive && !window.confirm(
        "Deactivate \"" + product.name + "\"? " +
        "Customers will no longer discover or newly reserve this product. " +
        "Existing reservations are not cancelled."
      )) {
        return;
      }

      button.disabled = true;
      button.textContent = "Updating Listing...";
      feedback.textContent = "Saving listing status in Supabase...";

      try {
        const supabaseClient = getClient();
        const { data, error } = await supabaseClient.rpc(
          "shopfront_set_product_active",
          {
            p_product_id: product.product_id,
            p_is_active: targetActive,
            p_expected_is_active: currentlyActive
          }
        );

        if (error) throw error;
        if (!data?.success ||
            data.product_id !== product.product_id ||
            data.is_active !== targetActive) {
          throw new Error("Database did not confirm the listing status.");
        }

        await refreshOnlineShopkeeperInventory();
        shopkeeperInventoryNotice.textContent =
          "\"" + product.name + "\" " +
          (targetActive ? "reactivated" : "deactivated") +
          " successfully in Supabase.";
        displayMessage("Online product listing status updated.");

      } catch (error) {
        feedback.textContent =
          "Could not update listing: " + error.message +
          " Refresh online inventory before trying again.";
      } finally {
        button.disabled = false;
        button.textContent = actionText;
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
            addShopkeeperProductEditControls(item, product);
            addShopkeeperListingControls(item, product);
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
  // V2 DELIVERY PARTNER GATEWAY — SECURE ACCOUNT FOUNDATION
  // ==========================================

  let deliveryAccessStatus = null;
  let onlineDeliveryJobsSection = null;
  let onlineDeliveryJobsOutput = null;
  let onlineDeliveryJobsNotice = null;
  let latestDeliveryAccountCheck = 0;
  let latestDeliveryJobsCheck = 0;

  function setupOnlineDeliveryDashboard() {
    const screen = document.getElementById("deliveryScreen");
    const legacyDeliveryLayout = screen.querySelector(".delivery-layout");

    // V1 delivery forms and jobs are localStorage-only demo data.
    // Hide them entirely in V2 so they cannot be mistaken for live orders.
    if (legacyDeliveryLayout) {
      legacyDeliveryLayout.classList.add("hidden");
    }

    const dashboard = makeElement("section");
    dashboard.style.textAlign = "left";

    const accountCard = makeElement("div", undefined, "shopkeeper-card");
    accountCard.style.marginBottom = "22px";
    accountCard.appendChild(makeElement("h3", "My Delivery Partner Account"));

    deliveryAccessStatus = makeElement(
      "p", "Checking Delivery Partner access..."
    );
    deliveryAccessStatus.style.whiteSpace = "pre-line";
    deliveryAccessStatus.setAttribute("aria-live", "polite");

    const accountLink = makeElement(
      "button", "Open Login / Account", "view-shop-button"
    );
    accountLink.type = "button";
    accountLink.addEventListener("click", () => {
      window.location.href = "auth.html";
    });

    const refreshButton = makeElement(
      "button", "Refresh Delivery Partner Access", "view-shop-button"
    );
    refreshButton.type = "button";
    refreshButton.style.marginLeft = "10px";
    refreshButton.addEventListener("click", refreshOnlineDeliveryAccount);

    accountCard.append(
      deliveryAccessStatus,
      accountLink,
      refreshButton
    );

    onlineDeliveryJobsSection = makeElement(
      "div", undefined, "shopkeeper-card"
    );
    onlineDeliveryJobsSection.appendChild(
      makeElement("h3", "Online Delivery Jobs")
    );
    onlineDeliveryJobsSection.appendChild(
      makeElement(
        "p",
        "V2 prototype jobs assigned to your account. Status changes are simulated during testing: do not physically pick up or deliver anything. Customer test requests are enabled.",
        "queue-help-text"
      )
    );

    const refreshJobsButton = makeElement(
      "button", "Refresh Assigned Deliveries", "view-shop-button"
    );
    refreshJobsButton.type = "button";
    refreshJobsButton.addEventListener("click", () => {
      refreshOnlineDeliveryJobs();
    });

    onlineDeliveryJobsNotice = makeElement("p", "");
    onlineDeliveryJobsNotice.style.marginTop = "12px";
    onlineDeliveryJobsNotice.setAttribute("aria-live", "polite");

    onlineDeliveryJobsOutput = makeElement("div");
    onlineDeliveryJobsOutput.style.display = "grid";
    onlineDeliveryJobsOutput.style.gap = "12px";
    onlineDeliveryJobsOutput.style.marginTop = "16px";
    onlineDeliveryJobsOutput.setAttribute("aria-live", "polite");

    onlineDeliveryJobsSection.append(
      refreshJobsButton,
      onlineDeliveryJobsNotice,
      onlineDeliveryJobsOutput
    );
    onlineDeliveryJobsSection.classList.add("hidden");

    dashboard.append(accountCard, onlineDeliveryJobsSection);
    if (legacyDeliveryLayout) {
      screen.insertBefore(dashboard, legacyDeliveryLayout);
    } else {
      screen.appendChild(dashboard);
    }

    // Override the browser-only V1 delivery gateway handler in V2.
    deliveryGateway.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showScreen("deliveryScreen");
      displayMessage("V2 Delivery Partner Dashboard opened.");
      refreshOnlineDeliveryAccount();
    }, true);
  }

  async function refreshOnlineDeliveryAccount() {
    if (!deliveryAccessStatus || !onlineDeliveryJobsSection) return;

    const checkId = ++latestDeliveryAccountCheck;
    const isCurrent = () => checkId === latestDeliveryAccountCheck;

    deliveryAccessStatus.textContent = "Checking Delivery Partner account...";
    // Invalidate any previous in-flight job request before showing another user.
    ++latestDeliveryJobsCheck;
    onlineDeliveryJobsOutput.replaceChildren();
    onlineDeliveryJobsNotice.textContent = "";
    onlineDeliveryJobsSection.classList.add("hidden");

    try {
      const supabaseClient = getClient();
      const { data: userInfo, error: loginError } =
        await supabaseClient.auth.getUser();

      if (!isCurrent()) return;
      if (loginError && loginError.name !== "AuthSessionMissingError") {
        throw loginError;
      }

      if (!userInfo?.user) {
        deliveryAccessStatus.textContent =
          "Not logged in.\nLog in using your Delivery Partner account.";
        return;
      }

      const { data: profile, error: profileError } =
        await supabaseClient.from("profiles")
          .select("full_name, role, is_active")
          .eq("id", userInfo.user.id)
          .maybeSingle();

      if (!isCurrent()) return;
      if (profileError) throw profileError;

      const email = userInfo.user.email || "Account user";
      if (!profile || profile.role !== "delivery_partner" ||
          profile.is_active !== true) {
        deliveryAccessStatus.textContent =
          "Logged in as: " + email +
          "\nThis account does not have active Delivery Partner access.";
        return;
      }

      deliveryAccessStatus.textContent =
        "Logged in as: " + email +
        "\nName: " + (profile.full_name || "Not provided") +
        "\nRole: Delivery Partner" +
        "\nAccount status: Active";

      onlineDeliveryJobsSection.classList.remove("hidden");
      displayMessage("Verified Delivery Partner account in Supabase.");
      await refreshOnlineDeliveryJobs(checkId);

    } catch (error) {
      if (!isCurrent()) return;
      deliveryAccessStatus.textContent =
        "Could not verify Delivery Partner access: " + error.message;
    }
  }



  // Secure, owner-checked delivery status transitions.
  // Only one valid action is displayed for each current job status.
  function addDeliveryAdvanceControl(card, job) {
    if (job.status !== "accepted" && job.status !== "picked_up") {
      return;
    }

    const nextStatus = job.status === "accepted" ? "picked_up" : "delivered";
    const label = job.status === "accepted"
      ? "Mark as Picked Up"
      : "Mark as Delivered";

    const button = makeElement("button", label, "view-shop-button");
    button.type = "button";
    button.style.marginTop = "14px";

    const feedback = makeElement("p", "");
    feedback.style.marginTop = "10px";
    feedback.setAttribute("aria-live", "polite");

    card.append(button, feedback);

    button.addEventListener("click", async () => {
      const action = nextStatus === "picked_up"
        ? "Confirm this product was actually collected from the shop?"
        : "Confirm this product was actually handed to the customer?";

      if (!window.confirm(action)) return;

      button.disabled = true;
      button.textContent = "Updating...";
      feedback.textContent = "Verifying the delivery in Supabase...";

      try {
        const supabaseClient = getClient();
        const { data, error } = await supabaseClient.rpc(
          "shopfront_partner_advance_delivery",
          {
            p_delivery_id: job.delivery_id,
            p_expected_status: job.status
          }
        );

        if (error) throw error;
        if (data?.success !== true ||
            data.delivery_id !== job.delivery_id ||
            data.status !== nextStatus) {
          throw new Error("The database did not confirm the status update.");
        }

        await refreshOnlineDeliveryJobs();
        onlineDeliveryJobsNotice.textContent =
          (nextStatus === "picked_up"
            ? "Pickup confirmed successfully."
            : "Delivery completed successfully.") +
          " The status was saved in Supabase.";
        displayMessage(
          nextStatus === "picked_up"
            ? "Delivery job marked as picked up."
            : "Delivery job marked as delivered."
        );
      } catch (error) {
        feedback.textContent = "Could not update delivery: " +
          error.message + " Refresh assigned deliveries and try again.";
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  }

  async function refreshOnlineDeliveryJobs(accountCheckId) {
    if (!onlineDeliveryJobsOutput || !onlineDeliveryJobsSection) return;

    const requestId = ++latestDeliveryJobsCheck;
    const isCurrent = () =>
      requestId === latestDeliveryJobsCheck &&
      (accountCheckId === undefined ||
       accountCheckId === latestDeliveryAccountCheck);

    if (onlineDeliveryJobsSection.classList.contains("hidden")) {
      return;
    }

    onlineDeliveryJobsOutput.replaceChildren(
      makeElement("p", "Loading assigned deliveries from Supabase...")
    );

    try {
      const supabaseClient = getClient();
      // This RPC independently validates auth.uid(), active partner role,
      // and delivery_partner_id for each returned job.
      const { data: jobs, error } =
        await supabaseClient.rpc("shopfront_partner_deliveries");

      if (!isCurrent()) return;
      if (error) throw error;
      if (!Array.isArray(jobs)) {
        throw new Error("Unexpected delivery response from Supabase.");
      }

      onlineDeliveryJobsOutput.replaceChildren();
      if (jobs.length === 0) {
        onlineDeliveryJobsOutput.appendChild(makeElement(
          "p",
          "No active deliveries are assigned to your account right now.",
          "empty-result"
        ));
        return;
      }

      onlineDeliveryJobsOutput.appendChild(makeElement(
        "p",
        String(jobs.length) + " active assigned delivery job(s)."
      ));

      for (const job of jobs) {
        const card = makeElement("div", undefined, "reservation-card");
        card.appendChild(makeElement(
          "h4", job.product_name || "Assigned delivery"
        ));
        addDetailLine(card, "Shop", job.shop_name || "Not provided");
        addDetailLine(
          card, "Pickup location", job.shop_address || "Not provided"
        );
        addDetailLine(card, "Customer", job.customer_name || "Not provided");
        addDetailLine(
          card, "Customer phone", job.customer_phone || "Not provided"
        );
        addDetailLine(
          card, "Delivery address", job.delivery_address || "Not provided"
        );
        addDetailLine(card, "Quantity", job.quantity);
        addDetailLine(
          card,
          "Status",
          job.status === "picked_up" ? "Picked up" : "Accepted"
        );
        if (job.requested_at) {
          addDetailLine(
            card, "Requested at",
            new Date(job.requested_at).toLocaleString("en-IN")
          );
        }

        addDeliveryAdvanceControl(card, job);
        onlineDeliveryJobsOutput.appendChild(card);
      }

    } catch (error) {
      if (!isCurrent()) return;
      onlineDeliveryJobsOutput.replaceChildren(makeElement(
        "p", "Unable to load assigned deliveries: " + error.message
      ));
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  setupOnlineReservationsPanel();
  setupCustomerDeliveryRequestsPanel();
  setupOnlineShopkeeperDashboard();
  setupOnlineDeliveryDashboard();
  refreshCustomerAccount();
  loadMyOnlineReservations();
  loadMyDeliveryRequests();
  setInterval(updateReservationCountdowns, 1000);

  console.log(
    "Shopfront V2 online catalog and account recognition initialized."
  );
})();
