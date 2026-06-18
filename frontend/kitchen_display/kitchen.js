const socket = io("http://localhost:5000");

const placedOrders =
    document.getElementById("placedOrders");

const preparingOrders =
    document.getElementById("preparingOrders");

const liveIndicator =
    document.getElementById("liveIndicator");

const notificationSound =
    new Audio("./sounds/ding.mp3");

let knownOrders = new Set();
let firstLoad = true;
let audioUnlocked = false;


// =====================
// UNLOCK AUDIO
// =====================

document.addEventListener(
    "click",
    () => {

        if (!audioUnlocked) {

            notificationSound.play()
                .then(() => {

                    notificationSound.pause();
                    notificationSound.currentTime = 0;

                })
                .catch(() => {});

            audioUnlocked = true;
        }

    },
    { once: true }
);


// =====================
// SOCKET STATUS
// =====================

socket.on("connect", () => {

    liveIndicator.innerHTML =
        "🟢 LIVE";

});

socket.on("disconnect", () => {

    liveIndicator.innerHTML =
        "🔴 OFFLINE";

});


// =====================
// FOOD ICONS
// =====================

function getItemIcon(name) {

    const item =
        name.toLowerCase();

    if (item.includes("sandwich"))
        return "🥪";

    if (item.includes("coffee"))
        return "🥤";

    if (item.includes("water"))
        return "💧";

    return "🍽️";
}


// =====================
// LOAD ORDERS
// =====================

async function loadOrders() {

    try {

        const response =
            await fetch(
                "http://localhost:5000/kitchen/orders"
            );

        const orders =
            await response.json();

        renderOrders(orders);

    } catch (error) {

        console.error(
            "Failed to load orders:",
            error
        );

    }

}


// =====================
// TIMER HELPERS
// =====================

function getOrderAge(createdAt) {

    const created =
        new Date(createdAt);

    const now =
        new Date();

    const diff =
        Math.floor(
            (now - created) / 1000
        );

    const minutes =
        Math.floor(diff / 60);

    const seconds =
        diff % 60;

    return `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
}

function getAgeClass(createdAt) {

    const created =
        new Date(createdAt);

    const now =
        new Date();

    const minutes =
        (now - created) / 60000;

    if (minutes >= 5)
        return "age-red";

    if (minutes >= 2)
        return "age-yellow";

    return "age-normal";
}


// =====================
// RENDER ORDERS
// =====================

function renderOrders(orders) {

    placedOrders.innerHTML = "";
    preparingOrders.innerHTML = "";

    let placedCount = 0;
    let preparingCount = 0;

    orders.forEach(order => {

        const card =
            document.createElement("div");

        card.classList.add(
            "order-card"
        );

        const isNew =
            !firstLoad &&
            !knownOrders.has(order.id);

        knownOrders.add(order.id);

        let itemsHtml = "";

        order.items.forEach(item => {

            itemsHtml += `
<div class="item">
    <span>×${item.quantity}</span>
    <span>${getItemIcon(item.menuItem.name)}</span>
    <span class="item-name">${item.menuItem.name}</span>
</div>
`;
        });

        const badgeHtml =
            isNew
                ? `<div class="new-badge">NEW</div>`
                : "";

        const orderAge =
            getOrderAge(order.createdAt);

        const ageClass =
            getAgeClass(order.createdAt);

        card.innerHTML = `
            ${badgeHtml}

            <div class="token">
                ${order.tokenNumber}
            </div>

            <div class="items-section">
                ${itemsHtml}
            </div>

            <div
                class="time-section ${ageClass}"
                data-created-at="${order.createdAt}"
            >
                ${orderAge}
            </div>
        `;


        // =====================
        // PLACED
        // =====================

        if (order.status === "PLACED") {

            placedCount++;

            card.classList.add(
                "placed"
            );

            card.onclick = () => {

                card.classList.remove("placed");
                card.classList.add("preparing");

                preparingOrders.prepend(card);

                startPreparing(order.id);
            };

            if (isNew) {

                const token =
                    card.querySelector(".token");

                token.classList.add(
                    "token-glow"
                );

                notificationSound
                    .play()
                    .catch(() => {});

                setTimeout(() => {

                    token.classList.remove(
                        "token-glow"
                    );

                }, 5000);

            }

            placedOrders.appendChild(
                card
            );

        }


        // =====================
        // PREPARING
        // =====================

        if (order.status === "PREPARING") {

            preparingCount++;

            card.classList.add(
                "preparing"
            );

            card.onclick = () =>
                markReady(
                    order.id,
                    card
                );

            preparingOrders.appendChild(
                card
            );

        }

    });


    // =====================
    // COUNTS
    // =====================

    document.getElementById(
        "placedCount"
    ).innerText =
        placedCount;

    document.getElementById(
        "preparingCount"
    ).innerText =
        preparingCount;

    document.getElementById(
        "activeCount"
    ).innerText =
        placedCount +
        preparingCount;

    firstLoad = false;

}


// =====================
// PLACED → PREPARING
// =====================

async function startPreparing(id) {

    try {

        await fetch(
            `http://localhost:5000/kitchen/orders/${id}/start`,
            {
                method: "PATCH"
            }
        );

    } catch (error) {

        console.error(error);

    }

}


// =====================
// PREPARING → READY
// =====================

async function markReady(
    id,
    card
) {

    card.className =
        "order-card ready ready-card";

    card.innerHTML = `
        <div class="ready-check">
            ✓
        </div>

        <div class="ready-text">
            ORDER READY
        </div>
    `;

    setTimeout(async () => {

        try {

            await fetch(
                `http://localhost:5000/kitchen/orders/${id}/ready`,
                {
                    method: "PATCH"
                }
            );

        } catch (error) {

            console.error(error);

        }

    }, 2000);

}


// =====================
// SOCKET EVENTS
// =====================

socket.on(
    "ORDER_STATUS_UPDATED",
    loadOrders
);

socket.on(
    "ORDER_READY",
    loadOrders
);

socket.on(
    "NEW_ORDER",
    loadOrders
);


// =====================
// INITIAL LOAD
// =====================

loadOrders();


// =====================
// BACKUP REFRESH
// =====================

setInterval(() => {

    loadOrders();

}, 30000);


// =====================
// LIVE TIMERS
// =====================

setInterval(() => {

    const timers =
        document.querySelectorAll(".time-section");

    timers.forEach(timer => {

        const createdAt =
            timer.dataset.createdAt;

        if (!createdAt) return;

        timer.textContent =
            getOrderAge(createdAt);

    });

}, 1000);