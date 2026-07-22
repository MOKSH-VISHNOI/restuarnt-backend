// ==========================================
// ORDER STATUS PAGE
// ==========================================


// ==========================================
// DOM
// =======================================

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


const viewBillButton =

    document.getElementById(
        "viewBillButton"
    );

const orderSheetOverlay =
    document.getElementById(
        "orderSheetOverlay"
    );

const orderSheetItems =
    document.getElementById(
        "orderSheetItems"
    );

const orderSheetSubtotal =
    document.getElementById(
        "orderSheetSubtotal"
    );

const orderSheetTax =
    document.getElementById(
        "orderSheetTax"
    );

const orderSheetTotal =
    document.getElementById(
        "orderSheetTotal"
    );

const closeOrderSheetButton =
    document.getElementById(
        "closeOrderSheetButton"
    );

const currentOrderSummary =
    document.getElementById(
        "currentOrderSummary"
    );


// ==========================================
// OTHER ORDERS DOM
// ==========================================

const otherOrdersList =

    document.getElementById(

        "otherOrdersList"

    );


const otherOrdersCount =

    document.getElementById(

        "otherOrdersCount"

    );
  
// ==========================================
// EVENT LISTENERS 
// ==========================================

viewBillButton?.addEventListener(
    "click",
    openOrderSheet
);

closeOrderSheetButton?.addEventListener(
    "click",
    closeOrderSheet
);

orderSheetOverlay?.addEventListener(
    "click",
    event => {

        if(
            event.target ===
            orderSheetOverlay
        ){

            closeOrderSheet();

        }

    }
);



// ==========================================
// STATE
// ==========================================

let currentOrder = null;

let customerOrders = [];

let polling = null;

// ==========================================
// READY NOTIFICATION STATE
// ==========================================

const notifiedReadyOrders = new Set();


let previousStatus = null;

// ==========================================
// UI STATE
// ==========================================

let selectedOrder = null;


// ==========================================
// INITIALIZE
// ==========================================
async function initializeSuccess(){

    createProgressBar();

    if(!loadOrder()){
        return;
    }

    loadCustomerOrders();

    renderOtherOrders();

    await syncCustomerOrders();

    updateStatus();

    startPolling();

}


// ==========================================
// LOAD ORDER
// ==========================================

function loadOrder(){

    const storedOrder =

        localStorage.getItem(

            "currentOrder"

        );

        if(!storedOrder){

            return false;
        
        }

        currentOrder =

        JSON.parse(
    
            storedOrder
    
        );
    
    
    // Initially the UI follows
    // the current order
    
    selectedOrder = currentOrder;

    previousStatus = selectedOrder.status;
    
    renderSelectedOrder();
    
    return true;
}


// ==========================================
// LOAD CUSTOMER ORDERS
// ==========================================

function loadCustomerOrders(){

    const storedOrders =

        localStorage.getItem(

            "customerOrders"

        );


    if(!storedOrders){

        customerOrders = [];

        return;

    }


    try{

        customerOrders =

            JSON.parse(

                storedOrders

            );


        if(

            !Array.isArray(

                customerOrders

            )

        ){

            customerOrders = [];

        }

    }

    catch(error){

        console.error(

            "Failed to load customer orders:",

            error

        );

        customerOrders = [];

    }

}


// ==========================================
// RENDER OTHER ORDERS
// ==========================================

function renderOtherOrders(){

    if(

        !otherOrdersList ||

        !otherOrdersCount

    ){

        return;

    }


    // Exclude the order currently shown
    // in the main status tracker

    const otherOrders =

        customerOrders.filter(

            order =>

                order.id !==

                currentOrder?.id

        );


    // Update count

    otherOrdersCount.textContent =

        `(${otherOrders.length})`;


    // Clear previous content

    otherOrdersList.innerHTML = "";


    // Empty state

    if(

        otherOrders.length === 0

    ){

        const emptyState =

            document.createElement(

                "div"

            );


        emptyState.className =

            "other-orders-empty";


        emptyState.innerHTML = `

            <span class="empty-orders-text">

                No other active orders

            </span>

        `;


        otherOrdersList.appendChild(

            emptyState

        );


        return;

    }


    // Render other orders

    otherOrders.forEach(

        order => {

            const orderItem =

                document.createElement(

                    "div"

                );


            orderItem.className =

                "other-order-item";


            orderItem.innerHTML = `

                <span class="other-order-token">

                    Token ${order.tokenNumber}

                </span>


                <span
                    class="other-order-status ${order.status.toLowerCase()}"
                >

                    ${formatOrderStatus(

                        order.status

                    )}

                </span>

            `;


            otherOrdersList.appendChild(

                orderItem

            );

        }

    );

}



// ==========================================
// FORMAT ORDER STATUS
// ==========================================

function formatOrderStatus(status){

    switch(status){

        case "PLACED":

            return "Received";


        case "PREPARING":

            return "Preparing";


        case "READY":

            return "Ready";


        default:

            return status;

    }

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


    if(!selectedOrder){

        return;

    }

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

    activeLine.setAttribute(

        "x2",
    
        "55"
    
    );

    switch(selectedOrder.status){

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

                currentOrder &&
            
                !notifiedReadyOrders.has(
            
                    currentOrder.id
            
                )
            
            ){
            
                notifiedReadyOrders.add(
            
                    currentOrder.id
            
                );
            
                notifyReady();
            
            }

            break;

    }

}



// ==========================================
// START POLLING
// ==========================================

function startPolling(){

    if(polling){

        clearInterval(

            polling

        );

    }


    polling = setInterval(

        async () => {

            try{

                await syncCustomerOrders();

            }

            catch(error){

                console.error(

                    "Order polling failed:",

                    error

                );

            }

        },

        5000

    );

}




// ==========================================
// SYNC CUSTOMER ORDERS
// ==========================================

async function syncCustomerOrders(){

    if(

        !customerOrders ||

        customerOrders.length === 0

    ){

        return;

    }


    try{

        // ==========================================
        // FETCH FRESH DATA FOR ALL CUSTOMER ORDERS
        // ==========================================

        const updatedOrders =

            await Promise.all(

                customerOrders.map(

                    async order => {

                        try{

                            return await getOrder(

                                order.id

                            );

                        }

                        catch(error){

                            console.error(

                                `Failed to update order ${order.id}:`,

                                error

                            );


                            // Keep previous local data
                            // if this specific request fails

                            return order;

                        }

                    }

                )

            );


        // ==========================================
        // REMOVE COLLECTED ORDERS
        // ==========================================

        const activeOrders =

            updatedOrders.filter(

                order =>

                    order.status !==

                    "COLLECTED"

            );


        // Check whether the current order
        // is still active

        const currentOrderStillActive =

            activeOrders.find(

                order =>

                    order.id ===

                    currentOrder?.id

            );


        // Replace local customer orders
        // with active orders only

        customerOrders =

            activeOrders;


        // ==========================================
        // SAVE ACTIVE CUSTOMER ORDERS
        // ==========================================

        localStorage.setItem(

            "customerOrders",

            JSON.stringify(

                customerOrders

            )

        );


        // ==========================================
        // NO ACTIVE ORDERS REMAIN
        // ==========================================

        if(

            customerOrders.length === 0

        ){

            handleNoActiveOrders();

            return;

        }


        const wasViewingCurrentOrder =

            selectedOrder?.id === currentOrder?.id;

        // ==========================================
        // CURRENT ORDER STILL ACTIVE
        // ==========================================

        if(currentOrderStillActive){

            currentOrder =
        
                currentOrderStillActive;
        
            if(wasViewingCurrentOrder){
        
                selectedOrder =
        
                    currentOrder;
        
            }
        
        }


        // ==========================================
        // CURRENT ORDER WAS COLLECTED
        // PROMOTE NEXT ACTIVE ORDER
        // ==========================================

        else{

            currentOrder =

                customerOrders[0];


        // New current order becomes
        // the default viewed order

        selectedOrder = currentOrder;

        previousStatus = currentOrder.status;

        
    }

    localStorage.setItem(

        "currentOrder",

        JSON.stringify(

            currentOrder

        )

    );


    // ==========================================
    // REFRESH UI
    // ==========================================

    renderSelectedOrder();

    renderOtherOrders();
    }

    catch(error){

        console.error(

            "Failed to sync customer orders:",

            error

        );

    }

}


// ==========================================
// HANDLE NO ACTIVE ORDERS
// ==========================================

function handleNoActiveOrders(){

    // Stop polling

    if(polling){

        clearInterval(

            polling

        );

        polling = null;

    }


    // Clear order storage

    localStorage.removeItem(

        "currentOrder"

    );


    localStorage.removeItem(

        "customerOrders"

    );


    currentOrder = null;

    selectedOrder = null;
    
    customerOrders = [];
    
    notifiedReadyOrders.clear();


    // Return to customer landing page

    window.location.href =

        "./index.html";

}

 


// ==========================================
// READY NOTIFICATION
// ==========================================

async function notifyReady(){

    playNotificationSound();

    vibratePhone();

    await showBrowserNotification();

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

// ==========================================
// OPEN CURRENT ORDER
// ==========================================

function openOrderSheet(){

    if(
        !selectedOrder ||
        !orderSheetOverlay
    ){

        return;

    }

    renderCurrentOrder();

    orderSheetOverlay.classList.remove(
        "hidden"
    );

    requestAnimationFrame(()=>{

        orderSheetOverlay.classList.add(
            "show"
        );

    });

}


// ==========================================
// CLOSE CURRENT ORDER
// ==========================================

function closeOrderSheet(){

    if(!orderSheetOverlay){

        return;

    }

    orderSheetOverlay.classList.remove(
        "show"
    );

    setTimeout(()=>{

        orderSheetOverlay.classList.add(
            "hidden"
        );

    },350);

}


// ==========================================
// RENDER CURRENT ORDER
// ==========================================

function renderCurrentOrder(){

    if(
        !selectedOrder ||
        !orderSheetItems
    ){

        return;

    }

    orderSheetItems.innerHTML = "";

    let subtotal = 0;

    selectedOrder.items.forEach(item => {

        const menuItem =
            item.menuItem;

        if(!menuItem){

            return;

        }

        const lineTotal =
            menuItem.price *
            item.quantity;

        subtotal += lineTotal;

        const orderItem =
            document.createElement(
                "article"
            );

        orderItem.className =
            "checkout-item";

        orderItem.innerHTML = `

            <img
                src="${menuItem.imageUrl
        ? `./images/${menuItem.imageUrl}`
        : "./images/placeholder.png"
        }"
        alt="${menuItem.name}"
        class="cart-item-image"
            >

            <div class="cart-item-info">

                <h3>
                    ${menuItem.name}
                </h3>

                <p>
                    ₹${menuItem.price} × ${item.quantity}
                </p>

            </div>

            <div class="cart-item-right">

                <span class="line-total">
                    ₹${lineTotal}
                </span>

            </div>

        `;

        orderSheetItems.appendChild(
            orderItem
        );

    });

    orderSheetSubtotal.textContent =
        `₹${subtotal}`;

    orderSheetTax.textContent =
        "₹0";

    orderSheetTotal.textContent =
        `₹${subtotal}`;

}


// ==========================================
// UPDATE CURRENT ORDER SUMMARY
// ==========================================

function updateCurrentOrderSummary(){

    if(
        !selectedOrder ||
        !currentOrderSummary
    ){

        return;

    }

    const totalItems =
        selectedOrder.items.reduce(
            (total, item) =>
                total + item.quantity,
            0
        );

    const totalAmount =
        selectedOrder.totalAmount ?? 0;

    currentOrderSummary.textContent =
        `${totalItems} ${
            totalItems === 1
                ? "Item"
                : "Items"
        } • ₹${totalAmount}`;

}


// ==========================================
// RENDER SELECTED ORDER
// ==========================================

function renderSelectedOrder(){

    if(!selectedOrder){

        return;

    }

    tokenNumber.textContent =

        selectedOrder.tokenNumber;

    updateStatus();

    updateCurrentOrderSummary();

    renderCurrentOrder();

}


// ==========================================
// START PAGE
// ==========================================

document.addEventListener(

    "DOMContentLoaded",

    initializeSuccess

);



