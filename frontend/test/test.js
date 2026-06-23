const API =
    "/orders";

    async function createOrder(items) {

        try {
    
            const response = await fetch(
                API,
                {
                    method: "POST",
    
                    headers: {
                        "Content-Type": "application/json"
                    },
    
                    body: JSON.stringify({
                        branchId: 1,
                        items
                    })
                }
            );
    
            console.log("STATUS:", response.status);
    
            const data =
                await response.text();
    
            console.log("RESPONSE:", data);
    
            document.getElementById(
                "status"
            ).innerText =
                `✅ ${response.status}`;
    
        } catch(error) {
    
            console.error(error);
    
            alert(error.message);
    
            document.getElementById(
                "status"
            ).innerText =
                "❌ Failed";
        }
    }

function placeOrder(menuItemId) {

    createOrder([
        {
            menuItemId,
            quantity:1
        }
    ]);
}

function placeCombo() {

    createOrder([
        {
            menuItemId:1,
            quantity:1
        },
        {
            menuItemId:2,
            quantity:1
        }
    ]);
}

async function placeRush() {

    for(
        let i=0;
        i<10;
        i++
    ) {

        await createOrder([
            {
                menuItemId:1,
                quantity:1
            }
        ]);
    }
}