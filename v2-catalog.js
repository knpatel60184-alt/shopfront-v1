(function () {
  "use strict";

  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const searchResults = document.getElementById("searchResults");
  const messageBox = document.getElementById("messageBox");
  const shopDetailScreen = document.getElementById("shopDetailScreen");
  const shopDetailContent = document.getElementById("shopDetailContent");

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

  function getClient() {
    if (client) return client;

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

  function showScreen(screenId) {
    screens.forEach(id => {
      document.getElementById(id).classList.add("hidden");
    });

    document.getElementById(screenId)
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
    addDetailLine(card, "Address", shop.address || "Not provided");
    addDetailLine(card, "Phone", shop.phone || "Not provided");

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

  async function searchOnline() {
    const requestId = ++latestSearch;
    const query = searchInput.value.trim();

    if (!query) {
      showResultMessage("Please enter a product name.");
      displayMessage("Search cannot be empty.");
      return;
    }

    showResultMessage("Searching the online Shopfront database...");
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

      if (requestId !== latestSearch) return;

      if (error) throw error;

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
      if (requestId !== latestSearch) return;

      console.error("V2 catalog error:", error);

      showResultMessage(
        `Online search failed: ${error.message}`
      );

      displayMessage(
        "Could not load the online catalog."
      );
    }
  }

  // Intercept only Customer search.
  // Preserve the original V1 shopkeeper and delivery code.

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

  console.log("Shopfront V2 online catalog initialized.");
})();