
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
    addDetailLine(card, "Available stock", product.stock);

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
      "V2 online catalog preview. Online reservations and deliveries are not connected yet."
    );

    notice.style.marginTop = "22px";
    notice.style.fontWeight = "bold";

    card.appendChild(notice);
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
  // INITIALIZATION
  // ==========================================

  refreshCustomerAccount();

  console.log(
    "Shopfront V2 online catalog and account recognition initialized."
  );
})();
