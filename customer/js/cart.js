// ==========================================
// YATHARTH CART ENGINE
// ==========================================


// ==========================================
// CART STATE
// ==========================================

let cart = JSON.parse(

    localStorage.getItem(
        CONFIG.cartStorageKey
    )

) || [];


// ==========================================
// BOTTOM SHEET DOM
// ==========================================

const cartOverlay =
    document.getElementById(
        "cartOverlay"
    );

const cartSheet =
    document.getElementById(
        "cartSheet"
    );

const cartItemsContainer =
    document.getElementById(
        "cartItems"
    );

const sheetTotal =
    document.getElementById(
        "sheetTotal"
    );


    // ==========================================
// OPEN CART
// ==========================================

function openCart(){

    cartOverlay.classList.remove(
        "hidden"
    );

    requestAnimationFrame(() => {

        cartOverlay.classList.add(
            "show"
        );

    });

}


// ==========================================
// CLOSE CART
// ==========================================

function closeCart(){

    cartOverlay.classList.remove(
        "show"
    );

    setTimeout(() => {

        cartOverlay.classList.add(
            "hidden"
        );

    },250);

}

cartOverlay.onclick = (event) => {

    if (event.target === cartOverlay) {

        closeCart();

    }

};


// ==========================================
// SAVE CART
// ==========================================

function saveCart(){

    localStorage.setItem(

        CONFIG.cartStorageKey,
    
        JSON.stringify(cart)
    
    );

}


// ==========================================
// FIND ITEM
// ==========================================

function findItem(id){

    return cart.find(

        item => item.id === id

    );

}


// ==========================================
// ADD ITEM
// ==========================================

function addToCart(item){

    const existing =

        findItem(item.id);

    if(existing){

        existing.quantity++;

    }

    else{

        cart.push({

            ...item,

            quantity:1

        });

    }



    updateCart();

}


// ==========================================
// INCREASE
// ==========================================

function increaseQuantity(id){

    const item =

        findItem(id);

    if(!item) return;

    item.quantity++;


    updateCart();

}


// ==========================================
// DECREASE
// ==========================================

function decreaseQuantity(id){

    const item =

        findItem(id);

    if(!item) return;

    item.quantity--;

    if(item.quantity<=0){

        removeItem(id);

        return;

    }


    updateCart();

}


// ==========================================
// REMOVE ITEM
// ==========================================

function removeItem(id){

    cart = cart.filter(

        item => item.id !== id

    );


    updateCart();

}


// ==========================================
// TOTAL ITEMS
// ==========================================

function totalItems(){

    return cart.reduce(

        (sum,item)=>

            sum+

            item.quantity,

        0

    );

}


// ==========================================
// TOTAL PRICE
// ==========================================

function totalPrice(){

    return cart.reduce(

        (sum,item)=>

            sum+

            item.price*

            item.quantity,

        0

    );

}


// ==========================================
// UPDATE FLOATING CART
// ==========================================

function updateFloatingCart(){

    const items =
        totalItems();

    const total =
        totalPrice();

    cartCount.textContent =
        items;

    cartTotal.textContent =
        `${CONFIG.currency}${total}`;

    if(items===0){

        cartBar.classList.add("empty");

        cartTitle.textContent =
            "Cart Empty";

            cartSubtitle.textContent =
            `Subtotal ${CONFIG.currency}0`;

    }

    else{

        cartBar.classList.remove("empty");

        cartTitle.textContent =
            `${items} Item${items>1?"s":""}`;

            cartSubtitle.textContent =
            `Subtotal ${CONFIG.currency}${total}`;

    }

    animateCart();

}


// ==========================================
// CART BUMP
// ==========================================

function animateCart(){

    cartBar.classList.remove(
        "cart-bump"
    );

    void cartBar.offsetWidth;

    cartBar.classList.add(
        "cart-bump"
    );

}


// ==========================================
// BADGE POP
// ==========================================

function animateBadge(){

    cartCount.classList.remove(
        "pop"
    );

    void cartCount.offsetWidth;

    cartCount.classList.add(
        "pop"
    );

}

// ==========================================
// UPDATE CART
// ==========================================

function updateCart(){

    updateFloatingCart();

    renderBottomSheet();

    animateBadge();

    saveCart();

}

// ==========================================
// RENDER BOTTOM SHEET
// ==========================================

function renderBottomSheet(){

}


// ==========================================
// CREATE CART ITEM
// ==========================================

function createCartItem(item){

}


// ==========================================
// RESTORE CART
// ==========================================

function restoreCart(){

    updateCart();

}

restoreCart();

cartBar.onclick = () => {

    if(totalItems()===0){

        return;

    }

    openCart();

};
