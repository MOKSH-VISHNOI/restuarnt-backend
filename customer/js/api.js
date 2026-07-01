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

        if(

            !response.ok

        ){

            throw new Error(

                `HTTP ${response.status}`

            );

        }

        return await response.json();

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

