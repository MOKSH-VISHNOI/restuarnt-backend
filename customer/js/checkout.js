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

const estimatedTime =

    document.getElementById(
        "estimatedTime"
    );



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


checkoutOverlay.onclick = (event)=>{

    if(

        event.target===checkoutOverlay

    ){

        closeCheckout();

    }

};


// ==========================================
// RENDER CHECKOUT
// ==========================================

function renderCheckout(){

    checkoutItems.innerHTML="";

    cart.forEach(item=>{

        checkoutItems.appendChild(

            createCheckoutItem(item)

        );

    });

    updateCheckoutTotals();

    updateEstimatedTime();

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
// ESTIMATED TIME
// ==========================================

function updateEstimatedTime(){

    let maxTime = 0;

    cart.forEach(item=>{

        maxTime = Math.max(

            maxTime,

            item.preparationTime

        );

    });

    estimatedTime.textContent =

        `${maxTime} min`;

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

        <img

            src="/images/${item.imageUrl}"

            class="checkout-image"

            alt="${item.name}"

            onerror="this.src='/images/placeholder.png'"

        >

        <div class="checkout-info">

            <h3>

                ${item.name}

            </h3>

            <div class="checkout-price">

                ${CONFIG.currency}${item.price}

            </div>

        </div>

        <div class="checkout-quantity">

            <button

                class="checkout-decrease"

            >

                −

            </button>

            <span

                class="checkout-quantity-value"

            >

                ${item.quantity}

            </span>

            <button

                class="checkout-increase"

            >

                +

            </button>

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


// ==========================================
// ADD MORE ITEMS
// ==========================================

function continueShopping(){

    closeCheckout();

}