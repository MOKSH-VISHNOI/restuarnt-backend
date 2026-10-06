// ==========================================
// YATHARTH ORDER ENGINE
// ==========================================


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

        const order =
            await createOrder(
                orderData
            );

        console.log(
            "Pending Payment Order Created:",
            order
        );


        // ==========================================
        // 2. CREATE RAZORPAY PAYMENT ORDER
        // ==========================================

        const paymentOrder =
            await createPaymentOrder(
                order.id
            );

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

                        alert(
                            "Payment was received, but order confirmation is still being processed. Please do not pay again."
                        );

                    }

                },

            modal: {

                ondismiss:
                    function(){

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


        razorpay.on(
            "payment.failed",
            function(response){

                console.error(
                    "Razorpay Payment Failed:",
                    response
                );

                alert(
                    "Payment failed. Your order has not been sent to the kitchen."
                );

                isPlacingOrder =
                    false;

                placeOrderButton.disabled =
                    false;

                placeOrderButton.textContent =
                    "Place Order";

            }
        );


        razorpay.open();

    }
    catch(error){

        console.error(
            "Order/Payment Failed:",
            error
        );

        alert(
            "Unable to start payment. Please try again."
        );

        isPlacingOrder =
            false;

        placeOrderButton.disabled =
            false;

        placeOrderButton.textContent =
            "Place Order";

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


    // Prevent duplicate orders

    const orderExists =

        customerOrders.some(

            existingOrder =>

                existingOrder.id === order.id

        );


    if(!orderExists){

        customerOrders.unshift(

            order

        );

    }


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
