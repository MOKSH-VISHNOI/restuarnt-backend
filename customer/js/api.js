// ==========================================
// YATHARTH API ENGINE
// ==========================================


// ==========================================
// API BASE URL
// ==========================================

const API = {

    baseUrl:
        CONFIG.apiBaseUrl

};


// ==========================================
// REQUEST
// ==========================================

async function request(

    endpoint,

    options = {}

){

    try{

        const response = await fetch(

            `${API.baseUrl}${endpoint}`,

            {

                ...options,

                headers:{
                
                    "Content-Type":
                
                        "application/json",
                
                    ...options.headers
                
                }

            }

        );

        let result;

        try{
            result = await response.json();
        }
        catch{
            result = {};
        }

        if(!response.ok){
            const apiError = new Error(
                result.message || `HTTP ${response.status}`
            );

            apiError.status = response.status;
            apiError.code = result.code;

            throw apiError;
        }

        return result;

    }

    catch(error){

        console.error(

            "API Error:",

            error

        );

        throw error;

    }

}


// ==========================================
// MENU
// ==========================================

async function getMenu(){

    return await request(

        "/menu-items"

    );

}


// ==========================================
// CREATE ORDER
// ==========================================

async function createOrder(

    orderData

){

    return await request(

        "/orders",

        {

            method:"POST",

            body:JSON.stringify(

                orderData

            )

        }

    );

}


// ==========================================
// SUBMIT FEEDBACK
// ==========================================

async function submitFeedback(

    feedbackData

){

    return await request(

        "/feedback",

        {

            method:"POST",

            body:JSON.stringify(

                feedbackData

            )

        }

    );

}



// ==========================================
// GET ORDER
// ==========================================

async function getOrder(

    id

){

    return await request(

        `/orders/${id}`

    );

}


// ==========================================
// UPDATE ORDER
// ==========================================

async function updateOrder(

    id,

    data

){

    return await request(

        `/orders/${id}`,

        {

            method:"PUT",

            body:JSON.stringify(

                data

            )

        }

    );

}


// ==========================================
// DELETE ORDER
// ==========================================

async function deleteOrder(

    id

){

    return await request(

        `/orders/${id}`,

        {

            method:"DELETE"

        }

    );

}


// ==========================================
// KITCHEN
// ==========================================

async function getKitchenOrders(){

    return await request(

        "/kitchen"

    );

}


// ==========================================
// COUNTER
// ==========================================

async function getCounterOrders(){

    return await request(

        "/counter"

    );

}


// ==========================================
// CATEGORIES
// ==========================================

async function getCategories(){

    return await request(

        "/categories"

    );

}


// ==========================================
// BRANCHES
// ==========================================

async function getBranches(){

    return await request(

        "/branches"

    );

}


// ==========================================
// SERVER STATUS
// ==========================================

async function checkServer(){

    try{

        await request(

            "/menu-items"

        );

        console.log(

            "Backend Connected"

        );

    }

    catch{

        console.warn(

            "Backend Offline"

        );

    }

}


// ==========================================
// CREATE RAZORPAY PAYMENT ORDER
// ==========================================

async function createPaymentOrder(orderId, idempotencyKey) {
    return await request(
        "/api/payments/razorpay/order",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                orderId,
                idempotencyKey
            })
        }
    );
}

// ==========================================
// GET PAYMENT ATTEMPTS FOR ORDER (RECOVERY)
// ==========================================

async function getPaymentAttempts(orderId) {
    return await request(
        `/api/payments/order/${orderId}/attempts`
    );
}

// Ask the backend to fetch and reconcile the exact payment reported by
// Razorpay Checkout. The browser's failure callback is never treated as proof.
async function reconcilePaymentFailure(orderId, paymentData) {
    return await request(
        "/api/payments/razorpay/reconcile-failure",
        {
            method: "POST",
            body: JSON.stringify({
                orderId,
                ...paymentData
            })
        }
    );
}

// ==========================================
// VERIFY RAZORPAY PAYMENT
// ==========================================

async function verifyPayment(paymentData){

    return await request(
        "/api/payments/razorpay/verify",
        {
            method:"POST",

            body:JSON.stringify(
                paymentData
            )
        }
    );

}
