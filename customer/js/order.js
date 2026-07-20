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

    if(cart.length===0){

        alert(
            "Your cart is empty."
        );

        return;

    }

    isPlacingOrder = true;

    placeOrderButton.disabled = true;

    placeOrderButton.textContent =
        "Placing Order...";

    const orderData =
        buildOrderPayload();

    try{

        const order =

            await createOrder(
                orderData
            );

        console.log(
            "Order Created:",
            order
        );

        // Clear cart

        cart = [];

        saveCart();

        updateCart();

    // ==========================================
    // SAVE CUSTOMER ORDER
    // ==========================================

        saveCustomerOrder(order);


    // ==========================================
    // SAVE CURRENT ORDER
    // ==========================================

        localStorage.setItem(

            "currentOrder",

            JSON.stringify(order)

        );

        // Success overlay will be opened here later

        window.location.href =
            "./order.html";

        }

    catch(error){

        console.error(
            "Order Failed:",
            error
        );

        alert(
            "Failed to place order. Please try again."
        );

    }

    finally{

        isPlacingOrder = false;

        placeOrderButton.disabled = false;

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

        items:

            cart.map(item => ({

                menuItemId:
                    item.id,

                quantity:
                    item.quantity

            }))

    };

}
