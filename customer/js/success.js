// ==========================================
// SUCCESS PAGE
// ==========================================


// ==========================================
// DOM
// ==========================================

const tokenNumber =

    document.getElementById(
        "tokenNumber"
    );

const progressContainer =

    document.getElementById(
        "progressContainer"
    );

const statusTitle =

    document.getElementById(
        "statusTitle"
    );

const statusMessage =

    document.getElementById(
        "statusMessage"
    );

const statusCard =

    document.querySelector(
        ".status-card"
    );


// ==========================================
// STATE
// ==========================================

let currentOrder = null;

let polling = null;

let readyNotificationSent = false;

let previousStatus = null;


// ==========================================
// INIT
// ==========================================

function init(){

    loadOrder();

    createProgressBar();

    updateStatus();

    startPolling();

}

document.addEventListener(

    "DOMContentLoaded",

    init

);

// ==========================================
// LOAD ORDER
// ==========================================

function loadOrder(){

    const storedOrder =

        localStorage.getItem(

            "currentOrder"

        );

    if(!storedOrder){

        window.location.href =

            "index.html";

        return;

    }

    currentOrder =

        JSON.parse(

            storedOrder

        );

    tokenNumber.textContent =

        currentOrder.tokenNumber;

    previousStatus =

        currentOrder.status;

}

// ==========================================
// CREATE PROGRESS BAR
// ==========================================

function createProgressBar(){

    progressContainer.innerHTML = `

        <svg

            class="progress-svg"

            viewBox="0 0 320 70"

        >

            <!-- Background Line -->

            <line

                x1="55"

                y1="35"

                x2="265"

                y2="35"

                class="progress-line"

            />

            <!-- Active Line -->

            <line

                id="progressActive"

                x1="55"

                y1="35"

                x2="55"

                y2="35"

                class="progress-active"

            />

            <!-- Node 1 -->

            <circle

                id="nodeReceived"

                class="progress-node"

                cx="55"

                cy="35"

                r="10"

            />

            <!-- Node 2 -->

            <circle

                id="nodePreparing"

                class="progress-node"

                cx="160"

                cy="35"

                r="10"

            />

            <!-- Node 3 -->

            <circle

                id="nodeReady"

                class="progress-node"

                cx="265"

                cy="35"

                r="10"

            />

            <!-- Labels -->

            <text

                x="55"

                y="62"

                text-anchor="middle"

                class="progress-label"

            >

                Received

            </text>

            <text

                x="160"

                y="62"

                text-anchor="middle"

                class="progress-label"

            >

                Preparing

            </text>

            <text

                x="265"

                y="62"

                text-anchor="middle"

                class="progress-label"

            >

                Ready

            </text>

        </svg>

    `;

}

// ==========================================
// UPDATE STATUS
// ==========================================

function updateStatus(){

    const nodeReceived =

        document.getElementById(
            "nodeReceived"
        );

    const nodePreparing =

        document.getElementById(
            "nodePreparing"
        );

    const nodeReady =

        document.getElementById(
            "nodeReady"
        );

    const activeLine =

        document.getElementById(
            "progressActive"
        );

    const labels =

        document.querySelectorAll(
            ".progress-label"
        );

    // Reset

    nodeReceived.classList.remove("active");
    nodePreparing.classList.remove("active");
    nodeReady.classList.remove("active");

    labels.forEach(label =>

        label.classList.remove("active")

    );

    statusCard.classList.remove("ready");



    switch(currentOrder.status){

        // ======================================
        // ORDER RECEIVED
        // ======================================

        case "PLACED":

            nodeReceived.classList.add(
                "active"
            );

            labels[0].classList.add(
                "active"
            );

            activeLine.setAttribute(

                "x2",

                "55"

            );

            statusTitle.textContent =

                "Order Received";

            statusMessage.textContent =

                "Your order has reached the kitchen.";

            break;



        // ======================================
        // PREPARING
        // ======================================

        case "PREPARING":

            nodeReceived.classList.add(
                "active"
            );

            nodePreparing.classList.add(
                "active"
            );

            labels[0].classList.add(
                "active"
            );

            labels[1].classList.add(
                "active"
            );

            activeLine.setAttribute(

                "x2",

                "160"

            );

            statusTitle.textContent =

                "Preparing";

            statusMessage.textContent =

                "Our chefs are preparing your order.";

            break;



        // ======================================
        // READY
        // ======================================

        case "READY":

            nodeReceived.classList.add(
                "active"
            );

            nodePreparing.classList.add(
                "active"
            );

            nodeReady.classList.add(
                "active"
            );

            labels[0].classList.add(
                "active"
            );

            labels[1].classList.add(
                "active"
            );

            labels[2].classList.add(
                "active"
            );

            activeLine.setAttribute(

                "x2",

                "265"

            );

            statusCard.classList.add(
                "ready"
            );

            statusTitle.textContent =

                "Ready for Pickup";

            statusMessage.textContent =

                "Please collect your order from the counter.";

            // Trigger notification once

            if(

                !readyNotificationSent

            ){

                readyNotificationSent = true;

                notifyReady();

            }

            break;

    }

}

// ==========================================
// START POLLING
// ==========================================

function startPolling(){

    polling = setInterval(

        fetchLatestOrder,

        5000

    );

}

// ==========================================
// FETCH LATEST ORDER
// ==========================================

async function fetchLatestOrder(){

    try{

        const latestOrder =

            await getOrder(

                currentOrder.id

            );

        if(

            latestOrder.status ===

            "COLLECTED"

        ){

            finishOrder();

            return;

        }

        if(

            latestOrder.status !==

            previousStatus

        ){

            previousStatus =

                latestOrder.status;

            currentOrder =

                latestOrder;

            updateStatus();

        }

    }

    catch(error){

        console.error(

            error

        );

    }

}

// ==========================================
// FINISH ORDER
// ==========================================

function finishOrder(){

    clearInterval(

        polling

    );

    localStorage.removeItem(

        "currentOrder"

    );

    document.body.style.opacity =

        "0";

    setTimeout(()=>{

        window.location.href =

            "index.html";

    },300);

}


// ==========================================
// FETCH LATEST ORDER
// ==========================================

async function fetchLatestOrder(){

    try{

        const latestOrder =

            await getOrder(

                currentOrder.id

            );

        // Order collected

        if(

            latestOrder.status ===

            "COLLECTED"

        ){

            finishOrder();

            return;

        }

        // Update UI only if status changed

        if(

            latestOrder.status !==

            previousStatus

        ){

            previousStatus =

                latestOrder.status;

            currentOrder =

                latestOrder;

            updateStatus();

        }

    }

    catch(error){

        console.error(

            "Polling Error:",

            error

        );

    }

}
// ==========================================
// FINISH ORDER
// ==========================================

function finishOrder(){

    clearInterval(

        polling

    );

    localStorage.removeItem(

        "currentOrder"

    );

    document.body.style.opacity = "0";

    setTimeout(()=>{

        window.location.href =

            "index.html";

    },300);

}

// ==========================================
// READY NOTIFICATION
// ==========================================

async function notifyReady(){

    playNotificationSound();

    vibratePhone();

    showBrowserNotification();

}

// ==========================================
// PLAY SOUND
// ==========================================

function playNotificationSound(){

    const audio = new Audio(

        "./sounds/order-ready.mp3"

    );

    audio.play().catch(

        error =>

            console.log(

                "Sound blocked:",

                error

            )

    );

}

// ==========================================
// VIBRATE
// ==========================================

function vibratePhone(){

    if(

        navigator.vibrate

    ){

        navigator.vibrate(

            [300,100,300]

        );

    }

}

// ==========================================
// BROWSER NOTIFICATION
// ==========================================

async function showBrowserNotification(){

    if(

        !("Notification" in window)

    ){

        return;

    }

    if(

        Notification.permission ===

        "default"

    ){

        await Notification.requestPermission();

    }

    if(

        Notification.permission ===

        "granted"

    ){

        new Notification(

            "Yatharth Café",

            {

                body:

                    `Token ${currentOrder.tokenNumber} is ready for pickup.`,

                icon:

                    "./images/logo.png"

            }

        );

    }

}