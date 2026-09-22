const gatewayScreen = document.getElementById("gatewayScreen");
const customerScreen = document.getElementById("customerScreen");
const shopDetailScreen = document.getElementById("shopDetailScreen");
const mapScreen = document.getElementById("mapScreen");
const shopkeeperScreen = document.getElementById("shopkeeperScreen");
const deliveryScreen = document.getElementById("deliveryScreen");

const messageBox = document.getElementById("messageBox");
const gatewayButtons = document.querySelectorAll(".gateway-card");

const backButton = document.getElementById("backButton");
const backToResultsButton = document.getElementById("backToResultsButton");
const backToShopButton = document.getElementById("backToShopButton");
const shopkeeperBackButton = document.getElementById("shopkeeperBackButton");
const deliveryBackButton = document.getElementById("deliveryBackButton");

const searchButton = document.getElementById("searchButton");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const shopDetailContent = document.getElementById("shopDetailContent");

const shopNameInput = document.getElementById("shopNameInput");
const ownerNameInput = document.getElementById("ownerNameInput");
const shopPhoneInput = document.getElementById("shopPhoneInput");
const shopAddressInput = document.getElementById("shopAddressInput");
const productPriceInput = document.getElementById("productPriceInput");
const productStockInput = document.getElementById("productStockInput");
const homeDeliveryInput = document.getElementById("homeDeliveryInput");
const saveShopButton = document.getElementById("saveShopButton");
const shopkeeperSaveResult = document.getElementById("shopkeeperSaveResult");
const reservationQueue = document.getElementById("reservationQueue");

const deliveryPersonName = document.getElementById("deliveryPersonName");
const deliveryPersonPhone = document.getElementById("deliveryPersonPhone");
const deliveryOnlineToggle = document.getElementById("deliveryOnlineToggle");
const saveDeliveryPartnerButton = document.getElementById("saveDeliveryPartnerButton");
const deliveryPartnerSaveResult = document.getElementById("deliveryPartnerSaveResult");
const deliveryJobQueue = document.getElementById("deliveryJobQueue");

let currentShopId = null;
let leafletMap = null;

let customerCountdownInterval = null;
let queueRefreshInterval = null;

const CARTO_API_KEY =
  window.SHOPFRONT_CONFIG?.CARTO_API_KEY || "";

const defaultShops = [
  {
    id: 1,
    name: "Patel Auto Parts",
    owner: "Demo Owner",
    product: "Honda Activa Brake Pad",
    price: 350,
    stock: 6,
    distance: "1.2 km away",
    address: "Sample Address, Nagpur",
    phone: "9876543210",
    delivery: true,
    lat: 21.1458,
    lng: 79.0882
  },

  {
    id: 2,
    name: "Sai Auto Spares",
    owner: "Demo Owner",
    product: "Honda Activa Brake Pad",
    price: 330,
    stock: 3,
    distance: "2.4 km away",
    address: "Sample Address 2, Nagpur",
    phone: "9876543211",
    delivery: false,
    lat: 21.1505,
    lng: 79.098
  },

  {
    id: 3,
    name: "City Two Wheeler Parts",
    owner: "Demo Owner",
    product: "Honda Activa Brake Pad",
    price: 370,
    stock: 8,
    distance: "3.1 km away",
    address: "Sample Address 3, Nagpur",
    phone: "9876543212",
    delivery: true,
    lat: 21.1355,
    lng: 79.08
  }
];

let shops = loadShops();
let bookings = loadBookings();
let deliveryJobs = loadDeliveryJobs();

/* =================================
   STORAGE
================================= */

function loadShops() {
  const saved = localStorage.getItem("shopfront_shops");

  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      console.error("Could not load shops:", error);
    }
  }

  const freshShops = JSON.parse(
    JSON.stringify(defaultShops)
  );

  localStorage.setItem(
    "shopfront_shops",
    JSON.stringify(freshShops)
  );

  return freshShops;
}

function saveShops() {
  localStorage.setItem(
    "shopfront_shops",
    JSON.stringify(shops)
  );
}

function loadBookings() {
  const saved = localStorage.getItem("shopfront_bookings");

  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error("Could not load bookings:", error);
    }
  }

  return [];
}

function saveBookings() {
  localStorage.setItem(
    "shopfront_bookings",
    JSON.stringify(bookings)
  );
}

function loadDeliveryJobs() {
  const saved = localStorage.getItem("shopfront_delivery_jobs");

  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error("Could not load delivery jobs:", error);
    }
  }

  return [];
}

function saveDeliveryJobs() {
  localStorage.setItem(
    "shopfront_delivery_jobs",
    JSON.stringify(deliveryJobs)
  );
}

/* =================================
   SCREEN CONTROL
================================= */

function showOnly(screen) {
  [
    gatewayScreen,
    customerScreen,
    shopDetailScreen,
    mapScreen,
    shopkeeperScreen,
    deliveryScreen
  ].forEach((item) => {
    item.classList.add("hidden");
  });

  screen.classList.remove("hidden");
}

/* =================================
   GATEWAYS
================================= */

gatewayButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.role;

    stopQueueRefresh();

    if (role === "customer") {
      showOnly(customerScreen);

      messageBox.textContent =
        "Customer gateway opened.";
    }

    if (role === "shopkeeper") {
      showOnly(shopkeeperScreen);

      loadShopkeeperForm();

      startQueueRefresh();

      messageBox.textContent =
        "Shopkeeper gateway opened.";
    }

    if (role === "delivery") {
      showOnly(deliveryScreen);

      loadDeliveryPartner();

      renderDeliveryJobs();

      messageBox.textContent =
        "Delivery Partner gateway opened.";
    }
  });
});

/* =================================
   BACK BUTTONS
================================= */

backButton.addEventListener("click", () => {
  stopQueueRefresh();

  showOnly(gatewayScreen);

  searchResults.innerHTML = "";
  searchInput.value = "";

  messageBox.textContent =
    "Select a gateway to continue.";
});

shopkeeperBackButton.addEventListener("click", () => {
  stopQueueRefresh();

  showOnly(gatewayScreen);

  messageBox.textContent =
    "Select a gateway to continue.";
});

deliveryBackButton.addEventListener("click", () => {
  showOnly(gatewayScreen);

  messageBox.textContent =
    "Select a gateway to continue.";
});

backToResultsButton.addEventListener("click", () => {
  clearInterval(customerCountdownInterval);

  showOnly(customerScreen);

  messageBox.textContent =
    "Back to search results.";
});

backToShopButton.addEventListener("click", () => {
  showOnly(shopDetailScreen);

  const shop = shops.find(
    (item) => item.id === currentShopId
  );

  if (shop) {
    messageBox.textContent =
      `${shop.name} opened.`;
  }
});

/* =================================
   CUSTOMER SEARCH
================================= */

searchButton.addEventListener("click", runSearch);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch();
  }
});

function runSearch() {
  processExpiredBookings();

  const query =
    searchInput.value.trim().toLowerCase();

  if (!query) {
    searchResults.innerHTML = `
      <p class="empty-result">
        Please type a product name.
      </p>
    `;

    messageBox.textContent =
      "Please enter a product name.";

    return;
  }

  const validSearch =
    query.includes("activa") &&
    (
      query.includes("brake") ||
      query.includes("break")
    ) &&
    (
      query.includes("pad") ||
      query.includes("pads")
    );

  if (!validSearch) {
    searchResults.innerHTML = `
      <p class="empty-result">
        For this prototype, search only:
        <strong>Activa brake pad</strong>
      </p>
    `;

    messageBox.textContent =
      "Prototype search currently supports Activa brake pads only.";

    return;
  }

  const availableShops =
    shops.filter(
      (shop) => Number(shop.stock) > 0
    );

  if (availableShops.length === 0) {
    searchResults.innerHTML = `
      <p class="empty-result">
        No shop currently has this product in stock.
      </p>
    `;

    messageBox.textContent =
      "No available stock found.";

    return;
  }

  searchResults.innerHTML =
    availableShops
      .map(
        (shop) => `
          <div class="shop-result">

            <h3>${shop.name}</h3>

            <p>
              <strong>
                ${shop.product}
              </strong>
            </p>

            <p>
              ₹${shop.price}
            </p>

            <p>
              In stock:
              ${shop.stock}
            </p>

            <p>
              ${shop.distance || "Nearby"}
            </p>

            <p>
              Home Delivery:
              <strong>
                ${
                  shop.delivery
                    ? "Available"
                    : "Not Available"
                }
              </strong>
            </p>

            <button
              class="view-shop-button"
              data-shop-id="${shop.id}"
            >
              View Shop
            </button>

          </div>
        `
      )
      .join("");

  document
    .querySelectorAll(".view-shop-button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openShop(
          Number(button.dataset.shopId)
        );
      });
    });

  messageBox.textContent =
    `${availableShops.length} shop(s) found.`;
}

/* =================================
   SHOP DETAILS
================================= */

function openShop(shopId) {
  processExpiredBookings();

  clearInterval(customerCountdownInterval);

  const shop = shops.find(
    (item) => item.id === shopId
  );

  if (!shop) {
    messageBox.textContent =
      "Shop could not be found.";

    return;
  }

  currentShopId = shopId;

  showOnly(shopDetailScreen);

  const activeBooking =
    bookings.find(
      (booking) =>
        booking.shopId === shopId &&
        booking.status === "active" &&
        booking.expiresAt > Date.now()
    );

  shopDetailContent.innerHTML = `
    <div class="shop-detail-card">

      <h2>${shop.name}</h2>

      <p>
        <strong>${shop.product}</strong>
      </p>

      <p>
        Price:
        ₹${shop.price}
      </p>

      <p>
        Stock:
        <span id="shopStock">
          ${shop.stock}
        </span>
      </p>

      <p>
        Distance:
        ${shop.distance || "Nearby"}
      </p>

      <p>
        Address:
        ${shop.address}
      </p>

      <p>
        Phone:
        ${shop.phone}
      </p>

      <p>
        Home Delivery:
        <strong>
          ${
            shop.delivery
              ? "Available"
              : "Not Available"
          }
        </strong>
      </p>

      <button
        class="reserve-button"
        id="reserveButton"
        ${
          activeBooking
            ? "disabled"
            : ""
        }
      >
        ${
          activeBooking
            ? "Reserved"
            : "Reserve for 2 Hours"
        }
      </button>

      <button
        class="map-button"
        id="viewMapButton"
      >
        View on Map
      </button>

      ${
        shop.delivery
          ? `
            <button
              class="map-button"
              id="requestDeliveryButton"
            >
              Request Home Delivery
            </button>
          `
          : ""
      }

      <div id="reservationBox"></div>

    </div>
  `;

  document
    .getElementById("reserveButton")
    .addEventListener("click", () => {
      reserveProduct(shop.id);
    });

  document
    .getElementById("viewMapButton")
    .addEventListener("click", () => {
      openMap(shop.id);
    });

  if (shop.delivery) {
    document
      .getElementById("requestDeliveryButton")
      .addEventListener("click", () => {
        requestHomeDelivery(shop.id);
      });
  }

  if (activeBooking) {
    renderCustomerBooking(
      activeBooking
    );
  }

  messageBox.textContent =
    `${shop.name} opened.`;
}

/* =================================
   PICKUP RESERVATION
================================= */

function reserveProduct(shopId) {
  processExpiredBookings();

  const shop = shops.find(
    (item) => item.id === shopId
  );

  if (!shop) {
    messageBox.textContent =
      "Shop could not be found.";

    return;
  }

  if (Number(shop.stock) <= 0) {
    messageBox.textContent =
      "This product is currently out of stock.";

    return;
  }

  const existingBooking =
    bookings.find(
      (booking) =>
        booking.shopId === shopId &&
        booking.status === "active" &&
        booking.expiresAt > Date.now()
    );

  if (existingBooking) {
    renderCustomerBooking(existingBooking);

    return;
  }

  const pickupCode =
    String(
      Math.floor(
        1000 +
        Math.random() * 9000
      )
    );

  const booking = {
    id: Date.now(),

    customerName:
      "Prototype Customer",

    shopId:
      shop.id,

    shopName:
      shop.name,

    product:
      shop.product,

    price:
      shop.price,

    pickupCode:
      pickupCode,

    bookedAt:
      Date.now(),

    expiresAt:
      Date.now() +
      2 * 60 * 60 * 1000,

    status:
      "active"
  };

  shop.stock =
    Number(shop.stock) - 1;

  bookings.push(booking);

  saveShops();
  saveBookings();

  const stockElement =
    document.getElementById("shopStock");

  if (stockElement) {
    stockElement.textContent =
      shop.stock;
  }

  const reserveButton =
    document.getElementById("reserveButton");

  if (reserveButton) {
    reserveButton.disabled = true;
    reserveButton.textContent = "Reserved";
  }

  renderCustomerBooking(
    booking
  );

  messageBox.textContent =
    `${shop.product} reserved at ${shop.name}.`;
}

function renderCustomerBooking(booking) {
  clearInterval(
    customerCountdownInterval
  );

  const reservationBox =
    document.getElementById("reservationBox");

  if (!reservationBox) {
    return;
  }

  reservationBox.innerHTML = `
    <div class="reservation-success">

      <h3>
        Reserved Successfully ✅
      </h3>

      <p>
        Your Activa Brake Pad
        is reserved at:
      </p>

      <p>
        <strong>
          ${booking.shopName}
        </strong>
      </p>

      <p>
        Pickup Code:
      </p>

      <div class="pickup-code">
        ${booking.pickupCode}
      </div>

      <p>
        Time Remaining:
      </p>

      <div
        id="countdownTimer"
        class="countdown-timer"
      >
        02:00:00
      </div>

      <p class="reservation-note">
        Reach the shop before
        the timer ends.
      </p>

    </div>
  `;

  updateCustomerCountdown(
    booking
  );

  customerCountdownInterval =
    setInterval(() => {
      processExpiredBookings();

      updateCustomerCountdown(
        booking
      );
    }, 1000);
}

function updateCustomerCountdown(booking) {
  const timerElement =
    document.getElementById("countdownTimer");

  const note =
    document.querySelector(".reservation-note");

  if (!timerElement) {
    return;
  }

  const freshBooking =
    bookings.find(
      (item) =>
        item.id === booking.id
    );

  if (!freshBooking) {
    return;
  }

  if (
    freshBooking.status ===
    "completed"
  ) {
    clearInterval(
      customerCountdownInterval
    );

    timerElement.textContent =
      "Collected";

    if (note) {
      note.textContent =
        "Pickup completed successfully.";
    }

    return;
  }

  if (
    freshBooking.status ===
    "expired"
  ) {
    clearInterval(
      customerCountdownInterval
    );

    timerElement.textContent =
      "Expired";

    if (note) {
      note.textContent =
        "Reservation expired. Stock has been released.";
    }

    const reserveButton =
      document.getElementById("reserveButton");

    if (reserveButton) {
      reserveButton.disabled = false;
      reserveButton.textContent =
        "Reserve for 2 Hours";
    }

    return;
  }

  const remaining =
    freshBooking.expiresAt -
    Date.now();

  if (remaining <= 0) {
    processExpiredBookings();

    return;
  }

  timerElement.textContent =
    formatRemainingTime(
      remaining
    );
}

function processExpiredBookings() {
  let changed = false;

  bookings.forEach(
    (booking) => {
      if (
        booking.status ===
          "active" &&
        booking.expiresAt <=
          Date.now()
      ) {
        booking.status =
          "expired";

        const shop =
          shops.find(
            (item) =>
              item.id ===
              booking.shopId
          );

        if (shop) {
          shop.stock =
            Number(shop.stock) + 1;
        }

        changed = true;
      }
    }
  );

  if (changed) {
    saveBookings();
    saveShops();
  }

  return changed;
}

function formatRemainingTime(milliseconds) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        milliseconds / 1000
      )
    );

  const hours =
    String(
      Math.floor(
        totalSeconds / 3600
      )
    ).padStart(2, "0");

  const minutes =
    String(
      Math.floor(
        (
          totalSeconds %
          3600
        ) / 60
      )
    ).padStart(2, "0");

  const seconds =
    String(
      totalSeconds % 60
    ).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

/* =================================
   HOME DELIVERY REQUEST
================================= */

function requestHomeDelivery(shopId) {
  const shop =
    shops.find(
      (item) =>
        item.id === shopId
    );

  if (!shop) {
    return;
  }

  if (!shop.delivery) {
    messageBox.textContent =
      "This shop does not offer home delivery.";

    return;
  }

  if (Number(shop.stock) <= 0) {
    messageBox.textContent =
      "This product is out of stock.";

    return;
  }

  const customerName =
    window.prompt(
      "Enter customer name:"
    );

  if (!customerName) {
    return;
  }

  const customerPhone =
    window.prompt(
      "Enter customer phone number:"
    );

  if (!customerPhone) {
    return;
  }

  const deliveryAddress =
    window.prompt(
      "Enter delivery address:"
    );

  if (!deliveryAddress) {
    return;
  }

  const job = {
    id:
      Date.now(),

    shopId:
      shop.id,

    shopName:
      shop.name,

    shopAddress:
      shop.address,

    product:
      shop.product,

    price:
      shop.price,

    customerName:
      customerName,

    customerPhone:
      customerPhone,

    deliveryAddress:
      deliveryAddress,

    status:
      "requested",

    createdAt:
      Date.now(),

    deliveryPartnerName:
      ""
  };

  shop.stock =
    Number(shop.stock) - 1;

  deliveryJobs.push(job);

  saveShops();
  saveDeliveryJobs();

  const stockElement =
    document.getElementById("shopStock");

  if (stockElement) {
    stockElement.textContent =
      shop.stock;
  }

  const reservationBox =
    document.getElementById("reservationBox");

  reservationBox.innerHTML = `
    <div class="reservation-success">

      <h3>
        Home Delivery Requested ✅
      </h3>

      <p>
        Product:
        <strong>
          ${job.product}
        </strong>
      </p>

      <p>
        Shop:
        <strong>
          ${job.shopName}
        </strong>
      </p>

      <p>
        Deliver to:
        <strong>
          ${job.deliveryAddress}
        </strong>
      </p>

      <p>
        Status:
        Waiting for delivery partner.
      </p>

    </div>
  `;

  messageBox.textContent =
    "Home delivery request created successfully.";
}

/* =================================
   MAP
================================= */

function openMap(shopId) {
  const shop =
    shops.find(
      (item) =>
        item.id === shopId
    );

  if (!shop) {
    messageBox.textContent =
      "Shop could not be found.";

    return;
  }

  currentShopId =
    shopId;

  showOnly(mapScreen);

  if (leafletMap) {
    leafletMap.remove();

    leafletMap = null;
  }

  setTimeout(() => {
    leafletMap =
      L.map("map").setView(
        [
          shop.lat,
          shop.lng
        ],
        15
      );

    L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
      {
        subdomains: "abcd",
        maxZoom: 20,
        attribution:
          '&copy; OpenStreetMap contributors &copy; CARTO'
      }
    ).addTo(
      leafletMap
    );

    L.marker(
      [
        shop.lat,
        shop.lng
      ]
    )
      .addTo(
        leafletMap
      )
      .bindPopup(`
        <strong>
          ${shop.name}
        </strong>

        <br>

        ${shop.product}

        <br>

        ₹${shop.price}

        <br>

        ${shop.address}
      `)
      .openPopup();

    leafletMap.invalidateSize();
  }, 100);

  messageBox.textContent =
    `Showing ${shop.name} on the map.`;
}

/* =================================
   SHOPKEEPER
================================= */

function loadShopkeeperForm() {
  processExpiredBookings();

  const shop =
    shops.find(
      (item) =>
        item.id === 1
    );

  if (!shop) {
    return;
  }

  shopNameInput.value =
    shop.name || "";

  ownerNameInput.value =
    shop.owner || "";

  shopPhoneInput.value =
    shop.phone || "";

  shopAddressInput.value =
    shop.address || "";

  productPriceInput.value =
    shop.price || "";

  productStockInput.value =
    shop.stock ?? "";

  homeDeliveryInput.checked =
    Boolean(shop.delivery);

  shopkeeperSaveResult
    .classList
    .add("hidden");

  shopkeeperSaveResult.innerHTML =
    "";

  renderReservationQueue();
}

saveShopButton.addEventListener(
  "click",
  saveShopkeeperData
);

function saveShopkeeperData() {
  const shopName =
    shopNameInput.value.trim();

  const ownerName =
    ownerNameInput.value.trim();

  const phone =
    shopPhoneInput.value.trim();

  const address =
    shopAddressInput.value.trim();

  const price =
    Number(
      productPriceInput.value
    );

  const stock =
    Number(
      productStockInput.value
    );

  const delivery =
    homeDeliveryInput.checked;

  if (
    !shopName ||
    !ownerName ||
    !phone ||
    !address
  ) {
    messageBox.textContent =
      "Please fill all shop details.";

    return;
  }

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    messageBox.textContent =
      "Please enter a valid product price.";

    return;
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    messageBox.textContent =
      "Please enter a valid stock quantity.";

    return;
  }

  const index =
    shops.findIndex(
      (item) =>
        item.id === 1
    );

  const oldShop =
    index >= 0
      ? shops[index]
      : null;

  const updatedShop = {
    id: 1,

    name:
      shopName,

    owner:
      ownerName,

    product:
      "Honda Activa Brake Pad",

    price:
      price,

    stock:
      stock,

    distance:
      "1.2 km away",

    address:
      address,

    phone:
      phone,

    delivery:
      delivery,

    lat:
      oldShop?.lat ??
      21.1458,

    lng:
      oldShop?.lng ??
      79.0882
  };

  if (index >= 0) {
    shops[index] =
      updatedShop;
  } else {
    shops.unshift(
      updatedShop
    );
  }

  saveShops();

  shopkeeperSaveResult.innerHTML = `
    <strong>
      Saved successfully ✅
    </strong>

    <br>

    ${updatedShop.name}

    <br>

    Honda Activa Brake Pad

    <br>

    ₹${updatedShop.price}

    <br>

    Stock:
    ${updatedShop.stock}
  `;

  shopkeeperSaveResult
    .classList
    .remove("hidden");

  messageBox.textContent =
    "Shop and inventory saved successfully.";
}

/* =================================
   PICKUP RESERVATION QUEUE
================================= */

function renderReservationQueue() {
  processExpiredBookings();

  const activeBookings =
    bookings.filter(
      (booking) =>
        booking.shopId === 1 &&
        booking.status ===
          "active"
    );

  if (
    activeBookings.length === 0
  ) {
    reservationQueue.innerHTML = `
      <p class="empty-result">
        No active reservations yet.
      </p>
    `;

    return;
  }

  reservationQueue.innerHTML =
    activeBookings
      .map((booking) => {
        const remaining =
          booking.expiresAt -
          Date.now();

        return `
          <div
            class="reservation-card"
            data-booking-id="${booking.id}"
          >

            <h4>
              ${booking.product}
            </h4>

            <span
              class="reservation-status"
            >
              ACTIVE
            </span>

            <p>
              Customer:
              <strong>
                ${booking.customerName}
              </strong>
            </p>

            <p>
              Shop:
              <strong>
                ${booking.shopName}
              </strong>
            </p>

            <p>
              Price:
              ₹${booking.price}
            </p>

            <p>
              Time Remaining:
              <strong
                class="queue-countdown"
                data-booking-id="${booking.id}"
              >
                ${formatRemainingTime(remaining)}
              </strong>
            </p>

            <input
              type="text"
              class="pickup-code-input"
              maxlength="4"
              inputmode="numeric"
              autocomplete="off"
              placeholder="Enter customer's 4-digit pickup code"
            />

            <button
              class="complete-pickup-button"
              data-booking-id="${booking.id}"
            >
              Complete Pickup
            </button>

            <div
              class="pickup-result"
            >
            </div>

          </div>
        `;
      })
      .join("");

  document
    .querySelectorAll(
      ".complete-pickup-button"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          completePickup(
            Number(
              button.dataset.bookingId
            )
          );
        }
      );
    });
}

function updateQueueCountdowns() {
  document
    .querySelectorAll(
      ".queue-countdown"
    )
    .forEach((element) => {
      const bookingId =
        Number(
          element.dataset.bookingId
        );

      const booking =
        bookings.find(
          (item) =>
            item.id === bookingId
        );

      if (
        !booking ||
        booking.status !==
          "active"
      ) {
        return;
      }

      const remaining =
        booking.expiresAt -
        Date.now();

      element.textContent =
        formatRemainingTime(
          remaining
        );
    });
}

function startQueueRefresh() {
  stopQueueRefresh();

  processExpiredBookings();

  renderReservationQueue();

  queueRefreshInterval =
    setInterval(() => {
      const changed =
        processExpiredBookings();

      if (changed) {
        renderReservationQueue();
      } else {
        updateQueueCountdowns();
      }
    }, 1000);
}

function stopQueueRefresh() {
  if (
    queueRefreshInterval
  ) {
    clearInterval(
      queueRefreshInterval
    );

    queueRefreshInterval =
      null;
  }
}

function completePickup(bookingId) {
  const booking =
    bookings.find(
      (item) =>
        item.id === bookingId
    );

  if (!booking) {
    return;
  }

  const card =
    document.querySelector(
      `.reservation-card[data-booking-id="${bookingId}"]`
    );

  if (!card) {
    return;
  }

  const input =
    card.querySelector(
      ".pickup-code-input"
    );

  const result =
    card.querySelector(
      ".pickup-result"
    );

  const enteredCode =
    input.value.trim();

  if (
    enteredCode.length !== 4
  ) {
    result.className =
      "pickup-result reservation-error";

    result.textContent =
      "Please enter the 4-digit pickup code.";

    input.focus();

    return;
  }

  if (
    enteredCode !==
    booking.pickupCode
  ) {
    result.className =
      "pickup-result reservation-error";

    result.textContent =
      "Incorrect pickup code.";

    input.select();

    return;
  }

  booking.status =
    "completed";

  booking.completedAt =
    Date.now();

  saveBookings();

  result.className =
    "pickup-result reservation-completed";

  result.textContent =
    "Pickup completed successfully ✅";

  input.disabled =
    true;

  const button =
    card.querySelector(
      ".complete-pickup-button"
    );

  button.disabled =
    true;

  button.textContent =
    "Completed";

  messageBox.textContent =
    "Pickup completed successfully.";

  setTimeout(() => {
    renderReservationQueue();
  }, 1500);
}

/* =================================
   DELIVERY PARTNER
================================= */

saveDeliveryPartnerButton.addEventListener(
  "click",
  saveDeliveryPartner
);

function loadDeliveryPartner() {
  const saved =
    localStorage.getItem(
      "shopfront_delivery_partner"
    );

  if (saved) {
    try {
      const partner =
        JSON.parse(saved);

      deliveryPersonName.value =
        partner.name || "";

      deliveryPersonPhone.value =
        partner.phone || "";

      deliveryOnlineToggle.checked =
        Boolean(
          partner.available
        );

      return;
    } catch (error) {
      console.error(
        "Could not load delivery partner:",
        error
      );
    }
  }

  deliveryPersonName.value =
    "";

  deliveryPersonPhone.value =
    "";

  deliveryOnlineToggle.checked =
    false;
}

function saveDeliveryPartner() {
  const name =
    deliveryPersonName.value.trim();

  const phone =
    deliveryPersonPhone.value.trim();

  const available =
    deliveryOnlineToggle.checked;

  if (
    !name ||
    !phone
  ) {
    messageBox.textContent =
      "Please enter delivery partner name and phone.";

    return;
  }

  const partner = {
    name:
      name,

    phone:
      phone,

    available:
      available
  };

  localStorage.setItem(
    "shopfront_delivery_partner",
    JSON.stringify(partner)
  );

  deliveryPartnerSaveResult.innerHTML = `
    <strong>
      Saved successfully ✅
    </strong>

    <br>

    ${name}

    <br>

    ${
      available
        ? "Available for deliveries"
        : "Currently offline"
    }
  `;

  deliveryPartnerSaveResult
    .classList
    .remove("hidden");

  messageBox.textContent =
    "Delivery partner status saved.";

  renderDeliveryJobs();
}

function renderDeliveryJobs() {
  if (
    deliveryJobs.length === 0
  ) {
    deliveryJobQueue.innerHTML = `
      <p class="empty-result">
        No delivery jobs yet.
      </p>
    `;

    return;
  }

  const visibleJobs =
    deliveryJobs.filter(
      (job) =>
        job.status !==
        "delivered"
    );

  if (
    visibleJobs.length === 0
  ) {
    deliveryJobQueue.innerHTML = `
      <p class="empty-result">
        No active delivery jobs.
      </p>
    `;

    return;
  }

  deliveryJobQueue.innerHTML =
    visibleJobs
      .map((job) => {

        let buttonText =
          "";

        if (
          job.status ===
          "requested"
        ) {
          buttonText =
            "Accept Delivery";
        }

        if (
          job.status ===
          "accepted"
        ) {
          buttonText =
            "Mark Picked Up";
        }

        if (
          job.status ===
          "picked_up"
        ) {
          buttonText =
            "Mark Delivered";
        }

        return `
          <div
            class="delivery-job-card"
            data-job-id="${job.id}"
          >

            <h4>
              ${job.product}
            </h4>

            <span
              class="delivery-job-status"
            >
              ${deliveryStatusLabel(job.status)}
            </span>

            <p>
              Pickup:
              <strong>
                ${job.shopName}
              </strong>
            </p>

            <p>
              Shop Address:
              ${job.shopAddress}
            </p>

            <p>
              Customer:
              <strong>
                ${job.customerName}
              </strong>
            </p>

            <p>
              Customer Phone:
              ${job.customerPhone}
            </p>

            <p>
              Deliver To:
              <strong>
                ${job.deliveryAddress}
              </strong>
            </p>

            <p>
              Product Price:
              ₹${job.price}
            </p>

            <button
              class="delivery-action-button"
              data-job-id="${job.id}"
            >
              ${buttonText}
            </button>

          </div>
        `;
      })
      .join("");

  document
    .querySelectorAll(
      ".delivery-action-button"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          advanceDeliveryJob(
            Number(
              button.dataset.jobId
            )
          );
        }
      );
    });
}

function deliveryStatusLabel(status) {
  if (
    status ===
    "requested"
  ) {
    return "NEW REQUEST";
  }

  if (
    status ===
    "accepted"
  ) {
    return "ACCEPTED";
  }

  if (
    status ===
    "picked_up"
  ) {
    return "PICKED UP";
  }

  if (
    status ===
    "delivered"
  ) {
    return "DELIVERED";
  }

  return status;
}

function advanceDeliveryJob(jobId) {
  const job =
    deliveryJobs.find(
      (item) =>
        item.id === jobId
    );

  if (!job) {
    return;
  }

  const partnerSaved =
    localStorage.getItem(
      "shopfront_delivery_partner"
    );

  if (!partnerSaved) {
    messageBox.textContent =
      "Save delivery partner details first.";

    return;
  }

  const partner =
    JSON.parse(
      partnerSaved
    );

  if (!partner.available) {
    messageBox.textContent =
      "Turn on 'Available for deliveries' first.";

    return;
  }

  if (
    job.status ===
    "requested"
  ) {
    job.status =
      "accepted";

    job.deliveryPartnerName =
      partner.name;

    job.acceptedAt =
      Date.now();

    messageBox.textContent =
      "Delivery accepted.";
  }

  else if (
    job.status ===
    "accepted"
  ) {
    job.status =
      "picked_up";

    job.pickedUpAt =
      Date.now();

    messageBox.textContent =
      "Product marked as picked up.";
  }

  else if (
    job.status ===
    "picked_up"
  ) {
    job.status =
      "delivered";

    job.deliveredAt =
      Date.now();

    messageBox.textContent =
      "Delivery completed successfully.";
  }

  saveDeliveryJobs();

  renderDeliveryJobs();
}