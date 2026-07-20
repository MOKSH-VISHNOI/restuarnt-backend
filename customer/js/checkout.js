// ==========================================
// YATHARTH CHECKOUT ENGINE
// ==========================================


// ==========================================
// DOM
// ==========================================

const checkoutOverlay =

    document.getElementById(
        "checkoutOverlay"
    );

const checkoutSheet =

    document.getElementById(
        "checkoutSheet"
    );

const checkoutItems =

    document.getElementById(
        "checkoutItems"
    );

const checkoutSubtotal =

    document.getElementById(
        "checkoutSubtotal"
    );

const checkoutTax =

    document.getElementById(
        "checkoutTax"
    );

const checkoutTotal =

    document.getElementById(
        "checkoutTotal"
    );

const addMoreBtn =
    document.getElementById(
        "addMoreButton"
    );


// ==========================================
// EVENT LISTENERS
// ==========================================

addMoreBtn?.addEventListener(
    "click",
    closeCheckout
);


checkoutOverlay.onclick = (event)=>{

    if(event.target===checkoutOverlay){

        closeCheckout();

    }

};



// ==========================================
// OPEN CHECKOUT
// ==========================================

function openCheckout(){

    renderCheckout();

    checkoutOverlay.classList.remove(
        "hidden"
    );

    requestAnimationFrame(()=>{

        checkoutOverlay.classList.add(
            "show"
        );

    });

}


// ==========================================
// CLOSE CHECKOUT
// ==========================================

function closeCheckout(){

    checkoutOverlay.classList.remove(
        "show"
    );

    setTimeout(()=>{

        checkoutOverlay.classList.add(
            "hidden"
        );

    },250);

}


// ==========================================
// RENDER CHECKOUT
// ==========================================

function renderCheckout(){

    checkoutItems.innerHTML = "";

    if(cart.length === 0){

        checkoutItems.innerHTML = `

            <div class="empty-state">

                <div class="empty-cart-icon">

                    🛒

                </div>

                <h3>

                    Your cart is empty

                </h3>

                <p>

                    Add something delicious to get started.

                </p>

                <button
                    id="emptyCheckoutButton"
                    class="primary-btn"
                >

                    Add Items

                </button>

            </div>

        `;

        document
            .getElementById("emptyCheckoutButton")
            .addEventListener(

                "click",

                closeCheckout

            );

        document.querySelector(".summary").style.display = "none";

        document.getElementById(
            "placeOrderButton"
        ).style.display = "none";

        document.getElementById(
            "addMoreButton"
        ).style.display = "none";

        return;

    }

    document.querySelector(".summary").style.display = "";

    document.getElementById(
        "placeOrderButton"
    ).style.display = "";

    document.getElementById(
        "addMoreButton"
    ).style.display = "";

    for(const item of cart){

        checkoutItems.appendChild(

            createCheckoutItem(item)

        );

    }

    updateCheckoutTotals();

}


// ==========================================
// UPDATE CHECKOUT
// ==========================================

function updateCheckout(){

    if(

        checkoutOverlay.classList.contains(
    
            "hidden"
    
        )
    
    ){
    
        return;
    
    }
    
    renderCheckout();

}


// ==========================================
// TOTALS
// ==========================================

function updateCheckoutTotals(){

    const subtotal =

        totalPrice();

    const tax = 0;

    checkoutSubtotal.textContent =

        `${CONFIG.currency}${subtotal}`;

    checkoutTax.textContent =

        `${CONFIG.currency}${tax}`;

    checkoutTotal.textContent =

        `${CONFIG.currency}${subtotal+tax}`;

}




// ==========================================
// CHECKOUT ITEM
// ==========================================

function createCheckoutItem(item){

    const card =

        document.createElement(
            "article"
        );

    card.className =

        "checkout-item";

        card.innerHTML = `

    <div class="cart-item-image">

        <img

            src="/images/${item.imageUrl}"

            alt="${item.name}"

            onerror="this.src='/images/placeholder.png'"

        >

    </div>

    <div class="cart-item-info">

        <h3>

            ${item.name}

        </h3>

        <p>

            ${CONFIG.currency}${item.price} each

        </p>

    </div>

    <div class="cart-item-right">

        <div class="line-total">

            ${CONFIG.currency}${item.price * item.quantity}

        </div>

        <div class="checkout-quantity">

            <button class="checkout-decrease">

                −

            </button>

            <span class="checkout-quantity-value">

                ${item.quantity}

            </span>

            <button class="checkout-increase">

                +

            </button>

        </div>

    </div>

`;


    const increaseButton =
        card.querySelector(
            ".checkout-increase"
        );

    const decreaseButton =
        card.querySelector(
            ".checkout-decrease"
        );

    increaseButton.addEventListener(

        "click",

        () => {

            increaseQuantity(item.id);


        }

    );

    decreaseButton.addEventListener(

        "click",

        () => {

            decreaseQuantity(item.id);


        }

    );

    return card;

}
