let currentHighlightedToken = null;

const socket = io();

const preparingDiv = document.getElementById("preparing");
const readyDiv = document.getElementById("ready");

async function loadDisplay() {

    try {

        const response = await fetch("/display");

        const data = await response.json();

        console.log(data);

        render(data);

    } catch (error) {

        console.error("Display Load Failed:", error);

    }
}

function render(data) {

    preparingDiv.innerHTML = "";
    readyDiv.innerHTML = "";

    const preparingOrders = data?.preparing || [];
    const readyOrders = data?.ready || [];

    preparingOrders.forEach(order => {

        const token =
            document.createElement("div");
    
        token.className =
            "token";
    
        token.textContent =
            order.tokenNumber;
    
        if (
            preparingOrders.length > 12
        ) {
            token.classList.add(
                "compact"
            );
        }
    
        preparingDiv.appendChild(
            token
        );
    
    });

    readyOrders.forEach(order => {

        const token =
            document.createElement("div");
    
        token.className =
            "token ready-token";
    
        token.id =
            `token-${order.tokenNumber}`;
    
        token.textContent =
            order.tokenNumber;
    
        if (
            readyOrders.length > 12
        ) {
            token.classList.add(
                "compact"
            );
        }
    
        readyDiv.appendChild(
            token
        );
    
    });
}

function highlightNewestReady(tokenNumber) {

    if (currentHighlightedToken) {
        currentHighlightedToken.classList.remove("new-ready");
    }

    const tokenElement =
        document.getElementById(`token-${tokenNumber}`);

    if (!tokenElement) return;

    currentHighlightedToken = tokenElement;

    tokenElement.classList.add("new-ready");

    setTimeout(() => {

        if (currentHighlightedToken === tokenElement) {

            tokenElement.classList.remove("new-ready");

            currentHighlightedToken = null;
        }

    }, 10000);
}

socket.on("ORDER_STATUS_UPDATED", async (order) => {

    console.log("STATUS UPDATED", order);

    await loadDisplay();

    if (order.status === "READY") {

        setTimeout(() => {

            highlightNewestReady(order.tokenNumber);

        }, 200);

    }

});

socket.on("ORDER_STATUS_UPDATED", () => {

    loadDisplay();

});

socket.on("DISPLAY_REFRESH", () => {

    loadDisplay();

});
socket.on("connect", () => {

    console.log("🟢 Display Connected");

});

socket.on("disconnect", () => {

    console.log("🔴 Display Disconnected");

});
loadDisplay();
setInterval(loadDisplay, 5000);
