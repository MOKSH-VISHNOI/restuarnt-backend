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


function returnToMenuAfterPaymentExhausted(order) {
    // Preserve the failed order in customer order history.
    if (order) {
    saveCustomerOrder(order);
        localStorage.setItem(
            "currentOrder",
            JSON.stringify(order)
        );
    }
    
    // Clear the shopping cart.
    cart = [];
    saveCart();
    updateCart();
    
    // Clear pending-payment state.
    sessionStorage.removeItem("yatharth_pending_payment_order_id");
    pendingPaymentOrderId = null;
    pendingPaymentOrder = null;
    
    // Remove the old order-page reference.
    sessionStorage.removeItem("viewedOrderId");
    
    // Close Razorpay Checkout if it is still open.
    if (activeRazorpayCheckout) {
        activeRazorpayCheckout.close();
    }
    
    // Return to the menu so the customer can start a fresh order.
    window.location.href = "./index.html";
    
    }
    

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

        if (order.paymentState === "ATTEMPTS_EXHAUSTED") {
            returnToMenuAfterPaymentExhausted(order);
            return;
            }
            
            if (order.status !== "PENDING_PAYMENT") {
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
let paymentFailureHandling = false;



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
// PAYMENT STATUS UI
// ==========================================

const paymentStatusOverlay =
    document.getElementById("paymentStatusOverlay");

const paymentStatusIcon =
    document.getElementById("paymentStatusIcon");

const paymentStatusIconContent =
    document.getElementById("paymentStatusIconContent");

const paymentStatusTitle =
    document.getElementById("paymentStatusTitle");

const paymentStatusMessage =
    document.getElementById("paymentStatusMessage");

const paymentAttemptCount =
    document.getElementById("paymentAttemptCount");

const paymentAttemptProgress =
    document.getElementById("paymentAttemptProgress");

const paymentAttemptsRemaining =
    document.getElementById("paymentAttemptsRemaining");

const paymentVerificationIndicator =
    document.getElementById("paymentVerificationIndicator");

const paymentVerificationText =
    document.getElementById("paymentVerificationText");

const paymentStatusAction =
    document.getElementById("paymentStatusAction");

const paymentStatusFootnote =
    document.getElementById("paymentStatusFootnote");


// ==========================================
// PAYMENT STATUS UI FUNCTIONS
// ==========================================

function showPaymentStatus() {
    if (!paymentStatusOverlay) return;

    paymentStatusOverlay.classList.remove("hidden");
    paymentStatusOverlay.classList.remove("is-resolved");
    paymentStatusOverlay.setAttribute("aria-hidden", "false");
}

function hidePaymentStatus() {
    if (!paymentStatusOverlay) return;

    paymentStatusOverlay.classList.add("hidden");
    paymentStatusOverlay.setAttribute("aria-hidden", "true");
}

function updatePaymentAttemptDisplay(order, confirmedFailure = false) {
    if (!order) return;

    const maxAttempts = Number(order.maxPaymentAttempts) || 3;
    const attemptsUsed = Math.max(
        0,
        Math.min(Number(order.paymentAttemptsUsed) || 0, maxAttempts)
    );
    const attemptsRemaining = Math.max(
        0,
        Number(
            order.paymentAttemptsRemaining ??
            (maxAttempts - attemptsUsed)
        )
    );

    if (paymentAttemptCount) {
        paymentAttemptCount.textContent =
            `${attemptsUsed} of ${maxAttempts}`;
    }

    if (paymentAttemptsRemaining) {
        if (order.paymentState === "ATTEMPTS_EXHAUSTED") {
            paymentAttemptsRemaining.textContent =
                "No payment attempts remaining.";
        } else if (attemptsRemaining === 1) {
            paymentAttemptsRemaining.textContent =
                "1 payment attempt remaining.";
        } else {
            paymentAttemptsRemaining.textContent =
                `${attemptsRemaining} payment attempts remaining.`;
        }
    }

    if (paymentAttemptProgress) {
        paymentAttemptProgress.setAttribute(
            "aria-valuemax",
            String(maxAttempts)
        );

        paymentAttemptProgress.setAttribute(
            "aria-valuenow",
            String(attemptsUsed)
        );

        const segments = [
            ...paymentAttemptProgress.querySelectorAll(
                ".payment-attempt-segment"
            )
        ];

        segments.forEach((segment, index) => {
            segment.classList.toggle(
                "used",
                index < attemptsUsed
            );

            segment.classList.toggle(
                "failed",
                confirmedFailure && index < attemptsUsed
            );
        });
    }
}

function setPaymentStatusState(state, order = null) {
    if (!paymentStatusOverlay) return;

    const states = {
        verifying: {
            icon: "↻",
            title: "Confirming your payment",
            message:
                "We're checking your payment status. Please don't start another payment yet.",
            verification: "Verifying with the payment provider...",
            button: "Please wait...",
            footnote:
                "Please avoid making another payment while we verify this transaction.",
            resolved: false,
            disabled: true,
            showVerification: true,
            danger: false
        },

        failed: {
            icon: "!",
            title: "Payment unsuccessful",
            message:
                "Your payment attempt was unsuccessful. You can retry when the status is confirmed.",
            verification: "Payment failure confirmed.",
            button: "Retry Payment",
            footnote:
                "If money was deducted, allow the payment provider time to confirm its final status.",
            resolved: true,
            disabled: false,
            showVerification: false,
            danger: true
        },

        exhausted: {
            icon: "!",
            title: "Payment attempts exhausted",
            message:
                "You've reached the maximum of three payment attempts for this order.",
            verification: "No further attempts are available.",
            button: "Returning to menu...",
            footnote:
                "Your failed order will remain available in your order history.",
            resolved: true,
            disabled: true,
            showVerification: false,
            danger: true
        },

        success: {
            icon: "✓",
            title: "Payment successful",
            message:
                "Your payment has been verified. We're opening your order confirmation.",
            verification: "Payment verified successfully.",
            button: "Opening your order...",
            footnote:
                "Your order confirmation is being prepared.",
            resolved: true,
            disabled: true,
            showVerification: false,
            danger: false
        }
    };

    const config = states[state];
    if (!config) return;

    if (paymentStatusIcon) {
        paymentStatusIcon.className =
            `payment-status-icon ${state === "failed" ? "failed" : state === "success" ? "confirmed" : state === "exhausted" ? "exhausted" : "verifying"}`;
    }

    if (paymentStatusIconContent) {
        paymentStatusIconContent.textContent = config.icon;
    }

    if (paymentStatusTitle) {
        paymentStatusTitle.textContent = config.title;
    }

    if (paymentStatusMessage) {
        paymentStatusMessage.textContent = config.message;
    }

    if (paymentVerificationText) {
        paymentVerificationText.textContent = config.verification;
    }

    if (paymentVerificationIndicator) {
        paymentVerificationIndicator.style.display =
            config.showVerification ? "flex" : "none";
    }

    if (paymentStatusFootnote) {
        paymentStatusFootnote.textContent = config.footnote;
    }

    if (paymentStatusAction) {
        paymentStatusAction.textContent = config.button;
        paymentStatusAction.disabled = config.disabled;
        paymentStatusAction.classList.toggle("danger", config.danger);
    }

    paymentStatusOverlay.classList.toggle(
        "is-resolved",
        config.resolved
    );

    if (order) {
        updatePaymentAttemptDisplay(
            order,
            state === "failed"
        );
    }

    showPaymentStatus();

    console.log("[DEBUG] Displaying payment overlay for state:", state);
}



// ==========================================
// PAYMENT STATUS ACTION
// ==========================================

if (paymentStatusAction) {
    paymentStatusAction.addEventListener("click", async () => {
        if (paymentStatusAction.disabled) return;

        // Only allow retry when the backend has confirmed it is available.
        if (
            !pendingPaymentOrder ||
            pendingPaymentOrder.paymentState !== "RETRY_AVAILABLE"
        ) {
            return;
        }

        // Prevent duplicate clicks or overlapping payment attempts.
        if (isPlacingOrder || reconcilingPaymentOrderId !== null) {
            return;
        }

        hidePaymentStatus();

        // Reuse the existing order and payment-attempt logic.
        await placeOrder();
    });
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

                        // TEMPORARY DIAGNOSTIC LOG
                        console.log("[DIAG] modal.ondismiss fired");

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

        console.log("[DIAG] Checkout instance created:", {
            instanceExists: !!razorpay,
            closeMethodExists: typeof razorpay.close,
            failureFlag: paymentFailureHandling,
            scriptURL: document.currentScript?.src || "Not available"
            });
            


      
     
            razorpay.on("payment.failed", function (response) {
                console.log(
                    "[PAYMENT DEBUG] Razorpay payment.failed event fired:",
                    response
                );

                console.error("Razorpay Payment Failed:", response);

                const metadata = response?.error?.metadata || {};

                const failureData = {
                    razorpay_order_id:
                        metadata.order_id ||
                        response?.razorpay_order_id ||
                        paymentOrder?.razorpayOrder?.id,

                    razorpay_payment_id:
                        metadata.payment_id ||
                        response?.razorpay_payment_id
                };

                // Prevent duplicate failure handling.
                if (paymentFailureHandling) {
                    console.log(
                        "[PAYMENT DEBUG] Failure handling already started."
                    );
                    return;
                }

                console.log("[DIAG] Failure handler reached:", {
                    orderId: order.id,
                    failureFlagBefore: paymentFailureHandling,
                    activeInstanceMatches: activeRazorpayCheckout === razorpay
                });

                paymentFailureHandling = true;

                // Close Checkout immediately, without waiting for the backend.
                try {

                    console.log("[DIAG] Calling razorpay.close()", {
                        instanceExists: !!razorpay,
                        closeMethodExists: typeof razorpay.close,
                        activeInstanceMatches: activeRazorpayCheckout === razorpay
                    });
                    razorpay.close();

                    console.log("[DIAG] razorpay.close() returned without throwing");

                } catch (error) {
                    console.error(
                        "[PAYMENT DEBUG] Checkout close error:",
                        error
                    );
                }

                // Reconcile the failure with the backend separately.
                reconcileCheckoutFailure(order.id, failureData)
                    .catch(function (error) {
                        console.error(
                            "[PAYMENT DEBUG] Failure reconciliation error:",
                            error
                        );
                    })
                    .finally(function () {
                        paymentFailureHandling = false;
                    });
            });






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
                    returnToMenuAfterPaymentExhausted(latest.order);
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


    async function waitForPaymentResolution(orderId, maxChecks = 12) {
        for (let attempt = 0; attempt < maxChecks; attempt++) {
            // Gradually increase the delay between checks, up to 10 seconds.
            const delay = Math.min(2000 * (attempt + 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                const response = await getPaymentAttempts(orderId);

                if (!response?.success || !response.order) {
                    continue;
                }

                const order = response.order;

                saveCustomerOrder(order);
                localStorage.setItem("currentOrder", JSON.stringify(order));

                if (
                    order.paymentState === "RETRY_AVAILABLE" ||
                    order.paymentState === "ATTEMPTS_EXHAUSTED" ||
                    order.status !== "PENDING_PAYMENT"
                ) {
                    return order;
                }
            } catch (error) {
                console.warn("Payment status recheck failed:", error);
            }
        }

        return null;
    }


    
    let reconcilingPaymentOrderId = null;

   
    async function reconcileCheckoutFailure(orderId, paymentData = {}) {
        if (String(reconcilingPaymentOrderId) === String(orderId)) {
            console.log(
                "Payment reconciliation is already running for order:",
                orderId
            );
            return;
        }

        reconcilingPaymentOrderId = orderId;

        console.log(
            "[PAYMENT DEBUG] Reconciliation started:",
            orderId,
            paymentData
        );

        isPlacingOrder = true;

        placeOrderButton.disabled = true;
        placeOrderButton.textContent = "Checking Payment...";

        setPaymentStatusState("verifying", pendingPaymentOrder);

        try {
            let response = null;

            // First, reconcile the specific Razorpay payment when possible.
            if (
                paymentData.razorpay_order_id &&
                paymentData.razorpay_payment_id
            ) {
                try {
                    response = await reconcilePaymentFailure(
                        orderId,
                        paymentData
                    );
                } catch (reconcileError) {
                    console.warn(
                        "Exact payment reconciliation failed; checking the order history:",
                        reconcileError
                    );
                }
            }

            // Fall back to the authoritative order payment-attempt history.
            if (!response) {
                response = await getPaymentAttempts(orderId);
            }

            if (!response?.success || !response.order) {
                throw new Error("Payment status is not available yet");
            }

            const order = response.order;


            console.log("[DEBUG] Payment state:", order.paymentState);
            console.log("[DEBUG] Overlay element:", paymentStatusOverlay);
            console.log("[DEBUG] Overlay hidden before display:",
                    paymentStatusOverlay?.classList.contains("hidden")
            );

            console.log(
                "[PAYMENT DEBUG] Reconciliation response:",
                {
                    orderId: order.id,
                    status: order.status,
                    paymentState: order.paymentState,
                    attemptsUsed: order.paymentAttemptsUsed,
                    attemptsRemaining: order.paymentAttemptsRemaining
                }
            );

            pendingPaymentOrder = order;
            saveCustomerOrder(order);
            localStorage.setItem("currentOrder", JSON.stringify(order));

            // All attempts have been used. Preserve the failed order and return
            // the customer to the menu using the existing helper.
            if (order.paymentState === "ATTEMPTS_EXHAUSTED") {
                setPaymentStatusState("exhausted", order);
                returnToMenuAfterPaymentExhausted(order);
                return;
            }

            // If the order is no longer awaiting payment, open its status page.
            if (order.status !== "PENDING_PAYMENT") {
                setPaymentStatusState("success", order);

                activeRazorpayCheckout?.close();

                sessionStorage.removeItem(
                    "yatharth_pending_payment_order_id"
                );

                pendingPaymentOrderId = null;
                pendingPaymentOrder = null;

                sessionStorage.setItem(
                    "viewedOrderId",
                    String(order.id)
                );

                window.location.href = "./order.html";
                return;
            }

            // The backend has confirmed that another attempt is allowed.
            if (order.paymentState === "RETRY_AVAILABLE") {
                setPaymentStatusState("failed", order);

                if (paymentStatusAction) {
                    paymentStatusAction.textContent = "Retry Payment";
                    paymentStatusAction.disabled = false;
                }

                return;
            }

            // The payment is not resolved yet. Keep the customer from starting
            // another payment until the server confirms its final status.
            setPaymentStatusState("verifying", order);

            const resolvedOrder = await waitForPaymentResolution(orderId);

            if (!resolvedOrder) {
                setPaymentStatusState("verifying", pendingPaymentOrder);

                setTimeout(() => {
                    if (pendingPaymentOrderId !== null) {
                        reconcileCheckoutFailure(orderId, paymentData);
                    }
                }, 5000);

                return;
            }

            pendingPaymentOrder = resolvedOrder;

            saveCustomerOrder(resolvedOrder);
            localStorage.setItem(
                "currentOrder",
                JSON.stringify(resolvedOrder)
            );

            // Check whether the maximum number of attempts has been reached.
            if (resolvedOrder.paymentState === "ATTEMPTS_EXHAUSTED") {
                setPaymentStatusState("exhausted", resolvedOrder);
                returnToMenuAfterPaymentExhausted(resolvedOrder);
                return;
            }

            // A confirmed, non-pending order can proceed to the order page.
            if (resolvedOrder.status !== "PENDING_PAYMENT") {
                setPaymentStatusState("success", resolvedOrder);

                activeRazorpayCheckout?.close();

                sessionStorage.removeItem(
                    "yatharth_pending_payment_order_id"
                );

                pendingPaymentOrderId = null;
                pendingPaymentOrder = null;

                sessionStorage.setItem(
                    "viewedOrderId",
                    String(resolvedOrder.id)
                );

                window.location.href = "./order.html";
                return;
            }

            // A failed attempt is now confirmed, so offer a retry.
            if (resolvedOrder.paymentState === "RETRY_AVAILABLE") {
                setPaymentStatusState("failed", resolvedOrder);

                if (paymentStatusAction) {
                    paymentStatusAction.textContent = "Retry Payment";
                    paymentStatusAction.disabled = false;
                }
            }
        } catch (error) {

            console.log("[PAYMENT DEBUG] Reconciliation entered catch block");
            
            console.warn(
                "Could not reconcile the failed checkout:",
                error
            );

            setPaymentStatusState("verifying", pendingPaymentOrder);

            console.error(
                "Payment status is not confirmed yet. Do not start another payment."
            );
        } finally {
            const paymentIsResolved =
                pendingPaymentOrder &&
                (
                    pendingPaymentOrder.paymentState === "RETRY_AVAILABLE" ||
                    pendingPaymentOrder.paymentState === "ATTEMPTS_EXHAUSTED" ||
                    pendingPaymentOrder.status !== "PENDING_PAYMENT"
                );

            if (paymentIsResolved) {
                isPlacingOrder = false;

                placeOrderButton.disabled = false;
                placeOrderButton.textContent = "Place Order";
            } else {
                isPlacingOrder = true;

                placeOrderButton.disabled = true;
                placeOrderButton.textContent = "Checking Payment...";
            }

            reconcilingPaymentOrderId = null;
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
