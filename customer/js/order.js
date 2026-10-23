// ==========================================
// YATHARTH ORDER ENGINE
// ==========================================

const storedPendingPaymentOrderId = Number(
    sessionStorage.getItem("yatharth_pending_payment_order_id")
);
let pendingPaymentOrderId = Number.isSafeInteger(storedPendingPaymentOrderId) && storedPendingPaymentOrderId > 0
    ? storedPendingPaymentOrderId
    : null;
let pendingPaymentOrder = null;
let isRecoveringPendingPayment = pendingPaymentOrderId !== null;

// Recover only the payment the customer was actively completing. Completed historical
// attempts stay available for lookup but must not redirect a deliberate new order.
(async function recoverPendingPayment() {
    try {
        const orderId = sessionStorage.getItem("yatharth_pending_payment_order_id");
        if (!orderId) return;

        const resp = await getPaymentAttempts(orderId);
        if (!resp?.success || !resp.order) return;

        const order = resp.order;
        pendingPaymentOrder = order;
        saveCustomerOrder(order);
        localStorage.setItem("currentOrder", JSON.stringify(order));

        if (order.status !== "PENDING_PAYMENT" || order.paymentState === "ATTEMPTS_EXHAUSTED") {
            sessionStorage.removeItem("yatharth_pending_payment_order_id");
            pendingPaymentOrder = null;
            sessionStorage.setItem("viewedOrderId", String(order.id));
            window.location.href = "./order.html";
            return;
        }

        pendingPaymentOrderId = order.id;
    } catch (err) {
        console.warn("Payment recovery check failed:", err);
    } finally {
        isRecoveringPendingPayment = false;
    }
})();

// ==========================================
// DOM
// ==========================================

const placeOrderButton =

    document.getElementById(
        "placeOrderButton"
    );


// ==========================================
// ORDER STATE
// ==========================================

let isPlacingOrder = false;
let activeRazorpayCheckout = null;


// ==========================================
// EVENT
// ==========================================

if(placeOrderButton){

    placeOrderButton.addEventListener(

        "click",

        placeOrder

    );

}


// ==========================================
// PLACE ORDER
// ==========================================

async function placeOrder(){

    if(isRecoveringPendingPayment){
        return;
    }

    if(isPlacingOrder){
        return;
    }

    if(cart.length === 0){
        alert(
            "Your cart is empty."
        );
        return;
    }

    isPlacingOrder = true;

    placeOrderButton.disabled = true;

    placeOrderButton.textContent =
        "Creating Payment...";

    const orderData =
        buildOrderPayload();

    try{

        // ==========================================
        // 1. CREATE PENDING PAYMENT ORDER
        // ==========================================

        let order = null;

        if (pendingPaymentOrderId !== null) {
            // Load the authoritative prior order before deciding whether this is
            // a retry of the same cart or a genuinely new cart.
            if (!pendingPaymentOrder) {
                const recovered = await getPaymentAttempts(pendingPaymentOrderId);
                if (!recovered?.success || !recovered.order) {
                    throw new Error("The previous order payment is still being checked. Please retry in a moment.");
                }
                pendingPaymentOrder = recovered.order;
            }

            if (!orderMatchesCart(pendingPaymentOrder, cart)) {
                const failureIsDefinitive = ["RETRY_AVAILABLE", "ATTEMPTS_EXHAUSTED"]
                    .includes(pendingPaymentOrder.paymentState);
                if (!failureIsDefinitive) {
                    throw new Error("The previous payment is still unresolved. Wait for its status before starting a different order.");
                }

                // A changed cart must get a new server-calculated total and a new
                // restaurant order. The failed order remains in order history.
                sessionStorage.removeItem("yatharth_pending_payment_order_id");
                pendingPaymentOrderId = null;
                pendingPaymentOrder = null;
            } else {
                order = pendingPaymentOrder;
            }
        }

        if (!order) {
            // Keep the order key tied to this cart so transport retries return
            // the same server-side order, while a changed cart gets a new key.
            const cartIdentity = JSON.stringify({
                branchId: orderData.branchId,
                paymentRequired: orderData.paymentRequired,
                items: [...orderData.items]
                    .map((item) => ({ menuItemId: Number(item.menuItemId), quantity: Number(item.quantity) }))
                    .sort((a, b) => a.menuItemId - b.menuItemId || a.quantity - b.quantity),
            });
            const orderKeyStorageKey = `yatharth_order_idempotency_${encodeURIComponent(cartIdentity)}`;
            let orderIdempotencyKey = sessionStorage.getItem(orderKeyStorageKey);
            if (!orderIdempotencyKey) {
                orderIdempotencyKey = crypto.randomUUID();
                sessionStorage.setItem(orderKeyStorageKey, orderIdempotencyKey);
            }
            orderData.idempotencyKey = orderIdempotencyKey;

            order = await createOrder(orderData);

            pendingPaymentOrderId = order.id;
            pendingPaymentOrder = order;
            sessionStorage.setItem("yatharth_pending_payment_order_id", String(order.id));
            sessionStorage.removeItem(orderKeyStorageKey);
        }

        if (order.status === "PENDING_PAYMENT") {
            pendingPaymentOrder = {
                ...order,
                paymentState: order.paymentState || "AWAITING_PAYMENT",
                paymentAttemptsUsed: order.paymentAttemptsUsed || 0,
                paymentAttemptsRemaining: order.paymentAttemptsRemaining ?? 3,
                maxPaymentAttempts: order.maxPaymentAttempts || 3,
            };
            order = pendingPaymentOrder;
            saveCustomerOrder(pendingPaymentOrder);
        }

        console.log(
            "Pending Payment Order:",
            order
        );


        // ==========================================
        // 2. CREATE RAZORPAY PAYMENT ORDER
        // ==========================================

        // Reuse the key if this exact request is retried.
        const idempotencyStorageKey =
            `yatharth_payment_attempt_${order.id}`;

        let idempotencyKey =
            sessionStorage.getItem(idempotencyStorageKey);

        if (!idempotencyKey) {
            idempotencyKey = crypto.randomUUID();

        sessionStorage.setItem(
            idempotencyStorageKey,
            idempotencyKey
        );
        }

        let paymentOrder;

        try{
            paymentOrder = await createPaymentOrder(
                order.id,
                idempotencyKey
            );
        }
        catch(error){
            if(error.code !== "PAYMENT_ATTEMPT_FAILED"){
                throw error;
            }

            // A definitively failed attempt needs a new idempotency key and
            // a new Razorpay order. Keep the restaurant order itself intact.
            idempotencyKey = crypto.randomUUID();

            sessionStorage.setItem(
                idempotencyStorageKey,
                idempotencyKey
            );

            paymentOrder = await createPaymentOrder(
                order.id,
                idempotencyKey
            );
        }

        console.log(
            "Razorpay Payment Order Created:",
            paymentOrder
        );


        // ==========================================
        // 3. OPEN RAZORPAY CHECKOUT
        // ==========================================

        const options = {

            key:
                CONFIG.razorpayKeyId,

            amount:
                paymentOrder.razorpayOrder.amount,

            currency:
                paymentOrder.razorpayOrder.currency,

            name:
                CONFIG.restaurantName,

            description:
                `Order #${order.id}`,

            order_id:
                paymentOrder.razorpayOrder.id,

            handler:
                async function(response){

                    console.log(
                        "Razorpay Payment Success:",
                        response
                    );

                    try{

                        // ==========================================
                        // 4. VERIFY PAYMENT WITH YATHARTH
                        // ==========================================

                        const verification =
                            await verifyPayment({

                                orderId:
                                    order.id,

                                razorpay_payment_id:
                                    response.razorpay_payment_id,

                                razorpay_order_id:
                                    response.razorpay_order_id,

                                razorpay_signature:
                                    response.razorpay_signature

                            });


                        console.log(
                            "Payment Verification Result:",
                            verification
                        );


                        // ==========================================
                        // 5. SAVE CONFIRMED ORDER
                        // ==========================================

                        const confirmedOrder =
                            verification.order;


                        cart = [];

                        saveCart();

                        updateCart();


                        saveCustomerOrder(
                            confirmedOrder
                        );


                        localStorage.setItem(
                            "currentOrder",
                            JSON.stringify(
                                confirmedOrder
                            )
                        );


                        sessionStorage.setItem(
                            "viewedOrderId",
                            String(
                                confirmedOrder.id
                            )
                        );

                        sessionStorage.removeItem("yatharth_pending_payment_order_id");
                        pendingPaymentOrderId = null;
                        pendingPaymentOrder = null;


                        // ==========================================
                        // 6. OPEN ORDER STATUS PAGE
                        // ==========================================

                        window.location.href =
                            "./order.html";

                    }
                    catch(error){

                        console.error(
                            "Payment verification failed:",
                            error
                        );

                        if (["PAYMENT_FAILED", "PAYMENT_NOT_CAPTURED"].includes(error.code)) {
                            await reconcileCheckoutFailure(order.id, {
                                razorpay_order_id:
                                    response?.razorpay_order_id || paymentOrder?.razorpayOrder?.id,
                                razorpay_payment_id:
                                    response?.razorpay_payment_id,
                            });
                            return;
                        }

                        alert(
                            "Payment was received, but order confirmation is still being processed. Please do not pay again."
                        );

                    }

                },

            modal: {

                ondismiss:
                    function(){

                        if (activeRazorpayCheckout === razorpay) {
                            activeRazorpayCheckout = null;
                        }

                        console.log(
                            "Razorpay Checkout closed"
                        );

                        isPlacingOrder =
                            false;

                        placeOrderButton.disabled =
                            false;

                        placeOrderButton.textContent =
                            "Place Order";

                    }

            },

            theme: {

                color:
                    "#d4a24c"

            }

        };


        const razorpay =
            new Razorpay(
                options
            );

        activeRazorpayCheckout = razorpay;


        razorpay.on(
            "payment.failed",
            function(response){

                console.error(
                    "Razorpay Payment Failed:",
                    response
                );

                const metadata = response?.error?.metadata || {};
                reconcileCheckoutFailure(order.id, {
                    razorpay_order_id:
                        metadata.order_id || response?.razorpay_order_id || paymentOrder?.razorpayOrder?.id,
                    razorpay_payment_id:
                        metadata.payment_id || response?.razorpay_payment_id,
                });

            }
        );


        razorpay.open();

    }
    catch(error){

        console.error(
            "Order/Payment Failed:",
            error
        );

        if (error.code === "PAYMENT_ATTEMPT_LIMIT") {
            try {
                const latest = await getPaymentAttempts(pendingPaymentOrderId);
                if (latest?.success && latest.order) {
                    saveCustomerOrder(latest.order);
                    localStorage.setItem("currentOrder", JSON.stringify(latest.order));
                    sessionStorage.removeItem("yatharth_pending_payment_order_id");
                    pendingPaymentOrderId = null;
                    pendingPaymentOrder = null;
                    sessionStorage.setItem("viewedOrderId", String(latest.order.id));
                    window.location.href = "./order.html";
                    return;
                }
            } catch (refreshError) {
                console.warn("Could not refresh exhausted payment order:", refreshError);
            }
        }

        alert(error.message || "Unable to start payment. Please try again.");

        isPlacingOrder =
            false;

        placeOrderButton.disabled =
            false;

        placeOrderButton.textContent =
            "Place Order";

    }

}

async function reconcileCheckoutFailure(orderId, paymentData = {}) {
    placeOrderButton.disabled = true;
    placeOrderButton.textContent = "Checking Payment...";

    try {
        let response = null;
        if (paymentData.razorpay_order_id && paymentData.razorpay_payment_id) {
            try {
                response = await reconcilePaymentFailure(orderId, paymentData);
            } catch (reconcileError) {
                // The order-level recovery endpoint remains a safe fallback: it
                // also checks Razorpay's authoritative payment records.
                console.warn("Exact payment reconciliation failed; checking the order history:", reconcileError);
            }
        }
        if (!response) response = await getPaymentAttempts(orderId);
        if (!response?.success || !response.order) {
            throw new Error("Payment status is not available yet");
        }

        const order = response.order;
        pendingPaymentOrder = order;
        saveCustomerOrder(order);
        localStorage.setItem("currentOrder", JSON.stringify(order));

        if (order.status !== "PENDING_PAYMENT" || order.paymentState === "ATTEMPTS_EXHAUSTED") {
            activeRazorpayCheckout?.close();
            sessionStorage.removeItem("yatharth_pending_payment_order_id");
            pendingPaymentOrderId = null;
            pendingPaymentOrder = null;
            sessionStorage.setItem("viewedOrderId", String(order.id));
            window.location.href = "./order.html";
            return;
        }

        if (order.paymentState === "RETRY_AVAILABLE") {
            alert(`Payment failed. Attempt ${order.paymentAttemptsUsed} of ${order.maxPaymentAttempts} failed. You can retry this order.`);
        } else {
            alert("Razorpay has not confirmed a failed payment yet. Wait while we reconcile it; a new attempt will only be allowed after Razorpay confirms the previous attempt failed.");
        }
    } catch (error) {
        console.warn("Could not reconcile the failed checkout:", error);
        alert("Payment failed, but its final status is still being confirmed. Please wait a moment before retrying.");
    } finally {
        isPlacingOrder = false;
        placeOrderButton.disabled = false;
        placeOrderButton.textContent = "Place Order";
    }
}


// ==========================================
// SAVE CUSTOMER ORDER
// ==========================================

function saveCustomerOrder(order){

    const storedOrders =

        localStorage.getItem(

            "customerOrders"

        );


    let customerOrders = [];


    if(storedOrders){

        try{

            customerOrders =

                JSON.parse(

                    storedOrders

                );

        }

        catch(error){

            console.error(

                "Failed to load customer orders:",

                error

            );

            customerOrders = [];

        }

    }


    const existingOrderIndex = customerOrders.findIndex(
        existingOrder => existingOrder.id === order.id
    );

    if (existingOrderIndex === -1) customerOrders.unshift(order);
    else customerOrders[existingOrderIndex] = order;


    localStorage.setItem(

        "customerOrders",

        JSON.stringify(

            customerOrders

        )

    );

}


// ==========================================
// BUILD ORDER PAYLOAD
// ==========================================

function getCartSignature(items, isOrderItems = false) {
    if (!Array.isArray(items) || items.length === 0) return null;

    const quantitiesByMenuItem = new Map();
    for (const item of items) {
        const rawId = isOrderItems
            ? item.menuItemId ?? item.menuItem?.id ?? item.id
            : item.id ?? item.menuItemId ?? item.menuItem?.id;
        const menuItemId = Number(rawId);
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(menuItemId) || menuItemId <= 0 ||
            !Number.isSafeInteger(quantity) || quantity <= 0) {
            return null;
        }
        quantitiesByMenuItem.set(
            menuItemId,
            (quantitiesByMenuItem.get(menuItemId) || 0) + quantity
        );
    }

    return JSON.stringify(
        [...quantitiesByMenuItem.entries()].sort(([left], [right]) => left - right)
    );
}

function orderMatchesCart(order, currentCart) {
    const orderSignature = getCartSignature(order?.items, true);
    const cartSignature = getCartSignature(currentCart);
    return orderSignature !== null && cartSignature !== null && orderSignature === cartSignature;
}

function buildOrderPayload(){

    return{

        branchId:1,

        notes:"",

        paymentRequired:true,

        items:
            cart.map(item => ({

                menuItemId:
                    item.id,

                quantity:
                    item.quantity

            }))

    };

}
