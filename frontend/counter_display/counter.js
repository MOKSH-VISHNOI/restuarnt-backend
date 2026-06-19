const socket = io("http://localhost:5000");

const readyOrders =
    document.getElementById("readyOrders");

const liveIndicator =
    document.getElementById("liveIndicator");

const fullscreenBtn =
    document.getElementById("fullscreenBtn");

let knownOrders = new Set();
let firstLoad = true;


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
// TIMER HELPERS
// =====================

function getReadyAge(readyAt) {

    const ready =
        new Date(readyAt);

    const now =
        new Date();

    const diff =
        Math.floor(
            (now - ready) / 1000
        );

    const minutes =
        Math.floor(diff / 60);

    const seconds =
        diff % 60;

    return `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
}


// =====================
// LOAD ORDERS
// =====================

async function loadOrders() {

    try {

        const response =
            await fetch(
                "http://localhost:5000/counter/orders"
            );

        const orders =
            await response.json();

        renderOrders(orders);

    } catch (error) {

        console.error(error);

    }

}


// =====================
// RENDER
// =====================

function renderOrders(orders) {

    readyOrders.innerHTML = "";

    document.getElementById(
        "readyCount"
    ).innerText =
        orders.length;

    let oldestTime = "0:00";

    if (orders.length > 0) {

        oldestTime =
            getReadyAge(
                orders[0].readyAt
            );
    }

    document.getElementById(
        "oldestWait"
    ).innerText =
        oldestTime;

    orders.forEach(order => {

        const card =
            document.createElement("div");

        card.classList.add(
            "order-card",
            "ready"
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
    <span>${item.menuItem.name}</span>
</div>
`;
        });

        card.innerHTML = `
            <div class="token">
                ${order.tokenNumber}
            </div>

            <div class="items-section">
                ${itemsHtml}
            </div>

            <div
                class="time-section"
                data-ready-at="${order.readyAt}"
            >
                ${getReadyAge(order.readyAt)}
            </div>

            <button class="collect-btn">
                ✓ COLLECTED
            </button>
        `;

        const collectBtn =
            card.querySelector(
                ".collect-btn"
            );

        collectBtn.onclick =
            (e) => {

                e.stopPropagation();

                markCollected(
                    order.id,
                    card
                );
            };

        if (isNew) {

            card.classList.add(
                "new-ready"
            );

            setTimeout(() => {

                card.classList.remove(
                    "new-ready"
                );

            }, 5000);
        }

        readyOrders.appendChild(
            card
        );

    });

    firstLoad = false;
}


// =====================
// COLLECT
// =====================

async function markCollected(
    id,
    card
) {

    card.className =
        "order-card completed completed-card";

    card.innerHTML = `
        <div class="completed-check">
            ✓
        </div>

        <div class="completed-text">
            ORDER COMPLETED
        </div>
    `;

    setTimeout(async () => {

        try {

            await fetch(
                `http://localhost:5000/counter/orders/${id}/collect`,
                {
                    method: "PATCH"
                }
            );

        } catch (error) {

            console.error(error);

        }

    }, 1000);

}


// =====================
// SOCKET EVENTS
// =====================

socket.on(
    "ORDER_READY",
    loadOrders
);

socket.on(
    "ORDER_COLLECTED",
    loadOrders
);

socket.on(
    "COUNTER_REFRESH",
    loadOrders
);

socket.on(
    "ORDER_STATUS_UPDATED",
    loadOrders
);


// =====================
// FULLSCREEN
// =====================

fullscreenBtn.onclick =
async () => {

    if (
        !document.fullscreenElement
    ) {

        await document
            .documentElement
            .requestFullscreen();

        fullscreenBtn.innerHTML =
            "🗗 Exit";

    } else {

        await document
            .exitFullscreen();

        fullscreenBtn.innerHTML =
            "⛶ Fullscreen";
    }
};


// =====================
// WAKE LOCK
// =====================

let wakeLock = null;

async function keepScreenAwake() {

    try {

        wakeLock =
            await navigator
                .wakeLock
                .request("screen");

    } catch (err) {

        console.log(err);

    }

}

keepScreenAwake();

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            wakeLock !== null &&
            document.visibilityState ===
                "visible"
        ) {

            keepScreenAwake();

        }

    }
);


// =====================
// INITIAL LOAD
// =====================

loadOrders();


// =====================
// LIVE TIMERS
// =====================

setInterval(() => {

    const timers =
        document.querySelectorAll(
            ".time-section"
        );

    timers.forEach(timer => {

        const readyAt =
            timer.dataset.readyAt;

        if (!readyAt) return;

        timer.textContent =
            getReadyAge(
                readyAt
            );

    });

}, 1000);


// =====================
// BACKUP REFRESH
// =====================

setInterval(() => {

    loadOrders();

}, 30000);