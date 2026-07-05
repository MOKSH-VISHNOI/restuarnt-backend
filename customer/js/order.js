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

        // Save current order

        localStorage.setItem(

            "currentOrder",

            JSON.stringify(order)

        );

        // Redirect

        window.location.href =

            "success.html";

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